"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { authFetch } from "../../../../../store/authFetch";
import { CourseBuilder } from "../../../../../components/CourseBuilder";
import { ChevronRight, ArrowLeft, Eye, Save, Globe } from "lucide-react";

export default function InstructorCourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchCourseData = async () => {
    try {
      const res = await authFetch(`/api/courses/${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
        setSections(data.course?.sections || []);
      }
    } catch (err) {
      console.error("Failed to load course", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const handleTogglePublish = async () => {
    if (!course) return;
    setSavingStatus(true);
    const newStatus = "in_review"; // instructors submit; an admin approves (see /admin/courses)
    try {
      const res = await authFetch(`/api/instructor/courses/${courseId}/submit`, { method: "POST" });
      if (res.ok) {
        setCourse((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error("Failed to update course status", err);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-caption text-caption text-ink-secondary">
          <Link href="/instructor/courses" className="hover:text-primary transition-colors">
            Instructor Portal
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/instructor/courses" className="hover:text-primary transition-colors">
            Courses
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-ink font-semibold truncate max-w-xs">
            {course?.title || "Course Builder"}
          </span>
        </div>

        {/* Top Header Card */}
        <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                {course?.code || "COURSE"}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                  course?.status === "published"
                    ? "bg-green-100 text-accent-green"
                    : "bg-slate-100 text-ink-secondary"
                }`}
              >
                {course?.status || "Draft"}
              </span>
            </div>
            <h1 className="font-headline-md text-2xl font-bold text-ink">
              {course?.title || "Loading Course..."}
            </h1>
            <p className="font-body-md text-sm text-ink-secondary">
              {course?.description || "Curriculum & Video Pipeline Management"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/courses/${courseId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-ink hover:bg-slate-100 rounded-full font-label-md text-sm font-semibold transition-colors"
            >
              <Eye className="w-4 h-4 text-ink-secondary" />
              <span>Preview</span>
            </Link>
            <button
              onClick={handleTogglePublish}
              disabled={savingStatus}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-label-md text-sm font-semibold transition-colors ${
                course?.status === "published"
                  ? "bg-slate-200 text-ink hover:bg-slate-300"
                  : "bg-primary text-white hover:bg-primary-hover shadow-sm"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>{course?.status === "published" ? "Published" : course?.status === "in_review" ? "In review" : "Submit for review"}</span>
            </button>
          </div>
        </div>

        {/* Course Builder Component */}
        <CourseBuilder
          courseId={courseId}
          initialSections={sections}
          onRefresh={fetchCourseData}
        />
      </div>
    </>
  );
}
