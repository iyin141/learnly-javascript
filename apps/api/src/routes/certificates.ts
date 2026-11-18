import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { prisma, isUuid } from "../db.js";
import { certificateDownloadUrl, certificateView } from "../services/learning.js";

export const certificatesRouter = Router();

certificatesRouter.get("/certificates", requireAuth, async (req: Request, res: Response) => {
  const certs = await prisma.certificate.findMany({ where: { userId: req.user!.id }, orderBy: { issuedAt: "desc" }, select: { id: true } });
  const certificates = (await Promise.all(certs.map((c) => certificateView(c.id)))).filter(Boolean);
  res.json({ certificates });
});

async function ownCert(req: Request) {
  if (!isUuid(req.params.id)) throw new AppError(400, "INVALID_ID", "Invalid id");
  const cert = await prisma.certificate.findUnique({ where: { id: req.params.id } });
  if (!cert || (cert.userId !== req.user!.id && req.user!.role !== "admin")) throw new AppError(404, "NOT_FOUND", "Certificate not found");
  return cert;
}

certificatesRouter.get("/certificates/:id", requireAuth, async (req: Request, res: Response) => {
  const cert = await ownCert(req);
  res.json({ certificate: await certificateView(cert.id) });
});

certificatesRouter.get("/certificates/:id/download", requireAuth, async (req: Request, res: Response) => {
  const cert = await ownCert(req);
  res.json({ url: await certificateDownloadUrl(cert.id) });
});

// Public: anyone with the code can verify authenticity.
certificatesRouter.get("/verify/:code", async (req: Request, res: Response) => {
  const cert = await prisma.certificate.findUnique({ where: { code: req.params.code.toUpperCase() } });
  if (!cert) return res.status(404).json({ valid: false });
  res.json({ valid: true, certificate: await certificateView(cert.id) });
});
