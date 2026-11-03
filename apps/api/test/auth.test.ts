import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { UserModel } from "../src/db.js";
import { redis } from "../src/redis.js";
import http from "node:http";

describe("API Auth and Health Suite", { timeout: 20000 }, () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Connect to local Mongo and Redis
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/learnly_test";
    await mongoose.connect(mongoUri);

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await UserModel.deleteMany({ email: /@test\.learnly$/ });
    await mongoose.disconnect();
    try {
      await redis.quit();
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /healthz returns 200 ok", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("POST /api/auth/register creates user with student role and returns accessToken", async () => {
    const email = `student_${Date.now()}@test.learnly`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        email,
        password: "password123",
        role: "student",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe("student");
    expect(body.accessToken).toBeDefined();

    // Check Set-Cookie for refreshToken
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("refreshToken=");
  });

  it("POST /api/auth/register supports instructor role", async () => {
    const email = `instructor_${Date.now()}@test.learnly`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Instructor",
        email,
        password: "password123",
        role: "instructor",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.role).toBe("instructor");
  });

  it("POST /api/auth/register supports admin role", async () => {
    const email = `admin_${Date.now()}@test.learnly`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sys Admin",
        email,
        password: "password123",
        role: "admin",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.role).toBe("admin");
  });

  it("POST /api/auth/login validates credentials and returns token", async () => {
    const email = `login_${Date.now()}@test.learnly`;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Login User",
        email,
        password: "secretPassword",
        role: "student",
      }),
    });

    // Wrong password -> 401
    const badRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong" }),
    });
    expect(badRes.status).toBe(401);
    const badBody = await badRes.json();
    expect(badBody.error.code).toBe("INVALID_CREDENTIALS");

    // Correct password -> 200
    const goodRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "secretPassword" }),
    });
    expect(goodRes.status).toBe(200);
    const goodBody = await goodRes.json();
    expect(goodBody.user.email).toBe(email);
    expect(goodBody.accessToken).toBeDefined();

    // GET /api/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${goodBody.accessToken}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.id).toBe(goodBody.user.id);
  });
});
