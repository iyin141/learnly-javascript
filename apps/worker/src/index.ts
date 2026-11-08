import { Worker, Job } from "bullmq";
import mongoose from "mongoose";
import pino from "pino";
import { VideoTranscoder, TranscodeJobData } from "./transcoder.js";
import { LessonModel, connectDB } from "../../api/src/db.js";
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

async function startWorker() {
  logger.info("Initializing Learnly Video Worker...");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/learnly";
  await mongoose.connect(mongoUri);
  logger.info("Connected to MongoDB at %s", mongoUri);

  const worker = new Worker(
    "video",
    async (job: Job<TranscodeJobData>) => {
      logger.info({ jobId: job.id, data: job.data }, "Processing video transcode job");

      const { lessonId, courseId } = job.data;

      // Update lesson status to transcoding
      await LessonModel.findByIdAndUpdate(lessonId, {
        $set: { "video.status": "transcoding" },
      });

      try {
        const result = await transcoder.process(job.data, async (progress) => {
          await job.updateProgress(progress);
        });

        // Update lesson status to ready
        await LessonModel.findByIdAndUpdate(lessonId, {
          $set: {
            "video.status": "ready",
            "video.durationSeconds": result.durationSeconds,
            "video.renditions": result.renditions,
            "video.masterPlaylistPath": result.masterPlaylistPath,
            "video.posterPath": result.posterPath,
            "video.thumbnailPaths": result.thumbnailPaths,
            durationSeconds: result.durationSeconds,
          },
        });

        logger.info(
          { lessonId, duration: result.durationSeconds },
          "Video transcoding successfully completed and lesson updated"
        );

        return result;
      } catch (err: any) {
        logger.error({ err, lessonId }, "Transcoding failed for lesson");
        await LessonModel.findByIdAndUpdate(lessonId, {
          $set: {
            "video.status": "failed",
            "video.errorReason": err.message || "Transcoding failed",
          },
        });
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
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker().catch((err) => {
  logger.error({ err }, "Fatal error starting worker");
  process.exit(1);
});
