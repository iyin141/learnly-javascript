"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AttemptResult, AttemptStart } from "@learnly/shared";
import { QuizRunner } from "../../../../../components/QuizRunner";
import { useGetQuizQuery, useStartAttemptMutation } from "../../../../../store/apiSlice";

export default function QuizPage() {
  const { id, quizId } = useParams<{ id: string; quizId: string }>();
  const { data, isLoading, isError } = useGetQuizQuery(quizId);
  const [start, { isLoading: starting, error: startError }] = useStartAttemptMutation();
  const [attempt, setAttempt] = useState<AttemptStart | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const quiz = data?.quiz;

  if (isLoading) return <div className="p-margin"><div className="h-64 rounded-xl bg-border animate-pulse" /></div>;
  if (isError || !quiz)
    return <div className="p-margin"><div role="alert" className="bg-card rounded-xl border border-border p-space-lg">Quiz not found or you are not enrolled.</div></div>;

  const crumbs = (
    <nav aria-label="Breadcrumb" className="font-caption text-caption text-ink-secondary flex gap-1 flex-wrap">
      <Link href="/" className="hover:text-primary">Learnly</Link> / <Link href={`/courses/${id}`} className="hover:text-primary">Course</Link> / <span className="text-ink">{quiz.title}</span>
    </nav>
  );

  if (attempt && !result)
    return (
      <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
        {crumbs}
        <QuizRunner attempt={attempt} title={quiz.title} onDone={setResult} />
      </div>
    );

  if (result)
    return (
      <div className="p-margin-sm md:p-margin flex flex-col gap-space-md max-w-3xl mx-auto">
        {crumbs}
        <section className="bg-card rounded-xl border border-border p-space-lg text-center flex flex-col items-center gap-space-sm">
          <span className={`material-symbols-outlined text-[48px] ${result.passed ? "text-success" : "text-warning"}`}>{result.passed ? "emoji_events" : "replay"}</span>
          <h1 className="font-headline-lg text-headline-lg">{result.passed ? "You passed" : "Not passed yet"}</h1>
          {result.timedOut && <p role="alert" className="text-danger font-label-md">Time ran out. Your saved answers were submitted automatically.</p>}
          <p className="font-headline-xl text-headline-xl">{Math.round(result.scorePercent)}%</p>
          <p className="text-ink-secondary">{result.scorePoints} / {result.maxPoints} points, pass mark {quiz.passMarkPercent}%</p>
          {result.certificateIssued && <Link href="/certificates" className="min-h-11 px-space-lg inline-flex items-center rounded-full bg-accent text-white">Your certificate is ready</Link>}
        </section>
        <section className="flex flex-col gap-space-sm" aria-label="Review">
          {result.review.map((r, i) => (
            <div key={r.questionId} className={`bg-card rounded-xl border p-space-md ${r.correct ? "border-success/40" : "border-danger/40"}`}>
              <p className="font-label-md text-label-md text-ink">{i + 1}. {r.prompt}</p>
              <p className={`font-caption text-caption ${r.correct ? "text-success" : "text-danger"}`}>{r.correct ? "Correct" : "Incorrect"} ({r.earned}/{r.points})</p>
              {r.explanation && <p className="font-body-md text-body-md text-ink-secondary mt-1">{r.explanation}</p>}
            </div>
          ))}
        </section>
        <div className="flex gap-space-sm">
          <Link href={`/courses/${id}`} className="min-h-11 px-space-lg inline-flex items-center rounded-full bg-canvas border border-border">Back to course</Link>
          {!result.passed && quiz.attemptsUsed < quiz.maxAttempts && (
            <button onClick={() => { setAttempt(null); setResult(null); }} className="min-h-11 px-space-lg rounded-full bg-primary text-white">Try again</button>
          )}
        </div>
      </div>
    );

  const out = quiz.attemptsUsed >= quiz.maxAttempts;
  const err = (startError as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message;
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md max-w-3xl mx-auto">
      {crumbs}
      <section className="bg-card rounded-xl border border-border p-space-lg flex flex-col gap-space-md">
        {quiz.unitLabel && <span className="self-start px-3 py-1 rounded-full bg-primary/10 text-primary font-caption uppercase">{quiz.unitLabel}</span>}
        <h1 className="font-headline-lg text-headline-lg">{quiz.title}</h1>
        <p className="text-ink-secondary">{quiz.description}</p>
        <dl className="grid grid-cols-2 gap-space-sm font-label-md">
          <div><dt className="text-ink-secondary font-caption">Questions</dt><dd>{quiz.questionCount}</dd></div>
          <div><dt className="text-ink-secondary font-caption">Time limit</dt><dd>{quiz.timeLimitMinutes} min (enforced by the server)</dd></div>
          <div><dt className="text-ink-secondary font-caption">Pass mark</dt><dd>{quiz.passMarkPercent}%</dd></div>
          <div><dt className="text-ink-secondary font-caption">Attempts</dt><dd>{quiz.attemptsUsed} of {quiz.maxAttempts} used</dd></div>
        </dl>
        {quiz.bestScorePercent != null && <p>Best score: <b>{Math.round(quiz.bestScorePercent)}%</b> {quiz.passed && "(passed)"}</p>}
        {err && <p role="alert" className="text-danger">{err}</p>}
        <button
          disabled={starting || out}
          onClick={async () => { const r = await start(quizId); if ("data" in r && r.data) setAttempt(r.data); }}
          className="self-start min-h-11 px-space-lg rounded-full bg-primary text-white font-label-md disabled:opacity-50"
        >
          {out ? "No attempts left" : starting ? "Starting..." : "Start attempt"}
        </button>
      </section>
    </div>
  );
}
