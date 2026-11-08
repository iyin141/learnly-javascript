"use client";

import React from "react";
import Link from "next/link";
import type { Section } from "@learnly/shared";

const mins = (s: number) => `${Math.max(1, Math.round(s / 60))}m`;

/** Curriculum accordion: sections with lesson rows, done/active states. */
export function LessonList({
  courseId,
  sections,
  activeLessonId,
  completed,
}: {
  courseId: string;
  sections: Section[];
  activeLessonId?: string;
  completed: Set<string>;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-space-md py-space-sm bg-primary/5 flex items-center justify-between">
        <h2 className="font-label-md text-label-md font-semibold text-ink">Course Curriculum</h2>
        <span className="font-caption text-caption text-ink-secondary">{sections.length} Modules</span>
      </div>
      {sections.map((sec, i) => {
        const done = sec.lessons.filter((l) => completed.has(l.id)).length;
        const all = done === sec.lessons.length && done > 0;
        const open = sec.lessons.some((l) => l.id === activeLessonId) || (!activeLessonId && i === 0);
        return (
          <details key={sec.id} open={open} className="border-t border-border group">
            <summary className="flex items-center gap-space-sm px-space-md py-space-sm cursor-pointer min-h-11 list-none">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${all ? "bg-success" : "bg-primary"}`}>
                {all ? <span className="material-symbols-outlined text-[16px]">check</span> : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-label-md text-label-md text-ink truncate">{sec.title}</span>
                <span className="block font-caption text-caption text-ink-secondary">{done} of {sec.lessons.length} completed</span>
              </span>
              <span className="material-symbols-outlined text-ink-secondary group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <ul>
              {sec.lessons.map((l) => {
                const isDone = completed.has(l.id);
                const active = l.id === activeLessonId;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/courses/${courseId}/lessons/${l.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-space-sm px-space-md py-space-sm min-h-11 hover:bg-canvas ${active ? "bg-primary/5 border-l-4 border-primary" : ""}`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isDone ? "text-success" : active ? "text-primary" : "text-ink-muted"}`}>
                        {isDone ? "check_circle" : active ? "play_circle" : l.type === "video" ? "radio_button_unchecked" : "article"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-md text-label-md text-ink truncate">{l.title}</span>
                        <span className="block font-caption text-caption text-ink-secondary">
                          {l.type === "video" ? mins(l.durationSeconds) : l.type === "text" ? "Reading" : "File"}
                          {l.type === "video" && l.video && l.video.status !== "ready" ? ` · ${l.video.status}` : ""}
                        </span>
                      </span>
                      {isDone && <span className="font-caption text-caption text-ink-secondary">Done</span>}
                      {active && <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs">Active</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
