"use client";

import React, { useState } from "react";
import { useGetInstructorCoursesQuery, useScheduleLiveMutation } from "../../../store/apiSlice";

export default function ScheduleLivePage() {
  const { data, isLoading: coursesLoading, isError: coursesError } = useGetInstructorCoursesQuery();
  const [schedule, { isLoading, isSuccess, error }] = useScheduleLiveMutation();
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const msg = (error as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message;
  const field = "min-h-11 rounded-xl border border-border px-space-md bg-card";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = courseId || data?.courses[0]?.id;
    if (id) void schedule({ courseId: id, title, startsAt: new Date(startsAt).toISOString(), durationMinutes: duration });
  };

  return (
    <form onSubmit={onSubmit} className="p-margin-sm md:p-margin max-w-xl flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Schedule a live class</h1>
      {coursesLoading && <div className="h-16 rounded-xl bg-border animate-pulse" />}
      {coursesError && <p role="alert" className="text-danger">Could not load your courses.</p>}
      {!coursesLoading && !coursesError && (data?.courses ?? []).length === 0 && <p className="bg-card rounded-xl border border-border p-space-lg text-ink-secondary">You have no courses yet. Create a course before scheduling a live class.</p>}
      <label className="flex flex-col gap-1">
        Course
        <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {(data?.courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}: {c.title}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Title<input required className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="flex flex-col gap-1">Starts at<input required type="datetime-local" className={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
      <label className="flex flex-col gap-1">Duration (minutes)<input type="number" min={5} max={480} className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
      {msg && <p role="alert" className="text-danger">{msg}</p>}
      {isSuccess && <p role="status" className="text-success">Scheduled. Students see it in the Live lobby and get a reminder email 15 minutes before.</p>}
      <button disabled={isLoading || !(data?.courses ?? []).length} className="min-h-11 rounded-full bg-primary text-white font-label-md disabled:opacity-50">Schedule</button>
    </form>
  );
}
