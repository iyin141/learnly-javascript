import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config.js";
import { AppError } from "./error-handler.js";
import { UserModel, RefreshTokenModel, type IUser } from "../db.js";
import type { UserRole } from "@learnly/shared";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export function generateAccessToken(user: IUser): string {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: "15m" });
}

export async function createRefreshToken(user: IUser): Promise<string> {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await RefreshTokenModel.create({
    token,
    userId: user._id,
    expiresAt,
    revoked: false,
  });

  return token;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization token");
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found or deactivated");
    }
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "TOKEN_EXPIRED_OR_INVALID", "Access token is invalid or expired");
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
    const user = await UserModel.findById(decoded.userId);
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid optional tokens
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", `Access requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}
