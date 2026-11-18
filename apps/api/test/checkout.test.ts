import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import http from "node:http";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db.js";
import { redis } from "../src/redis.js";
import { MockProvider, StripeProvider, setPaymentProvider } from "../src/services/payments.js";

describe("paid course checkout (test mode)", { timeout: 30000 }, () => {
  let server: http.Server;
  let base: string;
  const tag = `co${Date.now()}`;
  let insTok = "", stuTok = "", stu2Tok = "", courseId = "";

  const call = async (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
    let j: any = null; try { j = await r.json(); } catch { /* empty */ }
    return { s: r.status, j };
  };
  const register = async (role: string, n: string) =>
    (await call("POST", "/api/auth/register", undefined, { name: n, email: `${n}_${tag}@test.learnly`, password: "password123", role })).j.accessToken as string;

  beforeAll(async () => {
    await prisma.$connect();
    setPaymentProvider(new MockProvider());
    server = http.createServer(createApp());
    await new Promise<void>((res) => server.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; res(); }));
    insTok = await register("instructor", "ins"); stuTok = await register("student", "stu"); stu2Tok = await register("student", "stu2");
    const created = await call("POST", "/api/instructor/courses", insTok, { title: "Paid Course", code: "PAY1", priceCents: 4900 });
    courseId = created.j.course.id;
  });

  afterAll(async () => {
    // courses cascade to payments and enrolments; users last (courses reference the instructor)
    await prisma.course.deleteMany({ where: { instructor: { email: { endsWith: `_${tag}@test.learnly` } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `_${tag}@test.learnly` } } });
    setPaymentProvider(null);
    await prisma.$disconnect();
    try { await redis.quit(); } catch { /* ignore */ }
    await new Promise<void>((res) => server.close(() => res()));
  });

  it("free enrolment is refused on a paid course (402) and checkout is refused on a free one", async () => {
    expect((await call("POST", `/api/courses/${courseId}/enroll`, stuTok)).s).toBe(402);
    const insUser = await prisma.user.findFirstOrThrow({ where: { email: `ins_${tag}@test.learnly` } });
    const free = await prisma.course.create({ data: { title: "Free", code: "F1", description: "d", instructorId: insUser.id, status: "published" } });
    expect((await call("POST", `/api/courses/${free._id}/checkout`, stuTok)).s).toBe(400);
    await prisma.course.delete({ where: { id: free.id } });
  });

  it("mock checkout enrols at once, records a 10% platform fee, and cannot be bought twice", async () => {
    const r = await call("POST", `/api/courses/${courseId}/checkout`, stuTok);
    expect(r.s).toBe(201); expect(r.j.status).toBe("paid");
    expect(await prisma.enrolment.count({ where: { courseId } })).toBe(1);
    const p = await prisma.payment.findFirst({ where: { courseId } });
    expect(p).toMatchObject({ amountCents: 4900, feeCents: 490, status: "paid", provider: "mock" });
    expect((await call("POST", `/api/courses/${courseId}/checkout`, stuTok)).s).toBe(409);
    expect((await call("GET", "/api/payments/mine", stuTok)).j.payments).toHaveLength(1);
  });

  it("instructor revenue shows net (after fee) and gross; a student cannot read it", async () => {
    const r = await call("GET", "/api/instructor/revenue", insTok);
    expect(r.s).toBe(200);
    expect(r.j.totalEarningsCents).toBe(4410); expect(r.j.totalGrossCents).toBe(4900); expect(r.j.totalEnrolments).toBe(1);
    expect((await call("GET", "/api/instructor/revenue", stuTok)).s).toBe(403);
  });

  it("stripe webhook: bad signature 401; valid one enrols exactly once; replay is a duplicate; wrong amount is ignored", async () => {
    setPaymentProvider(new StripeProvider("sk_test_x", "whsec_x"));
    const stu2 = await prisma.user.findFirst({ where: { email: `stu2_${tag}@test.learnly` } });
    const pay = await prisma.payment.create({ data: { userId: stu2!.id, courseId, amountCents: 4900, feeCents: 490, provider: "stripe", status: "pending" } });
    const sign = (raw: string) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac("sha256", "whsec_x").update(`${t}.${raw}`).digest("hex")}`; };
    const event = (id: string, amount: number) => JSON.stringify({ id, type: "checkout.session.completed", data: { object: { client_reference_id: pay.id, amount_total: amount, payment_status: "paid" } } });

    const raw = event("evt_a", 4900);
    expect((await call("POST", "/api/payments/webhook", undefined, raw, { "stripe-signature": "t=1,v1=00" })).s).toBe(401);
    const wrongAmt = event("evt_w", 100);
    expect((await call("POST", "/api/payments/webhook", undefined, wrongAmt, { "stripe-signature": sign(wrongAmt) })).j.status).toBe("ignored");
    expect(await prisma.enrolment.count({ where: { userId: stu2!.id } })).toBe(0);

    expect((await call("POST", "/api/payments/webhook", undefined, raw, { "stripe-signature": sign(raw) })).j.status).toBe("posted");
    expect((await call("POST", "/api/payments/webhook", undefined, raw, { "stripe-signature": sign(raw) })).j.status).toBe("duplicate");
    expect(await prisma.enrolment.count({ where: { userId: stu2!.id } })).toBe(1);
    expect((await prisma.payment.findUnique({ where: { id: pay.id } }))?.status).toBe("paid");
    void stu2Tok;
  });
});
