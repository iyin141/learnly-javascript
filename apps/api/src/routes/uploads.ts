import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma, isUuid } from "../db.js";
import {
  initMultipartUpload,
  getPartPresignedUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  BUCKETS,
} from "../services/s3.js";
import { enqueueVideoTranscode } from "../services/queue.js";
import { logger } from "../logger.js";

export const uploadsRouter = Router();

// Allowed MIME types per FS-03 (mp4, mov, webm)
const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/x-matroska", // .mkv
];

const InitUploadSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().refine((val) => ALLOWED_VIDEO_MIMES.includes(val), {
    message: "Invalid file type. Allowed: mp4, mov, webm",
  }),
  fileSizeBytes: z.number().max(2 * 1024 * 1024 * 1024, {
    message: "File exceeds 2 GB limit",
  }).optional(),
});

const PartUrlsSchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partNumbers: z.array(z.number().min(1)).min(1),
});

const CompleteUploadSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z.array(
    z.object({
      PartNumber: z.number().min(1),
      ETag: z.string().min(1),
    })
  ).min(1),
});

const AbortUploadSchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
});

/**
 * POST /api/uploads/video/init
 * Initializes S3 multipart upload for an instructor/admin
 */
uploadsRouter.post(
  "/video/init",
  requireAuth,
  requireRole("instructor", "admin"),
  async (req: Request, res: Response) => {
    const parsed = InitUploadSchema.parse(req.body);

    const course = isUuid(parsed.courseId) ? await prisma.course.findUnique({ where: { id: parsed.courseId } }) : null;
    if (!course) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Course not found", requestId: req.id },
      });
    }

    if (req.user?.role !== "admin" && course.instructorId !== req.user?.id) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You are not the instructor of this course", requestId: req.id },
      });
    }

    const lesson = isUuid(parsed.lessonId) ? await prisma.lesson.findFirst({ where: { id: parsed.lessonId, courseId: course.id } }) : null;
    if (!lesson) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Lesson not found", requestId: req.id },
      });
    }

    // Key format: raw/{courseId}/{lessonId}/{timestamp}_{filename}
    const ext = parsed.fileName.split(".").pop() || "mp4";
    const safeKey = `raw/${parsed.courseId}/${parsed.lessonId}/${Date.now()}.${ext}`;

    const { uploadId, key, partSize } = await initMultipartUpload(
      safeKey,
      parsed.contentType,
      BUCKETS.uploads
    );

    // Save initial status
    await prisma.lesson.update({ where: { id: lesson.id }, data: { video: { status: "uploaded", rawUploadKey: key } } });

    res.status(200).json({
      uploadId,
      key,
      partSize,
      message: "Multipart upload initialized",
    });
  }
);

/**
 * POST /api/uploads/video/part-urls
 * Generates presigned URLs for part numbers
 */
uploadsRouter.post(
  "/video/part-urls",
  requireAuth,
  requireRole("instructor", "admin"),
  async (req: Request, res: Response) => {
    const parsed = PartUrlsSchema.parse(req.body);

    const parts = await getPartPresignedUrls(
      parsed.key,
      parsed.uploadId,
      parsed.partNumbers,
      BUCKETS.uploads
    );

    res.status(200).json({ parts });
  }
);

/**
 * POST /api/uploads/video/complete
 * Completes multipart upload and triggers BullMQ transcoding
 */
uploadsRouter.post(
  "/video/complete",
  requireAuth,
  requireRole("instructor", "admin"),
  async (req: Request, res: Response) => {
    const parsed = CompleteUploadSchema.parse(req.body);

    // the caller must own the course the lesson belongs to (this endpoint used to skip that check)
    const lesson = isUuid(parsed.lessonId) && isUuid(parsed.courseId) ? await prisma.lesson.findFirst({ where: { id: parsed.lessonId, courseId: parsed.courseId }, include: { course: true } }) : null;
    if (!lesson) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Lesson not found", requestId: req.id },
      });
    }
    if (req.user?.role !== "admin" && lesson.course.instructorId !== req.user?.id) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You are not the instructor of this course", requestId: req.id },
      });
    }

    // Complete upload on S3
    await completeMultipartUpload(
      parsed.key,
      parsed.uploadId,
      parsed.parts,
      BUCKETS.uploads
    );

    // Update lesson
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { video: { ...((lesson.video as Record<string, unknown> | null) ?? {}), status: "uploaded", rawUploadKey: parsed.key } },
    });

    // Enqueue transcode job
    const job = await enqueueVideoTranscode({
      courseId: parsed.courseId,
      lessonId: parsed.lessonId,
      rawKey: parsed.key,
      bucket: BUCKETS.uploads,
    });

    res.status(200).json({
      success: true,
      status: "uploaded",
      jobId: job.id,
      message: "Upload completed and transcoding job enqueued",
    });
  }
);

/**
 * POST /api/uploads/video/abort
 * Aborts an incomplete multipart upload
 */
uploadsRouter.post(
  "/video/abort",
  requireAuth,
  requireRole("instructor", "admin"),
  async (req: Request, res: Response) => {
    const parsed = AbortUploadSchema.parse(req.body);

    await abortMultipartUpload(parsed.key, parsed.uploadId, BUCKETS.uploads);

    res.status(200).json({
      success: true,
      message: "Multipart upload aborted",
    });
  }
);
