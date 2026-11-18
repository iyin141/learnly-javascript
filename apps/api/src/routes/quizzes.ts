import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { scoreAnswer, type QuizSummary, type QuizQuestionPublic } from "@learnly/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { prisma, Prisma, isUuid } from "../db.js";
import type { Attempt, Question, Quiz } from "@learnly/db";
import { evaluateCompletion } from "../services/learning.js";

export const quizzesRouter = Router();
/** Seconds of tolerance after endsAt for network latency on the final autosave/submit. */
export const GRACE_SECONDS = 5;

const oid = (v: string) => {
  if (!isUuid(v)) throw new AppError(400, "INVALID_ID", "Invalid id");
  return v;
};

type Opt = { id: string; text: string };
const optsOf = (q: { options: unknown }) => ((q.options ?? []) as Opt[]);
const answersOf = (a: { answers: unknown }) => ((a.answers ?? {}) as Record<string, unknown>);
const scoreInput = (q: Question) => ({ id: q.id, type: q.type as "single" | "multiple" | "true_false" | "short", points: q.points, correct: q.correct });

async function canAccessCourse(req: Request, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  const u = req.user!;
  if (u.role === "admin" || course.instructorId === u.id) return { course, staff: true };
  if (!(await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: u.id, courseId } }, select: { id: true } })))
    throw new AppError(403, "FORBIDDEN", "You must be enrolled in this course");
  return { course, staff: false };
}

async function summarise(quiz: Quiz, userId: string): Promise<QuizSummary> {
  const [qs, attempts] = await Promise.all([
    prisma.question.findMany({ where: { quizId: quiz.id }, select: { points: true } }),
    prisma.attempt.findMany({ where: { quizId: quiz.id, userId }, select: { submittedAt: true, scorePercent: true, passed: true } }),
  ]);
  const submitted = attempts.filter((a) => a.submittedAt);
  const inProgress = attempts.length - submitted.length;
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    title: quiz.title,
    description: quiz.description,
    unitLabel: quiz.unitLabel ?? undefined,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passMarkPercent: quiz.passMarkPercent,
    maxAttempts: quiz.maxAttempts,
    questionCount: qs.length,
    totalPoints: qs.reduce((a, q) => a + (q.points ?? 1), 0),
    attemptsUsed: submitted.length + inProgress,
    bestScorePercent: submitted.length ? Math.max(...submitted.map((a) => a.scorePercent ?? 0)) : undefined,
    passed: submitted.some((a) => a.passed),
    required: quiz.required,
  };
}

quizzesRouter.get("/courses/:courseId/quizzes", requireAuth, async (req: Request, res: Response) => {
  const courseId = oid(req.params.courseId);
  await canAccessCourse(req, courseId);
  const quizzes = await prisma.quiz.findMany({ where: { courseId }, orderBy: { createdAt: "asc" } });
  res.json({ quizzes: await Promise.all(quizzes.map((q) => summarise(q, req.user!.id))) });
});

quizzesRouter.get("/quizzes/:id", requireAuth, async (req: Request, res: Response) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: oid(req.params.id) } });
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await canAccessCourse(req, quiz.courseId);
  res.json({ quiz: await summarise(quiz, req.user!.id) });
});

function publicQuestions(questions: Question[], order: string[]): QuizQuestionPublic[] {
  const by = new Map(questions.map((q) => [q.id, q]));
  return order
    .map((id) => by.get(id))
    .filter((q): q is Question => !!q)
    .map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      topic: q.topic ?? undefined,
      points: q.points,
      options: optsOf(q).map((o) => ({ id: o.id, text: o.text })), // never expose `correct`
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
  const quiz = await prisma.quiz.findUnique({ where: { id: oid(req.params.id) } });
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await canAccessCourse(req, quiz.courseId);
  const questions = await prisma.question.findMany({ where: { quizId: quiz.id }, orderBy: { order: "asc" } });
  if (!questions.length) throw new AppError(409, "EMPTY_QUIZ", "This quiz has no questions yet");

  const now = new Date();
  let attempt = await prisma.attempt.findFirst({ where: { quizId: quiz.id, userId: req.user!.id, submittedAt: null } });
  if (attempt && attempt.endsAt.getTime() + GRACE_SECONDS * 1000 < now.getTime()) {
    await finalize(attempt, true); // stale unsubmitted attempt counts as used and is auto-submitted
    attempt = null;
  }
  if (!attempt) {
    const used = await prisma.attempt.count({ where: { quizId: quiz.id, userId: req.user!.id } });
    if (used >= quiz.maxAttempts) throw new AppError(409, "ATTEMPTS_EXHAUSTED", "No attempts left for this quiz");
    attempt = await prisma.attempt.create({
      data: {
        quizId: quiz.id,
        userId: req.user!.id,
        courseId: quiz.courseId,
        startedAt: now,
        endsAt: new Date(now.getTime() + quiz.timeLimitMinutes * 60_000),
        questionOrder: (quiz.shuffle ? shuffle(questions) : questions).map((q) => q.id),
      },
    });
  }
  res.status(201).json({
    attemptId: attempt.id,
    quizId: quiz.id,
    startedAt: attempt.startedAt.toISOString(),
    endsAt: attempt.endsAt.toISOString(),
    serverNow: new Date().toISOString(),
    questions: publicQuestions(questions, attempt.questionOrder),
    answers: answersOf(attempt),
    flagged: attempt.flagged,
  });
});

async function loadOwnAttempt(req: Request) {
  const attempt = await prisma.attempt.findUnique({ where: { id: oid(req.params.id) } });
  if (!attempt || attempt.userId !== req.user!.id) throw new AppError(404, "NOT_FOUND", "Attempt not found");
  return attempt;
}

quizzesRouter.put("/attempts/:id/answers", requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({ questionId: z.string(), answer: z.union([z.string(), z.array(z.string()), z.null()]).optional(), flagged: z.boolean().optional() })
    .parse(req.body);
  const attempt = await loadOwnAttempt(req);
  if (attempt.submittedAt) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  if (Date.now() > attempt.endsAt.getTime() + GRACE_SECONDS * 1000) throw new AppError(409, "ATTEMPT_EXPIRED", "Time is up");
  if (!attempt.questionOrder.includes(body.questionId)) throw new AppError(400, "BAD_QUESTION", "Question is not part of this attempt");
  const data: Prisma.AttemptUpdateInput = {};
  if (body.answer !== undefined) data.answers = { ...answersOf(attempt), [body.questionId]: body.answer } as Prisma.InputJsonObject;
  if (body.flagged !== undefined) {
    const s = new Set(attempt.flagged);
    if (body.flagged) s.add(body.questionId); else s.delete(body.questionId);
    data.flagged = [...s];
  }
  // only an open attempt can be written: the submittedAt filter closes the race with a simultaneous submit
  const r = await prisma.attempt.updateMany({ where: { id: attempt.id, submittedAt: null }, data: data as Prisma.AttemptUpdateManyMutationInput });
  if (r.count !== 1) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  res.json({ ok: true });
});

async function finalize(attempt: Attempt, timedOut: boolean) {
  const quiz = await prisma.quiz.findUnique({ where: { id: attempt.quizId } });
  const questions = await prisma.question.findMany({ where: { quizId: attempt.quizId } });
  const given = answersOf(attempt);
  let scorePoints = 0;
  let maxPoints = 0;
  const review = questions.map((q) => {
    const earned = scoreAnswer(scoreInput(q), given[q.id] as never);
    scorePoints += earned;
    maxPoints += q.points;
    return {
      questionId: q.id,
      prompt: q.prompt,
      correct: earned === q.points,
      earned,
      points: q.points,
      explanation: q.explanation ?? undefined,
      correctOptionIds: q.type === "short" ? [] : q.correct,
      given: given[q.id],
    };
  });
  const scorePercent = maxPoints ? (scorePoints / maxPoints) * 100 : 0;
  const passed = scorePercent >= (quiz?.passMarkPercent ?? 70);
  // finalise exactly once: a second concurrent submit matches zero rows
  const r = await prisma.attempt.updateMany({
    where: { id: attempt.id, submittedAt: null },
    data: { submittedAt: new Date(), timedOut, scorePoints, maxPoints, scorePercent, passed },
  });
  if (r.count !== 1) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  return { review, scorePoints, maxPoints, scorePercent, passed };
}

quizzesRouter.post("/attempts/:id/submit", requireAuth, async (req: Request, res: Response) => {
  const attempt = await loadOwnAttempt(req);
  if (attempt.submittedAt) throw new AppError(409, "ATTEMPT_CLOSED", "Attempt already submitted");
  const timedOut = Date.now() > attempt.endsAt.getTime() + GRACE_SECONDS * 1000;
  const result = await finalize(attempt, timedOut);
  let certificateIssued = false;
  if (result.passed) certificateIssued = (await evaluateCompletion(attempt.userId, attempt.courseId)).issued;
  res.json({
    attemptId: attempt.id,
    scorePoints: result.scorePoints,
    maxPoints: result.maxPoints,
    scorePercent: result.scorePercent,
    passed: result.passed,
    timedOut,
    certificateIssued,
    review: result.review,
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
  const course = await prisma.course.findUnique({ where: { id: oid(courseId) } });
  if (!course) throw new AppError(404, "NOT_FOUND", "Course not found");
  if (req.user!.role !== "admin" && course.instructorId !== req.user!.id) throw new AppError(403, "FORBIDDEN", "Not your course");
  return course;
}

quizzesRouter.post("/courses/:courseId/quizzes", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  await ownCourse(req, req.params.courseId);
  const { questions, ...meta } = QuizBody.parse(req.body);
  // quiz and questions in one transaction: no quiz without its questions
  const quiz = await prisma.quiz.create({
    data: {
      ...meta,
      courseId: req.params.courseId,
      questions: {
        create: questions.map((q, i) => ({
          type: q.type,
          prompt: q.prompt,
          topic: q.topic,
          points: q.points,
          options: q.options as Prisma.InputJsonValue,
          correct: q.type === "short" ? q.correct.map((c) => c.trim().toLowerCase()) : q.correct,
          explanation: q.explanation,
          order: i,
        })),
      },
    },
  });
  res.status(201).json({ quiz: await summarise(quiz, req.user!.id) });
});

quizzesRouter.get("/quizzes/:id/analytics", requireAuth, requireRole("instructor", "admin"), async (req: Request, res: Response) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: oid(req.params.id) } });
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found");
  await ownCourse(req, quiz.courseId);
  const [questions, attempts] = await Promise.all([
    prisma.question.findMany({ where: { quizId: quiz.id }, orderBy: { order: "asc" } }),
    prisma.attempt.findMany({ where: { quizId: quiz.id, submittedAt: { not: null } } }),
  ]);
  const perQuestion = questions.map((q) => {
    const answered = attempts.filter((a) => answersOf(a)[q.id] != null);
    const right = answered.filter((a) => scoreAnswer(scoreInput(q), answersOf(a)[q.id] as never) === q.points).length;
    return { questionId: q.id, prompt: q.prompt, answered: answered.length, correctRate: answered.length ? right / answered.length : null };
  });
  res.json({
    attempts: attempts.length,
    passRate: attempts.length ? attempts.filter((a) => a.passed).length / attempts.length : null,
    avgScorePercent: attempts.length ? attempts.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / attempts.length : null,
    perQuestion,
  });
});
