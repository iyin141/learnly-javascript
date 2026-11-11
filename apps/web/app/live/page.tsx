"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LobbyCard } from "../../components/LobbyCard";
import { DeviceCheck } from "../../components/DeviceCheck";
import { useAppSelector } from "../../store";
import { useGetLiveSessionsQuery, useJoinLiveByCodeMutation, useStartLiveSessionMutation } from "../../store/apiSlice";

export default function LiveLobbyPage() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const { data, isLoading, isError } = useGetLiveSessionsQuery(undefined, { pollingInterval: 15000 });
  const [joinByCode, { error: joinError, isLoading: joining }] = useJoinLiveByCodeMutation();
  const [start, { isLoading: starting }] = useStartLiveSessionMutation();
  const [code, setCode] = useState("");
  const [check, setCheck] = useState(false);
  const [filter, setFilter] = useState("All");

  const sessions = data?.sessions ?? [];
  const courses = ["All", ...Array.from(new Set(sessions.map((s) => s.courseTitle)))];
  const shown = sessions.filter((s) => filter === "All" || s.courseTitle === filter);
  const now = shown.filter((s) => s.status === "live" || (s.status === "scheduled" && new Date(s.startsAt).getTime() - Date.now() < 3600_000));
  const later = shown.filter((s) => s.status === "scheduled" && !now.includes(s));
  const past = shown.filter((s) => s.status === "ended");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await joinByCode(code);
    if ("data" in r && r.data) router.push(`/live/${r.data.session.id}`);
  };
  const err = (joinError as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message;

  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-lg">
      <header className="bg-card rounded-xl border border-border p-space-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[32px]">videocam</span>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-ink">Live Classes &amp; Workshops</h1>
            <p className="text-ink-secondary">Real-time classes, labs and office hours.</p>
          </div>
        </div>
        <form onSubmit={join} className="flex flex-wrap gap-space-sm items-start w-full sm:w-auto">
          <div className="flex-1 min-w-0 sm:flex-none">
            <input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Room code or link" placeholder="Enter room code or link..." className="min-h-11 w-full sm:w-64 rounded-full bg-canvas border border-border px-4 focus:outline-none focus:ring-2 focus:ring-primary-ring" />
            {err && <p role="alert" className="text-danger text-sm mt-1">{err}</p>}
          </div>
          <button disabled={joining || code.length < 3} className="min-h-11 px-space-lg rounded-full bg-primary text-white font-label-md disabled:opacity-50">Join</button>
        </form>
      </header>

      <section className="bg-primary/5 rounded-xl p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md">Join with your course link or room code</h2>
          <p className="text-ink-secondary">Workshops open 10 minutes before the scheduled start. Check your camera and microphone first.</p>
        </div>
        <button onClick={() => setCheck(true)} className="min-h-11 px-space-lg rounded-full bg-card border border-border font-label-md inline-flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[18px]">tune</span> Audio &amp; Video Check
        </button>
      </section>
      {check && <DeviceCheck onClose={() => setCheck(false)} />}

      <div className="flex flex-wrap gap-space-sm" role="tablist" aria-label="Filter by course">
        {courses.map((c) => (
          <button key={c} role="tab" aria-selected={filter === c} onClick={() => setFilter(c)} className={`min-h-11 px-space-md rounded-full font-label-md ${filter === c ? "bg-primary text-white" : "bg-card border border-border text-ink-secondary"}`}>
            {c}{c === "All" ? ` (${sessions.length})` : ""}
          </button>
        ))}
      </div>

      {!user && <p role="alert" className="text-ink-secondary">Log in to see your classes.</p>}
      {isLoading && <div className="h-48 rounded-xl bg-border animate-pulse" />}
      {isError && user && <p role="alert" className="text-danger">Could not load live classes.</p>}
      {!isLoading && user && sessions.length === 0 && <p className="bg-card rounded-xl border border-border p-space-lg text-center text-ink-secondary">No live classes are scheduled. Check back soon.</p>}

      {now.length > 0 && (
        <section>
          <h2 className="font-headline-md text-headline-md mb-space-md flex items-center gap-space-sm"><span className="w-3 h-3 rounded-full bg-danger" />Happening Now &amp; Starting Soon</h2>
          <div className="grid gap-gutter md:grid-cols-2">{now.map((s) => <LobbyCard key={s.id} s={s} busy={starting} onStart={async (id) => { await start(id); router.push(`/live/${id}`); }} />)}</div>
        </section>
      )}
      {later.length > 0 && (
        <section>
          <h2 className="font-headline-md text-headline-md mb-space-md flex items-center gap-space-sm"><span className="w-3 h-3 rounded-full bg-primary" />Upcoming Later This Week</h2>
          <div className="grid gap-gutter md:grid-cols-2">{later.map((s) => <LobbyCard key={s.id} s={s} busy={starting} onStart={async (id) => { await start(id); router.push(`/live/${id}`); }} />)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="font-headline-md text-headline-md mb-space-md">Recently ended</h2>
          <div className="grid gap-gutter md:grid-cols-2">{past.map((s) => <LobbyCard key={s.id} s={s} />)}</div>
        </section>
      )}
    </div>
  );
}
