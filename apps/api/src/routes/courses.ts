import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { CourseModel, SectionModel, LessonModel, EnrolmentModel, UserModel, type ICourse } from "../db.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { QuizModel } from "../db-learning.js";
import type { Course, Enrolment } from "@learnly/shared";

export const coursesRouter = Router();

function formatCourse(course: ICourse, instructorName: string, instructorAvatar?: string): Course {
  return {
    id: course._id.toString(),
    title: course.title,
    code: course.code,
    term: course.term,
    sectionName: course.sectionName,
    description: course.description,
    instructorId: String((course.instructorId as any)._id ?? course.instructorId),
    instructorName,
    instructorAvatar,
    status: course.status,
    subjectColor: course.subjectColor,
    estimatedHours: course.estimatedHours,
    totalLessons: 0,
    totalQuizzes: 0,
    isLiveNow: course.isLiveNow,
    upcomingLiveTitle: course.upcomingLiveTitle,
    upcomingLiveDate: course.upcomingLiveDate ? course.upcomingLiveDate.toISOString() : undefined,
  };
}

// GET /api/courses - List published courses
coursesRouter.get("/", optionalAuth, async (_req: Request, res: Response) => {
  const courses = await CourseModel.find({ status: "published" }).populate("instructorId", "name avatarUrl");

  const formatted: Course[] = await Promise.all(
    courses.map(async (c) => {
      const instructor = c.instructorId as any;
      const totalLessons = await LessonModel.countDocuments({ courseId: c._id });
      const item = formatCourse(c, instructor?.name || "Instructor", instructor?.avatarUrl);
      item.totalLessons = totalLessons;
      item.totalQuizzes = await QuizModel.countDocuments({ courseId: c._id });
      return item;
    })
  );

  res.json({ courses: formatted });
});

// GET /api/courses/:id - Course overview + curriculum
coursesRouter.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, "INVALID_ID", "Invalid course ID format");
  }

  const course = await CourseModel.findById(id).populate("instructorId", "name avatarUrl email");
  if (!course) {
    throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
  }

  const instructor = course.instructorId as any;
  const sections = await SectionModel.find({ courseId: course._id }).sort({ order: 1 });
  const lessons = await LessonModel.find({ courseId: course._id }).sort({ order: 1 });

  const sectionsWithLessons = sections.map((sec) => ({
    id: sec._id.toString(),
    courseId: course._id.toString(),
    title: sec.title,
    order: sec.order,
    lessons: lessons
      .filter((l) => l.sectionId.toString() === sec._id.toString())
      .map((l) => ({
        id: l._id.toString(),
        courseId: course._id.toString(),
        sectionId: sec._id.toString(),
        title: l.title,
        type: l.type,
        order: l.order,
        durationSeconds: l.durationSeconds,
        video: l.video,
        textContent: l.textContent,
      })),
  }));

  let enrolmentInfo: Enrolment | null = null;
  if (req.user) {
    const enrolment = await EnrolmentModel.findOne({ userId: req.user._id, courseId: course._id });
    if (enrolment) {
      enrolmentInfo = {
        id: enrolment._id.toString(),
        userId: req.user._id.toString(),
        courseId: course._id.toString(),
        status: enrolment.status,
        progressPercent: enrolment.progressPercent,
        completedLessons: enrolment.completedLessons.map((l) => l.toString()),
        lastLessonId: enrolment.lastLessonId?.toString(),
        lastPositionSeconds: enrolment.lastPositionSeconds,
        enrolledAt: enrolment.createdAt.toISOString(),
      };
    }
  }

  const totalLessons = lessons.length;
  const courseData = formatCourse(course, instructor?.name || "Instructor", instructor?.avatarUrl);
  courseData.totalLessons = totalLessons;
  courseData.totalQuizzes = await QuizModel.countDocuments({ courseId: course._id });
  courseData.sections = sectionsWithLessons;

  res.json({
    course: courseData,
    enrolment: enrolmentInfo,
  });
});

// POST /api/courses/:id/enroll - Enroll in course
coursesRouter.post("/:id/enroll", authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, "INVALID_ID", "Invalid course ID format");
  }

  const course = await CourseModel.findById(id);
  if (!course) {
    throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
  }

  let enrolment = await EnrolmentModel.findOne({ userId: req.user!._id, courseId: course._id });
  if (enrolment) {
    res.json({ message: "Already enrolled", enrolment });
    return;
  }

  enrolment = await EnrolmentModel.create({
    userId: req.user!._id,
    courseId: course._id,
    status: "active",
    progressPercent: 0,
    completedLessons: [],
  });

  res.status(201).json({ message: "Enrolled successfully", enrolment });
});

// GET /api/my-courses - List enrolled courses
coursesRouter.get("/user/enrolled", authenticate, async (req: Request, res: Response) => {
  const filterStatus = req.query.status as string; // 'active' | 'completed' | 'archived'

  const query: any = { userId: req.user!._id };
  if (filterStatus && ["active", "completed", "archived"].includes(filterStatus)) {
    query.status = filterStatus;
  }

  const enrolments = await EnrolmentModel.find(query).populate({
    path: "courseId",
    populate: { path: "instructorId", select: "name avatarUrl" },
  });

  const list = await Promise.all(
    enrolments.map(async (e) => {
      const course = e.courseId as any;
      if (!course) return null;
      const instructor = course.instructorId;
      const totalLessons = await LessonModel.countDocuments({ courseId: course._id });
      const c = formatCourse(course, instructor?.name || "Instructor", instructor?.avatarUrl);
      c.totalLessons = totalLessons;
      return {
        enrolmentId: e._id.toString(),
        status: e.status,
        progressPercent: e.progressPercent,
        completedCount: e.completedLessons.length,
        totalLessons,
        lastPositionSeconds: e.lastPositionSeconds,
        course: c,
      };
    })
  );

  res.json({ enrolments: list.filter(Boolean) });
});
