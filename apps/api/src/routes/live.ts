import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { LiveSessionInfo } from "@learnly/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { CourseModel, EnrolmentModel } from "../db.js";
import { AttendanceModel, LiveSessionModel, MessageModel } from "../db-learning.js";
import { config } from "../config.js";
import { redis } from "../redis.js";
import { logger } from "../logger.js";
import { emailQueue, remindersQueue } from "../services/queue.js";

export const liveRouter = Router();

const lkHttp = config.livekit.url.replace(/^ws/, "http");
const rooms = () => new RoomServiceClient(lkHttp, config.livekit.apiKey, config.livekit.apiSecret);
const oid = (v: string) => {
  if (!mongoose.isValidObjectId(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

async function view(s: any, userId?: unknown): Promise<LiveSessionInfo> {
  const course = await CourseModel.findById(s.courseId).populate("instructorId", "name");
  return {
    id: String(s._id),
    courseId: String(s.courseId),
    courseTitle: course?.title ?? "",
    title: s.title,
    code: s.code,
    instructorId: String(s.instructorId),
    instructorName: (course?.instructorId as any)?.name ?? "Instructor",
    startsAt: s.startsAt.toISOString(),
    durationMinutes: s.durationMinutes,
    status: s.status,
    recording: s.recording,
    isHost: userId ? String(s.instructorId) === String(userId) : false,
  };
}

/** Throws unless the user is the instructor, an admin, or enrolled. Returns whether they are staff. */
async function access(req: Request, session: any): Promise<boolean> {
  const u = req.user!;
  if (u.role === "admin" || String(session.instructorId) === String(u._id)) return true;
  if (!(await EnrolmentModel.exists({ userId: u._id, courseId: session.courseId })))
    throw new AppError(403, "FORBIDDEN", "You must be enrolled in this course to join");
  return false;
}
const host = (req: Request, s: any) => {
  if (req.user!.role !== "admin" && String(s.instructorId) !== String(req.user!._id)) throw new AppError(403, "FORBIDDEN", "Only the host can do this");
};
async function load(id: string) {
  const s = await LiveSessionModel.findById(oid(id));
  if (!s) throw new AppError(404, "NOT_FOUND", "Session not found");
  return s;
}

// List sessions the user can see: their enrolled courses, or the ones they teach.
liveRouter.get("/live", requireAuth, async (req: Request, res: Response) => {
  const u = req.user!;
  let courseIds: unknown[];
  if (u.role === "admin") courseIds = (await CourseModel.find().select("_id")).map((c) => c._id);
  else if (u.role === "instructor") courseIds = (await CourseModel.find({ instructorId: u._id }).select("_id")).map((c) => c._id);
  else courseIds = (await EnrolmentModel.find({ userId: u._id }).select("courseId")).map((e) => e.courseId);
  const since = new Date(Date.now() - 24 * 3600_000);
  const sessions = await LiveSessionModel.find({ courseId: { $in: courseIds }, $or: [{ status: "live" }, { startsAt: { $gte: since } }] }).sort({ startsAt: 1 });
  res.json({ sessions: await Promise.all(sessions.map((s) => view(s, u._id))) });
});

liveRouter.post("/live/join-by-code", requireAuth, async (req: Request, res: Response) => {
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const s = await LiveSessionModel.findOne({ code: code.trim().toLowerCase().split("/").pop() });
  if (!s) throw new AppError(404, "NOT_FOUND", "No class matches that code");
  await access(req, s);
  res.json({ session: await view(s, req.user!._id) });
});

liveRouter.post("/courses/:courseId/live", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const course = await CourseModel.findById(oid(req.params.courseId));
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && String(course.instructorId) !== String(req.user!._id)) throw new AppError(403, "FORBIDDEN", "Not your course");
  const body = z.object({ title: z.string().min(1), startsAt: z.string().datetime(), durationMinutes: z.number().int().min(5).max(480).default(60), recording: z.boolean().default(false) }).parse(req.body);
  const slug = course.code.toLowerCase().replace(/\s+/g, "");
  const s = await LiveSessionModel.create({
    ...body,
    startsAt: new Date(body.startsAt),
    courseId: course._id,
    instructorId: course.instructorId,
    code: `${slug}-${crypto.randomBytes(2).toString("hex")}`,
  });
  // reminder job 15 minutes before start
  const delay = s.startsAt.getTime() - 15 * 60_000 - Date.now();
  if (delay > 0) await remindersQueue.add("class-reminder", { sessionId: String(s._id) }, { delay, jobId: `reminder-${s._id}` }).catch((err) => logger.warn({ err }, "reminder enqueue failed"));
  res.status(201).json({ session: await view(s, req.user!._id) });
});

liveRouter.get("/live/:id", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  await access(req, s);
  res.json({ session: await view(s, req.user!._id) });
});

liveRouter.post("/live/:id/start", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  if (s.status === "ended") throw new AppError(409, "SESSION_ENDED", "This class has ended");
  s.status = "live";
  s.startedAt = s.startedAt ?? new Date();
  await s.save();
  await redis.set(`live:${s._id}:state`, "live", "EX", 24 * 3600).catch(() => undefined);
  try {
    await rooms().createRoom({ name: String(s._id), emptyTimeout: 600 });
  } catch (err) {
    logger.warn({ err }, "livekit createRoom failed (token join will create it on demand)");
  }
  // notify enrolled students by email (captured by Mailpit) and socket
  const enrolments = await EnrolmentModel.find({ courseId: s.courseId }).populate("userId", "email name");
  for (const e of enrolments) {
    const u = e.userId as any;
    if (u?.email) await emailQueue.add("class-live", { to: u.email, subject: `Class started: ${s.title}`, text: `${s.title} is live now. Join at /live/${s._id}` }).catch(() => undefined);
  }
  req.app.get("io")?.emit("live:started", { sessionId: String(s._id), title: s.title });
  res.json({ session: await view(s, req.user!._id) });
});

liveRouter.post("/live/:id/end", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  s.status = "ended";
  s.endedAt = new Date();
  await s.save();
  await AttendanceModel.updateMany({ sessionId: s._id, leftAt: { $exists: false } }, { leftAt: s.endedAt });
  await redis.del(`live:${s._id}:state`).catch(() => undefined);
  await rooms().deleteRoom(String(s._id)).catch((err) => logger.warn({ err }, "livekit deleteRoom failed"));
  req.app.get("io")?.to(`live:${s._id}`).emit("live:ended", { sessionId: String(s._id) });
  res.json({ session: await view(s, req.user!._id) });
});

// Token: instructor can publish and administer; students subscribe + data only until promoted.
liveRouter.post("/live/:id/token", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  const staff = await access(req, s);
  if (s.status === "ended") throw new AppError(409, "SESSION_ENDED", "This class has ended");
  if (s.status === "scheduled" && !staff) throw new AppError(409, "NOT_STARTED", "The class has not started yet");
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: String(req.user!._id),
    name: req.user!.name,
    ttl: "1h",
    metadata: JSON.stringify({ role: staff ? "host" : "student" }),
  });
  at.addGrant({ roomJoin: true, room: String(s._id), canSubscribe: true, canPublishData: true, canPublish: staff, roomAdmin: staff });
  await AttendanceModel.create({ sessionId: s._id, userId: req.user!._id });
  res.json({ token: await at.toJwt(), url: config.livekit.publicUrl, canPublish: staff });
});

// Instructor grants or revokes a student's mic/camera via the LiveKit server API.
liveRouter.post("/live/:id/grant", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  const { identity, allow } = z.object({ identity: z.string(), allow: z.boolean() }).parse(req.body);
  await rooms().updateParticipant(String(s._id), identity, undefined, { canPublish: allow, canSubscribe: true, canPublishData: true });
  res.json({ ok: true });
});

liveRouter.post("/live/:id/leave", requireAuth, async (req: Request, res: Response) => {
  await AttendanceModel.updateMany({ sessionId: req.params.id, userId: req.user!._id, leftAt: { $exists: false } }, { leftAt: new Date() });
  res.json({ ok: true });
});

liveRouter.get("/live/:id/attendance", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  host(req, s);
  const rows = await AttendanceModel.find({ sessionId: s._id }).populate("userId", "name email").sort({ joinedAt: 1 });
  res.json({ attendance: rows.map((r) => ({ name: (r.userId as any)?.name, email: (r.userId as any)?.email, joinedAt: r.joinedAt, leftAt: r.leftAt })) });
});

// Chat history for late joiners (live delivery uses the LiveKit data channel; every message is also posted here).
liveRouter.get("/live/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  await access(req, s);
  const msgs = await MessageModel.find({ sessionId: s._id }).sort({ createdAt: 1 }).limit(200);
  res.json({ messages: msgs.map((m) => ({ id: String(m._id), userId: String(m.userId), userName: m.userName, role: m.role, text: m.text, at: (m as any).createdAt })) });
});

liveRouter.post("/live/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const s = await load(req.params.id);
  const staff = await access(req, s);
  const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);
  const m = await MessageModel.create({ sessionId: s._id, userId: req.user!._id, userName: req.user!.name, role: staff ? "host" : "student", text });
  req.app.get("io")?.to(`live:${s._id}`).emit("live:message", { id: String(m._id), userName: m.userName, role: m.role, text: m.text });
  res.status(201).json({ id: String(m._id) });
});
