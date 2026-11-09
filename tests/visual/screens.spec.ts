import { test, expect, type APIRequestContext } from "@playwright/test";

// Demo login created by `pnpm seed`.
const STUDENT = { email: "student@learnly.local", password: "password123" };

interface Ids { courseId: string; lessonId: string; quizId: string; certId: string; sessionId: string }
let ids: Ids;

async function login(request: APIRequestContext) {
  const r = await request.post("/api/auth/login", { data: STUDENT });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).accessToken as string;
}

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL });
  const token = await login(request);
  const h = { Authorization: `Bearer ${token}` };
  const mine = await (await request.get("/api/my-courses", { headers: h })).json();
  const courseId = mine.enrolments[0].course.id as string;
  const course = await (await request.get(`/api/courses/${courseId}`, { headers: h })).json();
  const lessonId = course.course.sections[0].lessons[0].id as string;
  const quizzes = await (await request.get(`/api/courses/${courseId}/quizzes`, { headers: h })).json();
  const certs = await (await request.get("/api/certificates", { headers: h })).json();
  const live = await (await request.get("/api/live", { headers: h })).json();
  ids = { courseId, lessonId, quizId: quizzes.quizzes[0]?.id, certId: certs.certificates[0]?.id, sessionId: live.sessions[0]?.id };
});

test.beforeEach(async ({ page, request }) => {
  const token = await login(request);
  // The app keeps the access token in memory and refreshes it from the cookie; log in through the UI session.
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(STUDENT.email);
  await page.getByLabel(/password/i).fill(STUDENT.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL("**/", { timeout: 15_000 });
  void token;
});

// [mockup folder, route builder, tag]. Mockup folders live in design/stitch.
const screens: [string, (i: Ids) => string, "@desktop" | "@mobile"][] = [
  ["learnly_home_my_courses_desktop", () => "/", "@desktop"],
  ["learnly_home_my_courses_mobile", () => "/", "@mobile"],
  ["learnly_course_page_cs_101_overview", (i) => `/courses/${i.courseId}`, "@desktop"],
  ["learnly_course_page_cs_101_mobile", (i) => `/courses/${i.courseId}`, "@mobile"],
  ["learnly_lesson_player_curriculum_desktop", (i) => `/courses/${i.courseId}/lessons/${i.lessonId}`, "@desktop"],
  ["learnly_lesson_player_mobile", (i) => `/courses/${i.courseId}/lessons/${i.lessonId}`, "@mobile"],
  ["learnly_quiz_interface_question_navigator", (i) => `/courses/${i.courseId}/quizzes/${i.quizId}`, "@desktop"],
  ["learnly_quiz_interface_mobile", (i) => `/courses/${i.courseId}/quizzes/${i.quizId}`, "@mobile"],
  ["learnly_live_classes_lobby", () => "/live", "@desktop"],
  ["learnly_live_class_room_dark_stage", (i) => `/live/${i.sessionId}`, "@desktop"],
  ["learnly_certificate_of_completion_verification", (i) => `/certificates/${i.certId}`, "@desktop"],
];

for (const [folder, route, tag] of screens) {
  test(`${folder} ${tag}`, async ({ page }) => {
    await page.goto(route(ids));
    await page.waitForLoadState("networkidle");
    // soft: a mismatch is reported in the HTML report but does not stop the other screens
    await expect.soft(page).toHaveScreenshot(`${folder}/screen.png`, { fullPage: true });
  });
}
