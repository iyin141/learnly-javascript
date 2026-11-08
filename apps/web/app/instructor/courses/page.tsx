"use client";

import React from "react";
import Link from "next/link";
import { useGetInstructorCoursesQuery, useSubmitForReviewMutation } from "../../../store/apiSlice";
import { Edit3, Eye } from "lucide-react";

export default function InstructorCoursesIndexPage() {
  const { data, isLoading, isError } = useGetInstructorCoursesQuery();
  const [submit, { isLoading: submitting }] = useSubmitForReviewMutation();
  const courses = data?.courses ?? [];
  return (
    <div className="p-margin-sm md:p-margin max-w-6xl mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-ink">Instructor Courses</h1>
          <p className="text-ink-secondary">Build curriculum, upload video, schedule classes and publish.</p>
        </div>
        <nav className="flex gap-space-sm">
          <Link href="/instructor/live" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Schedule live</Link>
          <Link href="/instructor/revenue" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Revenue</Link>
          <Link href="/instructor/quizzes" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Quizzes</Link>
        </nav>
      </div>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Log in as an instructor to manage courses.</p>}
      {!isLoading && !isError && courses.length === 0 && <p className="bg-card rounded-xl border border-border p-space-lg text-center text-ink-secondary">You have no courses yet.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {courses.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{c.code}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 capitalize">{c.status.replace("_", " ")}</span>
            </div>
            <h3 className="font-label-md text-label-md font-bold text-ink">{c.title}</h3>
            <p className="font-caption text-caption text-ink-secondary">{c.lessons} lessons, {c.students} students</p>
            <div className="flex gap-space-sm mt-auto">
              <Link href={`/instructor/courses/${c.id}/builder`} className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-lg text-sm font-semibold"><Edit3 className="w-4 h-4" />Builder</Link>
              {c.status === "draft" && <button disabled={submitting} onClick={() => submit(c.id)} className="min-h-11 px-3 rounded-lg border border-border text-sm">Submit for review</button>}
              <Link href={`/courses/${c.id}`} aria-label="View course" className="min-w-11 min-h-11 inline-flex items-center justify-center border border-border rounded-lg"><Eye className="w-4 h-4" /></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
