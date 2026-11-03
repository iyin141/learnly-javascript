"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Plus, BookOpen, ChevronRight, Edit3, Eye, Video } from "lucide-react";

export default function InstructorCoursesIndexPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:4000/api/courses");
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell activeNav="instructor">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline-md text-2xl font-bold text-ink">Instructor Courses</h1>
            <p className="font-body-md text-sm text-ink-secondary">
              Manage your course curriculum, upload videos, and publish modules.
            </p>
          </div>
          <Link
            href="/courses/cs101"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-label-md text-sm font-semibold hover:bg-primary-hover shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </Link>
        </div>

        {/* Courses Table / List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course._id}
              className="bg-card border border-border rounded-card p-5 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {course.code}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      course.status === "published"
                        ? "bg-green-100 text-accent-green"
                        : "bg-slate-100 text-ink-secondary"
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
                <h3 className="font-title-md text-base font-bold text-ink line-clamp-1 mb-1">
                  {course.title}
                </h3>
                <p className="font-body-md text-xs text-ink-secondary line-clamp-2 mb-4">
                  {course.description}
                </p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                <Link
                  href={`/instructor/courses/${course._id}/builder`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Curriculum Builder</span>
                </Link>
                <Link
                  href={`/courses/${course._id}`}
                  className="p-1.5 border border-border text-ink-secondary hover:text-ink rounded-lg hover:bg-slate-100"
                  title="View Public Course"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
