import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma, isUuid } from "../db.js";
import { logger } from "../logger.js";

export const builderRouter = Router();

// Middleware to verify instructor ownership or admin
async function requireCourseAccess(req: Request, res: Response, next: () => void) {
  const courseId = req.params.courseId || req.params.id;
  if (!courseId) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Course ID is required" } });
  }

  const course = isUuid(courseId) ? await prisma.course.findUnique({ where: { id: courseId } }) : null;
  if (!course) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found" } });
  }

  if (req.user?.role !== "admin" && course.instructorId !== req.user?.id) {
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

    const count = await prisma.section.count({ where: { courseId } });
    const section = await prisma.section.create({ data: { courseId, title, order: count } });

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

    const sectionId = req.params.sectionId;
    const hit = isUuid(sectionId) ? await prisma.section.updateMany({ where: { id: sectionId, courseId: req.params.courseId }, data: parsed }) : { count: 0 };
    const section = hit.count ? await prisma.section.findUnique({ where: { id: sectionId } }) : null;

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

    // lessons go with the section (ON DELETE CASCADE); the count says whether the section existed for this course
    const deleted = isUuid(sectionId) ? await prisma.section.deleteMany({ where: { id: sectionId, courseId } }) : { count: 0 };

    if (!deleted.count) {
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

    const section = isUuid(sectionId) ? await prisma.section.findFirst({ where: { id: sectionId, courseId } }) : null;
    if (!section) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Section not found" } });
    const count = await prisma.lesson.count({ where: { courseId, sectionId } });
    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        sectionId,
        title: parsed.title,
        type: parsed.type,
        durationSeconds: parsed.durationSeconds,
        textContent: parsed.textContent,
        order: count,
        video: { status: parsed.type === "video" ? "uploaded" : "ready" },
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

    const lessonId = req.params.lessonId;
    if (parsed.sectionId && !(isUuid(parsed.sectionId) && (await prisma.section.findFirst({ where: { id: parsed.sectionId, courseId: req.params.courseId } })))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Target section not found" } });
    }
    const hit = isUuid(lessonId) ? await prisma.lesson.updateMany({ where: { id: lessonId, courseId: req.params.courseId }, data: parsed }) : { count: 0 };
    const lesson = hit.count ? await prisma.lesson.findUnique({ where: { id: lessonId } }) : null;

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
    const lessonId = req.params.lessonId;
    const deleted = isUuid(lessonId) ? await prisma.lesson.deleteMany({ where: { id: lessonId, courseId: req.params.courseId } }) : { count: 0 };

    if (!deleted.count) {
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

    const courseId = req.params.courseId;
    const ids = [...(sections ?? []).map((s) => s.id), ...(lessons ?? []).flatMap((l) => [l.id, l.sectionId])];
    if (ids.some((i) => !isUuid(i))) return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid id in reorder payload" } });

    // one transaction: a half-applied reorder would leave the curriculum in a mixed order
    await prisma.$transaction([
      ...(sections ?? []).map((s) => prisma.section.updateMany({ where: { id: s.id, courseId }, data: { order: s.order } })),
      ...(lessons ?? []).map((l) => prisma.lesson.updateMany({ where: { id: l.id, courseId }, data: { sectionId: l.sectionId, order: l.order } })),
    ]);

    res.status(200).json({ message: "Course curriculum reordered successfully" });
  }
);
