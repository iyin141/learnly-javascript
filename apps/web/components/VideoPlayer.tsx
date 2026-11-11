"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useGetPlaybackQuery, useSaveProgressMutation } from "../store/apiSlice";
import { withBase } from "../store/basePath";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

interface Props {
  lessonId: string;
  title: string;
  onEnded?: () => void;
  onCompleted?: () => void;
}

/** HLS player: signed URL refresh, resume, progress heartbeat every 10 s, keyboard shortcuts. */
export function VideoPlayer({ lessonId, title, onEnded, onCompleted }: Props) {
  const { data, error, isLoading, refetch } = useGetPlaybackQuery(lessonId);
  const [saveProgress] = useSaveProgressMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<{ height: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [menu, setMenu] = useState(false);
  const [captions, setCaptions] = useState(false);
  const url = data?.playbackUrl ? withBase(data.playbackUrl) : undefined;           // the API returns a root-relative /cdn/... URL
  const resumeAt = useRef(0);
  if (data && !resumeAt.current) resumeAt.current = data.lastPositionSeconds > 5 ? data.lastPositionSeconds : 0;

  // attach stream (re-attaching after a URL refresh keeps the current position)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url) return;
    const start = v.currentTime || resumeAt.current;
    if (Hls.isSupported()) {
      const hls = new Hls({ xhrSetup: (x) => { x.withCredentials = true; }, startPosition: start });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, m) => setLevels(m.levels));
      return () => hls.destroy();
    }
    v.src = url;
    if (start) v.currentTime = start;
  }, [url]);

  // refresh the signed URL 60 s before expiry (the call also re-sets the CDN cookies)
  useEffect(() => {
    if (!data) return;
    const ms = data.expiresAt * 1000 - Date.now() - 60_000;
    const t = setTimeout(() => refetch(), Math.max(ms, 5_000));
    return () => clearTimeout(t);
  }, [data, refetch]);

  // progress heartbeat every 10 s
  useEffect(() => {
    const id = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      const r = await saveProgress({ lessonId, positionSeconds: Math.floor(v.currentTime) });
      if ("data" in r && r.data?.completed) onCompleted?.();
    }, 10_000);
    return () => clearInterval(id);
  }, [lessonId, saveProgress, onCompleted]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (v) void (v.paused ? v.play() : v.pause());
  }, []);
  const seek = (d: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
  };
  const setRate = (r: number) => {
    setSpeed(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
  };
  const pickLevel = (i: number) => {
    setLevel(i);
    if (hlsRef.current) hlsRef.current.currentLevel = i;
    setMenu(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case " ":
      case "k": e.preventDefault(); toggle(); break;
      case "ArrowRight": seek(10); break;
      case "ArrowLeft": seek(-10); break;
      case "ArrowUp": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
      case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
      case "m": v.muted = !v.muted; break;
      case "f": void (document.fullscreenElement ? document.exitFullscreen() : wrapRef.current?.requestFullscreen()); break;
      case ">": setRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]); break;
      case "<": setRate(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]); break;
    }
  };

  const err = error as { data?: { error?: { code?: string; message?: string } }; status?: number } | undefined;
  if (isLoading) return <div className="aspect-video rounded-xl bg-stage animate-pulse" aria-busy="true" />;
  if (err) {
    const text =
      err.status === 403 ? "You are not enrolled in this course." :
      err.data?.error?.code === "VIDEO_NOT_READY" ? "This video is still processing. Check back in a few minutes." :
      err.data?.error?.message || "Could not load the video.";
    return (
      <div role="alert" className="aspect-video rounded-xl bg-stage text-white flex flex-col items-center justify-center gap-space-sm p-space-lg text-center">
        <span className="material-symbols-outlined text-[40px]">{err.status === 403 ? "lock" : "movie_edit"}</span>
        <p className="font-body-lg text-body-lg">{text}</p>
        <button onClick={() => refetch()} className="px-space-md py-space-xs rounded-full bg-white/10 hover:bg-white/20 min-h-11">Retry</button>
      </div>
    );
  }

  const btn = "min-w-11 min-h-11 flex items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary-ring outline-none";
  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKey} aria-label={`Video player: ${title}`}
      className="rounded-xl bg-stage overflow-hidden shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-ring">
      <video ref={videoRef} className="w-full aspect-video bg-black" playsInline onClick={toggle}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          if (videoRef.current) void saveProgress({ lessonId, positionSeconds: Math.floor(videoRef.current.duration) });
          onEnded?.();
        }}>
        {/* captions slot: a real <track src> is added once the API exposes caption files */}
        {captions && <track kind="captions" label="English" />}
      </video>
      <div className="px-space-md pt-space-sm">
        <input type="range" min={0} max={duration || 1} step={1} value={time} aria-label="Seek"
          onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
          className="w-full accent-primary h-1" />
      </div>
      <div className="flex items-center gap-space-xs px-space-sm pb-space-sm text-white font-label-md text-label-md flex-wrap">
        <button className={btn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
        </button>
        <button className={btn} onClick={() => seek(-10)} aria-label="Back 10 seconds"><span className="material-symbols-outlined">replay_10</span></button>
        <button className={btn} onClick={() => seek(10)} aria-label="Forward 10 seconds"><span className="material-symbols-outlined">forward_10</span></button>
        <span className="tabular-nums px-space-xs">{fmt(time)} / {fmt(duration)}</span>
        <span className="flex-1" />
        <button className={`${btn} px-space-sm`} onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed">{speed}x</button>
        <div className="relative">
          <button className={`${btn} px-space-sm`} onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
            {level === -1 ? "Auto" : `${levels[level]?.height}p`}
          </button>
          {menu && (
            <ul role="menu" className="absolute bottom-12 right-0 bg-stage-bar rounded-lg p-space-xs min-w-24 z-10">
              {[-1, ...levels.map((_, i) => i)].map((i) => (
                <li key={i} role="none">
                  <button role="menuitem" onClick={() => pickLevel(i)} className="w-full text-left px-space-sm min-h-11 hover:bg-white/10 rounded">
                    {i === -1 ? "Auto" : `${levels[i].height}p`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className={btn} aria-pressed={captions} onClick={() => setCaptions(!captions)} aria-label="Captions"><span className="material-symbols-outlined">closed_caption</span></button>
        <button className={btn} aria-label="Fullscreen" onClick={() => void wrapRef.current?.requestFullscreen()}><span className="material-symbols-outlined">fullscreen</span></button>
      </div>
    </div>
  );
}
