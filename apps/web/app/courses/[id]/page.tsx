"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircularProgress } from "../../../components/CircularProgress";
import { useGetCourseQuery } from "../../../store/apiSlice";

export default function CourseOverviewPage() {
  const params = useParams();
  const courseId = (params?.id as string) || "cs101";

  const [activeTab, setActiveTab] = useState<"overview" | "lessons" | "quizzes" | "live" | "people">("overview");

  const { data: serverData, isLoading } = useGetCourseQuery(courseId);
  const course = serverData?.course;

  const title = course?.title || "CS 101: Introduction to Python & Algorithms";
  const instructor = course?.instructorName || "Prof. Alan Vance";
  const progressPercent = 68;

  return (
    <div className="w-full p-margin-sm md:p-margin flex flex-col gap-space-lg">
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

        {/* Course Tabs Header */}
        <div className="flex items-center gap-space-lg overflow-x-auto border-b border-border pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`relative pb-space-xs font-label-md text-label-md flex items-center gap-space-xs transition-colors ${
              activeTab === "overview"
                ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("lessons")}
            className={`flex items-center gap-space-xs pb-space-xs font-label-md text-label-md transition-colors ${
              activeTab === "lessons"
                ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span>Lessons</span>
            <span className="bg-slate-200 text-ink-secondary px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold">
              {course?.totalLessons || 34}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("quizzes")}
            className={`flex items-center gap-space-xs pb-space-xs font-label-md text-label-md transition-colors ${
              activeTab === "quizzes"
                ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span>Quizzes</span>
            <span className="bg-slate-200 text-ink-secondary px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold">
              4
            </span>
          </button>

          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-space-xs pb-space-xs font-label-md text-label-md transition-colors ${
              activeTab === "live"
                ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span>Live</span>
            <span className="bg-chip-done-bg text-chip-done-fg px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping"></span>
              1 Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab("people")}
            className={`flex items-center gap-space-xs pb-space-xs font-label-md text-label-md transition-colors ${
              activeTab === "people"
                ? "text-primary font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span>People</span>
            <span className="bg-slate-200 text-ink-secondary px-space-xs py-[1px] rounded-full font-caption text-caption font-semibold">
              48
            </span>
          </button>
        </div>
      </div>

      {/* Hero Course Banner matching B2 */}
      <section className="relative overflow-hidden rounded-card bg-gradient-to-r from-primary to-blue-700 text-white p-space-lg md:p-space-xl shadow-sm">
        <div className="absolute -right-12 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
          <div className="flex flex-col max-w-2xl">
            <div className="flex items-center gap-space-sm mb-space-xs">
              <span className="bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full font-label-sm text-label-sm tracking-wide uppercase font-semibold">
                Core Course
              </span>
              <span className="font-caption text-caption text-white/80">
                Code: {course?.code || "CS-101-FALL"}
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-white mb-space-xs tracking-tight font-bold">
              {title}
            </h1>
            <p className="font-body-md text-body-md text-white/90 flex flex-wrap items-center gap-x-space-sm gap-y-1">
              <span>{course?.term || "Fall 2026"}</span>
              <span>•</span>
              <span>{course?.sectionName || "Section 02"}</span>
              <span>•</span>
              <span className="font-medium">{instructor}</span>
            </p>
            <div className="flex flex-wrap items-center gap-space-sm mt-space-lg">
              <button
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-label-md text-label-md transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Download Syllabus</span>
              </button>
              <button
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors"
                title="Course Information"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
              </button>
              <button
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors"
                title="Share Course Link"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
            </div>
          </div>

          {/* Progress Card Inside Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md sm:gap-space-xl bg-white/10 backdrop-blur-md p-space-md rounded-2xl border border-white/20">
            <div className="flex items-center gap-space-md">
              <CircularProgress percent={progressPercent} size={64} strokeWidth={5} />
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-semibold text-white">Progress Track</span>
                <span className="font-caption text-caption text-white/80">32 of 48 Modules complete</span>
                <span className="font-caption text-caption text-emerald-300 font-medium mt-0.5">
                  Top 15% of Cohort
                </span>
              </div>
            </div>
            <Link
              href={`/courses/${courseId}/lessons/lesson-1`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-space-xs px-space-lg py-space-sm bg-white text-primary hover:bg-white/90 font-label-md text-label-md font-semibold rounded-full shadow-md transition-all active:scale-95"
            >
              <span>Continue to Module 4</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid: Sidebar + Curriculum Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        {/* Left Column (Upcoming + Instructor) */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          {/* Upcoming Schedule Card */}
          <div className="bg-card rounded-card p-space-lg shadow-card border border-border flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-ink flex items-center gap-space-xs font-semibold">
                <span className="material-symbols-outlined text-primary text-[22px]">calendar_month</span>
                <span>Upcoming</span>
              </h2>
              <span className="bg-red-100 text-danger font-label-sm text-label-sm px-2 py-0.5 rounded-full font-semibold">
                2 Soon
              </span>
            </div>
            <div className="flex flex-col gap-space-sm">
              <div className="p-space-sm bg-canvas rounded-xl flex flex-col gap-1 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="bg-chip-done-bg text-chip-done-fg font-label-sm text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    Live Soon
                  </span>
                  <span className="font-caption text-caption text-ink-secondary font-medium">Today • 2:00 PM</span>
                </div>
                <p className="font-label-md text-label-md text-ink font-semibold mt-1">
                  Live Class: Object-Oriented Python
                </p>
                <p className="font-caption text-caption text-ink-secondary">Classroom Room 4B &amp; Web Cast</p>
              </div>

              <div className="p-space-sm bg-canvas rounded-xl flex flex-col gap-1 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="bg-slate-200 text-ink-secondary font-label-sm text-label-sm px-2 py-0.5 rounded-full font-medium">
                    Quiz
                  </span>
                  <span className="font-caption text-caption text-danger font-medium">Tomorrow • 11:59 PM</span>
                </div>
                <p className="font-label-md text-label-md text-ink font-semibold mt-1">Recursion Quiz 2</p>
                <p className="font-caption text-caption text-ink-secondary">45 mins • 15 Questions</p>
              </div>
            </div>
            <button
              className="w-full py-space-xs bg-canvas hover:bg-slate-200 text-ink font-label-md text-label-md rounded-xl transition-colors font-medium text-center"
              type="button"
            >
              View all upcoming (6)
            </button>
          </div>

          {/* Instructor & TAs Card */}
          <div className="bg-card rounded-card p-space-lg shadow-card border border-border flex flex-col gap-space-md">
            <h2 className="font-headline-md text-headline-md text-ink flex items-center gap-space-xs font-semibold">
              <span className="material-symbols-outlined text-primary text-[22px]">group</span>
              <span>Instructors &amp; TAs</span>
            </h2>
            <div className="flex items-start gap-space-sm p-space-sm bg-canvas rounded-xl border border-border/50">
              <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">
                AV
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="font-label-md text-label-md text-ink font-semibold truncate">{instructor}</p>
                <p className="font-caption text-caption text-ink-secondary">Lead Lecturer • Mon/Wed Office Hours</p>
                <a href="mailto:instructor@learnly.edu" className="font-caption text-caption text-primary hover:underline mt-0.5">
                  vance@learnly.edu
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Syllabus Curriculum Breakdown */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg">
          <div className="bg-card rounded-card p-space-lg shadow-card border border-border flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md text-headline-md text-ink font-bold">Curriculum Syllabus</h2>
                <p className="font-body-md text-body-md text-ink-secondary mt-0.5">
                  6 units • 48 lessons total • Estimated 40 hours of coursework
                </p>
              </div>
              <span className="font-label-sm text-label-sm text-primary font-semibold">Expand all</span>
            </div>

            {/* Units list */}
            <div className="flex flex-col gap-space-md mt-space-sm">
              {/* Unit 1 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-space-md bg-canvas/60 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-accent text-[20px]">check_circle</span>
                    <div>
                      <h3 className="font-label-md text-label-md text-ink font-semibold">
                        Unit 1: Python Fundamentals &amp; Setup
                      </h3>
                      <p className="font-caption text-caption text-ink-secondary">6 lessons • 100% completed</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-ink-secondary text-[20px]">expand_more</span>
                </div>
              </div>

              {/* Unit 2 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-space-md bg-canvas/60 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-accent text-[20px]">check_circle</span>
                    <div>
                      <h3 className="font-label-md text-label-md text-ink font-semibold">
                        Unit 2: Conditionals, Loops &amp; Functions
                      </h3>
                      <p className="font-caption text-caption text-ink-secondary">8 lessons • 100% completed</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-ink-secondary text-[20px]">expand_more</span>
                </div>
              </div>

              {/* Unit 3 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-space-md bg-canvas/60 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-accent text-[20px]">check_circle</span>
                    <div>
                      <h3 className="font-label-md text-label-md text-ink font-semibold">
                        Unit 3: Data Structures (Lists, Tuples, Dictionaries)
                      </h3>
                      <p className="font-caption text-caption text-ink-secondary">10 lessons • 100% completed</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-ink-secondary text-[20px]">expand_more</span>
                </div>
              </div>

              {/* Unit 4: In Progress */}
              <div className="border-2 border-primary/40 rounded-xl overflow-hidden bg-primary/[0.02]">
                <div className="p-space-md bg-primary/[0.06] flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                    <div>
                      <h3 className="font-label-md text-label-md text-ink font-bold">
                        Unit 4: Recursion &amp; Algorithmic Thinking
                      </h3>
                      <p className="font-caption text-caption text-primary font-medium">8 lessons • In progress (4/8)</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary text-[20px]">expand_less</span>
                </div>

                {/* Expanded Lessons in Unit 4 */}
                <div className="p-space-md flex flex-col gap-space-sm border-t border-primary/20">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-accent text-[18px]">check_circle</span>
                      <span className="font-body-md text-body-md text-ink">4.1 Introduction to Call Stacks</span>
                    </div>
                    <span className="font-caption text-caption text-ink-secondary">14 mins</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-accent text-[18px]">check_circle</span>
                      <span className="font-body-md text-body-md text-ink">4.2 Base Cases &amp; Recursion Depth</span>
                    </div>
                    <span className="font-caption text-caption text-ink-secondary">18 mins</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border bg-primary/10 px-2 rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[18px]">play_circle</span>
                      <span className="font-body-md text-body-md text-primary font-semibold">
                        4.3 Tree Traversal: Pre-Order &amp; In-Order
                      </span>
                    </div>
                    <Link
                      href={`/courses/${courseId}/lessons/lesson-1`}
                      className="px-3 py-1 bg-primary text-white text-xs rounded-full font-semibold"
                    >
                      Resume
                    </Link>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-ink-muted text-[18px]">radio_button_unchecked</span>
                      <span className="font-body-md text-body-md text-ink-secondary">
                        4.4 Binary Search Trees in Python
                      </span>
                    </div>
                    <span className="font-caption text-caption text-ink-secondary">22 mins</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
