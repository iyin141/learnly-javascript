import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { prisma, Prisma, isUuid } from "../db.js";

export const adminRouter = Router();
const oid = (v: string) => {
  if (!isUuid(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

// ---------- Admin ----------
adminRouter.get("/admin/users", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  res.json({ users });
});

adminRouter.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { role } = z.object({ role: z.enum(["student", "instructor", "admin"]) }).parse(req.body);
  const id = oid(req.params.id);
  if (req.user!.id === id) throw new AppError(409, "SELF_EDIT", "You cannot change your own role");
  const u = await prisma.user.update({ where: { id }, data: { role } }).catch((e) => {
    if (e?.code === "P2025") throw new AppError(404, "NOT_FOUND", "User not found");
    throw e;
  });
  res.json({ id: u.id, role: u.role });
});

adminRouter.get("/admin/courses", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "in_review");
  if (status !== "all" && !["draft", "in_review", "published"].includes(status)) throw new AppError(400, "INVALID_STATUS", "Unknown status filter");
  const courses = await prisma.course.findMany({
    where: status === "all" ? {} : { status: status as "draft" | "in_review" | "published" },
    include: { instructor: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ courses: courses.map((c) => ({ id: c.id, title: c.title, code: c.code, status: c.status, instructorName: c.instructor?.name })) });
});

adminRouter.post("/admin/courses/:id/decision", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
  const hit = await prisma.course.updateMany({ where: { id: oid(req.params.id) }, data: { status: approve ? "published" : "draft" } });
  if (!hit.count) throw new AppError(404, "NOT_FOUND", "Course not found");
  res.json({ id: req.params.id, status: approve ? "published" : "draft" });
});

adminRouter.get("/admin/reports", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  const [users, courses, enrolments, certificates, attempts, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.course.count({ where: { status: "published" } }),
    prisma.enrolment.count(),
    prisma.certificate.count(),
    prisma.attempt.count({ where: { submittedAt: { not: null } } }),
    prisma.payment.aggregate({ where: { status: { not: "failed" } }, _sum: { amountCents: true } }),
  ]);
  res.json({ users, publishedCourses: courses, enrolments, certificates, quizAttempts: attempts, revenueCents: revenue._sum.amountCents ?? 0 });
});

// ---------- Instructor ----------
adminRouter.get("/instructor/courses", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const courses = await prisma.course.findMany({
    where: req.user!.role === "admin" ? {} : { instructorId: req.user!.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { lessons: true, enrolments: true } } },
  });
  res.json({ courses: courses.map((c) => ({ id: c.id, title: c.title, code: c.code, status: c.status, lessons: c._count.lessons, students: c._count.enrolments })) });
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
      priceCents: z.number().int().min(0).max(1_000_000).optional(),
    })
    .parse(req.body);
  const c = await prisma.course.create({
    data: {
      priceCents: b.priceCents ?? 0,
      title: b.title,
      code: b.code.toUpperCase(),
      term: b.term || "Self-paced",
      sectionName: "Section 01",
      description: b.description || "No description yet.",
      instructorId: req.user!.id,
      status: "draft",
      subjectColor: b.subjectColor ?? "blue",
    },
  });
  res.status(201).json({ course: { id: c.id, title: c.title, code: c.code, status: c.status } });
});

adminRouter.post("/instructor/courses/:id/submit", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const c = await prisma.course.findUnique({ where: { id: oid(req.params.id) } });
  if (!c) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && c.instructorId !== req.user!.id) throw new AppError(403, "FORBIDDEN", "Not your course");
  if (c.status === "published") throw new AppError(409, "ALREADY_PUBLISHED", "This course is already published");
  const u = await prisma.course.update({ where: { id: c.id }, data: { status: "in_review" } });
  res.json({ id: u.id, status: u.status });
});

/** Enrolments and earnings per course per month (SQL GROUP BY). Earnings are net of the platform fee; pending and failed payments are excluded. */
adminRouter.get("/instructor/revenue", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const scope = req.user!.role === "admin" ? Prisma.sql`TRUE` : Prisma.sql`c.instructor_id = ${req.user!.id}::uuid`;
  const [enr, pay] = await Promise.all([
    prisma.$queryRaw<{ course_id: string; title: string; month: string; n: number }[]>`
      SELECT c.id AS course_id, c.title, to_char(e.created_at, 'YYYY-MM') AS month, count(*)::int AS n
      FROM enrolments e JOIN courses c ON c.id = e.course_id WHERE ${scope} GROUP BY c.id, c.title, month`,
    prisma.$queryRaw<{ course_id: string; title: string; month: string; net: number; gross: number }[]>`
      SELECT c.id AS course_id, c.title, to_char(p.created_at, 'YYYY-MM') AS month,
             coalesce(sum(p.amount_cents - p.fee_cents), 0)::int AS net, coalesce(sum(p.amount_cents), 0)::int AS gross
      FROM payments p JOIN courses c ON c.id = p.course_id WHERE ${scope} AND p.status = 'paid' GROUP BY c.id, c.title, month`,
  ]);
  const rows = new Map<string, { courseId: string; course: string; month: string; enrolments: number; earningsCents: number; grossCents: number }>();
  const row = (courseId: string, title: string, m: string) => {
    const k = `${courseId}|${m}`;
    if (!rows.has(k)) rows.set(k, { courseId, course: title, month: m, enrolments: 0, earningsCents: 0, grossCents: 0 });
    return rows.get(k)!;
  };
  enr.forEach((e) => (row(e.course_id, e.title, e.month).enrolments = e.n));
  pay.forEach((p) => { const r = row(p.course_id, p.title, p.month); r.earningsCents = p.net; r.grossCents = p.gross; });
  const list = [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
  res.json({ rows: list, totalEnrolments: list.reduce((s, r) => s + r.enrolments, 0), totalEarningsCents: list.reduce((s, r) => s + r.earningsCents, 0), totalGrossCents: list.reduce((s, r) => s + r.grossCents, 0) });
});
