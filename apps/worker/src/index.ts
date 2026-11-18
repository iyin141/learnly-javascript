import { Worker, Job } from "bullmq";
import pino from "pino";
import { VideoTranscoder, TranscodeJobData } from "./transcoder.js";
import { prisma, Prisma } from "@learnly/db";
import { startNotificationWorkers } from "./notifications.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const redisUrl = new URL(process.env.REDIS_URL || "redis://127.0.0.1:6379");
const connection = {
  host: redisUrl.hostname || "127.0.0.1",
  port: parseInt(redisUrl.port || "6379", 10),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

const transcoder = new VideoTranscoder();

/** Merge fields into the lesson.video JSON column (read-modify-write; one worker owns a lesson at a time). */
async function patchLesson(lessonId: string, video: Record<string, unknown>, extra: Prisma.LessonUpdateInput = {}) {
  const cur = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { video: true } });
  if (!cur) throw new Error(`lesson ${lessonId} no longer exists`);
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { ...extra, video: { ...((cur.video as Record<string, unknown> | null) ?? {}), ...video } as Prisma.InputJsonObject },
  });
}

async function startWorker() {
  logger.info("Initializing Learnly Video Worker...");

  await prisma.$connect();
  logger.info("Connected to PostgreSQL");

  const worker = new Worker(
    "video",
    async (job: Job<TranscodeJobData>) => {
      logger.info({ jobId: job.id, data: job.data }, "Processing video transcode job");

      const { lessonId, courseId } = job.data;

      // Update lesson status to transcoding
      await patchLesson(lessonId, { status: "transcoding" });

      try {
        const result = await transcoder.process(job.data, async (progress) => {
          await job.updateProgress(progress);
        });

        // Update lesson status to ready
        await patchLesson(
          lessonId,
          {
            status: "ready",
            durationSeconds: result.durationSeconds,
            renditions: result.renditions,
            masterPlaylistPath: result.masterPlaylistPath,
            posterPath: result.posterPath,
            thumbnailPaths: result.thumbnailPaths,
          },
          { durationSeconds: Math.round(result.durationSeconds) }
        );

        logger.info(
          { lessonId, duration: result.durationSeconds },
          "Video transcoding successfully completed and lesson updated"
        );

        return result;
      } catch (err: any) {
        logger.error({ err, lessonId }, "Transcoding failed for lesson");
        await patchLesson(lessonId, { status: "failed", errorReason: err.message || "Transcoding failed" }).catch((e) => logger.error({ e }, "could not record failure"));
        throw err;
      }
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "1", 10),
    }
  );

  const extra = startNotificationWorkers(connection);

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Job completed successfully");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Job failed");
  });

  logger.info("Learnly Video Worker is running and waiting for jobs on queue 'video' (concurrency: 1)...");

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info("Worker shutting down...");
    await worker.close();
    await Promise.all(extra.map((w) => w.close()));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker().catch((err) => {
  logger.error({ err }, "Fatal error starting worker");
  process.exit(1);
});
