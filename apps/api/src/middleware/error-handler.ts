import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger.js";
import type { ApiErrorResponse } from "@learnly/shared";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.flatten(),
        requestId,
      },
    };
    res.status(400).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  logger.error({ err, path: req.path, requestId }, "Unhandled application error");

  const response: ApiErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  };
  res.status(500).json(response);
}
