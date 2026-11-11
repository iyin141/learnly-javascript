import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { CourseModel, EnrolmentModel, UserModel, LessonModel } from "../db.js";
import { AttemptModel, CertificateModel, PaymentModel } from "../db-learning.js";

export const adminRouter = Router();
const oid = (v: string) => {
  if (!mongoose.isValidObjectId(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

// ---------- Admin ----------
adminRouter.get("/admin/users", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  const users = await UserModel.find().sort({ createdAt: -1 }).limit(500).select("name email role createdAt");
  res.json({ users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })) });
});

adminRouter.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { role } = z.object({ role: z.enum(["student", "instructor", "admin"]) }).parse(req.body);
  if (String(req.user!._id) === req.params.id) throw new AppError(409, "SELF_EDIT", "You cannot change your own role");
  const u = await UserModel.findByIdAndUpdate(oid(req.params.id), { role }, { new: true });
  if (!u) throw new AppError(404, "NOT_FOUND", "User not found");
  res.json({ id: String(u._id), role: u.role });
});

adminRouter.get("/admin/courses", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "in_review");
  const courses = await CourseModel.find(status === "all" ? {} : { status }).populate("instructorId", "name").sort({ updatedAt: -1 });
  res.json({ courses: courses.map((c) => ({ id: String(c._id), title: c.title, code: c.code, status: c.status, instructorName: (c.instructorId as any)?.name })) });
});

adminRouter.post("/admin/courses/:id/decision", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
  const c = await CourseModel.findByIdAndUpdate(oid(req.params.id), { status: approve ? "published" : "draft" }, { new: true });
  if (!c) throw new AppError(404, "NOT_FOUND", "Course not found");
  res.json({ id: String(c._id), status: c.status });
});

adminRouter.get("/admin/reports", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  const [users, courses, enrolments, certificates, attempts, revenue] = await Promise.all([
    UserModel.countDocuments(),
    CourseModel.countDocuments({ status: "published" }),
    EnrolmentModel.countDocuments(),
    CertificateModel.countDocuments(),
    AttemptModel.countDocuments({ submittedAt: { $exists: true } }),
    PaymentModel.aggregate([{ $group: { _id: null, total: { $sum: "$amountCents" } } }]),
  ]);
  res.json({ users, publishedCourses: courses, enrolments, certificates, quizAttempts: attempts, revenueCents: revenue[0]?.total ?? 0 });
});

// ---------- Instructor ----------
adminRouter.get("/instructor/courses", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const filter = req.user!.role === "admin" ? {} : { instructorId: req.user!._id };
  const courses = await CourseModel.find(filter).sort({ updatedAt: -1 });
  const out = await Promise.all(
    courses.map(async (c) => ({
      id: String(c._id),
      title: c.title,
      code: c.code,
      status: c.status,
      lessons: await LessonModel.countDocuments({ courseId: c._id }),
      students: await EnrolmentModel.countDocuments({ courseId: c._id }),
    }))
  );
  res.json({ courses: out });
});

/** Create a draft course owned by the calling instructor; content is added in the builder. */
adminRouter.post("/instructor/courses", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const b = z
    .object({
      title: z.string().trim().min(3, "Title must be at least 3 characters"),
      code: z.string().trim().min(2).max(20),
      term: z.string().trim().optional(),
      description: z.string().trim().optional(),
      subjectColor: z.enum(["blue", "coral", "slate", "purple", "teal", "amber"]).optional(),
    })
    .parse(req.body);
  const c = await CourseModel.create({
    title: b.title,
    code: b.code.toUpperCase(),
    term: b.term || "Self-paced",
    sectionName: "Section 01",
    description: b.description || "No description yet.",
    instructorId: req.user!._id,
    status: "draft",
    subjectColor: b.subjectColor ?? "blue",
  });
  res.status(201).json({ course: { id: String(c._id), title: c.title, code: c.code, status: c.status } });
});

adminRouter.post("/instructor/courses/:id/submit", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const c = await CourseModel.findById(oid(req.params.id));
  if (!c) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && String(c.instructorId) !== String(req.user!._id)) throw new AppError(403, "FORBIDDEN", "Not your course");
  c.status = "in_review";
  await c.save();
  res.json({ id: String(c._id), status: c.status });
});

/** Enrolments and earnings per course per month, via aggregation pipelines. */
adminRouter.get("/instructor/revenue", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const mine = req.user!.role === "admin" ? {} : { instructorId: req.user!._id };
  const courseIds = (await CourseModel.find(mine).select("_id title")).map((c) => c);
  const ids = courseIds.map((c) => c._id);
  const month = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
  const [enr, pay] = await Promise.all([
    EnrolmentModel.aggregate([{ $match: { courseId: { $in: ids } } }, { $group: { _id: { courseId: "$courseId", month }, enrolments: { $sum: 1 } } }]),
    PaymentModel.aggregate([{ $match: { courseId: { $in: ids } } }, { $group: { _id: { courseId: "$courseId", month }, cents: { $sum: "$amountCents" } } }]),
  ]);
  const title = new Map(courseIds.map((c) => [String(c._id), c.title]));
  const rows = new Map<string, { courseId: string; course: string; month: string; enrolments: number; earningsCents: number }>();
  const row = (courseId: unknown, m: string) => {
    const k = `${courseId}|${m}`;
    if (!rows.has(k)) rows.set(k, { courseId: String(courseId), course: title.get(String(courseId)) ?? "", month: m, enrolments: 0, earningsCents: 0 });
    return rows.get(k)!;
  };
  enr.forEach((e) => (row(e._id.courseId, e._id.month).enrolments = e.enrolments));
  pay.forEach((p) => (row(p._id.courseId, p._id.month).earningsCents = p.cents));
  const list = [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
  res.json({ rows: list, totalEnrolments: list.reduce((s, r) => s + r.enrolments, 0), totalEarningsCents: list.reduce((s, r) => s + r.earningsCents, 0) });
});
