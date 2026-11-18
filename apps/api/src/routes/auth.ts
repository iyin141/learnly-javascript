import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { RegisterRequestSchema, LoginRequestSchema, type User } from "@learnly/shared";
import { prisma, type User as DbUser } from "../db.js";
import { generateAccessToken, createRefreshToken, authenticate } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rate-limiter.js";
import { AppError } from "../middleware/error-handler.js";

export const authRouter = Router();

function formatUser(user: DbUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

function setRefreshTokenCookie(res: Response, token: string, role: string): void {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  // Site-wide "signed in" marker carrying the role (no secret) so the web app's route guard can pick pages per role.
  // The API still checks the role on every request.
  res.cookie("session", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.clearCookie("session", { path: "/" });
}

authRouter.post("/register", authRateLimiter, async (req: Request, res: Response) => {
  const body = RegisterRequestSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) {
    throw new AppError(409, "EMAIL_EXISTS", "A user with this email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(body.password, salt);

  let user;
  try {
    user = await prisma.user.create({ data: { name: body.name, email: body.email.toLowerCase(), passwordHash, role: body.role } });
  } catch (e: any) {
    // two simultaneous registrations with the same email: the unique index decides, the loser gets the normal 409
    if (e?.code === "P2002") throw new AppError(409, "EMAIL_EXISTS", "A user with this email already exists");
    throw e;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshToken(user);
  setRefreshTokenCookie(res, refreshToken, user.role);

  res.status(201).json({
    user: formatUser(user),
    accessToken,
  });
});

authRouter.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  const body = LoginRequestSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isMatch = await bcrypt.compare(body.password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshToken(user);
  setRefreshTokenCookie(res, refreshToken, user.role);

  res.json({
    user: formatUser(user),
    accessToken,
  });
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new AppError(401, "NO_REFRESH_TOKEN", "Refresh token cookie missing");
  }

  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    if (storedToken && storedToken.revoked) {
      // Possible reuse attack: revoke all tokens for this user
      await prisma.refreshToken.updateMany({ where: { userId: storedToken.userId }, data: { revoked: true } });
    }
    clearAuthCookies(res);
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
  if (!user) {
    clearAuthCookies(res);
    throw new AppError(401, "USER_NOT_FOUND", "User associated with token no longer exists");
  }

  // Rotate token: revoke old one, create new one
  // conditional update: if two refreshes race with the same token only one wins
  const rotated = await prisma.refreshToken.updateMany({ where: { id: storedToken.id, revoked: false }, data: { revoked: true } });
  if (rotated.count !== 1) {
    clearAuthCookies(res);
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const newRefreshToken = await createRefreshToken(user);
  const newAccessToken = generateAccessToken(user);
  setRefreshTokenCookie(res, newRefreshToken, user.role);

  res.json({
    user: formatUser(user),
    accessToken: newAccessToken,
  });
});

authRouter.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
  }
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

authRouter.get("/me", authenticate, (req: Request, res: Response) => {
  res.json({ user: formatUser(req.user!) });
});
