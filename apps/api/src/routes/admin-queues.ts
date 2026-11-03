import { Router, Request, Response } from "express";
import { videoQueue, emailQueue, certificateQueue, remindersQueue } from "../services/queue.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const adminQueuesRouter = Router();

const queuesMap: Record<string, typeof videoQueue> = {
  video: videoQueue,
  email: emailQueue,
  certificate: certificateQueue,
  reminders: remindersQueue,
};

/**
 * GET /api/admin/queues/stats
 */
adminQueuesRouter.get(
  "/api/admin/queues/stats",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const stats: Record<string, any> = {};

    for (const [name, queue] of Object.entries(queuesMap)) {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused"
      );
      stats[name] = counts;
    }

    res.status(200).json({ stats });
  }
);

/**
 * GET /api/admin/queues/:name/jobs
 */
adminQueuesRouter.get(
  "/api/admin/queues/:name/jobs",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const queue = queuesMap[req.params.name];
    if (!queue) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Queue not found" } });
    }

    const status = (req.query.status as any) || "failed";
    const jobs = await queue.getJobs([status], 0, 50, true);

    const formatted = jobs.map((j) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      progress: j.progress,
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
      finishedOn: j.finishedOn,
    }));

    res.status(200).json({ queue: req.params.name, status, jobs: formatted });
  }
);

/**
 * POST /api/admin/queues/:name/retry/:jobId
 */
adminQueuesRouter.post(
  "/api/admin/queues/:name/retry/:jobId",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const queue = queuesMap[req.params.name];
    if (!queue) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Queue not found" } });
    }

    const job = await queue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
    }

    await job.retry();
    res.status(200).json({ success: true, message: `Job ${job.id} queued for retry` });
  }
);

/**
 * GET /admin/queues
 * Clean HTML dashboard for admin inspection
 */
adminQueuesRouter.get("/admin/queues", async (req: Request, res: Response) => {
  try {
    const statsHtml = await Promise.all(
      Object.entries(queuesMap).map(async ([name, queue]) => {
        const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
        return `
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05)">
            <h3 style="margin-top:0; font-size:18px; color:#1e293b; text-transform:capitalize;">${name} Queue</h3>
            <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin-top:15px; text-align:center;">
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="font-size:12px; color:#64748b;">Waiting</div>
                <div style="font-size:20px; font-weight:700; color:#2563eb;">${counts.waiting}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="font-size:12px; color:#64748b;">Active</div>
                <div style="font-size:20px; font-weight:700; color:#16a34a;">${counts.active}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="font-size:12px; color:#64748b;">Completed</div>
                <div style="font-size:20px; font-weight:700; color:#0f172a;">${counts.completed}</div>
              </div>
              <div style="background:#fef2f2; padding:10px; border-radius:8px;">
                <div style="font-size:12px; color:#ef4444;">Failed</div>
                <div style="font-size:20px; font-weight:700; color:#dc2626;">${counts.failed}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="font-size:12px; color:#64748b;">Delayed</div>
                <div style="font-size:20px; font-weight:700; color:#d97706;">${counts.delayed}</div>
              </div>
            </div>
          </div>
        `;
      })
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Learnly — BullMQ Queues Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 30px; }
            .header { max-width: 1000px; margin: 0 auto 30px auto; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #2563eb; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            .grid { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .footer { max-width: 1000px; margin: 40px auto 0 auto; font-size: 13px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Learnly Queue Manager</h1>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">BullMQ Redis Job Queues & Worker Telemetry</p>
            </div>
            <div>
              <span class="badge">Live Redis: 6379</span>
            </div>
          </div>
          <div class="grid">
            ${statsHtml.join("")}
          </div>
          <div class="footer">
            Learnly BullMQ Admin Monitor • Port 4000 • Auto-refreshes on reload
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error({ err }, "Failed to render /admin/queues dashboard");
    res.status(500).send("Error loading queues dashboard");
  }
});
