import rateLimit from "express-rate-limit";
import { AppError } from "./error-handler.js";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, _res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    throw new AppError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many login or registration attempts. Please try again later.",
      { retryAfter }
    );
  },
});

/** Blanket limiter for every /api route. Per-IP, 300 requests a minute. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT || "300", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/healthz") || req.path.startsWith("/readyz"),
  handler: (_req, _res, _next, options) => {
    throw new AppError(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Slow down.", { retryAfter: Math.ceil(options.windowMs / 1000) });
  },
});
