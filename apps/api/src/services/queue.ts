import { Queue } from "bullmq";
import { config } from "../config.js";
import { logger } from "../logger.js";

// Parse Redis connection details for BullMQ
const redisUrl = new URL(config.redisUrl);
export const bullRedisConnection = {
  host: redisUrl.hostname || "127.0.0.1",
  port: parseInt(redisUrl.port || "6379", 10),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

// Queues defined in FS-03 prompt
export const videoQueue = new Queue("video", {
  connection: bullRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400, // keep 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // keep 7 days
    },
  },
});

export const emailQueue = new Queue("email", {
  connection: bullRedisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
  },
});

export const certificateQueue = new Queue("certificate", {
  connection: bullRedisConnection,
});

export const remindersQueue = new Queue("reminders", {
  connection: bullRedisConnection,
});

export interface VideoTranscodeJobPayload {
  courseId: string;
  lessonId: string;
  rawKey: string;
  bucket: string;
}

export async function enqueueVideoTranscode(payload: VideoTranscodeJobPayload) {
  const job = await videoQueue.add("video:transcode", payload, {
    jobId: `transcode-${payload.lessonId}`,
  });
  logger.info({ jobId: job.id, lessonId: payload.lessonId }, "Enqueued video:transcode job");
  return job;
}
