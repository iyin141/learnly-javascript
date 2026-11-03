import React from "react";
import Link from "next/link";
import type { Course, SubjectColor } from "@learnly/shared";

interface CourseCardProps {
  course: Course;
  progressPercent?: number;
  completedLessons?: number;
  nextUpTitle?: string;
}

const colorClassMap: Record<SubjectColor, { bg: string; text: string }> = {
  blue: { bg: "bg-subject-blue", text: "text-white" },
  coral: { bg: "bg-subject-coral", text: "text-white" },
  slate: { bg: "bg-subject-slate", text: "text-white" },
  purple: { bg: "bg-subject-purple", text: "text-white" },
  teal: { bg: "bg-subject-teal", text: "text-white" },
  amber: { bg: "bg-subject-amber", text: "text-white" },
};

export function CourseCard({
  course,
  progressPercent = 0,
  completedLessons = 0,
  nextUpTitle = "Module 1: Getting Started",
}: CourseCardProps) {
  const color = colorClassMap[course.subjectColor] || colorClassMap.blue;

  return (
    <div className="bg-card rounded-card overflow-hidden shadow-card hover:shadow-card-hover border border-border transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Colored Header Band */}
        <div className={`h-24 ${color.bg} p-space-md ${color.text} relative flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="font-caption text-caption uppercase tracking-wider font-semibold opacity-90">
              {course.term || "Fall 2026"}
            </span>
            {course.isLiveNow ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger text-white font-caption text-caption font-bold shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>Live now</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-white/20 font-caption text-caption font-semibold">
                {course.sectionName || "Section 01"}
              </span>
            )}
          </div>
          <div className="pr-12">
            <h3 className="font-headline-md text-headline-md font-bold leading-tight truncate">
              {course.title}
            </h3>
            <p className="font-caption text-caption opacity-90 truncate">
              {course.instructorName}
            </p>
          </div>
          {/* Overlapping Avatar */}
          <div className="absolute right-4 -bottom-5 w-11 h-11 rounded-full overflow-hidden shadow-md bg-card p-0.5 border border-border">
            {course.instructorAvatar ? (
              <img
                src={course.instructorAvatar}
                alt={course.instructorName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                {course.instructorName.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-space-md pt-7 flex flex-col gap-space-sm">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-ink-secondary uppercase font-semibold tracking-wider">
              Next up
            </span>
            <Link
              href={`/courses/${course.id}`}
              className="font-body-md text-body-md text-ink font-semibold truncate group-hover:text-primary transition-colors"
            >
              {nextUpTitle}
            </Link>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-caption text-caption text-ink-secondary">Progress</span>
              <span className="font-caption text-caption text-ink font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-ink-secondary font-caption text-caption">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">auto_stories</span>
              <span>
                {completedLessons} / {course.totalLessons || 12} lessons
              </span>
            </span>
            {progressPercent >= 50 ? (
              <span className="px-2 py-0.5 rounded-full bg-chip-done-bg text-chip-done-fg font-label-sm text-label-sm font-semibold">
                Ahead
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-chip-due-bg text-chip-due-fg font-label-sm text-label-sm font-semibold">
                On track
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-space-md py-space-sm bg-canvas/40 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-space-xs text-ink-secondary">
          <Link
            href={`/courses/${course.id}`}
            className="p-1 rounded-lg hover:bg-slate-100 hover:text-ink transition-colors"
            title="Course syllabus"
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
          </Link>
          <button
            className="p-1 rounded-lg hover:bg-slate-100 hover:text-ink transition-colors"
            type="button"
            title="Shared files"
          >
            <span className="material-symbols-outlined text-[20px]">folder_open</span>
          </button>
        </div>
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm font-semibold hover:underline"
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
