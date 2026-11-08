"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LiveRoom } from "../../../components/LiveRoom";
import { DeviceCheck } from "../../../components/DeviceCheck";
import { useEndLiveSessionMutation, useGetLiveSessionQuery, useGetLiveTokenMutation, useLeaveLiveMutation, useStartLiveSessionMutation } from "../../../store/apiSlice";

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useGetLiveSessionQuery(sessionId, { pollingInterval: 10000 });
  const [getToken, { data: tok, error: tokError, isLoading: joining }] = useGetLiveTokenMutation();
  const [start] = useStartLiveSessionMutation();
  const [end] = useEndLiveSessionMutation();
  const [leaveApi] = useLeaveLiveMutation();
  const [checked, setChecked] = useState(false);
  const [left, setLeft] = useState(false);
  const s = data?.session;

  const shell = (children: React.ReactNode) => <div className="min-h-screen bg-stage text-white flex items-center justify-center p-space-md"><div className="max-w-md w-full flex flex-col gap-space-md text-center">{children}</div></div>;

  if (isLoading) return shell(<div className="h-40 rounded-xl bg-stage-tile animate-pulse" />);
  if (isError || !s) return shell(<><h1 className="font-headline-lg">Class not found</h1><p>You may not be enrolled in this course.</p><Link className="underline" href="/live">Back to live classes</Link></>);
  if (s.status === "ended" || left)
    return shell(<><span className="material-symbols-outlined text-[48px]">event_available</span><h1 className="font-headline-lg">{left && s.status !== "ended" ? "You left the class" : "This class has ended"}</h1><p className="text-white/70">{s.title}</p><Link className="min-h-11 inline-flex items-center justify-center rounded-full bg-primary" href="/live">Back to live classes</Link></>);

  if (tok) {
    const leave = async () => { await leaveApi(sessionId); setLeft(true); };
    return <LiveRoom session={s} token={tok.token} url={tok.url} onLeave={leave} onEnd={s.isHost ? async () => { await end(sessionId); router.push("/live"); } : undefined} />;
  }

  const err = (tokError as { data?: { error?: { code?: string; message?: string } } } | undefined)?.data?.error;
  const notStarted = s.status === "scheduled" && !s.isHost;
  return shell(
    <>
      <h1 className="font-headline-lg text-headline-lg">{s.title}</h1>
      <p className="text-white/70">{s.courseTitle} &middot; {s.instructorName}</p>
      {notStarted ? (
        <>
          <p role="status">This class has not started yet. It begins {new Date(s.startsAt).toLocaleString()}.</p>
          <button onClick={() => refetch()} className="min-h-11 rounded-full bg-stage-bar">Check again</button>
        </>
      ) : (
        <>
          {!checked && <button onClick={() => setChecked(true)} className="min-h-11 rounded-full bg-stage-bar">Check camera &amp; microphone</button>}
          {checked && <DeviceCheck onClose={() => setChecked(false)} />}
          {err && <p role="alert" className="text-danger">{err.message}</p>}
          <button
            disabled={joining}
            onClick={async () => { if (s.isHost && s.status === "scheduled") await start(sessionId); await getToken(sessionId); }}
            className="min-h-11 rounded-full bg-accent font-label-md disabled:opacity-50"
          >
            {s.isHost && s.status === "scheduled" ? "Start class" : "Join class"}
          </button>
        </>
      )}
    </>
  );
}
