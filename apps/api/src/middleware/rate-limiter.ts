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
