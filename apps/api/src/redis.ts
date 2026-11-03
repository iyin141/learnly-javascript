import { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.warn({ err }, "Redis connection error");
});

export async function connectRedis(): Promise<void> {
  try {
    if (redis.status === "wait" || redis.status === "close") {
      await redis.connect();
      logger.info("Connected to Redis successfully");
    }
  } catch (err) {
    logger.warn({ err }, "Redis connect warning, continuing gracefully");
  }
}
