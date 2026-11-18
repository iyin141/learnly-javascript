import { Router, type Request, type Response } from "express";
import { prisma, isUuid, type Course as DbCourse, type LessonVideo } from "../db.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import type { Course, Enrolment } from "@learnly/shared";

export const coursesRouter = Router();

type Instructor = { name: string; avatarUrl: string | null } | null;

function formatCourse(course: DbCourse, instructor: Instructor): Course {
  return {
    id: course.id,
    title: course.title,
    code: course.code,
    term: course.term,
    sectionName: course.sectionName,
    description: course.description,
    instructorId: course.instructorId,
    instructorName: instructor?.name || "Instructor",
    instructorAvatar: instructor?.avatarUrl ?? undefined,
    status: course.status,
    subjectColor: course.subjectColor as Course["subjectColor"],
    estimatedHours: course.estimatedHours,
    priceCents: course.priceCents ?? 0,
    totalLessons: 0,
    totalQuizzes: 0,
    isLiveNow: course.isLiveNow,
    upcomingLiveTitle: course.upcomingLiveTitle ?? undefined,
    upcomingLiveDate: course.upcomingLiveDate ? course.upcomingLiveDate.toISOString() : undefined,
  };
}

function publicVideo(v: LessonVideo | undefined, full: boolean): LessonVideo | undefined {
  if (!v || full) return v;
  const { rawUploadKey: _k, masterPlaylistPath: _m, ...rest } = v as LessonVideo & { rawUploadKey?: string; masterPlaylistPath?: string };
  return rest as LessonVideo;
}

// GET /api/courses - List published courses
coursesRouter.get("/", optionalAuth, async (_req: Request, res: Response) => {
  const courses = await prisma.course.findMany({
    where: { status: "published" },
    include: { instructor: { select: { name: true, avatarUrl: true } }, _count: { select: { lessons: true, quizzes: true } } },
    orderBy: { createdAt: "asc" },
  });
  const formatted: Course[] = courses.map((c) => {
    const item = formatCourse(c, c.instructor);
    item.totalLessons = c._count.lessons;
    item.totalQuizzes = c._count.quizzes;
    return item;
  });
  res.json({ courses: formatted });
});

// GET /api/courses/:id - Course overview + curriculum
coursesRouter.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new AppError(400, "INVALID_ID", "Invalid course ID format");

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      instructor: { select: { name: true, avatarUrl: true } },
      sections: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
      _count: { select: { quizzes: true } },
    },
  });
  if (!course) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");

  const isOwnerOrAdmin = !!req.user && (req.user.role === "admin" || course.instructorId === req.user.id);
  // unpublished courses are visible to their instructor and admins only
  if (course.status !== "published" && !isOwnerOrAdmin) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");

  let enrolmentRow: Awaited<ReturnType<typeof prisma.enrolment.findUnique>> = null;
  if (req.user) {
    enrolmentRow = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user.id, courseId: course.id } } });
  }
  // lesson bodies and video storage keys only go to enrolled students, the owner and admins (no preview flag exists)
  const canSeeContent = isOwnerOrAdmin || !!enrolmentRow;

  const sectionsWithLessons = course.sections.map((sec) => ({
    id: sec.id,
    courseId: course.id,
    title: sec.title,
    order: sec.order,
    lessons: sec.lessons.map((l) => ({
      id: l.id,
      courseId: course.id,
      sectionId: sec.id,
      title: l.title,
      type: l.type,
      order: l.order,
      durationSeconds: l.durationSeconds,
      video: publicVideo((l.video ?? undefined) as LessonVideo | undefined, canSeeContent),
      textContent: canSeeContent ? l.textContent ?? undefined : undefined,
    })),
  }));

  let enrolmentInfo: Enrolment | null = null;
  if (req.user) {
    const enrolment = enrolmentRow;
    if (enrolment) {
      enrolmentInfo = {
        id: enrolment.id,
        userId: req.user.id,
        courseId: course.id,
        status: enrolment.status,
        progressPercent: enrolment.progressPercent,
        completedLessons: enrolment.completedLessons,
        lastLessonId: enrolment.lastLessonId ?? undefined,
        lastPositionSeconds: enrolment.lastPositionSeconds,
        enrolledAt: enrolment.createdAt.toISOString(),
      };
    }
  }

  const courseData = formatCourse(course, course.instructor);
  courseData.totalLessons = sectionsWithLessons.reduce((n, s) => n + s.lessons.length, 0);
  courseData.totalQuizzes = course._count.quizzes;
  courseData.sections = sectionsWithLessons as Course["sections"];

  res.json({ course: courseData, enrolment: enrolmentInfo });
});

// GET /api/courses/:id/people - the instructor and the enrolled students; visible to the course's students, its instructor and admins.
// Students see names, avatars and enrolment dates only; the instructor and admins also get emails and progress.
coursesRouter.get("/:id/people", authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new AppError(400, "INVALID_ID", "Invalid course ID format");

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, status: true, instructorId: true, instructor: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!course) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");

  const isOwnerOrAdmin = req.user!.role === "admin" || course.instructorId === req.user!.id;
  if (course.status !== "published" && !isOwnerOrAdmin) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
  if (!isOwnerOrAdmin) {
    const mine = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: id } }, select: { status: true } });
    if (!mine) throw new AppError(403, "NOT_ENROLLED", "Enrol in this course to see who is in it");
  }

  const LIMIT = 500;
  const [total, rows] = await Promise.all([
    prisma.enrolment.count({ where: { courseId: id } }),
    prisma.enrolment.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
      select: { createdAt: true, progressPercent: true, status: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  res.json({
    instructor: course.instructor ? { id: course.instructor.id, name: course.instructor.name, avatarUrl: course.instructor.avatarUrl ?? undefined } : null,
    total,
    students: rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      avatarUrl: r.user.avatarUrl ?? undefined,
      enrolledAt: r.createdAt.toISOString(),
      ...(isOwnerOrAdmin ? { email: r.user.email, progressPercent: r.progressPercent, status: r.status } : {}),
    })),
    detailed: isOwnerOrAdmin,
  });
});

// POST /api/courses/:id/enroll - Enroll in course
coursesRouter.post("/:id/enroll", authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new AppError(400, "INVALID_ID", "Invalid course ID format");

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");

  const existing = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: course.id } } });
  if (existing) {
    res.json({ message: "Already enrolled", enrolment: existing });
    return;
  }

  const isOwner = req.user!.role === "admin" || course.instructorId === req.user!.id;
  if (course.priceCents > 0 && !isOwner) {
    throw new AppError(402, "PAYMENT_REQUIRED", "This is a paid course: use POST /api/courses/:id/checkout");
  }

  // upsert: two simultaneous enrol clicks resolve to one row through the (userId, courseId) unique key
  const enrolment = await prisma.enrolment.upsert({
    where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
    update: {},
    create: { userId: req.user!.id, courseId: course.id, status: "active", progressPercent: 0, completedLessons: [] },
  });
  res.status(201).json({ message: "Enrolled successfully", enrolment });
});

// GET /api/my-courses - List enrolled courses
coursesRouter.get("/user/enrolled", authenticate, async (req: Request, res: Response) => {
  const filterStatus = req.query.status as string; // 'active' | 'completed' | 'archived'
  const where: { userId: string; status?: "active" | "completed" | "archived" } = { userId: req.user!.id };
  if (filterStatus && ["active", "completed", "archived"].includes(filterStatus)) where.status = filterStatus as "active";

  const enrolments = await prisma.enrolment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { course: { include: { instructor: { select: { name: true, avatarUrl: true } }, _count: { select: { lessons: true } } } } },
  });

  const list = enrolments.map((e) => {
    const c = formatCourse(e.course, e.course.instructor);
    c.totalLessons = e.course._count.lessons;
    return {
      enrolmentId: e.id,
      status: e.status,
      progressPercent: e.progressPercent,
      completedCount: e.completedLessons.length,
      totalLessons: c.totalLessons,
      lastPositionSeconds: e.lastPositionSeconds,
      course: c,
    };
  });

  res.json({ enrolments: list });
});
