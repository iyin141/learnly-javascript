import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import pino from "pino";
import { EnrolmentModel, CourseModel } from "../../api/src/db.js";
import { LiveSessionModel } from "../../api/src/db-learning.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: false,
});
const FROM = process.env.MAIL_FROM || "Learnly <no-reply@learnly.local>";

export function startNotificationWorkers(connection: any) {
  const email = new Worker(
    "email",
    async (job: Job<{ to: string; subject: string; text: string }>) => {
      await transport.sendMail({ from: FROM, ...job.data });
    },
    { connection, concurrency: 5 }
  );

  // Delayed job queued 15 minutes before a class: tell every enrolled student.
  const reminders = new Worker(
    "reminders",
    async (job: Job<{ sessionId: string }>) => {
      const s = await LiveSessionModel.findById(job.data.sessionId);
      if (!s || s.status !== "scheduled") return;
      const course = await CourseModel.findById(s.courseId);
      const enrolments = await EnrolmentModel.find({ courseId: s.courseId }).populate("userId", "email");
      for (const e of enrolments) {
        const to = (e.userId as any)?.email;
        if (to) await transport.sendMail({ from: FROM, to, subject: `Starting soon: ${s.title}`, text: `${course?.title}: "${s.title}" starts in 15 minutes. Join from the Live page.` });
      }
    },
    { connection }
  );
  for (const w of [email, reminders]) w.on("failed", (j, err) => logger.error({ queue: w.name, id: j?.id, err: err.message }, "job failed"));
  return [email, reminders];
}
