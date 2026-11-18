"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircularProgress } from "../../../components/CircularProgress";
import { LessonList } from "../../../components/LessonList";
import { useAppSelector } from "../../../store";
import {
  useGetCourseQuery,
  useGetCourseQuizzesQuery,
  useEnrollCourseMutation,
  useCheckoutCourseMutation,
  useVerifyPaymentMutation,
  useGetLiveSessionsQuery,
  useGetCoursePeopleQuery,
} from "../../../store/apiSlice";

type Tab = "overview" | "lessons" | "quizzes" | "live" | "people";
const TABS: Tab[] = ["overview", "lessons", "quizzes", "live", "people"];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export default function CourseOverviewPage() {
  const params = useParams();
  const courseId = params?.id as string;
  const user = useAppSelector((s) => s.auth.user);

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: serverData, isLoading, isError, error } = useGetCourseQuery(courseId);
  const course = serverData?.course;
  const enrolment = serverData?.enrolment;
  const { data: quizzes } = useGetCourseQuizzesQuery(courseId, { skip: !enrolment });
  const { data: liveData } = useGetLiveSessionsQuery(undefined, { skip: !user });
  // the roster is for the course's students, its instructor and admins (the API enforces the same rule)
  const canSeePeople = !!user && (!!enrolment || user.role === "admin" || user.id === course?.instructorId);
  const { data: people, isLoading: peopleLoading, isError: peopleError } = useGetCoursePeopleQuery(courseId, { skip: !canSeePeople || activeTab !== "people" });
  const liveSessions = (liveData?.sessions ?? []).filter((l) => l.courseId === courseId && l.status !== "ended");
  const liveNow = liveSessions.filter((l) => l.status === "live").length;
  const [enroll, { isLoading: enrolling, error: enrollError }] = useEnrollCourseMutation();
  const [checkout, { isLoading: buying }] = useCheckoutCourseMutation();
  const [verifyPayment] = useVerifyPaymentMutation();
  const [buyError, setBuyError] = useState("");
  const [payMsg, setPayMsg] = useState<{ kind: "pending" | "paid" | "failed"; text: string } | null>(null);
  const verifiedRef = useRef(false);
  const priceCents = course?.priceCents ?? 0;
  /** Paid course: start checkout. Mock provider enrols at once; Stripe/Paystack return a hosted page and come back with ?payment=<id>. */
  async function buy() {
    setBuyError("");
    try {
      const r = await checkout(courseId).unwrap();
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
    } catch (e: any) { setBuyError(e?.data?.error?.message ?? "Payment could not be started"); }
  }

  // back from the payment page: ask the API to confirm the payment; the mutation invalidates Course/MyCourses so the page refetches
  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get("payment");
    if (!paymentId || !user || verifiedRef.current) return;
    verifiedRef.current = true;
    setPayMsg({ kind: "pending", text: "Confirming your payment..." });
    verifyPayment(paymentId)
      .unwrap()
      .then((r) =>
        setPayMsg(
          r.status === "paid"
            ? { kind: "paid", text: "Payment received. You are enrolled in this course." }
            : r.status === "failed"
              ? { kind: "failed", text: "The payment did not go through. You were not charged. You can try again." }
              : { kind: "pending", text: "Your payment is still pending. It can take a minute; reload this page to check again." },
        ),
      )
      .catch((e: any) => setPayMsg({ kind: "failed", text: e?.data?.error?.message ?? "Could not confirm the payment. Reload to try again." }));
  }, [user, verifyPayment]);

  const completed = new Set(enrolment?.completedLessons ?? []);
  const flat = (course?.sections ?? []).flatMap((s) => s.lessons);
  const resumeLesson = flat.find((l) => l.id === enrolment?.lastLessonId) ?? flat.find((l) => !completed.has(l.id)) ?? flat[0];

  // honour ?tab= from the CourseTabs links used on other course routes
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.includes(t)) setActiveTab(t);
  }, []);

  if (isLoading) return <div className="p-margin"><div className="h-64 rounded-card bg-border animate-pulse" /></div>;
  if (isError || !course) {
    const status = (error as { status?: number } | undefined)?.status;
    const notFound = status === 404 || status === 400;
    return (
      <div className="p-margin text-center flex flex-col items-center gap-space-md">
        <h1 className="font-headline-lg text-headline-lg text-ink">{notFound ? "Course not found" : "Could not load this course"}</h1>
        <p role="alert" className="text-ink-secondary">{notFound ? "It may have been removed or is not published yet." : "Something went wrong. Please try again."}</p>
        <Link href="/" className="text-primary font-semibold hover:underline">Back to courses</Link>
      </div>
    );
  }

  const title = course.title;
  const instructor = course.instructorName;
  const progressPercent = enrolment?.progressPercent ?? 0;
  const tabCls = (t: Tab) =>
    `relative pb-space-xs font-label-md text-label-md flex items-center gap-space-xs transition-colors ${
      activeTab === t
        ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
        : "text-ink-secondary hover:text-ink"
    }`;
  const badge = "bg-slate-200 text-ink-secondary px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold";

  return (
    <div className="w-full p-margin-sm md:p-margin flex flex-col gap-space-lg">
      {payMsg && (
        <div role="status" className={`p-3 rounded-lg border text-sm ${payMsg.kind === "paid" ? "bg-green-50 border-green-200 text-green-800" : payMsg.kind === "failed" ? "bg-red-50 border-red-200 text-danger" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {payMsg.text}
        </div>
      )}
      {/* Top Breadcrumb & Tab Bar */}
      <div className="flex flex-col gap-space-md">
        <nav className="flex items-center gap-space-xs font-caption text-caption text-ink-secondary">
          <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">school</span>
            <span>Learnly</span>
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-ink font-label-md text-label-md font-medium truncate">{title}</span>
        </nav>

        <div className="flex items-center gap-space-lg overflow-x-auto border-b border-border pb-1">
          <button onClick={() => setActiveTab("overview")} className={tabCls("overview")}><span>Overview</span></button>
          <button onClick={() => setActiveTab("lessons")} className={tabCls("lessons")}>
            <span>Lessons</span><span className={badge}>{course.totalLessons}</span>
          </button>
          <button onClick={() => setActiveTab("quizzes")} className={tabCls("quizzes")}>
            <span>Quizzes</span><span className={badge}>{course.totalQuizzes}</span>
          </button>
          {canSeePeople && (
            <button onClick={() => setActiveTab("people")} className={tabCls("people")}>
              <span>People</span>{people && <span className={badge}>{people.total + (people.instructor ? 1 : 0)}</span>}
            </button>
          )}
          <button onClick={() => setActiveTab("live")} className={tabCls("live")}>
            <span>Live</span>
            {liveNow > 0 && (
              <span className="bg-chip-done-bg text-chip-done-fg px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping"></span>
                {liveNow} Live
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Hero Course Banner */}
      <section className="relative overflow-hidden rounded-card bg-gradient-to-r from-primary to-blue-700 text-white p-space-lg md:p-space-xl shadow-sm">
        <div className="absolute -right-12 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
          <div className="flex flex-col max-w-2xl">
            <div className="flex items-center gap-space-sm mb-space-xs">
              {course.status !== "published" && (
                <span className="bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full font-label-sm text-label-sm tracking-wide uppercase font-semibold">
                  {course.status === "in_review" ? "In review" : "Draft"}
                </span>
              )}
              <span className="font-caption text-caption text-white/80">Code: {course.code}</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-white mb-space-xs tracking-tight font-bold">{title}</h1>
            <p className="font-body-md text-body-md text-white/90 flex flex-wrap items-center gap-x-space-sm gap-y-1">
              {course.term && <><span>{course.term}</span><span>•</span></>}
              {course.sectionName && <><span>{course.sectionName}</span><span>•</span></>}
              <span className="font-medium">{instructor}</span>
            </p>
          </div>

          {/* Progress Card Inside Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md sm:gap-space-xl bg-white/10 backdrop-blur-md p-space-md rounded-2xl border border-white/20">
            <div className="flex items-center gap-space-md">
              <CircularProgress percent={progressPercent} size={64} strokeWidth={5} />
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-semibold text-white">Progress Track</span>
                <span className="font-caption text-caption text-white/80">{completed.size} of {flat.length} lessons complete</span>
                <span className="font-caption text-caption text-emerald-300 font-medium mt-0.5">
                  {enrolment ? `${progressPercent}% done` : "Not enrolled"}
                </span>
              </div>
            </div>
            {enrolment ? (
              flat.length > 0 && (
                <Link href={`/courses/${courseId}/lessons/${resumeLesson?.id ?? ""}`} className="w-full sm:w-auto min-h-11 inline-flex items-center justify-center gap-space-xs px-space-lg py-space-sm bg-white text-primary hover:bg-white/90 font-label-md text-label-md font-semibold rounded-full shadow-md transition-all active:scale-95">
                  <span>{completed.size ? "Continue learning" : "Start course"}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              )
            ) : !user ? (
              <Link href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`} className="w-full sm:w-auto min-h-11 inline-flex items-center justify-center px-space-lg py-space-sm bg-white text-primary font-label-md text-label-md font-semibold rounded-full shadow-md">
                Sign in to enrol
              </Link>
            ) : (
              <button disabled={enrolling || buying} onClick={() => (priceCents > 0 ? void buy() : void enroll(courseId))} className="w-full sm:w-auto min-h-11 inline-flex items-center justify-center gap-space-xs px-space-lg py-space-sm bg-white text-primary hover:bg-white/90 font-label-md text-label-md font-semibold rounded-full shadow-md transition-all active:scale-95 disabled:opacity-60">
                <span>{enrolling || buying ? "Working..." : priceCents > 0 ? `Buy for $${(priceCents / 100).toFixed(2)}` : "Enrol in this course"}</span>
              </button>
            )}
            {(buyError || enrollError) && <p role="alert" className="text-red-200 font-caption text-caption">{buyError || (enrollError as any)?.data?.error?.message || "Could not enrol"}</p>}
          </div>
        </div>
      </section>

      {/* Tab content: each tab shows its own data */}
      <div className="bg-card rounded-card p-space-lg shadow-card border border-border flex flex-col gap-space-md">
        {activeTab === "overview" && (
          <>
            <h2 className="font-headline-md text-headline-md text-ink font-bold">About this course</h2>
            <p className="font-body-md text-body-md text-ink whitespace-pre-line">{course.description || "No description yet."}</p>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
              {[
                ["Instructor", instructor],
                ["Lessons", String(course.totalLessons)],
                ["Quizzes", String(course.totalQuizzes)],
                ["Estimated time", course.estimatedHours ? `${course.estimatedHours} h` : "Not set"],
              ].map(([k, v]) => (
                <div key={k} className="bg-canvas rounded-xl p-space-sm">
                  <dt className="font-caption text-caption text-ink-secondary">{k}</dt>
                  <dd className="font-label-md text-label-md text-ink font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {activeTab === "lessons" &&
          (flat.length > 0 ? (
            <LessonList courseId={courseId} sections={course.sections!} completed={completed} activeLessonId={resumeLesson?.id} />
          ) : (
            <p className="text-ink-secondary">No lessons have been published for this course yet.</p>
          ))}

        {activeTab === "quizzes" && (
          <div id="quizzes">
            <h2 className="font-headline-md text-headline-md text-ink mb-space-sm">Quizzes</h2>
            {(quizzes?.quizzes ?? []).length === 0 && <p className="text-ink-secondary font-body-md">{enrolment ? "No quizzes yet." : "Enrol to see quizzes."}</p>}
            <ul className="flex flex-col gap-space-sm">
              {(quizzes?.quizzes ?? []).map((q) => (
                <li key={q.id}>
                  <Link href={`/courses/${courseId}/quizzes/${q.id}`} className="min-h-11 flex items-center justify-between gap-space-sm bg-canvas rounded-xl p-space-md hover:border-primary border border-transparent">
                    <span>
                      <span className="block font-label-md text-label-md text-ink">{q.title}</span>
                      <span className="block font-caption text-caption text-ink-secondary">{q.questionCount} questions, {q.timeLimitMinutes} min, pass {q.passMarkPercent}%</span>
                    </span>
                    <span className={`font-caption px-2 py-0.5 rounded-full ${q.passed ? "bg-chip-done-bg text-chip-done-fg" : "bg-slate-200 text-ink-secondary"}`}>{q.passed ? "Passed" : `${q.attemptsUsed}/${q.maxAttempts} attempts`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "people" && (
          <div>
            <h2 className="font-headline-md text-headline-md text-ink mb-space-sm">People</h2>
            {!canSeePeople && <p className="text-ink-secondary">Enrol in this course to see who is in it.</p>}
            {canSeePeople && peopleLoading && <p className="text-ink-secondary">Loading...</p>}
            {canSeePeople && peopleError && <p className="text-danger" role="alert">The class list could not be loaded.</p>}
            {people && (
              <>
                {people.instructor && (
                  <div className="mb-space-md">
                    <h3 className="font-label-md text-label-md text-ink-secondary mb-space-xs">Instructor</h3>
                    <div className="flex items-center gap-space-sm bg-canvas rounded-xl p-space-md">
                      <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{initials(people.instructor.name)}</span>
                      <span className="font-label-md text-label-md text-ink">{people.instructor.name}</span>
                    </div>
                  </div>
                )}
                <h3 className="font-label-md text-label-md text-ink-secondary mb-space-xs">
                  Students ({people.total}{people.students.length < people.total ? `, showing the first ${people.students.length}` : ""})
                </h3>
                {people.students.length === 0 && <p className="text-ink-secondary">No students are enrolled yet.</p>}
                <ul className="flex flex-col gap-space-sm">
                  {people.students.map((p) => (
                    <li key={p.id} className="flex items-center gap-space-sm bg-canvas rounded-xl p-space-md">
                      <span className="w-10 h-10 rounded-full bg-slate-200 text-ink flex items-center justify-center font-bold shrink-0">{initials(p.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-label-md text-label-md text-ink truncate">{p.name}{p.id === user?.id ? " (you)" : ""}</span>
                        <span className="block font-caption text-caption text-ink-secondary truncate">
                          {p.email ? `${p.email} · ` : ""}Joined {new Date(p.enrolledAt).toLocaleDateString()}
                        </span>
                      </span>
                      {people.detailed && typeof p.progressPercent === "number" && (
                        <span className="font-caption text-caption text-ink-secondary shrink-0">{p.progressPercent}%</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === "live" && (
          <div>
            <h2 className="font-headline-md text-headline-md text-ink mb-space-sm">Live classes</h2>
            {!user && <p className="text-ink-secondary">Sign in to see this course&apos;s live classes.</p>}
            {user && liveSessions.length === 0 && <p className="text-ink-secondary">No live classes are scheduled for this course.</p>}
            <ul className="flex flex-col gap-space-sm">
              {liveSessions.map((l) => (
                <li key={l.id}>
                  <Link href={`/live/${l.id}`} className="min-h-11 flex items-center justify-between gap-space-sm bg-canvas rounded-xl p-space-md hover:border-primary border border-transparent">
                    <span>
                      <span className="block font-label-md text-label-md text-ink">{l.title}</span>
                      <span className="block font-caption text-caption text-ink-secondary">{new Date(l.startsAt).toLocaleString()} · {l.durationMinutes} min</span>
                    </span>
                    <span className={`font-caption px-2 py-0.5 rounded-full ${l.status === "live" ? "bg-chip-done-bg text-chip-done-fg" : "bg-slate-200 text-ink-secondary"}`}>{l.status === "live" ? "Live now" : "Scheduled"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
