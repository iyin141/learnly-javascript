import { config } from "../config.js";
import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma, isUuid, type LessonVideo } from "../db.js";
import { getCdnSigner } from "../services/cdn.js";
import { evaluateCompletion } from "../services/learning.js";

export const lessonsRouter = Router();

const findLesson = (id: string) => (isUuid(id) ? prisma.lesson.findUnique({ where: { id } }) : Promise.resolve(null));
const videoOf = (l: { video: unknown }) => (l.video ?? undefined) as LessonVideo | undefined;
const notFound = (req: Request, res: Response, what: string) =>
  res.status(404).json({ error: { code: "NOT_FOUND", message: `${what} not found`, requestId: req.id } });

/**
 * GET /api/lessons/:id/playback
 * Returns signed HLS playback URL & sets signed cookie for CDN segments
 * Enforces course enrolment (students must be enrolled; instructors/admins allowed)
 */
lessonsRouter.get("/:id/playback", requireAuth, async (req: Request, res: Response) => {
  const lesson = await findLesson(req.params.id);
  if (!lesson) return notFound(req, res, "Lesson");

  const course = await prisma.course.findUnique({ where: { id: lesson.courseId } });
  if (!course) return notFound(req, res, "Course");

  // Check enrollment / ownership
  const isInstructor = req.user?.role === "instructor" && course.instructorId === req.user?.id;
  const isAdmin = req.user?.role === "admin";

  let enrolment: Awaited<ReturnType<typeof prisma.enrolment.findUnique>> = null;
  if (!isInstructor && !isAdmin) {
    enrolment = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: lesson.courseId } } });
    if (!enrolment) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You must be enrolled in this course to access playback", requestId: req.id },
      });
    }
  }

  // If lesson is not a video or video is not ready
  const video = videoOf(lesson);
  if (lesson.type === "video" && video?.status !== "ready") {
    return res.status(400).json({
      error: { code: "VIDEO_NOT_READY", message: `Video is currently in state: ${video?.status || "uploaded"}`, requestId: req.id },
    });
  }

  const playlistKey = video?.masterPlaylistPath || `hls/${lesson.courseId}/${lesson.id}/master.m3u8`;

  const signer = getCdnSigner();
  const signed = signer.signPlayback(`/cdn/${playlistKey}`);

  // Set signed CDN cookies for seamless segment playback in HLS.js
  res.cookie("cdn_md5", signed.token, { path: "/cdn/hls/", expires: new Date(signed.expires * 1000), sameSite: "lax" });
  res.cookie("cdn_expires", String(signed.expires), { path: "/cdn/hls/", expires: new Date(signed.expires * 1000), sameSite: "lax" });

  for (const c of signed.cookies ?? []) {
    res.cookie(c.name, c.value, { path: "/", domain: config.cdn.cloudfront.cookieDomain, expires: new Date(signed.expires * 1000), secure: true, sameSite: "none", httpOnly: true });
  }

  res.status(200).json({
    playbackUrl: signed.url,
    expiresAt: signed.expires,
    lastPositionSeconds: enrolment?.lastPositionSeconds || 0,
    isCompleted: enrolment?.completedLessons?.includes(lesson.id) || false,
    durationSeconds: lesson.durationSeconds || video?.durationSeconds || 0,
    renditions: video?.renditions || ["360p", "720p"],
  });
});

/**
 * POST /api/lessons/:id/progress
 * Heartbeat every 10 seconds: saves lastPositionSeconds,
 * and auto-marks lesson complete when position >= 90% of duration.
 */
lessonsRouter.post("/:id/progress", requireAuth, async (req: Request, res: Response) => {
  const { positionSeconds } = z.object({ positionSeconds: z.number().min(0) }).parse(req.body);

  const lesson = await findLesson(req.params.id);
  if (!lesson) return notFound(req, res, "Lesson");

  const enrolment = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: lesson.courseId } } });
  if (!enrolment) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Enrolment required to track progress" } });
  }

  // Rule: mark complete if >= 90% watched
  const duration = lesson.durationSeconds || videoOf(lesson)?.durationSeconds || 0;
  const alreadyCompleted = enrolment.completedLessons.includes(lesson.id);
  const newlyCompleted = !alreadyCompleted && duration > 0 && positionSeconds >= 0.9 * duration;

  const data: { lastPositionSeconds: number; lastLessonId: string; completedLessons?: string[]; progressPercent?: number; status?: "completed" } = {
    lastPositionSeconds: Math.round(positionSeconds),
    lastLessonId: lesson.id,
  };
  if (newlyCompleted) {
    const completed = [...new Set([...enrolment.completedLessons, lesson.id])];
    data.completedLessons = completed;
    const totalLessons = await prisma.lesson.count({ where: { courseId: lesson.courseId } });
    if (totalLessons > 0) {
      data.progressPercent = Math.min(100, Math.round((completed.length / totalLessons) * 100));
      if (data.progressPercent === 100) data.status = "completed";
    }
  }

  const saved = await prisma.enrolment.update({ where: { id: enrolment.id }, data });
  if (newlyCompleted) await evaluateCompletion(saved.userId, saved.courseId);

  res.status(200).json({
    success: true,
    progressPercent: saved.progressPercent,
    completed: alreadyCompleted || newlyCompleted,
    lastPositionSeconds: saved.lastPositionSeconds,
  });
});

/**
 * POST /api/lessons/:id/complete
 * Manual "Mark as complete" (text/file lessons, or video watched elsewhere).
 */
lessonsRouter.post("/:id/complete", requireAuth, async (req: Request, res: Response) => {
  const lesson = await findLesson(req.params.id);
  if (!lesson) return notFound(req, res, "Lesson");
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: lesson.courseId } } });
  if (!enrolment) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Enrolment required", requestId: req.id } });
  }
  if (!enrolment.completedLessons.includes(lesson.id)) {
    await prisma.enrolment.update({ where: { id: enrolment.id }, data: { completedLessons: [...enrolment.completedLessons, lesson.id], lastLessonId: lesson.id } });
  }
  const result = await evaluateCompletion(enrolment.userId, enrolment.courseId);
  const fresh = await prisma.enrolment.findUnique({ where: { id: enrolment.id } });
  res.json({ progressPercent: fresh?.progressPercent ?? 0, certificateIssued: result.issued });
});
