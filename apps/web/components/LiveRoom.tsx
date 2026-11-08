"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useConnectionState, useDataChannel, useLocalParticipant, useParticipants, useTracks, isTrackReference } from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import type { LiveSessionInfo } from "@learnly/shared";
import { useAppSelector } from "../store";
import { useGetLiveMessagesQuery, useGrantMicMutation, usePostLiveMessageMutation } from "../store/apiSlice";

interface Props {
  session: LiveSessionInfo;
  token: string;
  url: string;
  onLeave: () => void;
  onEnd?: () => void;
}

export function LiveRoom(props: Props) {
  return (
    <LiveKitRoom token={props.token} serverUrl={props.url} connect video={false} audio={false} onDisconnected={props.onLeave} data-lk-theme="default" className="h-screen">
      <RoomAudioRenderer />
      <Stage {...props} />
    </LiveKitRoom>
  );
}

interface Chat { id: string; userName: string; role?: string; text: string }
const enc = new TextEncoder();
const dec = new TextDecoder();

function Tile({ p, big }: { p: Participant; big?: boolean }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const ref = tracks.find((t) => t.participant.identity === p.identity && isTrackReference(t));
  return (
    <div className={`relative rounded-xl bg-stage-tile overflow-hidden flex items-center justify-center ${big ? "h-full min-h-64" : "aspect-video"} ${p.isSpeaking ? "ring-2 ring-accent" : ""}`}>
      {ref && isTrackReference(ref) ? (
        <VideoTrack trackRef={ref} className="w-full h-full object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-stage-bar text-white flex items-center justify-center text-xl font-bold">{(p.name || "?")[0]}</div>
      )}
      <span className="absolute left-2 bottom-2 text-xs bg-black/60 text-white rounded px-2 py-0.5 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">{p.isMicrophoneEnabled ? "mic" : "mic_off"}</span>{p.name}
      </span>
    </div>
  );
}

function Stage({ session, onLeave, onEnd }: Props) {
  const me = useAppSelector((s) => s.auth.user);
  const isHost = !!session.isHost || me?.role === "admin";
  const state = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const [messages, setMessages] = useState<Chat[]>([]);
  const [hands, setHands] = useState<{ identity: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [handUp, setHandUp] = useState(false);
  const [secs, setSecs] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useDataChannel("chat", (m) => {
    const c = JSON.parse(dec.decode(m.payload)) as Chat;
    setMessages((p) => (p.some((x) => x.id === c.id) ? p : [...p, c]));
  });
  const hand = useDataChannel("hand", (m) => {
    const d = JSON.parse(dec.decode(m.payload)) as { identity: string; name: string; up: boolean };
    setHands((p) => (d.up ? (p.some((h) => h.identity === d.identity) ? p : [...p, d]) : p.filter((h) => h.identity !== d.identity)));
  });

  // history for late joiners
  const { data: history } = useGetLiveMessagesQuery(session.id);
  useEffect(() => {
    if (history) setMessages((p) => [...history.messages.filter((m) => !p.some((x) => x.id === m.id)), ...p]);
  }, [history]);
  const [postMessage] = usePostLiveMessageMutation();
  const [grantMic] = useGrantMicMutation();
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    const msg: Chat = { id: crypto.randomUUID(), userName: me?.name ?? "Me", role: isHost ? "host" : "student", text: text.trim() };
    setText("");
    setMessages((p) => [...p, msg]);
    await chat.send(enc.encode(JSON.stringify(msg)), { reliable: true });
    void postMessage({ id: session.id, text: msg.text });
  };

  const toggle = async (kind: "mic" | "cam" | "screen") => {
    setMediaError(null);
    try {
      if (kind === "mic") await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
      if (kind === "cam") await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
      if (kind === "screen") await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
    } catch (e) {
      const err = e as Error;
      setMediaError(err.name === "NotAllowedError" ? "Permission denied. Allow camera and microphone in your browser, or ask the host for the stage." : err.message);
    }
  };
  const raise = async () => {
    const up = !handUp;
    setHandUp(up);
    await hand.send(enc.encode(JSON.stringify({ identity: localParticipant.identity, name: localParticipant.name, up })), { reliable: true });
  };
  const grant = async (identity: string, allow: boolean) => {
    await grantMic({ id: session.id, identity, allow });
    if (allow) setHands((p) => p.filter((h) => h.identity !== identity));
  };

  const active = useMemo(() => participants.find((p) => p.isScreenShareEnabled) ?? participants.find((p) => p.isSpeaking) ?? participants.find((p) => p.metadata?.includes("host")) ?? participants[0], [participants]);
  const canPublish = localParticipant.permissions?.canPublish;
  const clock = `${String(Math.floor(secs / 3600)).padStart(2, "0")}:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const btn = "min-w-11 min-h-11 rounded-full flex items-center justify-center text-white bg-stage-bar hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary-ring outline-none";

  return (
    <div className="h-screen bg-stage text-white flex flex-col">
      {state === ConnectionState.Reconnecting && <div role="status" className="bg-warning text-white text-center text-sm py-1">Connection lost. Reconnecting...</div>}
      <header className="h-14 px-space-md flex items-center gap-space-md border-b border-white/10 shrink-0">
        {session.recording && <span className="flex items-center gap-1 text-danger text-sm font-bold"><span className="w-2 h-2 rounded-full bg-danger animate-pulse" /> REC</span>}
        <h1 className="font-label-md text-label-md truncate flex-1">{session.courseTitle}: {session.title}</h1>
        <span className="hidden sm:inline text-sm bg-stage-bar rounded-full px-3 py-1">{session.code}</span>
        <span className="tabular-nums text-sm" aria-label="Elapsed time">{clock}</span>
        <span className="text-sm bg-stage-bar rounded-full px-3 py-1 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">group</span>{participants.length}</span>
        <span className="text-xs flex items-center gap-1" title="Connection"><span className={`w-2 h-2 rounded-full ${state === ConnectionState.Connected ? "bg-accent" : "bg-warning"}`} />{state === ConnectionState.Connected ? "Good" : state}</span>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px_340px] gap-space-sm p-space-sm">
        <main className="min-h-64 min-w-0">{active ? <Tile p={active} big /> : <p className="p-space-lg">Waiting for others to join...</p>}</main>
        <aside aria-label="Participants" className="hidden lg:flex flex-col gap-space-sm overflow-y-auto">
          {participants.filter((p) => p !== active).slice(0, 6).map((p) => <Tile key={p.identity} p={p} />)}
          {participants.length > 7 && <div className="rounded-xl bg-stage-tile p-space-md text-center">+{participants.length - 7} others</div>}
        </aside>
        <aside className="bg-stage-tile rounded-xl flex flex-col min-h-64 max-h-[50vh] lg:max-h-none">
          <div role="tablist" className="flex border-b border-white/10">
            {(["chat", "people"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 min-h-11 capitalize text-sm ${tab === t ? "border-b-2 border-primary text-white" : "text-white/60"}`}>
                {t === "chat" ? "In-Class Chat" : `People (${participants.length})`}{t === "people" && hands.length > 0 && isHost ? ` · ${hands.length} hand${hands.length > 1 ? "s" : ""}` : ""}
              </button>
            ))}
          </div>
          {tab === "chat" ? (
            <>
              <ul className="flex-1 overflow-y-auto p-space-sm flex flex-col gap-space-sm" aria-live="polite">
                {messages.map((m) => (
                  <li key={m.id} className="text-sm"><span className="font-semibold">{m.userName}</span> {m.role === "host" && <span className="text-xs bg-primary rounded px-1">Host</span>}<p className="bg-stage-bar rounded-lg p-2 mt-1">{m.text}</p></li>
                ))}
                <div ref={endRef} />
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="p-space-sm flex gap-space-xs">
                <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" placeholder="Send a message" className="flex-1 min-h-11 rounded-full bg-stage-bar px-4 outline-none focus:ring-2 focus:ring-primary-ring" />
                <button className={`${btn} bg-primary`} aria-label="Send"><span className="material-symbols-outlined">send</span></button>
              </form>
            </>
          ) : (
            <ul className="flex-1 overflow-y-auto p-space-sm flex flex-col gap-space-xs">
              {isHost && hands.length > 0 && (
                <li className="mb-space-sm"><p className="text-xs uppercase text-white/60 mb-1">Raised hands (in order)</p>
                  {hands.map((h, i) => (
                    <div key={h.identity} className="flex items-center gap-2 bg-stage-bar rounded-lg p-2 mb-1">
                      <span className="text-warning">{i + 1}. </span><span className="flex-1 truncate">{h.name}</span>
                      <button onClick={() => grant(h.identity, true)} className="min-h-11 px-3 rounded-full bg-accent text-sm">Grant mic</button>
                    </div>
                  ))}
                </li>
              )}
              {participants.map((p) => (
                <li key={p.identity} className="flex items-center gap-2 p-2">
                  <span className="flex-1 truncate">{p.name}{p.isLocal ? " (you)" : ""}</span>
                  <span className="material-symbols-outlined text-[18px]">{p.isMicrophoneEnabled ? "mic" : "mic_off"}</span>
                  {isHost && !p.isLocal && p.permissions?.canPublish && <button onClick={() => grant(p.identity, false)} className="min-h-11 px-3 rounded-full bg-danger text-sm">Revoke</button>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {mediaError && <div role="alert" className="mx-space-md mb-2 rounded-lg bg-danger/20 text-danger-foreground p-2 text-sm">{mediaError}</div>}
      <footer className="h-20 shrink-0 px-space-md flex items-center justify-center gap-space-sm border-t border-white/10 flex-wrap">
        <button className={btn} onClick={() => toggle("mic")} disabled={!canPublish} aria-pressed={localParticipant.isMicrophoneEnabled} aria-label="Microphone"><span className="material-symbols-outlined">{localParticipant.isMicrophoneEnabled ? "mic" : "mic_off"}</span></button>
        <button className={btn} onClick={() => toggle("cam")} disabled={!canPublish} aria-pressed={localParticipant.isCameraEnabled} aria-label="Camera"><span className="material-symbols-outlined">{localParticipant.isCameraEnabled ? "videocam" : "videocam_off"}</span></button>
        <button className={btn} onClick={() => toggle("screen")} disabled={!canPublish} aria-label="Share screen"><span className="material-symbols-outlined">present_to_all</span></button>
        {!isHost && <button className={`${btn} px-4 ${handUp ? "bg-warning" : ""}`} onClick={raise} aria-pressed={handUp}><span className="material-symbols-outlined">back_hand</span><span className="ml-1 text-sm">{handUp ? "Lower hand" : "Raise hand"}</span></button>}
        {isHost && onEnd && <button className={`${btn} px-4 bg-danger`} onClick={onEnd}>End class</button>}
        <button className={`${btn} px-4 bg-danger`} onClick={onLeave}><span className="material-symbols-outlined">call_end</span><span className="ml-1 text-sm">Leave</span></button>
      </footer>
    </div>
  );
}
