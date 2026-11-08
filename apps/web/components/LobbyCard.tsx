"use client";

import React from "react";
import Link from "next/link";
import type { LiveSessionInfo } from "@learnly/shared";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function LobbyCard({
  s,
  onStart,
  busy,
}: {
  s: LiveSessionInfo;
  onStart?: (id: string) => void;
  busy?: boolean;
}) {
  const live = s.status === "live";
  const ended = s.status === "ended";
  const startsIn = Math.round((new Date(s.startsAt).getTime() - Date.now()) / 60000);
  const soon = !live && !ended && startsIn <= 10;
  return (
    <article className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
      <div className={`p-space-md flex flex-col gap-space-xs ${live ? "bg-primary text-white" : ended ? "bg-border text-ink" : "bg-stage-bar text-white"}`}>
        <div className="flex items-center justify-between gap-space-sm">
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{s.courseTitle}</span>
          <span className="text-xs bg-white text-ink rounded-full px-2 py-0.5 font-semibold">
            {live ? "LIVE NOW" : ended ? "Ended" : startsIn > 0 ? `Starts in ${startsIn >= 60 ? `${Math.round(startsIn / 60)}h` : `${startsIn} min`}` : "Starting"}
          </span>
        </div>
        <h3 className="font-headline-md text-headline-md">{s.title}</h3>
        <p className="text-sm opacity-90">{time(s.startsAt)} &middot; {s.durationMinutes} min</p>
      </div>
      <div className="p-space-md flex flex-col gap-space-sm flex-1">
        <p className="font-label-md text-label-md text-ink">{s.instructorName}</p>
        <p className="font-caption text-caption text-ink-secondary">Room code: <span className="font-mono">{s.code}</span></p>
        <div className="mt-auto flex gap-space-sm">
          {s.isHost && !live && !ended && (
            <button disabled={busy} onClick={() => onStart?.(s.id)} className="min-h-11 px-space-lg rounded-full bg-primary text-white font-label-md disabled:opacity-50">Start class</button>
          )}
          {(live || (s.isHost && !ended)) && (
            <Link href={`/live/${s.id}`} className="min-h-11 px-space-lg rounded-full bg-accent text-white font-label-md inline-flex items-center">{s.isHost && !live ? "Open room" : "Join room now"}</Link>
          )}
          {!live && !ended && !s.isHost && (
            <span className="min-h-11 px-space-lg rounded-full bg-canvas text-ink-secondary inline-flex items-center gap-1 font-label-md">
              <span className="material-symbols-outlined text-[18px]">lock_clock</span>{soon ? "Opens when the host starts" : `Opens at ${time(s.startsAt)}`}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
