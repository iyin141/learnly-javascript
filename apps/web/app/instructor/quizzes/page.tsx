"use client";

import React, { useState } from "react";
import { useCreateQuizMutation, useGetInstructorCoursesQuery, useGetCourseQuizzesQuery, useGetQuizAnalyticsQuery } from "../../../store/apiSlice";

interface Q {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}
const blank = (): Q => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" });
const letter = (i: number) => String.fromCharCode(97 + i);

const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

function Analytics({ quizId }: { quizId: string }) {
  const { data, isLoading, isError } = useGetQuizAnalyticsQuery(quizId);
  if (isLoading) return <div className="h-16 rounded-lg bg-border animate-pulse" />;
  if (isError || !data) return <p role="alert" className="text-danger text-sm">Could not load analytics.</p>;
  if (data.attempts === 0) return <p className="text-ink-secondary text-sm">No submitted attempts yet.</p>;
  return (
    <div className="flex flex-col gap-space-sm text-sm">
      <p>{data.attempts} attempts, pass rate {pct(data.passRate)}, average score {data.avgScorePercent == null ? "n/a" : `${Math.round(data.avgScorePercent)}%`}</p>
      <ul className="flex flex-col gap-1">
        {data.perQuestion.map((q) => (
          <li key={q.questionId} className="flex justify-between gap-space-sm"><span className="truncate">{q.prompt}</span><span className="shrink-0 text-ink-secondary">{q.answered} answered, {pct(q.correctRate)} correct</span></li>
        ))}
      </ul>
    </div>
  );
}

function CourseQuizzes({ course }: { course: { id: string; code: string; title: string } }) {
  const { data, isLoading, isError } = useGetCourseQuizzesQuery(course.id);
  const [open, setOpen] = useState<string | null>(null);
  const quizzes = data?.quizzes ?? [];
  return (
    <section className="bg-card rounded-xl border border-border p-space-md flex flex-col gap-space-sm">
      <h3 className="font-label-md font-semibold">{course.code}: {course.title}</h3>
      {isLoading && <div className="h-10 rounded-lg bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger text-sm">Could not load quizzes for this course.</p>}
      {!isLoading && !isError && quizzes.length === 0 && <p className="text-ink-secondary text-sm">No quizzes yet.</p>}
      {quizzes.map((q) => (
        <div key={q.id} className="bg-canvas rounded-lg p-space-sm flex flex-col gap-space-sm">
          <div className="flex items-center justify-between gap-space-sm">
            <span>
              <span className="block font-label-md">{q.title}</span>
              <span className="block font-caption text-caption text-ink-secondary">{q.questionCount} questions, {q.timeLimitMinutes} min, pass {q.passMarkPercent}%</span>
            </span>
            <button type="button" aria-expanded={open === q.id} onClick={() => setOpen(open === q.id ? null : q.id)} className="min-h-11 px-space-md rounded-full border border-border text-sm">{open === q.id ? "Hide analytics" : "Analytics"}</button>
          </div>
          {open === q.id && <Analytics quizId={q.id} />}
        </div>
      ))}
    </section>
  );
}

export default function QuizBuilderPage() {
  const { data, isLoading: coursesLoading, isError: coursesError } = useGetInstructorCoursesQuery();
  const [create, { isLoading, isSuccess, error }] = useCreateQuizMutation();
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [pass, setPass] = useState(70);
  const [qs, setQs] = useState<Q[]>([blank()]);
  const upd = (i: number, p: Partial<Q>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const msg = (error as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message;
  const field = "min-h-11 rounded-xl border border-border px-space-md bg-card";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = courseId || data?.courses[0]?.id;
    if (!id) return;
    const body = {
      title,
      timeLimitMinutes: minutes,
      passMarkPercent: pass,
      questions: qs.map((q) => ({
        type: "single",
        prompt: q.prompt,
        points: 1,
        explanation: q.explanation || undefined,
        options: q.options.map((text, i) => ({ id: letter(i), text })).filter((o) => o.text),
        correct: [letter(q.correct)],
      })),
    };
    void create({ courseId: id, body });
  };

  return (
    <div className="p-margin-sm md:p-margin max-w-3xl flex flex-col gap-space-lg">
    <section className="flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Your quizzes</h1>
      {coursesLoading && <div className="h-24 rounded-xl bg-border animate-pulse" />}
      {coursesError && <p role="alert" className="text-danger">Could not load your courses.</p>}
      {!coursesLoading && !coursesError && (data?.courses ?? []).length === 0 && <p className="bg-card rounded-xl border border-border p-space-lg text-center text-ink-secondary">You have no courses yet. Create a course before adding quizzes.</p>}
      {(data?.courses ?? []).map((c) => <CourseQuizzes key={c.id} course={c} />)}
    </section>
    <form onSubmit={submit} className="flex flex-col gap-space-md">
      <h2 className="font-headline-md text-headline-md">New quiz</h2>
      <label className="flex flex-col gap-1">
        Course
        <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {(data?.courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}: {c.title}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Title<input required className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <div className="flex gap-space-md">
        <label className="flex flex-col gap-1">Time limit (min)<input type="number" min={1} className={field} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1">Pass mark (%)<input type="number" min={1} max={100} className={field} value={pass} onChange={(e) => setPass(Number(e.target.value))} /></label>
      </div>
      {qs.map((q, i) => (
        <fieldset key={i} className="bg-card rounded-xl border border-border p-space-md flex flex-col gap-space-sm">
          <legend className="font-label-md px-1">Question {i + 1}</legend>
          <input required aria-label="Question text" placeholder="Question" className={field} value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} />
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`correct-${i}`} aria-label={`Option ${k + 1} is correct`} checked={q.correct === k} onChange={() => upd(i, { correct: k })} className="w-5 h-5" />
              <input aria-label={`Option ${k + 1}`} placeholder={`Option ${k + 1}`} className={`${field} flex-1`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
            </div>
          ))}
          <input aria-label="Explanation" placeholder="Explanation shown after submit" className={field} value={q.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} />
        </fieldset>
      ))}
      <button type="button" onClick={() => setQs([...qs, blank()])} className="min-h-11 rounded-full border border-border">Add question</button>
      {msg && <p role="alert" className="text-danger">{msg}</p>}
      {isSuccess && <p role="status" className="text-success">Quiz created.</p>}
      <button disabled={isLoading || !(data?.courses ?? []).length} className="min-h-11 rounded-full bg-primary text-white disabled:opacity-50">Create quiz</button>
    </form>
    </div>
  );
}
