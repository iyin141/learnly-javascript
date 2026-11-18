import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { LiveSessionInfo } from "@learnly/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { prisma, isUuid } from "../db.js";
import type { LiveSession } from "@learnly/db";
import { config } from "../config.js";
import { redis } from "../redis.js";
import { logger } from "../logger.js";
import { emailQueue, remindersQueue } from "../services/queue.js";

export const liveRouter = Router();

const lkHttp = config.livekit.url.replace(/^ws/, "http");
const rooms = () => new RoomServiceClient(lkHttp, config.livekit.apiKey, config.livekit.apiSecret);
const oid = (v: string) => {
  if (!isUuid(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

async function view(s: LiveSession, userId?: string): Promise<LiveSessionInfo> {
  const course = await prisma.course.findUnique({ where: { id: s.courseId }, include: { instructor: { select: { name: true } } } });
  return {
    id: s.id,
    courseId: s.courseId,
    courseTitle: course?.title ?? "",
    title: s.title,
    code: s.code,
    instructorId: s.instructorId,
    instructorName: course?.instructor?.name ?? "Instructor",
    startsAt: s.startsAt.toISOString(),
    durationMinutes: s.durationMinutes,
    status: s.status,
    recording: s.recording,
    isHost: userId ? s.instructorId === userId : false,
  };
}

/** Throws unless the user is the instructor, an admin, or enrolled. Returns whether they are staff. */
async function access(req: Request, session: LiveSession): Promise<boolean> {
  const u = req.user!;
  if (u.role === "admin" || session.instructorId === u.id) return true;
  if (!(await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: u.id, courseId: session.courseId } }, select: { id: true } })))
    throw new AppError(403, "FORBIDDEN", "You must be enrolled in this course to join");
  return false;
}
const host = (req: Request, s: LiveSession) => {
  if (req.user!.role !== "admin" && s.instructorId !== req.user!.id) throw new AppError(403, "FORBIDDEN", "Only the host can do this");
};
async function load(id: string) {
  const s = await prisma.liveSession.findUnique({ where: { id: oid(id) } });
  if (!s) throw new AppError(404, "NOT_FOUND", "Session not found");
  return s;
}

// List sessions the user can see: their enrolled courses, or the ones they teach.
liveRouter.get("/live", requireAuth, async (req: Request, res: Response) => {
  const u = req.user!;
  let courseFilter: object;
  if (u.role === "admin") courseFilter = {};
  else if (u.role === "instructor") courseFilter = { course: { instructorId: u.id } };
  else courseFilter = { course: { enrolments: { some: { userId: u.id } } } };
  const since = new Date(Date.now() - 24 * 3600_000);
  const sessions = await prisma.liveSession.findMany({
    where: { ...courseFilter, OR: [{ status: "live" }, { startsAt: { gte: since } }] },
    orderBy: { startsAt: "asc" },
  });
  res.json({ sessions: await Promise.all(sessions.map((s) => view(s, u.id))) });
});

liveRouter.post("/live/join-by-code", requireAuth, async (req: Request, res: Response) => {
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const s = await prisma.liveSession.findUnique({ where: { code: code.trim().toLowerCase().split("/").pop() ?? "" } });
  if (!s) throw new AppError(404, "NOT_FOUND", "No class matches that code");
  await access(req, s);
  res.json({ session: await view(s, req.user!.id) });
});

liveRouter.post("/courses/:courseId/live", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: oid(req.params.courseId) } });
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && course.instructorId !== req.user!.id) throw new AppError(403, "FORBIDDEN", "Not your course");
  const body = z.object({ title: z.string().min(1), startsAt: z.string().datetime(), durationMinutes: z.number().int().min(5).max(480).default(60), recording: z.boolean().default(false) }).parse(req.body);
  const slug = course.code.toLowerCase().replace(/\s+/g, "");
  const s = await prisma.liveSession.create({
    data: {
      title: body.title,
      durationMinutes: body.durationMinutes,
      recording: body.recording,
      startsAt: new Date(body.startsAt),
      courseId: course.id,
      instructorId: course.instructorId,
      code: `${slug}-${crypto.randomBytes(2).toString("hex")}`,
    },
  });
  // reminder job 15 minutes before start
  const delay = s.startsAt.getTime() - 15 * 60_000 - Date.now();
  if (delay > 0) await remindersQueue.add("class-reminder", { sessionId: s.id }, { delay, jobId: `reminder-${s.id}` }).catch((err) => logger.warn({ err }, "reminder enqueue failed"));
  res.status(201).json({ session: await view(s, req.user!.id) });
});

liveRouter.get("/live/:id", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  await access(req, s);
  res.json({ session: await view(s, req.user!.id) });
});

liveRouter.post("/live/:id/start", requireAuth, async (req: Request, res: Response) => {
  let s = await load(req.params.id);
  host(req, s);
  if (s.status === "ended") throw new AppError(409, "SESSION_ENDED", "This class has ended");
  s = await prisma.liveSession.update({ where: { id: s.id }, data: { status: "live", startedAt: s.startedAt ?? new Date() } });
  await redis.set(`live:${s.id}:state`, "live", "EX", 24 * 3600).catch(() => undefined);
  try {
    await rooms().createRoom({ name: s.id, emptyTimeout: 600 });
  } catch (err) {
    logger.warn({ err }, "livekit createRoom failed (token join will create it on demand)");
  }
  // notify enrolled students by email (captured by Mailpit) and socket
  const enrolments = await prisma.enrolment.findMany({ where: { courseId: s.courseId }, include: { user: { select: { email: true } } } });
  for (const e of enrolments) {
    if (e.user?.email) await emailQueue.add("class-live", { to: e.user.email, subject: `Class started: ${s.title}`, text: `${s.title} is live now. Join at /live/${s.id}` }).catch(() => undefined);
  }
  req.app.get("io")?.emit("live:started", { sessionId: s.id, title: s.title });
  res.json({ session: await view(s, req.user!.id) });
});

liveRouter.post("/live/:id/end", requireAuth, async (req: Request, res: Response) => {
  let s = await load(req.params.id);
  host(req, s);
  const endedAt = new Date();
  s = await prisma.liveSession.update({ where: { id: s.id }, data: { status: "ended", endedAt } });
  await prisma.attendance.updateMany({ where: { sessionId: s.id, leftAt: null }, data: { leftAt: endedAt } });
  await redis.del(`live:${s.id}:state`).catch(() => undefined);
  await rooms().deleteRoom(s.id).catch((err) => logger.warn({ err }, "livekit deleteRoom failed"));
  req.app.get("io")?.to(`live:${s.id}`).emit("live:ended", { sessionId: s.id });
  res.json({ session: await view(s, req.user!.id) });
});

// Token: instructor can publish and administer; students subscribe + data only until promoted.
liveRouter.post("/live/:id/token", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  const staff = await access(req, s);
  if (s.status === "ended") throw new AppError(409, "SESSION_ENDED", "This class has ended");
  if (s.status === "scheduled" && !staff) throw new AppError(409, "NOT_STARTED", "The class has not started yet");
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: req.user!.id,
    name: req.user!.name,
    ttl: "1h",
    metadata: JSON.stringify({ role: staff ? "host" : "student" }),
  });
  at.addGrant({ roomJoin: true, room: s.id, canSubscribe: true, canPublishData: true, canPublish: staff, roomAdmin: staff });
  await prisma.attendance.create({ data: { sessionId: s.id, userId: req.user!.id } });
  res.json({ token: await at.toJwt(), url: config.livekit.publicUrl, canPublish: staff });
});

// Instructor grants or revokes a student's mic/camera via the LiveKit server API.
liveRouter.post("/live/:id/grant", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  const { identity, allow } = z.object({ identity: z.string(), allow: z.boolean() }).parse(req.body);
  await rooms().updateParticipant(s.id, identity, undefined, { canPublish: allow, canSubscribe: true, canPublishData: true });
  res.json({ ok: true });
});

liveRouter.post("/live/:id/leave", requireAuth, async (req: Request, res: Response) => {
  await prisma.attendance.updateMany({ where: { sessionId: oid(req.params.id), userId: req.user!.id, leftAt: null }, data: { leftAt: new Date() } });
  res.json({ ok: true });
});

liveRouter.get("/live/:id/attendance", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  const rows = await prisma.attendance.findMany({ where: { sessionId: s.id }, orderBy: { joinedAt: "asc" } });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true, email: true } });
  const by = new Map(users.map((u) => [u.id, u]));
  res.json({ attendance: rows.map((r) => ({ name: by.get(r.userId)?.name, email: by.get(r.userId)?.email, joinedAt: r.joinedAt, leftAt: r.leftAt })) });
});

// Chat history for late joiners (live delivery uses the LiveKit data channel; every message is also posted here).
liveRouter.get("/live/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  await access(req, s);
  const msgs = await prisma.message.findMany({ where: { sessionId: s.id }, orderBy: { createdAt: "asc" }, take: 200 });
  res.json({ messages: msgs.map((m) => ({ id: m.id, userId: m.userId, userName: m.userName, role: m.role, text: m.text, at: m.createdAt })) });
});

liveRouter.post("/live/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  const staff = await access(req, s);
  const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);
  const m = await prisma.message.create({ data: { sessionId: s.id, userId: req.user!.id, userName: req.user!.name, role: staff ? "host" : "student", text } });
  req.app.get("io")?.to(`live:${s.id}`).emit("live:message", { id: m.id, userName: m.userName, role: m.role, text: m.text });
  res.status(201).json({ id: m.id });
});
