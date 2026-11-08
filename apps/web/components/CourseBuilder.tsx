"use client";

import { authFetch } from "../store/authFetch";
import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Video,
  FileText,
  File,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { UploadProgress } from "./UploadProgress";

interface LessonData {
  _id: string;
  title: string;
  type: "video" | "text" | "file";
  order: number;
  durationSeconds: number;
  video?: {
    status: "uploaded" | "transcoding" | "ready" | "failed";
    durationSeconds?: number;
    renditions?: string[];
    errorReason?: string;
  };
}

interface SectionData {
  _id: string;
  title: string;
  order: number;
  lessons: LessonData[];
}

interface CourseBuilderProps {
  courseId: string;
  initialSections?: SectionData[];
  onRefresh?: () => void;
}

export const CourseBuilder: React.FC<CourseBuilderProps> = ({
  courseId,
  initialSections = [],
  onRefresh,
}) => {
  const [sections, setSections] = useState<SectionData[]>(initialSections);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<"video" | "text">("video");
  const [activeUploadLesson, setActiveUploadLesson] = useState<{
    sectionId: string;
    lessonId: string;
    file: File;
  } | null>(null);

  // Sync when initialSections changes
  React.useEffect(() => {
    if (initialSections.length > 0) {
      setSections(initialSections);
    }
  }, [initialSections]);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    try {
      const res = await authFetch(`/api/courses/${courseId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSectionTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSections((prev) => [...prev, { ...data.section, lessons: [] }]);
        setNewSectionTitle("");
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to add section", err);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Delete this section and all of its lessons?")) return;
    try {
      const res = await authFetch(`/api/courses/${courseId}/sections/${sectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSections((prev) => prev.filter((s) => s._id !== sectionId));
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete section", err);
    }
  };

  const handleAddLesson = async (sectionId: string) => {
    if (!newLessonTitle.trim()) return;
    try {
      const res = await authFetch(`/api/courses/${courseId}/sections/${sectionId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newLessonTitle.trim(),
          type: newLessonType,
          durationSeconds: 0,
        }),
      });
      if (res.ok) {
        const { lesson } = await res.json();
        setSections((prev) =>
          prev.map((s) =>
            s._id === sectionId ? { ...s, lessons: [...(s.lessons || []), lesson] } : s
          )
        );
        setNewLessonTitle("");
        setAddingToSectionId(null);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to add lesson", err);
    }
  };

  const handleDeleteLesson = async (lessonId: string, sectionId: string) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      const res = await authFetch(`/api/courses/${courseId}/lessons/${lessonId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSections((prev) =>
          prev.map((s) =>
            s._id === sectionId
              ? { ...s, lessons: s.lessons.filter((l) => l._id !== lessonId) }
              : s
          )
        );
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete lesson", err);
    }
  };

  const handleVideoSelect = (
    sectionId: string,
    lessonId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setActiveUploadLesson({ sectionId, lessonId, file });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="font-headline-md text-xl font-bold text-ink">Curriculum Builder</h2>
          <p className="font-body-md text-sm text-ink-secondary">
            Organize modules, upload lesson videos, and structure your course.
          </p>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((section, sIndex) => (
          <div
            key={section._id || sIndex}
            className="bg-card border border-border rounded-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {sIndex + 1}
                </span>
                <h3 className="font-title-md text-base font-bold text-ink">{section.title}</h3>
                <span className="text-xs text-ink-secondary">
                  ({section.lessons?.length || 0} lessons)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDeleteSection(section._id)}
                  className="p-1.5 text-ink-secondary hover:text-accent-coral rounded-lg hover:bg-slate-100 transition-colors"
                  title="Delete Section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lessons List in Section */}
            <div className="space-y-2 pl-4 border-l-2 border-slate-100 mb-4">
              {section.lessons && section.lessons.length > 0 ? (
                section.lessons.map((lesson, lIndex) => (
                  <div
                    key={lesson._id || lIndex}
                    className="flex flex-col gap-2 p-3 bg-canvas/70 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {lesson.type === "video" ? (
                          <Video className="w-4 h-4 text-primary" />
                        ) : (
                          <FileText className="w-4 h-4 text-ink-secondary" />
                        )}
                        <span className="font-body-md text-sm font-medium text-ink">
                          {lesson.title}
                        </span>

                        {/* Status Badge */}
                        {lesson.type === "video" && (
                          <div className="flex items-center gap-1.5">
                            {lesson.video?.status === "ready" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-green bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                <CheckCircle className="w-3 h-3" /> Ready (HLS 360p/720p)
                              </span>
                            )}
                            {lesson.video?.status === "transcoding" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-amber bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Loader2 className="w-3 h-3 animate-spin" /> Transcoding...
                              </span>
                            )}
                            {lesson.video?.status === "uploaded" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                Uploaded (queued)
                              </span>
                            )}
                            {lesson.video?.status === "failed" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-coral bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Failed
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Video Upload Button */}
                        {lesson.type === "video" && lesson.video?.status !== "ready" && (
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Video</span>
                            <input
                              type="file"
                              accept="video/mp4,video/quicktime,video/webm"
                              className="hidden"
                              onChange={(e) => handleVideoSelect(section._id, lesson._id, e)}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson._id, section._id)}
                          className="p-1 text-ink-secondary hover:text-accent-coral rounded hover:bg-slate-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Active Upload progress bar if this lesson is uploading */}
                    {activeUploadLesson &&
                      activeUploadLesson.lessonId === lesson._id && (
                        <UploadProgress
                          courseId={courseId}
                          lessonId={lesson._id}
                          file={activeUploadLesson.file}
                          onSuccess={() => {
                            if (onRefresh) onRefresh();
                          }}
                        />
                      )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-ink-secondary py-2 italic">
                  No lessons in this module yet.
                </div>
              )}
            </div>

            {/* Add Lesson Form or Trigger */}
            {addingToSectionId === section._id ? (
              <div className="p-3 bg-canvas rounded-xl border border-border flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Lesson title (e.g. Setting Up Virtual Environments)"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-ink focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <select
                    value={newLessonType}
                    onChange={(e) => setNewLessonType(e.target.value as any)}
                    className="px-2 py-1.5 text-sm bg-card border border-border rounded-lg text-ink"
                  >
                    <option value="video">Video</option>
                    <option value="text">Text / Notes</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToSectionId(null);
                      setNewLessonTitle("");
                    }}
                    className="px-3 py-1 text-xs text-ink-secondary hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddLesson(section._id)}
                    className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover"
                  >
                    Add Lesson
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingToSectionId(section._id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Lesson
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add New Section */}
      <form
        onSubmit={handleAddSection}
        className="flex items-center gap-3 p-4 bg-card border border-dashed border-border rounded-card"
      >
        <input
          type="text"
          placeholder="New Section Title (e.g. Module 5: Advanced Recursion)..."
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          className="flex-1 px-4 py-2 bg-canvas border border-border rounded-xl text-ink font-body-md text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-label-md text-label-md font-semibold hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </form>
    </div>
  );
};
