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

  // name check as well as instanceof: the shared package and the api can resolve different copies of zod
  if (err instanceof ZodError || (err as { name?: string })?.name === "ZodError") {
    const response: ApiErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: (err as ZodError).flatten(),
        requestId,
      },
    };
    res.status(400).json(response);
    return;
  }

  // body-parser failures: malformed JSON and oversized bodies are the client's fault, not a 500
  const bp = err as { type?: string; status?: number };
  if (bp?.type === "entity.parse.failed" || bp?.type === "entity.too.large") {
    const tooLarge = bp.type === "entity.too.large";
    res.status(tooLarge ? 413 : 400).json({ error: { code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON", message: tooLarge ? "Request body is too large" : "Request body is not valid JSON", requestId } });
    return;
  }

  // Prisma: malformed id, missing row and unique-key races become ordinary client errors instead of 500s
  const pc = (err as { code?: string; name?: string })?.code;
  if ((err as { name?: string })?.name === "PrismaClientKnownRequestError") {
    const map: Record<string, [number, string, string]> = {
      P2023: [400, "INVALID_ID", "Invalid id format"],
      P2025: [404, "NOT_FOUND", "Record not found"],
      P2002: [409, "CONFLICT", "A record with these values already exists"],
      P2003: [409, "CONFLICT", "Related record is missing or still in use"],
    };
    const hit = pc ? map[pc] : undefined;
    if (hit) {
      res.status(hit[0]).json({ error: { code: hit[1], message: hit[2], requestId } });
      return;
    }
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
