"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { VideoPlayer } from "../../../../../components/VideoPlayer";
import { LessonList } from "../../../../../components/LessonList";
import { CourseTabs } from "../../../../../components/CourseTabs";
import { CircularProgress } from "../../../../../components/CircularProgress";
import { useGetCourseQuery, useMarkCompleteMutation } from "../../../../../store/apiSlice";

export default function LessonPlayerPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useGetCourseQuery(id);
  const [markComplete, { isLoading: marking }] = useMarkCompleteMutation();

  const course = data?.course;
  const enrolment = data?.enrolment;
  const flat = useMemo(() => (course?.sections ?? []).flatMap((s) => s.lessons), [course]);
  const idx = flat.findIndex((l) => l.id === lessonId);
  const lesson = flat[idx];
  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  const completed = new Set(enrolment?.completedLessons ?? []);
  const section = course?.sections?.find((s) => s.id === lesson?.sectionId);
  const progress = enrolment?.progressPercent ?? 0;

  if (isLoading) return <div className="p-margin"><div className="h-96 rounded-xl bg-border animate-pulse" /></div>;
  if (isError || !course || !lesson)
    return (
      <div className="p-margin">
        <div role="alert" className="bg-card rounded-xl border border-border p-space-lg">
          Lesson not found. <Link className="text-primary underline" href="/">Back to my courses</Link>
        </div>
      </div>
    );

  const goNext = () => next && router.push(`/courses/${id}/lessons/${next.id}`);

  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <nav className="font-caption text-caption text-ink-secondary flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Learnly</Link> <span>/</span>
        <Link href={`/courses/${id}`} className="hover:text-primary">{course.title}</Link> <span>/</span>
        <span>{section?.title}</span> <span>/</span>
        <span className="text-ink">{lesson.title}</span>
      </nav>
      <h1 className="font-headline-lg text-headline-lg text-ink">{course.title}</h1>
      <CourseTabs courseId={id} active="Lessons" />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-gutter">
        <div className="flex flex-col gap-gutter min-w-0">
          {lesson.type === "video" ? (
            <VideoPlayer key={lesson.id} lessonId={lesson.id} title={lesson.title} onEnded={goNext} />
          ) : (
            <article className="bg-card rounded-xl border border-border p-space-lg whitespace-pre-wrap font-body-lg text-body-lg text-ink">
              {lesson.textContent || "No content yet."}
            </article>
          )}

          <section className="bg-card rounded-xl border border-border p-space-md md:p-space-lg flex flex-col gap-space-md">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-space-md">
              <div>
                {section && <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary font-caption text-caption">{section.title}</span>}
                <p className="font-caption text-caption text-ink-secondary mt-1">Published by {course.instructorName}</p>
                <h2 className="font-headline-lg text-headline-lg text-ink mt-1">{lesson.title}</h2>
              </div>
              <button
                disabled={marking || completed.has(lesson.id)}
                onClick={() => markComplete(lesson.id)}
                className="min-h-11 px-space-lg rounded-full bg-accent text-white font-label-md text-label-md inline-flex items-center justify-center gap-space-xs disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                {completed.has(lesson.id) ? "Completed" : "Mark as Complete"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-space-sm bg-canvas rounded-xl p-space-sm">
              {prev ? (
                <Link href={`/courses/${id}/lessons/${prev.id}`} className="min-h-11 flex items-center gap-space-xs text-ink-secondary hover:text-ink min-w-0">
                  <span className="material-symbols-outlined">arrow_back</span>
                  <span className="truncate">Prev: {prev.title}</span>
                </Link>
              ) : <span />}
              <span className="hidden sm:block font-caption text-caption text-ink-secondary whitespace-nowrap">Lesson {idx + 1} of {flat.length}</span>
              {next ? (
                <Link href={`/courses/${id}/lessons/${next.id}`} className="min-h-11 flex items-center gap-space-xs text-primary font-medium min-w-0">
                  <span className="truncate">Next: {next.title}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              ) : <span />}
            </div>
          </section>

          <section className="bg-card rounded-xl border border-border p-space-md md:p-space-lg">
            <h3 className="font-headline-md text-headline-md text-ink mb-space-sm">Lesson Summary</h3>
            <p className="font-body-lg text-body-lg text-ink-secondary">{course.description}</p>
          </section>
        </div>

        <aside className="flex flex-col gap-gutter min-w-0">
          <div className="bg-card rounded-xl border border-border p-space-md flex items-center gap-space-md">
            <CircularProgress percent={progress} />
            <div>
              <p className="font-label-md text-label-md font-semibold text-ink">Course Progress</p>
              <p className="font-caption text-caption text-ink-secondary">{completed.size} of {flat.length} lessons completed</p>
              {progress === 100 && <Link href="/certificates" className="font-caption text-caption text-primary underline">View certificate</Link>}
            </div>
          </div>
          <LessonList courseId={id} sections={course.sections ?? []} activeLessonId={lesson.id} completed={completed} />
          <div className="bg-card rounded-xl border border-border p-space-md flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{course.instructorName?.[0]}</div>
            <div className="min-w-0">
              <p className="font-label-md text-label-md font-semibold text-ink truncate">{course.instructorName}</p>
              <p className="font-caption text-caption text-ink-secondary">Instructor</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
