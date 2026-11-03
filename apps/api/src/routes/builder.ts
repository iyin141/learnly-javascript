import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { CourseModel, SectionModel, LessonModel } from "../db.js";
import { logger } from "../logger.js";

export const builderRouter = Router();

// Middleware to verify instructor ownership or admin
async function requireCourseAccess(req: Request, res: Response, next: () => void) {
  const courseId = req.params.courseId || req.params.id;
  if (!courseId) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Course ID is required" } });
  }

  const course = await CourseModel.findById(courseId);
  if (!course) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found" } });
  }

  if (req.user?.role !== "admin" && String(course.instructorId) !== String(req.user?._id)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Not permitted to edit this course" } });
  }

  (req as any).course = course;
  next();
}

/**
 * POST /api/courses/:courseId/sections
 * Create a new section
 */
builderRouter.post(
  "/:courseId/sections",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
    const courseId = req.params.courseId;

    const count = await SectionModel.countDocuments({ courseId });
    const section = await SectionModel.create({
      courseId,
      title,
      order: count,
    });

    res.status(201).json({ section });
  }
);

/**
 * PUT /api/courses/:courseId/sections/:sectionId
 * Update section title or order
 */
builderRouter.put(
  "/:courseId/sections/:sectionId",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const schema = z.object({
      title: z.string().min(1).optional(),
      order: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);

    const section = await SectionModel.findOneAndUpdate(
      { _id: req.params.sectionId, courseId: req.params.courseId },
      { $set: parsed },
      { new: true }
    );

    if (!section) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Section not found" } });
    }

    res.status(200).json({ section });
  }
);

/**
 * DELETE /api/courses/:courseId/sections/:sectionId
 * Delete section and its lessons
 */
builderRouter.delete(
  "/:courseId/sections/:sectionId",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const { courseId, sectionId } = req.params;

    await LessonModel.deleteMany({ courseId, sectionId });
    const deleted = await SectionModel.findOneAndDelete({ _id: sectionId, courseId });

    if (!deleted) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Section not found" } });
    }

    res.status(200).json({ message: "Section and its lessons deleted" });
  }
);

/**
 * POST /api/courses/:courseId/sections/:sectionId/lessons
 * Create a new lesson
 */
builderRouter.post(
  "/:courseId/sections/:sectionId/lessons",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const { courseId, sectionId } = req.params;
    const schema = z.object({
      title: z.string().min(1),
      type: z.enum(["video", "text", "file"]).default("video"),
      durationSeconds: z.number().int().default(0),
      textContent: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const count = await LessonModel.countDocuments({ courseId, sectionId });
    const lesson = await LessonModel.create({
      courseId,
      sectionId,
      title: parsed.title,
      type: parsed.type,
      durationSeconds: parsed.durationSeconds,
      textContent: parsed.textContent,
      order: count,
      video: {
        status: parsed.type === "video" ? "uploaded" : "ready",
      },
    });

    res.status(201).json({ lesson });
  }
);

/**
 * PUT /api/courses/:courseId/lessons/:lessonId
 * Update lesson
 */
builderRouter.put(
  "/:courseId/lessons/:lessonId",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const schema = z.object({
      title: z.string().min(1).optional(),
      type: z.enum(["video", "text", "file"]).optional(),
      durationSeconds: z.number().int().optional(),
      textContent: z.string().optional(),
      order: z.number().int().optional(),
      sectionId: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const lesson = await LessonModel.findOneAndUpdate(
      { _id: req.params.lessonId, courseId: req.params.courseId },
      { $set: parsed },
      { new: true }
    );

    if (!lesson) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Lesson not found" } });
    }

    res.status(200).json({ lesson });
  }
);

/**
 * DELETE /api/courses/:courseId/lessons/:lessonId
 * Delete a lesson
 */
builderRouter.delete(
  "/:courseId/lessons/:lessonId",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const deleted = await LessonModel.findOneAndDelete({
      _id: req.params.lessonId,
      courseId: req.params.courseId,
    });

    if (!deleted) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Lesson not found" } });
    }

    res.status(200).json({ message: "Lesson deleted" });
  }
);

/**
 * PUT /api/courses/:courseId/reorder
 * Batch reorder sections and lessons
 */
builderRouter.put(
  "/:courseId/reorder",
  requireAuth,
  requireRole("instructor", "admin"),
  requireCourseAccess,
  async (req: Request, res: Response) => {
    const ReorderSchema = z.object({
      sections: z.array(
        z.object({
          id: z.string(),
          order: z.number(),
        })
      ).optional(),
      lessons: z.array(
        z.object({
          id: z.string(),
          sectionId: z.string(),
          order: z.number(),
        })
      ).optional(),
    });

    const { sections, lessons } = ReorderSchema.parse(req.body);

    if (sections) {
      await Promise.all(
        sections.map((s) =>
          SectionModel.updateOne({ _id: s.id, courseId: req.params.courseId }, { $set: { order: s.order } })
        )
      );
    }

    if (lessons) {
      await Promise.all(
        lessons.map((l) =>
          LessonModel.updateOne(
            { _id: l.id, courseId: req.params.courseId },
            { $set: { sectionId: l.sectionId, order: l.order } }
          )
        )
      );
    }

    res.status(200).json({ message: "Course curriculum reordered successfully" });
  }
);
