import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { coursesRouter } from "./routes/courses.js";
import { docsRouter } from "./routes/docs.js";
import { uploadsRouter } from "./routes/uploads.js";
import { builderRouter } from "./routes/builder.js";
import { adminQueuesRouter } from "./routes/admin-queues.js";
import { lessonsRouter } from "./routes/lessons.js";

export function createApp(): express.Application {
  const app = express();

  // Basic middleware
  app.use(
    cors({
      origin: [
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
      ],
      credentials: true,
      exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req: any) => req.requestId,
      autoLogging: {
        ignore: (req: any) => req.url?.startsWith("/api/healthz") || req.url?.startsWith("/healthz"),
      },
    })
  );

  // Routes
  app.use("/api", healthRouter);
  app.use("/healthz", healthRouter);
  app.use("/readyz", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/courses", builderRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/lessons", lessonsRouter);
  app.use(adminQueuesRouter);
  app.use("/api/my-courses", (req, res, next) => {
    // Forward /api/my-courses to courses router
    req.url = "/user/enrolled" + (req.url.startsWith("/") ? req.url.slice(1) : req.url);
    coursesRouter(req, res, next);
  });
  app.use("/api/docs", docsRouter);

  // Central error handling
  app.use(errorHandler);

  return app;
}
