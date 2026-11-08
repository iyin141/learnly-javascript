import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { CourseModel, LessonModel, EnrolmentModel } from "../db.js";
import { getCdnSigner } from "../services/cdn.js";
import { logger } from "../logger.js";
import { evaluateCompletion } from "../services/learning.js";

export const lessonsRouter = Router();

/**
 * GET /api/lessons/:id/playback
 * Returns signed HLS playback URL & sets signed cookie for CDN segments
 * Enforces course enrolment (students must be enrolled; instructors/admins allowed)
 */
lessonsRouter.get("/:id/playback", requireAuth, async (req: Request, res: Response) => {
  const lessonId = req.params.id;

  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lesson not found", requestId: req.id },
    });
  }

  const course = await CourseModel.findById(lesson.courseId);
  if (!course) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Course not found", requestId: req.id },
    });
  }

  // Check enrollment / ownership
  const isInstructor =
    req.user?.role === "instructor" && String(course.instructorId) === String(req.user?._id);
  const isAdmin = req.user?.role === "admin";

  let enrolment = null;
  if (!isInstructor && !isAdmin) {
    enrolment = await EnrolmentModel.findOne({
      userId: req.user?._id,
      courseId: lesson.courseId,
    });

    if (!enrolment) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You must be enrolled in this course to access playback",
          requestId: req.id,
        },
      });
    }
  }

  // If lesson is not a video or video is not ready
  if (lesson.type === "video" && lesson.video?.status !== "ready") {
    return res.status(400).json({
      error: {
        code: "VIDEO_NOT_READY",
        message: `Video is currently in state: ${lesson.video?.status || "uploaded"}`,
        requestId: req.id,
      },
    });
  }

  const playlistKey =
    lesson.video?.masterPlaylistPath ||
    `hls/${lesson.courseId}/${lesson._id}/master.m3u8`;

  const signer = getCdnSigner();
  const signed = signer.signPlayback(`/cdn/${playlistKey}`);

  // Set signed CDN cookies for seamless segment playback in HLS.js
  res.cookie("cdn_md5", signed.token, {
    path: "/cdn/hls/",
    expires: new Date(signed.expires * 1000),
    sameSite: "lax",
  });
  res.cookie("cdn_expires", String(signed.expires), {
    path: "/cdn/hls/",
    expires: new Date(signed.expires * 1000),
    sameSite: "lax",
  });

  const isCompleted =
    enrolment?.completedLessons?.some((id) => String(id) === String(lesson._id)) || false;

  res.status(200).json({
    playbackUrl: signed.url,
    expiresAt: signed.expires,
    lastPositionSeconds: enrolment?.lastPositionSeconds || 0,
    isCompleted,
    durationSeconds: lesson.durationSeconds || lesson.video?.durationSeconds || 0,
    renditions: lesson.video?.renditions || ["360p", "720p"],
  });
});

/**
 * POST /api/lessons/:id/progress
 * Heartbeat every 10 seconds: saves lastPositionSeconds,
 * and auto-marks lesson complete when position >= 90% of duration.
 */
lessonsRouter.post("/:id/progress", requireAuth, async (req: Request, res: Response) => {
  const lessonId = req.params.id;
  const { positionSeconds } = z
    .object({ positionSeconds: z.number().min(0) })
    .parse(req.body);

  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lesson not found", requestId: req.id },
    });
  }

  const enrolment = await EnrolmentModel.findOne({
    userId: req.user?._id,
    courseId: lesson.courseId,
  });

  if (!enrolment) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Enrolment required to track progress" },
    });
  }

  enrolment.lastPositionSeconds = positionSeconds;
  enrolment.lastLessonId = lesson._id as any;

  // Rule: mark complete if >= 90% watched
  const duration = lesson.durationSeconds || lesson.video?.durationSeconds || 0;
  let newlyCompleted = false;

  const alreadyCompleted = enrolment.completedLessons.some(
    (id) => String(id) === String(lesson._id)
  );

  if (!alreadyCompleted && duration > 0 && positionSeconds >= 0.9 * duration) {
    enrolment.completedLessons.push(lesson._id as any);
    newlyCompleted = true;

    // Recalculate course completion percentage
    const totalLessons = await LessonModel.countDocuments({ courseId: lesson.courseId });
    if (totalLessons > 0) {
      enrolment.progressPercent = Math.min(
        100,
        Math.round((enrolment.completedLessons.length / totalLessons) * 100)
      );
      if (enrolment.progressPercent === 100) {
        enrolment.status = "completed";
      }
    }
  }

  await enrolment.save();
  if (newlyCompleted) await evaluateCompletion(enrolment.userId, enrolment.courseId);

  res.status(200).json({
    success: true,
    progressPercent: enrolment.progressPercent,
    completed: alreadyCompleted || newlyCompleted,
    lastPositionSeconds: enrolment.lastPositionSeconds,
  });
});

/**
 * POST /api/lessons/:id/complete
 * Manual "Mark as complete" (text/file lessons, or video watched elsewhere).
 */
lessonsRouter.post("/:id/complete", requireAuth, async (req: Request, res: Response) => {
  const lesson = await LessonModel.findById(req.params.id);
  if (!lesson) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Lesson not found", requestId: req.id } });
  }
  const enrolment = await EnrolmentModel.findOne({ userId: req.user?._id, courseId: lesson.courseId });
  if (!enrolment) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Enrolment required", requestId: req.id } });
  }
  if (!enrolment.completedLessons.some((id) => String(id) === String(lesson._id))) {
    enrolment.completedLessons.push(lesson._id as any);
    enrolment.lastLessonId = lesson._id as any;
    await enrolment.save();
  }
  const result = await evaluateCompletion(enrolment.userId, enrolment.courseId);
  const fresh = await EnrolmentModel.findById(enrolment._id);
  res.json({ progressPercent: fresh?.progressPercent ?? 0, certificateIssued: result.issued });
});
