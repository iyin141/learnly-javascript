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
  Pencil,
} from "lucide-react";
import { UploadProgress } from "./UploadProgress";
import { ConfirmModal } from "./Modal";

interface LessonData {
  id: string;
  title: string;
  type: "video" | "text" | "file";
  order: number;
  durationSeconds: number;
  textContent?: string;
  video?: {
    status: "uploaded" | "transcoding" | "ready" | "failed";
    durationSeconds?: number;
    renditions?: string[];
    errorReason?: string;
  };
}

interface SectionData {
  id: string;
  title: string;
  order: number;
  lessons: LessonData[];
}

interface CourseBuilderProps {
  courseId: string;
  initialSections?: SectionData[];
  onRefresh?: () => void;
}

// Every API route returns `id` (Postgres uuid); normalise a legacy `_id` once here so the rest of the file only uses `id`.
const withIds = (secs: any[]): SectionData[] =>
  secs.map((s) => ({ ...s, id: s.id ?? s._id, lessons: (s.lessons ?? []).map((l: any) => ({ ...l, id: l.id ?? l._id })) }));

/** authFetch + JSON; throws an Error carrying the API's message so every caller can show it. */
async function api<T = any>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export const CourseBuilder: React.FC<CourseBuilderProps> = ({
  courseId,
  initialSections = [],
  onRefresh,
}) => {
  const [sections, setSections] = useState<SectionData[]>(() => withIds(initialSections));
  const [error, setError] = useState("");
  const fail = (what: string, err: unknown) => setError(`${what}: ${err instanceof Error ? err.message : "unexpected error"}`);
  const [editingSection, setEditingSection] = useState<{ id: string; title: string } | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ id: string; title: string; textContent: string; type: LessonData["type"] } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
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
      setSections(withIds(initialSections));
    }
  }, [initialSections]);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    setError("");
    try {
      const data = await api(`/api/courses/${courseId}/sections`, "POST", { title: newSectionTitle.trim() });
      setSections((prev) => [...prev, ...withIds([{ ...data.section, lessons: [] }])]);
      setNewSectionTitle("");
      if (onRefresh) onRefresh();
    } catch (err) {
      fail("Could not add the section", err);
    }
  };

  const saveSectionTitle = async () => {
    if (!editingSection || !editingSection.title.trim()) return;
    setSavingEdit(true);
    setError("");
    try {
      const { section } = await api(`/api/courses/${courseId}/sections/${editingSection.id}`, "PUT", { title: editingSection.title.trim() });
      setSections((prev) => prev.map((s) => (s.id === editingSection.id ? { ...s, title: section.title } : s)));
      setEditingSection(null);
    } catch (err) {
      fail("Could not rename the section", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const saveLesson = async () => {
    if (!editingLesson || !editingLesson.title.trim()) return;
    setSavingEdit(true);
    setError("");
    try {
      const { lesson } = await api(`/api/courses/${courseId}/lessons/${editingLesson.id}`, "PUT", {
        title: editingLesson.title.trim(),
        ...(editingLesson.type === "text" ? { textContent: editingLesson.textContent } : {}),
      });
      setSections((prev) => prev.map((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === editingLesson.id ? { ...l, title: lesson.title, textContent: lesson.textContent ?? undefined } : l)) })));
      setEditingLesson(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      fail("Could not save the lesson", err);
    } finally {
      setSavingEdit(false);
    }
  };

  /** Swap a lesson with its neighbour and persist the whole section's order through the batch /reorder route. */
  const moveLesson = async (sectionId: string, index: number, dir: -1 | 1) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec || index + dir < 0 || index + dir >= sec.lessons.length) return;
    const next = [...sec.lessons];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    const before = sections;
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, lessons: next } : s)));
    setError("");
    try {
      await api(`/api/courses/${courseId}/reorder`, "PUT", { lessons: next.map((l, i) => ({ id: l.id, sectionId, order: i })) });
      if (onRefresh) onRefresh();
    } catch (err) {
      setSections(before);
      fail("Could not reorder the lessons", err);
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ kind: "section" | "lesson"; id: string; sectionId?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDeleteSection = (sectionId: string) => setPendingDelete({ kind: "section", id: sectionId });
  const handleDeleteLesson = (lessonId: string, sectionId: string) => setPendingDelete({ kind: "lesson", id: lessonId, sectionId });
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      if (pendingDelete.kind === "section") await performDeleteSection(pendingDelete.id);
      else await performDeleteLesson(pendingDelete.id, pendingDelete.sectionId!);
    } finally { setDeleting(false); setPendingDelete(null); }
  };
  const performDeleteSection = async (sectionId: string) => {
    try {
      await api(`/api/courses/${courseId}/sections/${sectionId}`, "DELETE");
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (onRefresh) onRefresh();
    } catch (err) {
      fail("Could not delete the section", err);
    }
  };

  const handleAddLesson = async (sectionId: string) => {
    if (!newLessonTitle.trim()) return;
    setError("");
    try {
      const { lesson } = await api(`/api/courses/${courseId}/sections/${sectionId}/lessons`, "POST", {
        title: newLessonTitle.trim(),
        type: newLessonType,
        durationSeconds: 0,
      });
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, lessons: [...(s.lessons || []), lesson] } : s)));
      setNewLessonTitle("");
      setAddingToSectionId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      fail("Could not add the lesson", err);
    }
  };

  const performDeleteLesson = async (lessonId: string, sectionId: string) => {
    try {
      await api(`/api/courses/${courseId}/lessons/${lessonId}`, "DELETE");
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s)));
      if (onRefresh) onRefresh();
    } catch (err) {
      fail("Could not delete the lesson", err);
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

      {error && <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-sm">{error}</p>}

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((section, sIndex) => (
          <div
            key={section.id || sIndex}
            className="bg-card border border-border rounded-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {sIndex + 1}
                </span>
                {editingSection?.id === section.id ? (
                  <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void saveSectionTitle(); }}>
                    <input aria-label="Section title" autoFocus value={editingSection.title} onChange={(e) => setEditingSection({ id: section.id, title: e.target.value })} className="px-2 py-1 text-sm bg-card border border-border rounded-lg text-ink focus:outline-none focus:border-primary" />
                    <button type="submit" disabled={savingEdit} className="px-2 py-1 text-xs font-semibold bg-primary text-white rounded-lg disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditingSection(null)} className="px-2 py-1 text-xs text-ink-secondary">Cancel</button>
                  </form>
                ) : (
                  <h3 className="font-title-md text-base font-bold text-ink">{section.title}</h3>
                )}
                <span className="text-xs text-ink-secondary">
                  ({section.lessons?.length || 0} lessons)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingSection({ id: section.id, title: section.title })}
                  className="p-1.5 text-ink-secondary hover:text-primary rounded-lg hover:bg-slate-100 transition-colors"
                  title="Rename Section"
                  aria-label="Rename section"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(section.id)}
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
                    key={lesson.id || lIndex}
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
                            {lesson.video?.status === "uploaded" && (lesson.video as { rawUploadKey?: string }).rawUploadKey && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                Uploaded (queued)
                              </span>
                            )}
                            {(!lesson.video || (lesson.video.status === "uploaded" && !(lesson.video as { rawUploadKey?: string }).rawUploadKey)) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-secondary bg-canvas px-2 py-0.5 rounded-full border border-border">
                                No video yet
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
                              onChange={(e) => handleVideoSelect(section.id, lesson.id, e)}
                            />
                          </label>
                        )}

                        <button type="button" disabled={lIndex === 0} onClick={() => void moveLesson(section.id, lIndex, -1)} className="p-1 text-ink-secondary hover:text-primary rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Move lesson up" title="Move up">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={lIndex === section.lessons.length - 1} onClick={() => void moveLesson(section.id, lIndex, 1)} className="p-1 text-ink-secondary hover:text-primary rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Move lesson down" title="Move down">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setEditingLesson({ id: lesson.id, title: lesson.title, textContent: lesson.textContent ?? "", type: lesson.type })} className="p-1 text-ink-secondary hover:text-primary rounded hover:bg-slate-100" aria-label="Edit lesson" title="Edit lesson">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson.id, section.id)}
                          className="p-1 text-ink-secondary hover:text-accent-coral rounded hover:bg-slate-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingLesson?.id === lesson.id && (
                      <div className="flex flex-col gap-2 p-3 bg-card border border-border rounded-lg">
                        <label className="text-xs text-ink-secondary">Title
                          <input value={editingLesson.title} onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })} className="mt-1 w-full px-3 py-1.5 text-sm bg-canvas border border-border rounded-lg text-ink focus:outline-none focus:border-primary" />
                        </label>
                        {editingLesson.type === "text" && (
                          <label className="text-xs text-ink-secondary">Lesson text
                            <textarea rows={10} value={editingLesson.textContent} onChange={(e) => setEditingLesson({ ...editingLesson, textContent: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm bg-canvas border border-border rounded-lg text-ink focus:outline-none focus:border-primary" />
                          </label>
                        )}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingLesson(null)} className="px-3 py-1 text-xs text-ink-secondary hover:text-ink">Cancel</button>
                          <button type="button" disabled={savingEdit} onClick={() => void saveLesson()} className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded-lg disabled:opacity-50">{savingEdit ? "Saving..." : "Save lesson"}</button>
                        </div>
                      </div>
                    )}

                    {/* Active Upload progress bar if this lesson is uploading */}
                    {activeUploadLesson &&
                      activeUploadLesson.lessonId === lesson.id && (
                        <UploadProgress
                          courseId={courseId}
                          lessonId={lesson.id}
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
            {addingToSectionId === section.id ? (
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
                    onClick={() => handleAddLesson(section.id)}
                    className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover"
                  >
                    Add Lesson
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingToSectionId(section.id)}
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
      <ConfirmModal
        open={pendingDelete !== null}
        tone="danger"
        title={pendingDelete?.kind === "section" ? "Delete section?" : "Delete lesson?"}
        message={pendingDelete?.kind === "section" ? "This deletes the section and all of its lessons. This cannot be undone." : "This lesson will be removed from the course. This cannot be undone."}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
