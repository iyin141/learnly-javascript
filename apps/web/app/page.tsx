"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CourseCard } from "../components/CourseCard";
import { useAppSelector } from "../store";
import { useGetCoursesQuery, useGetLiveSessionsQuery, useGetMyCoursesQuery } from "../store/apiSlice";

// Literal class names so Tailwind generates them.
const HEADER_BG: Record<string, string> = {
  blue: "bg-subject-blue", coral: "bg-subject-coral", slate: "bg-subject-slate",
  purple: "bg-subject-purple", teal: "bg-subject-teal", amber: "bg-subject-amber",
};

/** Home: the signed-in user's courses and progress, the next live class, and the published catalog. All live data. */
export default function HomePage() {
  const user = useAppSelector((s) => s.auth.user);
  const [filterTab, setFilterTab] = useState<"active" | "completed">("active");

  const { data: catalog, isLoading: catalogLoading } = useGetCoursesQuery();
  const { data: mine } = useGetMyCoursesQuery(undefined, { skip: !user });
  const { data: live } = useGetLiveSessionsQuery(undefined, { skip: !user });

  const enrolments = mine?.enrolments ?? [];
  const inProgress = enrolments.filter((e) => e.progressPercent > 0 && e.progressPercent < 100).slice(0, 2);
  const shown = enrolments.filter((e) => (filterTab === "completed" ? e.progressPercent >= 100 : e.progressPercent < 100));
  const nextLive = (live?.sessions ?? [])
    .filter((s) => s.status === "live" || new Date(s.startsAt).getTime() + s.durationMinutes * 60_000 > Date.now())
    .sort((a, b) => (a.status === "live" ? -1 : b.status === "live" ? 1 : +new Date(a.startsAt) - +new Date(b.startsAt)))[0];
  const enrolledIds = new Set(enrolments.map((e) => e.course.id));
  const courses = (catalog?.courses ?? []).filter((c) => !enrolledIds.has(c.id));
  const teaches = user?.role === "instructor" || user?.role === "admin";

  return (
    <div className="w-full p-margin-sm md:p-margin flex flex-col gap-space-xl">
      {/* Greeting and next live class */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-md [&>*]:min-w-0">
        <div className="lg:col-span-7 bg-card rounded-card shadow-card p-space-md border border-border flex flex-col gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-ink font-semibold break-words">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome to Learnly"}
          </h1>
          <p className="font-body-md text-body-md text-ink-secondary">
            {user
              ? enrolments.length
                ? `You are enrolled in ${enrolments.length} course${enrolments.length === 1 ? "" : "s"}.`
                : teaches
                  ? "Build and publish courses from Teach."
                  : "You are not enrolled in any course yet. Pick one from the list below."
              : "Sign in to track your courses, join live classes and earn certificates."}
          </p>
          <div className="flex flex-wrap gap-space-sm mt-auto">
            {user ? (
              teaches && (
                <Link href="/instructor/courses" className="min-h-11 px-space-md rounded-full bg-primary text-white font-label-md text-label-md inline-flex items-center">
                  Your teaching
                </Link>
              )
            ) : (
              <>
                <Link href="/login" className="min-h-11 px-space-md rounded-full bg-primary text-white font-label-md text-label-md inline-flex items-center">Sign in</Link>
                <Link href="/register" className="min-h-11 px-space-md rounded-full border border-border font-label-md text-label-md inline-flex items-center">Create an account</Link>
              </>
            )}
            <a href="#catalog" className="min-h-11 px-space-md rounded-full border border-border font-label-md text-label-md inline-flex items-center">Browse courses</a>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-900 rounded-card shadow-card p-space-md flex flex-col justify-between gap-space-sm text-white">
          {nextLive ? (
            <>
              <div className="flex items-center gap-space-xs">
                <span className={`w-2 h-2 rounded-full ${nextLive.status === "live" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-slate-300">
                  {nextLive.status === "live" ? "Live now" : new Date(nextLive.startsAt).toLocaleString([], { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div>
                <p className="font-caption text-caption text-slate-300">{nextLive.courseTitle}</p>
                <h3 className="font-headline-md text-headline-md font-semibold break-words">{nextLive.title}</h3>
                <p className="font-caption text-caption text-slate-400">Host: {nextLive.instructorName}</p>
              </div>
              <div className="flex flex-wrap gap-space-sm">
                <Link href={`/live/${nextLive.id}`} className="min-h-11 px-space-md rounded-lg bg-primary font-label-md text-label-md inline-flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[18px]">videocam</span>Join room
                </Link>
                <Link href="/live" className="min-h-11 px-space-md rounded-lg bg-white/10 font-label-md text-label-md inline-flex items-center">All classes</Link>
              </div>
            </>
          ) : (
            <>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-slate-300">Live classes</span>
              <p className="font-body-md text-body-md text-slate-200">
                {user ? "No upcoming live class. Have a room code? Join from the Live page." : "Sign in to see your live classes."}
              </p>
              <Link href="/live" className="min-h-11 px-space-md rounded-lg bg-white/10 font-label-md text-label-md inline-flex items-center w-fit">Open Live</Link>
            </>
          )}
        </div>
      </section>

      {/* Continue learning: real progress only */}
      {inProgress.length > 0 && (
        <section className="flex flex-col gap-space-sm">
          <h2 className="font-headline-lg text-headline-lg text-ink tracking-tight font-semibold">Continue learning</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md [&>*]:min-w-0">
            {inProgress.map((e) => (
              <Link key={e.enrolmentId} href={`/courses/${e.course.id}`} className="bg-card rounded-card shadow-card p-space-md border border-border flex flex-col gap-space-sm hover:shadow-md transition-shadow">
                <span className="font-label-sm text-label-sm text-primary font-semibold">{e.course.code}</span>
                <h3 className="font-headline-md text-headline-md text-ink font-semibold break-words">{e.course.title}</h3>
                <div className="flex justify-between font-caption text-caption text-ink-secondary">
                  <span>{e.completedCount} / {e.totalLessons} lessons</span>
                  <span className="text-ink font-semibold">{e.progressPercent}%</span>
                </div>
                <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(100, e.progressPercent)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* My courses */}
      {user && enrolments.length > 0 && (
        <section className="flex flex-col gap-space-md">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <h2 className="font-headline-lg text-headline-lg text-ink tracking-tight font-semibold">My courses</h2>
            <div className="flex bg-canvas border border-border p-1 rounded-full">
              {(["active", "completed"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setFilterTab(t)}
                  className={`px-space-md py-1 rounded-full font-label-sm text-label-sm font-semibold capitalize transition-all ${filterTab === t ? "bg-card text-ink shadow-sm" : "text-ink-secondary hover:text-ink"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {shown.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md [&>*]:min-w-0">
              {shown.map((e) => (
                <CourseCard key={e.enrolmentId} course={e.course} progressPercent={e.progressPercent} completedLessons={e.completedCount} />
              ))}
            </div>
          ) : (
            <p className="bg-card rounded-card border border-border p-space-lg text-center text-ink-secondary">
              {filterTab === "completed" ? "No completed courses yet." : "Every course you are enrolled in is complete."}
            </p>
          )}
        </section>
      )}

      {/* Catalog */}
      <section id="catalog" className="flex flex-col gap-space-md scroll-mt-20">
        <h2 className="font-headline-lg text-headline-lg text-ink tracking-tight font-semibold">
          {user && enrolments.length ? "More courses" : "Courses"}
        </h2>
        {catalogLoading ? (
          <div className="h-40 rounded-card bg-border animate-pulse" />
        ) : courses.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md [&>*]:min-w-0">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="bg-card rounded-card shadow-card border border-border overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className={`p-space-md text-white ${HEADER_BG[c.subjectColor] ?? HEADER_BG.blue}`}>
                  <span className="font-label-sm text-label-sm uppercase opacity-90">{c.term}</span>
                  <h3 className="font-headline-md text-headline-md font-semibold break-words">{c.title}</h3>
                  <span className="font-caption text-caption opacity-90">{c.instructorName}</span>
                </div>
                <div className="p-space-md flex flex-col gap-space-xs flex-1 font-caption text-caption text-ink-secondary">
                  <span className="line-clamp-2">{c.description}</span>
                  <span>{c.totalLessons} lessons</span>
                  <span className="text-primary font-semibold mt-auto">View course</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="bg-card rounded-card border border-border p-space-lg text-center text-ink-secondary">
            {user && enrolments.length ? "You are enrolled in every published course." : "No published courses yet."}
          </p>
        )}
      </section>
    </div>
  );
}
