import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { courseComplete } from "@learnly/shared";
import { prisma } from "../db.js";
import { BUCKETS, s3Internal, s3Public } from "./s3.js";
import { logger } from "../logger.js";

/** Recomputes progress and, when every lesson is done and required quizzes are passed, completes the course and issues a certificate. */
export async function evaluateCompletion(userId: string, courseId: string): Promise<{ certificateId?: string; issued: boolean }> {
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrolment) return { issued: false };
  const lessons = await prisma.lesson.findMany({ where: { courseId }, select: { id: true } });
  const lessonIds = lessons.map((l) => l.id);
  const done = enrolment.completedLessons;
  let progress = enrolment.progressPercent;
  if (lessonIds.length) progress = Math.min(100, Math.round((done.filter((d) => lessonIds.includes(d)).length / lessonIds.length) * 100));
  const quizzes = await prisma.quiz.findMany({ where: { courseId, required: true }, select: { id: true } });
  const required = await Promise.all(
    quizzes.map(async (q) => ({ id: q.id, passed: !!(await prisma.attempt.findFirst({ where: { quizId: q.id, userId, passed: true }, select: { id: true } })) }))
  );
  if (!courseComplete(lessonIds, done, required)) {
    await prisma.enrolment.update({ where: { id: enrolment.id }, data: { progressPercent: progress } });
    return { issued: false };
  }
  await prisma.enrolment.update({ where: { id: enrolment.id }, data: { status: "completed", progressPercent: 100 } });
  const existing = await prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return { issued: false, certificateId: existing.id };
  let cert;
  try {
    cert = await prisma.certificate.create({ data: { code: makeCode(), userId, courseId } });
  } catch (e: any) {
    // a concurrent completion issued it first: the unique (userId, courseId) key makes that the only certificate
    if (e?.code === "P2002") {
      const won = await prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
      return { issued: false, certificateId: won?.id };
    }
    throw e;
  }
  // PDF rendering is best-effort here; the download endpoint renders on demand if it is missing.
  try {
    await renderCertificatePdf(cert.id);
  } catch (err) {
    logger.warn({ err }, "certificate PDF render failed, will retry on download");
  }
  return { issued: true, certificateId: cert.id };
}

export function makeCode(): string {
  return `LRN-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function certificateView(certId: string) {
  const cert = await prisma.certificate.findUnique({ where: { id: certId }, include: { course: { include: { instructor: { select: { name: true } } } } } });
  if (!cert) return null;
  const user = await prisma.user.findUnique({ where: { id: cert.userId }, select: { name: true } });
  return {
    id: cert.id,
    code: cert.code,
    courseId: cert.courseId,
    courseTitle: cert.course?.title ?? "Course",
    studentName: user?.name ?? "Student",
    instructorName: cert.course?.instructor?.name ?? "Instructor",
    issuedAt: cert.issuedAt.toISOString(),
    hours: cert.course?.estimatedHours ?? 0,
  };
}

export async function renderCertificatePdf(certId: string): Promise<string> {
  const v = await certificateView(certId);
  if (!v) throw new Error("certificate not found");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const blue = rgb(0.145, 0.388, 0.922);
  const center = (t: string, y: number, size: number, f = font, color = rgb(0.06, 0.09, 0.16)) =>
    page.drawText(t, { x: (842 - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color });
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: blue, borderWidth: 2 });
  center("LEARNLY", 490, 28, bold, blue);
  center("CERTIFICATE OF COMPLETION", 460, 14);
  center("This is to certify that", 410, 14);
  center(v.studentName, 365, 36, bold);
  center("has successfully completed", 325, 14);
  center(v.courseTitle, 285, 26, bold, blue);
  center(`Issued ${new Date(v.issuedAt).toDateString()}  |  ${v.hours} hours  |  Instructor: ${v.instructorName}`, 235, 12);
  center(`Credential ${v.code}`, 90, 12, bold);
  center(`Verify at /verify/${v.code}`, 70, 10);
  const bytes = await pdf.save();
  const key = `certificates/${v.id}.pdf`;
  await s3Internal.send(new PutObjectCommand({ Bucket: BUCKETS.private, Key: key, Body: bytes, ContentType: "application/pdf" }));
  await prisma.certificate.update({ where: { id: certId }, data: { pdfKey: key } });
  return key;
}

/** 5-minute presigned download URL. */
export async function certificateDownloadUrl(certId: string): Promise<string> {
  let cert = await prisma.certificate.findUnique({ where: { id: certId } });
  if (!cert) throw new Error("certificate not found");
  if (!cert.pdfKey) {
    await renderCertificatePdf(certId);
    cert = await prisma.certificate.findUnique({ where: { id: certId } });
  }
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: BUCKETS.private, Key: cert!.pdfKey! }), { expiresIn: 300 });
}
