"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CourseCard } from "../components/CourseCard";
import { useGetCoursesQuery } from "../store/apiSlice";
import type { Course } from "@learnly/shared";

// Seeded / fallback course data matching B1 mockup exactly
const mockCourses: Course[] = [
  {
    id: "cs101",
    title: "CS 101: Python",
    code: "CS 101",
    term: "Fall 2026",
    sectionName: "Section 02",
    description: "Introduction to Python, computer science basics, and algorithms.",
    instructorId: "inst1",
    instructorName: "Prof. Alan Vance",
    instructorAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDQoj2qmCuaTndBWjotVyZ2a7wsGIygwx2O63Ekc7Jb6kXKwI4QbaIAig7JNyZUX7AiKwltHmEb_k8snWpkvccUOw0qOxcvv9filMjTdSG_tvczu7cqHg6qUK8V1xpYeC_EGg8c4wpJQfAPog278y4Q4DoV76_X_M3BF-2NMeAvOSEsQWRwWG5LIbQOtnKXcK7C7NPRnXzbmXFyesari4b4pEm_tdYzWUHDLkbzmus",
    status: "published",
    subjectColor: "blue",
    estimatedHours: 40,
    totalLessons: 48,
    totalQuizzes: 4,
    isLiveNow: true,
  },
  {
    id: "ux204",
    title: "UX 204: Interaction",
    code: "UX 204",
    term: "Fall 2026",
    sectionName: "Studio A",
    description: "Design systems, user testing, and interactive prototyping in Figma.",
    instructorId: "inst2",
    instructorName: "Elena Rostova",
    instructorAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBef8-L1RngA4tE3OWgiip0dHYwdJcZ_8QzsfBuuw5HLoFDWPAzIihwFjIUAnTIbLXOnEnS_GY5gxOxA5f-bOmcxuPBNEMFRNVFZZEruPacex7ZcCmOLQkUuNjXOVCPEm1-DfX5KR5z2EVkrznNPTgynIy0dHcv0WAPcMj11n6B90-3Svwfreu1n4PMrDLlr2eyb_dLbiQ8XM_5rYd2KhDRAqnSAVKjaDLGOuekYZQ",
    status: "published",
    subjectColor: "coral",
    estimatedHours: 35,
    totalLessons: 32,
    totalQuizzes: 3,
  },
  {
    id: "bio110",
    title: "BIO 110: Genetics",
    code: "BIO 110",
    term: "Fall 2026",
    sectionName: "Lab 04",
    description: "Molecular biology, DNA sequencing, and inheritance mechanisms.",
    instructorId: "inst3",
    instructorName: "Dr. Marcus Chen",
    status: "published",
    subjectColor: "teal",
    estimatedHours: 45,
    totalLessons: 36,
    totalQuizzes: 5,
  },
  {
    id: "data301",
    title: "DATA 301: ML Basics",
    code: "DATA 301",
    term: "Fall 2026",
    sectionName: "Cohort B",
    description: "Supervised and unsupervised learning, classification, and neural nets.",
    instructorId: "inst4",
    instructorName: "Prof. Sarah Jenkins",
    status: "published",
    subjectColor: "purple",
    estimatedHours: 50,
    totalLessons: 40,
    totalQuizzes: 6,
  },
];

export default function HomePage() {
  const [filterTab, setFilterTab] = useState<"active" | "completed" | "archived">("active");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: serverData } = useGetCoursesQuery();
  const displayCourses = serverData?.courses?.length ? serverData.courses : mockCourses;

  return (
    <div className="w-full p-margin-sm md:p-margin flex flex-col gap-space-xl">
      {/* Top Alerts & Today's Schedule Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Due Soon Banner Card */}
        {!bannerDismissed && (
          <div className="lg:col-span-7 bg-card rounded-card shadow-card p-space-md flex flex-col justify-between relative border border-border">
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex items-start gap-space-sm">
                <div className="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">schedule</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-sm text-label-sm text-danger uppercase font-semibold tracking-wider">
                      Due Soon
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                    <span className="font-caption text-caption text-ink-secondary">
                      Tomorrow • 11:59 PM
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-ink mt-0.5">
                    UX 204: Usability Heuristics Report
                  </h3>
                  <p className="font-body-md text-body-md text-ink-secondary mt-0.5">
                    Submit your final heuristic benchmark across 5 user task paths with Figma prototypes attached.
                  </p>
                </div>
              </div>
              <button
                className="p-1 rounded-full text-ink-secondary hover:text-ink hover:bg-canvas transition-colors"
                onClick={() => setBannerDismissed(true)}
                title="Dismiss banner"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="mt-space-md pt-space-sm flex items-center justify-between border-t border-border">
              <div className="flex items-center gap-space-xs text-ink-secondary font-caption text-caption">
                <span className="material-symbols-outlined text-[16px] text-danger">assignment_late</span>
                <span>Worth 15% of semester grade</span>
              </div>
              <Link
                href="/todo"
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-canvas text-ink hover:bg-slate-200 rounded-full font-label-md text-label-md shadow-sm transition-all"
              >
                <span>View to-do</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}

        {/* Live Classes Today Card */}
        <div
          className={`${
            bannerDismissed ? "lg:col-span-12" : "lg:col-span-5"
          } bg-stage text-white rounded-card shadow-card p-space-md flex flex-col justify-between relative overflow-hidden`}
        >
          <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-primary/20 blur-2xl pointer-events-none"></div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
              </span>
              <span className="font-label-sm text-label-sm font-semibold tracking-wide text-accent uppercase">
                Starting in 25 mins
              </span>
            </div>
            <span className="font-caption text-caption text-slate-300 px-space-xs py-0.5 rounded bg-white/10">
              2:00 PM EST
            </span>
          </div>

          <div className="my-space-sm z-10">
            <span className="font-label-sm text-label-sm text-slate-300 font-medium">
              CS 101 Live Workshop
            </span>
            <h3 className="font-headline-md text-headline-md text-white font-bold mt-0.5">
              Object-Oriented Python &amp; Data Structures
            </h3>
            <p className="font-caption text-caption text-slate-400 mt-1">
              Host: Prof. Alan Vance • 42 students in staging lobby
            </p>
          </div>

          <div className="flex items-center justify-between z-10 gap-space-xs pt-space-xs">
            <Link
              href="/live"
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-white/10 hover:bg-white/20 text-white font-label-md text-label-md transition-colors backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Prep Audio &amp; Video</span>
            </Link>
            <Link
              href="/live/cs101-session"
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-white hover:bg-primary-hover font-label-md text-label-md shadow transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              <span>Join Room</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Continue Learning Section */}
      <section className="flex flex-col gap-space-sm">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-space-sm">
            <h2 className="font-headline-lg text-headline-lg text-ink tracking-tight font-semibold">
              Continue learning
            </h2>
            <span className="font-caption text-caption uppercase tracking-wider text-ink-secondary font-semibold">
              Recent activity
            </span>
          </div>
          <Link
            className="font-label-md text-label-md text-primary hover:underline flex items-center gap-0.5"
            href="/history"
          >
            <span>History</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {/* Continue Card 1 */}
          <div className="group bg-card rounded-card p-space-lg shadow-card hover:shadow-card-hover border border-border transition-all duration-200 flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex gap-space-sm min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">terminal</span>
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-sm text-label-sm text-primary font-semibold">CS 101</span>
                    <span className="text-border">•</span>
                    <span className="font-caption text-caption text-ink-secondary truncate">
                      Introduction to Python
                    </span>
                  </div>
                  <h4 className="font-headline-md text-headline-md text-ink truncate group-hover:text-primary transition-colors font-semibold">
                    Module 4: Recursion &amp; Tree Traversal
                  </h4>
                  <span className="font-caption text-caption text-ink-secondary flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    <span>Estimated 24 min left</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-caption text-caption text-ink-secondary">Course Progress</span>
                  <span className="font-label-sm text-label-sm text-ink font-semibold">68%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: "68%" }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-space-xs">
                <span className="font-caption text-caption text-ink-secondary">Unit 4 of 6 • Lecture 12</span>
                <Link
                  href="/courses/cs101"
                  className="inline-flex items-center gap-space-xs px-space-lg py-space-xs bg-primary text-white rounded-full font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  <span>Continue</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Continue Card 2 */}
          <div className="group bg-card rounded-card p-space-lg shadow-card hover:shadow-card-hover border border-border transition-all duration-200 flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex gap-space-sm min-w-0">
                <div className="w-12 h-12 rounded-xl bg-subject-coral text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">draw</span>
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-sm text-label-sm text-subject-coral font-semibold">UX 204</span>
                    <span className="text-border">•</span>
                    <span className="font-caption text-caption text-ink-secondary truncate">
                      Interaction Design
                    </span>
                  </div>
                  <h4 className="font-headline-md text-headline-md text-ink truncate group-hover:text-primary transition-colors font-semibold">
                    Week 6: High-Fidelity Prototyping in Figma
                  </h4>
                  <span className="font-caption text-caption text-ink-secondary flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    <span>Estimated 35 min left</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-caption text-caption text-ink-secondary">Course Progress</span>
                  <span className="font-label-sm text-label-sm text-ink font-semibold">42%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: "42%" }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-space-xs">
                <span className="font-caption text-caption text-ink-secondary">Unit 3 of 8 • Lab 05</span>
                <Link
                  href="/courses/ux204"
                  className="inline-flex items-center gap-space-xs px-space-lg py-space-xs bg-primary text-white rounded-full font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  <span>Continue</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* My Courses Section */}
      <section className="flex flex-col gap-space-sm">
        {/* Header with Filters & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-lg text-headline-lg text-ink tracking-tight font-semibold">
              My courses
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 font-label-sm text-label-sm font-semibold text-ink-secondary">
              {displayCourses.length} Enrolled
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-space-md">
            {/* Filter Tabs */}
            <div className="inline-flex p-1 bg-canvas rounded-full border border-border" role="tablist">
              <button
                className={`px-space-md py-1 rounded-full font-label-sm text-label-sm font-semibold transition-all ${
                  filterTab === "active"
                    ? "bg-card text-ink shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
                onClick={() => setFilterTab("active")}
                type="button"
              >
                Active
              </button>
              <button
                className={`px-space-md py-1 rounded-full font-label-sm text-label-sm font-semibold transition-all ${
                  filterTab === "completed"
                    ? "bg-card text-ink shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
                onClick={() => setFilterTab("completed")}
                type="button"
              >
                Completed
              </button>
              <button
                className={`px-space-md py-1 rounded-full font-label-sm text-label-sm font-semibold transition-all ${
                  filterTab === "archived"
                    ? "bg-card text-ink shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
                onClick={() => setFilterTab("archived")}
                type="button"
              >
                Archived
              </button>
            </div>

            <Link
              className="font-label-md text-label-md text-primary font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
              href="/catalog"
            >
              <span>Explore catalog</span>
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </Link>
          </div>
        </div>

        {/* 4-Column Responsive Course Grid matching B1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {displayCourses.map((course, idx) => (
            <CourseCard
              key={course.id || idx}
              course={course}
              progressPercent={idx === 0 ? 68 : idx === 1 ? 42 : idx === 2 ? 85 : 20}
              completedLessons={idx === 0 ? 32 : idx === 1 ? 14 : idx === 2 ? 28 : 8}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
