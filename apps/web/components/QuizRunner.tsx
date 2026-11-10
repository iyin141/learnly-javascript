"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AttemptResult, AttemptStart } from "@learnly/shared";
import { useSaveAnswerMutation, useSubmitAttemptMutation } from "../store/apiSlice";
import { ConfirmModal } from "./Modal";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Runs one attempt. The server owns the clock: we only render the remaining time it reported. */
export function QuizRunner({
  attempt,
  title,
  onDone,
}: {
  attempt: AttemptStart;
  title: string;
  onDone: (r: AttemptResult) => void;
}) {
  const [saveAnswer] = useSaveAnswerMutation();
  const [submit, { isLoading: submitting }] = useSubmitAttemptMutation();
  const [current, setCurrent] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>(attempt.answers ?? {});
  const [flagged, setFlagged] = useState<Set<string>>(new Set(attempt.flagged ?? []));
  const [error, setError] = useState<string | null>(null);
  // offset between our clock and the server clock, so a wrong local clock cannot extend the timer
  const offset = useRef(new Date(attempt.serverNow).getTime() - Date.now());
  const endsAt = new Date(attempt.endsAt).getTime();
  const [left, setLeft] = useState(() => endsAt - (Date.now() + offset.current));
  const done = useRef(false);

  const finish = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    const r = await submit(attempt.attemptId);
    if ("data" in r && r.data) onDone(r.data);
    else {
      done.current = false;
      setError("Could not submit. Check your connection and try again.");
    }
  }, [attempt.attemptId, onDone, submit]);

  useEffect(() => {
    const t = setInterval(() => {
      const l = endsAt - (Date.now() + offset.current);
      setLeft(l);
      if (l <= 0) void finish();
    }, 1000);
    return () => clearInterval(t);
  }, [endsAt, finish]);

  const qs = attempt.questions;
  const q = qs[current];
  const answered = (id: string) => {
    const a = answers[id];
    return Array.isArray(a) ? a.length > 0 : a != null && a !== "";
  };
  const nAnswered = qs.filter((x) => answered(x.id)).length;

  const setAnswer = (questionId: string, answer: unknown) => {
    setAnswers((p) => ({ ...p, [questionId]: answer }));
    void saveAnswer({ attemptId: attempt.attemptId, questionId, answer });
  };
  const toggleFlag = () => {
    const next = new Set(flagged);
    next.has(q.id) ? next.delete(q.id) : next.add(q.id);
    setFlagged(next);
    void saveAnswer({ attemptId: attempt.attemptId, questionId: q.id, answer: answers[q.id] ?? null, flagged: next.has(q.id) });
  };

  const pick = (optId: string) => {
    if (q.type === "multiple") {
      const cur = (answers[q.id] as string[] | undefined) ?? [];
      setAnswer(q.id, cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId]);
    } else setAnswer(q.id, optId);
  };
  const selected = (optId: string) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.includes(optId) : a === optId;
  };

  const urgent = left < 60_000;
  return (
    <div className="flex flex-col gap-gutter">
      <header className="bg-card rounded-xl border border-border p-space-md md:p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-ink">{title}</h1>
            <p className="font-caption text-caption text-ink-secondary">Question {current + 1} of {qs.length}</p>
          </div>
          <div className="flex items-center gap-space-md">
            <div role="timer" aria-live={urgent ? "assertive" : "off"} className={`flex items-center gap-space-sm rounded-xl px-space-md py-space-sm ${urgent ? "bg-danger/10 text-danger" : "bg-primary/5 text-ink"}`}>
              <span className="material-symbols-outlined">timer</span>
              <div>
                <p className="font-caption text-caption uppercase">Remaining</p>
                <p className="font-headline-md text-headline-md tabular-nums">{mmss(left)}</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmSubmit(true)}
              disabled={submitting}
              className="min-h-11 px-space-lg rounded-full bg-danger text-white font-label-md text-label-md inline-flex items-center gap-space-xs disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span> Submit Quiz
            </button>
          </div>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={nAnswered} aria-valuemax={qs.length}>
          <div className="h-full bg-primary" style={{ width: `${(nAnswered / qs.length) * 100}%` }} />
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl bg-danger/10 text-danger p-space-md">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-gutter">
        <aside className="bg-card rounded-xl border border-border p-space-md flex flex-col gap-space-md h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-ink">Question Sheet</h2>
            <span className="font-caption text-caption bg-canvas rounded-full px-2 py-0.5">{qs.length} Items</span>
          </div>
          <div className="grid grid-cols-3 text-center bg-canvas rounded-xl py-space-sm">
            <div><p className="font-headline-md text-success">{nAnswered}</p><p className="font-caption text-caption text-ink-secondary">Answered</p></div>
            <div><p className="font-headline-md text-ink">{flagged.size}</p><p className="font-caption text-caption text-ink-secondary">Flagged</p></div>
            <div><p className="font-headline-md text-ink">{qs.length - nAnswered}</p><p className="font-caption text-caption text-ink-secondary">Remaining</p></div>
          </div>
          <div className="grid grid-cols-5 gap-space-sm">
            {qs.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setCurrent(i)}
                aria-label={`Question ${i + 1}${answered(x.id) ? ", answered" : ""}${flagged.has(x.id) ? ", flagged" : ""}`}
                aria-current={i === current}
                className={`relative min-h-11 rounded-lg font-label-md text-label-md ${
                  i === current ? "bg-primary text-white" : answered(x.id) ? "bg-accent/20 text-ink" : "bg-canvas text-ink-secondary"
                }`}
              >
                {i + 1}
                {flagged.has(x.id) && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-danger" />}
              </button>
            ))}
          </div>
          <button onClick={toggleFlag} className="min-h-11 rounded-full bg-canvas text-ink font-label-md text-label-md inline-flex items-center justify-center gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-danger">flag</span>
            {flagged.has(q.id) ? "Unflag Question" : "Flag Current Question"}
          </button>
          <p className="font-caption text-caption text-ink-secondary flex gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-primary">shield</span>
            Answers are saved to the server as you go, so you will not lose them if you disconnect.
          </p>
        </aside>

        <section className="bg-card rounded-xl border border-border p-space-md md:p-space-lg flex flex-col gap-space-lg">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">Question {current + 1}</span>
            <span className="px-3 py-1 rounded-full bg-canvas font-caption text-caption">{q.points} Points</span>
            <span className="px-3 py-1 rounded-full bg-canvas font-caption text-caption">
              {q.type === "multiple" ? "Multiple Choice" : q.type === "short" ? "Short Answer" : q.type === "true_false" ? "True / False" : "Single Choice"}
            </span>
            {q.topic && <span className="ml-auto font-caption text-caption text-ink-secondary">Topic: {q.topic}</span>}
          </div>
          <h2 className="font-headline-lg text-headline-lg text-ink">{q.prompt}</h2>

          {q.type === "short" ? (
            <input
              aria-label="Your answer"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="min-h-11 rounded-xl border border-border px-space-md focus:outline-none focus:ring-2 focus:ring-primary-ring"
              placeholder="Type your answer"
            />
          ) : (
            <div role={q.type === "multiple" ? "group" : "radiogroup"} className="flex flex-col gap-space-sm">
              {q.options.map((o, i) => (
                <button
                  key={o.id}
                  role={q.type === "multiple" ? "checkbox" : "radio"}
                  aria-checked={selected(o.id)}
                  onClick={() => pick(o.id)}
                  className={`text-left min-h-11 rounded-xl p-space-md flex items-center gap-space-md border ${
                    selected(o.id) ? "bg-primary/10 border-primary" : "bg-canvas border-transparent hover:border-border-hover"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md ${selected(o.id) ? "bg-primary text-white" : "bg-white"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="font-body-lg text-body-lg text-ink flex-1">{o.text}</span>
                  {selected(o.id) && <span className="font-caption text-caption bg-accent/20 text-accent rounded-full px-2 py-0.5">Your Selection</span>}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-space-sm">
            <button disabled={current === 0} onClick={() => setCurrent(current - 1)} className="min-h-11 px-space-lg rounded-full bg-canvas font-label-md text-label-md inline-flex items-center gap-space-xs disabled:opacity-50">
              <span className="material-symbols-outlined">arrow_back</span> Previous
            </button>
            <button onClick={() => setAnswer(q.id, q.type === "multiple" ? [] : null)} className="min-h-11 underline text-ink-secondary font-caption text-caption">Clear Selection</button>
            <button disabled={current === qs.length - 1} onClick={() => setCurrent(current + 1)} className="min-h-11 px-space-lg rounded-full bg-primary text-white font-label-md text-label-md inline-flex items-center gap-space-xs disabled:opacity-50">
              Next <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </section>
      </div>
      <ConfirmModal
        open={confirmSubmit}
        tone="danger"
        title="Submit quiz?"
        message={qs.length - nAnswered > 0 ? `You still have ${qs.length - nAnswered} unanswered question${qs.length - nAnswered === 1 ? "" : "s"}. You cannot change answers after submitting.` : "You cannot change your answers after submitting."}
        confirmLabel="Submit quiz"
        busy={submitting}
        onConfirm={() => { setConfirmSubmit(false); void finish(); }}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}
