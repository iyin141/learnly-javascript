import { Router } from "express";
import { prisma } from "../db.js";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { redis } from "../redis.js";
import { config } from "../config.js";
import type { ReadinessReport } from "@learnly/shared";

export const healthRouter = Router();

healthRouter.get(["/", "/healthz"], (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

healthRouter.get("/readyz", async (_req, res) => {
  const details: Record<string, string> = {};

  // 1. Postgres check
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err: any) {
    details.postgres = err.message || "Failed to check PostgreSQL";
  }

  // 2. Redis check
  let redisOk = false;
  try {
    const pong = await redis.ping();
    redisOk = pong === "PONG";
    if (!redisOk) details.redis = "Ping failed";
  } catch (err: any) {
    details.redis = err.message || "Redis ping failed";
  }

  // 3. S3 / MinIO check
  let s3Ok = false;
  try {
    const s3 = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
    });
    await s3.send(new HeadBucketCommand({ Bucket: config.s3.buckets.uploads }));
    s3Ok = true;
  } catch (err: any) {
    details.s3 = err.message || "S3 bucket check failed";
  }

  // 4. LiveKit check
  let livekitOk = false;
  try {
    // In dev, LiveKit check passes if host responds or livekit configuration is valid
    livekitOk = Boolean(config.livekit.apiKey && config.livekit.apiSecret);
  } catch (err: any) {
    details.livekit = err.message || "LiveKit check failed";
  }

  const allOk = dbOk && redisOk && s3Ok && livekitOk;
  const anyOk = dbOk || redisOk || s3Ok;

  const report: ReadinessReport = {
    status: allOk ? "ok" : anyOk ? "degraded" : "down",
    components: {
      postgres: dbOk,
      redis: redisOk,
      s3: s3Ok,
      livekit: livekitOk,
    },
    details: Object.keys(details).length > 0 ? details : undefined,
    timestamp: new Date().toISOString(),
  };

  const statusCode = allOk ? 200 : anyOk ? 200 : 503;
  res.status(statusCode).json(report);
});
