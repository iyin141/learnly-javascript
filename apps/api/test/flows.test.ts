import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db.js";
import { redis } from "../src/redis.js";

/** End-to-end API flow on the Prisma/Postgres data layer: build a course, learn, take a quiz, get a certificate, check authz and error paths. */
describe("learning flow on PostgreSQL", { timeout: 60000 }, () => {
  let server: http.Server;
  let base: string;
  const tag = `fl${Date.now()}`;
  let ins = "", stu = "", other = "", courseId = "", sectionId = "", lessonId = "", quizId = "";

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    let j: any = null; try { j = await r.json(); } catch { /* empty body */ }
    return { s: r.status, j };
  };
  const register = async (role: string, n: string) => (await call("POST", "/api/auth/register", undefined, { name: n, email: `${n}_${tag}@test.learnly`, password: "password123", role })).j.accessToken as string;

  beforeAll(async () => {
    await prisma.$connect();
    server = http.createServer(createApp());
    await new Promise<void>((res) => server.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; res(); }));
    ins = await register("instructor", "ins"); stu = await register("student", "stu"); other = await register("student", "oth");
  });

  afterAll(async () => {
    await prisma.course.deleteMany({ where: { instructor: { email: { endsWith: `_${tag}@test.learnly` } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `_${tag}@test.learnly` } } });
    await prisma.$disconnect();
    try { await redis.quit(); } catch { /* ignore */ }
    await new Promise<void>((res) => server.close(() => res()));
  });

  it("instructor builds a course: section, lesson, reorder; others cannot edit it", async () => {
    courseId = (await call("POST", "/api/instructor/courses", ins, { title: "Flow Course", code: "FLW1" })).j.course.id;
    sectionId = (await call("POST", `/api/courses/${courseId}/sections`, ins, { title: "Unit 1" })).j.section.id;
    const l = await call("POST", `/api/courses/${courseId}/sections/${sectionId}/lessons`, ins, { title: "Read me", type: "text", textContent: "hello" });
    expect(l.s).toBe(201); lessonId = l.j.lesson.id;
    expect((await call("PUT", `/api/courses/${courseId}/reorder`, ins, { lessons: [{ id: lessonId, sectionId, order: 5 }] })).s).toBe(200);
    expect((await call("POST", `/api/courses/${courseId}/sections`, stu, { title: "x" })).s).toBe(403);
    expect((await call("POST", `/api/courses/${courseId}/sections`, ins, { title: "" })).s).toBe(400);
    expect((await call("PUT", `/api/courses/not-a-uuid/reorder`, ins, {})).s).toBe(404);
    expect((await call("DELETE", `/api/courses/${courseId}/lessons/00000000-0000-0000-0000-000000000000`, ins)).s).toBe(404);
  });

  it("publish, list and detail show the curriculum; bad ids are 400, unknown ids 404", async () => {
    expect((await call("POST", `/api/instructor/courses/${courseId}/submit`, ins)).j.status).toBe("in_review");
    await prisma.course.update({ where: { id: courseId }, data: { status: "published" } });
    const list = await call("GET", "/api/courses", stu);
    expect(list.j.courses.some((c: any) => c.id === courseId && c.totalLessons === 1)).toBe(true);
    const d = await call("GET", `/api/courses/${courseId}`, stu);
    expect(d.j.course.sections[0].lessons[0].title).toBe("Read me");
    expect(d.j.enrolment).toBeNull();
    expect((await call("GET", "/api/courses/xyz", stu)).s).toBe(400);
    expect((await call("GET", "/api/courses/00000000-0000-0000-0000-000000000000", stu)).s).toBe(404);
  });

  it("quiz: created by the instructor, hidden answers, timed attempt, grading, single submit", async () => {
    const q = await call("POST", `/api/courses/${courseId}/quizzes`, ins, {
      title: "Check", passMarkPercent: 70, maxAttempts: 2, timeLimitMinutes: 10,
      questions: [
        { type: "single", prompt: "2+2?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }], correct: ["b"] },
        { type: "short", prompt: "Capital of France?", correct: ["Paris"] },
      ],
    });
    expect(q.s).toBe(201); quizId = q.j.quiz.id; expect(q.j.quiz.questionCount).toBe(2);

    expect((await call("POST", `/api/courses/${courseId}/enroll`, stu)).s).toBe(201);
    expect((await call("POST", `/api/quizzes/${quizId}/attempts`, other)).s).toBe(403); // not enrolled
    const at = await call("POST", `/api/quizzes/${quizId}/attempts`, stu);
    expect(at.s).toBe(201);
    expect(JSON.stringify(at.j)).not.toContain('"correct"'); // answers never reach the client
    const attemptId = at.j.attemptId;
    for (const qq of at.j.questions) {
      const answer = qq.type === "short" ? "paris" : "b";
      expect((await call("PUT", `/api/attempts/${attemptId}/answers`, stu, { questionId: qq.id, answer })).s).toBe(200);
    }
    expect((await call("PUT", `/api/attempts/${attemptId}/answers`, other, { questionId: at.j.questions[0].id, answer: "a" })).s).toBe(404); // not yours
    const sub = await call("POST", `/api/attempts/${attemptId}/submit`, stu);
    expect(sub.s).toBe(200); expect(sub.j.scorePercent).toBe(100); expect(sub.j.passed).toBe(true);
    expect((await call("POST", `/api/attempts/${attemptId}/submit`, stu)).s).toBe(409); // already submitted
    expect((await call("PUT", `/api/attempts/${attemptId}/answers`, stu, { questionId: at.j.questions[0].id, answer: "a" })).s).toBe(409);
  });

  it("finishing the last lesson completes the course and issues exactly one verifiable certificate", async () => {
    const done = await call("POST", `/api/lessons/${lessonId}/complete`, stu);
    expect(done.s).toBe(200); expect(done.j.progressPercent).toBe(100);
    expect(await prisma.certificate.count({ where: { courseId } })).toBe(1);
    await call("POST", `/api/lessons/${lessonId}/complete`, stu); // repeat is harmless
    expect(await prisma.certificate.count({ where: { courseId } })).toBe(1);
    const certs = await call("GET", "/api/certificates", stu);
    expect(certs.j.certificates).toHaveLength(1);
    const code = certs.j.certificates[0].code;
    expect((await call("GET", `/api/verify/${code}`)).j.valid).toBe(true);
    expect((await call("GET", "/api/verify/LRN-0000-NOPE")).s).toBe(404);
    expect((await call("GET", `/api/certificates/${certs.j.certificates[0].id}`, other)).s).toBe(404); // someone else's
    expect((await call("GET", "/api/my-courses?status=completed", stu)).j.enrolments).toHaveLength(1);
  });

  it("deleting a section removes its lessons; admin-only routes refuse non-admins; revenue is scoped to the instructor", async () => {
    expect((await call("DELETE", `/api/courses/${courseId}/sections/${sectionId}`, ins)).s).toBe(200);
    expect(await prisma.lesson.count({ where: { courseId } })).toBe(0);
    expect((await call("GET", "/api/admin/users", ins)).s).toBe(403);
    expect((await call("GET", "/api/admin/users")).s).toBe(401);
    const rev = await call("GET", "/api/instructor/revenue", ins);
    expect(rev.s).toBe(200); expect(rev.j.totalEnrolments).toBe(1);
    expect((await call("GET", "/api/instructor/revenue", other)).s).toBe(403);
  });

  it("duplicate registration is a clean 409, malformed login a 400", async () => {
    const r = await call("POST", "/api/auth/register", undefined, { name: "Dup", email: `ins_${tag}@test.learnly`, password: "password123", role: "student" });
    expect(r.s).toBe(409);
    expect((await call("POST", "/api/auth/login", undefined, { email: "nope" })).s).toBe(400);
  });
});
