import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { scoreAnswer, type QuizSummary, type QuizQuestionPublic } from "@learnly/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { CourseModel, EnrolmentModel } from "../db.js";
import { AttemptModel, QuestionModel, QuizModel } from "../db-learning.js";
import { evaluateCompletion } from "../services/learning.js";

export const quizzesRouter = Router();
/** Seconds of tolerance after endsAt for network latency on the final autosave/submit. */
export const GRACE_SECONDS = 5;

const oid = (v: string) => {
  if (!mongoose.isValidObjectId(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

async function canAccessCourse(req: Request, courseId: unknown) {
  const course = await CourseModel.findById(courseId);
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  const u = req.user!;
  if (u.role === "admin" || String(course.instructorId) === String(u._id)) return { course, staff: true };
  if (!(await EnrolmentModel.exists({ userId: u._id, courseId }))) throw new AppError(403, "FORBIDDEN", "You must be enrolled in this course");
  return { course, staff: false };
}

async function summarise(quiz: any, userId: unknown): Promise<QuizSummary> {
  const [qs, attempts] = await Promise.all([
    QuestionModel.find({ quizId: quiz._id }).select("points"),
    AttemptModel.find({ quizId: quiz._id, userId, submittedAt: { $exists: true } }).select("scorePercent passed"),
  ]);
  const inProgress = await AttemptModel.countDocuments({ quizId: quiz._id, userId, submittedAt: { $exists: false } });
  return {
    id: String(quiz._id),
    courseId: String(quiz.courseId),
    title: quiz.title,
    description: quiz.description,
    unitLabel: quiz.unitLabel,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passMarkPercent: quiz.passMarkPercent,
    maxAttempts: quiz.maxAttempts,
    questionCount: qs.length,
    totalPoints: qs.reduce((a, q) => a + (q.points ?? 1), 0),
    attemptsUsed: attempts.length + inProgress,
    bestScorePercent: attempts.length ? Math.max(...attempts.map((a) => a.scorePercent ?? 0)) : undefined,
    passed: attempts.some((a) => a.passed),
    required: quiz.required,
  };
}

quizzesRouter.get("/courses/:courseId/quizzes", requireAuth, async (req: Request, res: Response) => {
  await canAccessCourse(req, oid(req.params.courseId));
  const quizzes = await QuizModel.find({ courseId: req.params.courseId }).sort({ createdAt: 1 });
  res.json({ quizzes: await Promise.all(quizzes.map((q) => summarise(q, req.user!._id))) });
});

quizzesRouter.get("/quizzes/:id", requireAuth, async (req: Request, res: Response) => {
  const quiz = await QuizModel.findById(oid(req.params.id));
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await canAccessCourse(req, quiz.courseId);
  res.json({ quiz: await summarise(quiz, req.user!._id) });
});

function publicQuestions(questions: any[], order: unknown[]): QuizQuestionPublic[] {
  const by = new Map(questions.map((q) => [String(q._id), q]));
  return order
    .map((id) => by.get(String(id)))
    .filter(Boolean)
    .map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      topic: q.topic,
      points: q.points,
      options: (q.options ?? []).map((o: any) => ({ id: o.id, text: o.text })), // never expose `correct`
    }));
}

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// Start (or resume) an attempt. The server stores startedAt/endsAt; the client never supplies time.
quizzesRouter.post("/quizzes/:id/attempts", requireAuth, async (req: Request, res: Response) => {
  const quiz = await QuizModel.findById(oid(req.params.id));
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await canAccessCourse(req, quiz.courseId);
  const questions = await QuestionModel.find({ quizId: quiz._id }).sort({ order: 1 });
  if (!questions.length) throw new AppError(409, "EMPTY_QUIZ", "This quiz has no questions yet");

  const now = new Date();
  let attempt = await AttemptModel.findOne({ quizId: quiz._id, userId: req.user!._id, submittedAt: { $exists: false } });
  if (attempt && attempt.endsAt.getTime() + GRACE_SECONDS * 1000 < now.getTime()) {
    await finalize(attempt, true); // stale unsubmitted attempt counts as used and is auto-submitted
    attempt = null;
  }
  if (!attempt) {
    const used = await AttemptModel.countDocuments({ quizId: quiz._id, userId: req.user!._id });
    if (used >= quiz.maxAttempts) throw new AppError(409, "ATTEMPTS_EXHAUSTED", "No attempts left for this quiz");
    attempt = await AttemptModel.create({
      quizId: quiz._id,
      userId: req.user!._id,
      courseId: quiz.courseId,
      startedAt: now,
      endsAt: new Date(now.getTime() + quiz.timeLimitMinutes * 60_000),
      questionOrder: (quiz.shuffle ? shuffle(questions) : questions).map((q) => q._id),
    });
  }
  res.status(201).json({
    attemptId: String(attempt._id),
    quizId: String(quiz._id),
    startedAt: attempt.startedAt.toISOString(),
    endsAt: attempt.endsAt.toISOString(),
    serverNow: new Date().toISOString(),
    questions: publicQuestions(questions, attempt.questionOrder),
    answers: attempt.answers ?? {},
    flagged: attempt.flagged,
  });
});

async function loadOwnAttempt(req: Request) {
  const attempt = await AttemptModel.findById(oid(req.params.id));
  if (!attempt || String(attempt.userId) !== String(req.user!._id)) throw new AppError(404, "NOT_FOUND", "Attempt not found");
  return attempt;
}

quizzesRouter.put("/attempts/:id/answers", requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({ questionId: z.string(), answer: z.union([z.string(), z.array(z.string()), z.null()]).optional(), flagged: z.boolean().optional() })
    .parse(req.body);
  const attempt = await loadOwnAttempt(req);
  if (attempt.submittedAt) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  if (Date.now() > attempt.endsAt.getTime() + GRACE_SECONDS * 1000) throw new AppError(409, "ATTEMPT_EXPIRED", "Time is up");
  if (!attempt.questionOrder.some((q) => String(q) === body.questionId)) throw new AppError(400, "BAD_QUESTION", "Question is not part of this attempt");
  if (body.answer !== undefined) {
    attempt.answers = { ...(attempt.answers as object), [body.questionId]: body.answer };
    attempt.markModified("answers");
  }
  if (body.flagged !== undefined) {
    const s = new Set(attempt.flagged);
    body.flagged ? s.add(body.questionId) : s.delete(body.questionId);
    attempt.flagged = [...s];
  }
  await attempt.save();
  res.json({ ok: true });
});

async function finalize(attempt: any, timedOut: boolean) {
  const quiz = await QuizModel.findById(attempt.quizId);
  const questions = await QuestionModel.find({ quizId: attempt.quizId });
  let scorePoints = 0;
  let maxPoints = 0;
  const review = questions.map((q) => {
    const given = (attempt.answers as Record<string, unknown>)?.[String(q._id)];
    const earned = scoreAnswer({ id: String(q._id), type: q.type as any, points: q.points, correct: q.correct }, given);
    scorePoints += earned;
    maxPoints += q.points;
    return {
      questionId: String(q._id),
      prompt: q.prompt,
      correct: earned === q.points,
      earned,
      points: q.points,
      explanation: q.explanation ?? undefined,
      correctOptionIds: q.type === "short" ? [] : q.correct,
      given,
    };
  });
  attempt.submittedAt = new Date();
  attempt.timedOut = timedOut;
  attempt.scorePoints = scorePoints;
  attempt.maxPoints = maxPoints;
  attempt.scorePercent = maxPoints ? (scorePoints / maxPoints) * 100 : 0;
  attempt.passed = attempt.scorePercent >= (quiz?.passMarkPercent ?? 70);
  await attempt.save();
  return review;
}

quizzesRouter.post("/attempts/:id/submit", requireAuth, async (req: Request, res: Response) => {
  const attempt = await loadOwnAttempt(req);
  if (attempt.submittedAt) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  const timedOut = Date.now() > attempt.endsAt.getTime() + GRACE_SECONDS * 1000;
  const review = await finalize(attempt, timedOut);
  let certificateIssued = false;
  if (attempt.passed) certificateIssued = (await evaluateCompletion(attempt.userId, attempt.courseId)).issued;
  res.json({
    attemptId: String(attempt._id),
    scorePoints: attempt.scorePoints,
    maxPoints: attempt.maxPoints,
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    timedOut,
    certificateIssued,
    review,
  });
});

// --- Instructor: create quiz with questions, and per-question analytics ---
const QuizBody = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  unitLabel: z.string().optional(),
  timeLimitMinutes: z.number().int().min(1).max(240).default(20),
  passMarkPercent: z.number().min(1).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(20).default(3),
  required: z.boolean().default(true),
  questions: z
    .array(
      z.object({
        type: z.enum(["single", "multiple", "true_false", "short"]),
        prompt: z.string().min(1),
        topic: z.string().optional(),
        points: z.number().min(1).default(1),
        options: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
        correct: z.array(z.string()).min(1),
        explanation: z.string().optional(),
      })
    )
    .min(1),
});

async function ownCourse(req: Request, courseId: string) {
  const course = await CourseModel.findById(oid(courseId));
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && String(course.instructorId) !== String(req.user!._id)) throw new AppError(403, "FORBIDDEN", "Not your course");
  return course;
}

quizzesRouter.post("/courses/:courseId/quizzes", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  await ownCourse(req, req.params.courseId);
  const { questions, ...meta } = QuizBody.parse(req.body);
  const quiz = await QuizModel.create({ ...meta, courseId: req.params.courseId });
  await QuestionModel.insertMany(
    questions.map((q, i) => ({ ...q, correct: q.type === "short" ? q.correct.map((c) => c.trim().toLowerCase()) : q.correct, quizId: quiz._id, order: i }))
  );
  res.status(201).json({ quiz: await summarise(quiz, req.user!._id) });
});

quizzesRouter.get("/quizzes/:id/analytics", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const quiz = await QuizModel.findById(oid(req.params.id));
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await ownCourse(req, String(quiz.courseId));
  const [questions, attempts] = await Promise.all([
    QuestionModel.find({ quizId: quiz._id }).sort({ order: 1 }),
    AttemptModel.find({ quizId: quiz._id, submittedAt: { $exists: true } }),
  ]);
  const perQuestion = questions.map((q) => {
    const answered = attempts.filter((a) => (a.answers as any)?.[String(q._id)] != null);
    const right = answered.filter((a) =>
      scoreAnswer({ id: String(q._id), type: q.type as any, points: q.points, correct: q.correct }, (a.answers as any)[String(q._id)]) === q.points
    ).length;
    return { questionId: String(q._id), prompt: q.prompt, answered: answered.length, correctRate: answered.length ? right / answered.length : null };
  });
  res.json({
    attempts: attempts.length,
    passRate: attempts.length ? attempts.filter((a) => a.passed).length / attempts.length : null,
    avgScorePercent: attempts.length ? attempts.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / attempts.length : null,
    perQuestion,
  });
});
