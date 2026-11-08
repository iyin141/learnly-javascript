import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { CertificateModel } from "../db-learning.js";
import { certificateDownloadUrl, certificateView } from "../services/learning.js";

export const certificatesRouter = Router();

certificatesRouter.get("/certificates", requireAuth, async (req: Request, res: Response) => {
  const certs = await CertificateModel.find({ userId: req.user!._id }).sort({ issuedAt: -1 });
  const certificates = (await Promise.all(certs.map((c) => certificateView(String(c._id))))).filter(Boolean);
  res.json({ certificates });
});

async function ownCert(req: Request) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, "INVALID_ID", "Invalid id");
  const cert = await CertificateModel.findById(req.params.id);
  if (!cert || (String(cert.userId) !== String(req.user!._id) && req.user!.role !== "admin"))
    throw new AppError(404, "NOT_FOUND", "Certificate not found");
  return cert;
}

certificatesRouter.get("/certificates/:id", requireAuth, async (req: Request, res: Response) => {
  const cert = await ownCert(req);
  res.json({ certificate: await certificateView(String(cert._id)) });
});

certificatesRouter.get("/certificates/:id/download", requireAuth, async (req: Request, res: Response) => {
  const cert = await ownCert(req);
  res.json({ url: await certificateDownloadUrl(String(cert._id)) });
});

// Public: anyone with the code can verify authenticity.
certificatesRouter.get("/verify/:code", async (req: Request, res: Response) => {
  const cert = await CertificateModel.findOne({ code: req.params.code.toUpperCase() });
  if (!cert) return res.status(404).json({ valid: false });
  res.json({ valid: true, certificate: await certificateView(String(cert._id)) });
});
