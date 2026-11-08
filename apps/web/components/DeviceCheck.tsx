"use client";

import React, { useEffect, useRef, useState } from "react";

/** Camera and microphone preview shown before joining. Stops all tracks on close. */
export function DeviceCheck({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let ctx: AudioContext | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          setLevel(Math.min(100, Math.max(...Array.from(buf).map((v) => Math.abs(v - 128))) * 1.5));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((e: Error) =>
        setError(e.name === "NotAllowedError" ? "Permission denied. Allow camera and microphone access in your browser settings and try again." : e.name === "NotFoundError" ? "No camera or microphone was found." : e.message)
      );
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Audio and video check" className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-space-md">
      <div className="bg-card rounded-xl p-space-lg max-w-md w-full flex flex-col gap-space-md">
        <h2 className="font-headline-md text-headline-md">Audio &amp; Video Check</h2>
        {error ? (
          <p role="alert" className="text-danger">{error}</p>
        ) : (
          <>
            <video ref={video} autoPlay muted playsInline className="w-full aspect-video rounded-xl bg-stage" />
            <div className="h-2 rounded-full bg-border overflow-hidden" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(level)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${level}%` }} />
            </div>
            <p className="font-caption text-caption text-ink-secondary">Speak to see the microphone level move.</p>
          </>
        )}
        <button onClick={onClose} className="min-h-11 rounded-full bg-primary text-white font-label-md">Done</button>
      </div>
    </div>
  );
}
