import { prisma, Prisma } from "@learnly/db";
import type { User, Course, Section, Lesson, Enrolment } from "@learnly/db";
import { logger } from "./logger.js";

export { prisma, Prisma };
export type { User, Course, Section, Lesson, Enrolment };

/** Lesson.video JSON column shape (see schema.prisma). */
export interface LessonVideo {
  status?: "uploaded" | "transcoding" | "ready" | "failed";
  durationSeconds?: number;
  renditions?: string[];
  masterPlaylistPath?: string;
  posterPath?: string;
  thumbnailPaths?: string[];
  errorReason?: string;
  rawUploadKey?: string;
}

export const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Fail fast at startup if Postgres is unreachable; Prisma otherwise connects lazily on first query. */
export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Connected to PostgreSQL successfully");
  } catch (err) {
    logger.error({ err }, "PostgreSQL connection failed");
    throw err;
  }
}
