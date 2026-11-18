import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signResetToken, readResetToken, resetTokenMatches } from "../src/services/reset-token.js";

describe("password reset token", () => {
  const user = { id: "u1", passwordHash: "hash-a" };
  it("round-trips and is bound to the password hash", () => {
    const r = readResetToken(signResetToken(user))!;
    expect(r.userId).toBe("u1");
    expect(resetTokenMatches(r.fp, "hash-a")).toBe(true);
    expect(resetTokenMatches(r.fp, "hash-b")).toBe(false); // password changed -> token is dead
  });
  it("rejects garbage and tokens of another purpose", () => {
    expect(readResetToken("nope")).toBeNull();
    const access = jwt.sign({ purpose: "access", sub: "u1", fp: "x" }, "dev-access-secret-change-me");
    expect(readResetToken(access)).toBeNull();
  });
});
