import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Stateless password-reset token: no table needed. It is bound to the current password hash, so using it
// (which changes the hash) or changing the password any other way makes it stop working.
const key = () => crypto.createHmac("sha256", config.jwtAccessSecret).update("learnly:password-reset").digest();
const fingerprint = (passwordHash: string) => crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);

export function signResetToken(user: { id: string; passwordHash: string }): string {
  return jwt.sign({ purpose: "pwreset", sub: user.id, fp: fingerprint(user.passwordHash) }, key(), { expiresIn: "30m" });
}

/** Returns the user id when the token is genuine and unexpired, else null. Caller must still check {@link resetTokenMatches}. */
export function readResetToken(token: string): { userId: string; fp: string } | null {
  try {
    const p = jwt.verify(token, key()) as { purpose?: string; sub?: string; fp?: string };
    return p.purpose === "pwreset" && p.sub && p.fp ? { userId: p.sub, fp: p.fp } : null;
  } catch {
    return null;
  }
}

export const resetTokenMatches = (fp: string, passwordHash: string) => fp === fingerprint(passwordHash);
