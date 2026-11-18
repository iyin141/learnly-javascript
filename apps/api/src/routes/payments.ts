import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { prisma, isUuid } from "../db.js";
import { getPaymentProvider, platformFee } from "../services/payments.js";

export const paymentsRouter = Router();

/** Pending -> paid exactly once (the status filter is the guard), then enrol. Safe to call twice: webhook retries, double clicks. */
export async function fulfilPayment(paymentId: string, eventId?: string, amountCents?: number): Promise<boolean> {
  if (!isUuid(paymentId)) return false;
  return prisma.$transaction(async (tx) => {
    const hit = await tx.payment.updateMany({
      where: { id: paymentId, status: "pending", ...(amountCents !== undefined ? { amountCents } : {}) },
      data: { status: "paid", ...(eventId ? { eventId } : {}) },
    });
    if (hit.count !== 1) return false;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    // payment and enrolment commit together: a paid payment without access (or the reverse) cannot exist
    await tx.enrolment.upsert({
      where: { userId_courseId: { userId: p.userId, courseId: p.courseId } },
      update: {},
      create: { userId: p.userId, courseId: p.courseId, status: "active", progressPercent: 0, completedLessons: [] },
    });
    return true;
  });
}

// POST /api/courses/:id/checkout - buy a paid course (test mode)
paymentsRouter.post("/courses/:id/checkout", authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new AppError(400, "INVALID_ID", "Invalid course ID format");
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
  if (!course.priceCents) throw new AppError(400, "COURSE_IS_FREE", "This course is free: use the enrol endpoint");
  if (await prisma.enrolment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: course.id } }, select: { id: true } })) {
    throw new AppError(409, "ALREADY_ENROLLED", "Already enrolled");
  }

  const provider = getPaymentProvider();
  const payment = await prisma.payment.create({
    data: {
      userId: req.user!.id, courseId: course.id, amountCents: course.priceCents, feeCents: platformFee(course.priceCents),
      provider: provider.name, status: "pending", currency: config.payments.currency,
    },
  });
  let session;
  try {
    session = await provider.createSession({
      paymentId: payment.id, amountCents: course.priceCents, courseTitle: course.title, email: req.user!.email,
      returnUrl: `${config.webOrigin}/courses/${course.id}`,
    });
  } catch (e) {
    // gateway down or misconfigured: do not leave a payment hanging as pending, and tell the client it is retryable
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    logger.error({ err: e, paymentId: payment.id }, "payment provider failed to create a session");
    throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "The payment service is unavailable. You were not charged. Please try again.");
  }
  if (session.ref) await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: session.ref } });
  if (session.paidNow) {
    await fulfilPayment(payment.id);
    res.status(201).json({ status: "paid", paymentId: payment.id, provider: provider.name });
    return;
  }
  res.status(202).json({ status: "pending", paymentId: payment.id, checkoutUrl: session.url, provider: provider.name });
});

// POST /api/payments/webhook - gateway callback (signature over the raw body, idempotent per event id)
paymentsRouter.post("/payments/webhook", async (req: Request, res: Response) => {
  const raw: Buffer = (req as any).rawBody ?? Buffer.alloc(0);
  const ev = getPaymentProvider().parseWebhook(raw, req.header("stripe-signature") ?? undefined);
  if (!ev) throw new AppError(401, "INVALID_SIGNATURE", "Invalid webhook signature");
  if (await prisma.payment.findUnique({ where: { eventId: ev.eventId }, select: { id: true } })) {
    res.json({ status: "duplicate" });
    return;
  }
  const ok = await fulfilPayment(ev.paymentId, ev.eventId, ev.amountCents);
  res.json({ status: ok ? "posted" : "ignored" });
});

// GET /api/payments/mine - the caller's payment history
paymentsRouter.get("/payments/mine", authenticate, async (req: Request, res: Response) => {
  const rows = await prisma.payment.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 50, include: { course: { select: { title: true } } } });
  res.json({ payments: rows.map((p) => ({ id: p.id, course: p.course?.title ?? "", amountCents: p.amountCents, status: p.status, provider: p.provider, createdAt: p.createdAt })) });
});
