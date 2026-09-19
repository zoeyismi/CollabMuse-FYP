"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ArrowLeft, Circle, RadioTower, Share2 } from "@/components/Icons";
import { ChatPanel } from "@/components/ChatPanel";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { ControlPanel } from "@/components/ControlPanel";
import { EventActivity } from "@/components/EventActivity";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { Timeline } from "@/components/Timeline";
import { TrackList } from "@/components/TrackList";
import {
  initialRoomEvents,
  initialRoomNotes,
  initialTimelineRegions,
  roomStats,
} from "@/lib/mock-data";
import type { RoomEvent, RoomNote, TimelineRegion } from "@/lib/mock-data";

type RoomSocket = Socket<
  {
    "room:snapshot": (payload: {
      roomId: string;
      title: string;
      events: RoomEvent[];
      notes: RoomNote[];
      uploadedFileName: string;
      waveformPeaks: number[] | null;
      audioAvailable: boolean;
      timelineRegions: TimelineRegion[];
    }) => void;
    "room:event": (event: RoomEvent) => void;
    "room:upload": (payload: {
      fileName: string;
      waveformPeaks?: number[] | null;
      audioAvailable?: boolean;
      event?: RoomEvent;
    }) => void;
    "room:note": (payload: { note: RoomNote; event?: RoomEvent }) => void;
    "room:timeline": (payload: { timelineRegions: TimelineRegion[]; event?: RoomEvent }) => void;
    "room:presence": (payload: { roomId: string; count: number }) => void;
  },
  {
    "room:join": (roomId: string) => void;
    "room:event": (payload: { roomId: string; event: RoomEvent }) => void;
    "room:upload": (payload: {
      roomId: string;
      fileName: string;
      waveformPeaks: number[] | null;
      audioAvailable: boolean;
      event: RoomEvent;
    }) => void;
    "room:note": (payload: { roomId: string; note: RoomNote; event: RoomEvent }) => void;
    "room:timeline": (payload: {
      roomId: string;
      timelineRegions: TimelineRegion[];
      event: RoomEvent;
    }) => void;
  }
>;

function createEvent(kind: RoomEvent["kind"], title: string, detail: string): RoomEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    title,
    detail,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function createNote(message: string): RoomNote {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author: "Ziyi",
    message,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function clampRegionStart(left: number, width: number) {
  return Math.min(96 - width, Math.max(4, left));
}

function getNextTimelineRegions(regions: TimelineRegion[], label: string) {
  return regions.map((region) => {
    if (label === "Move clip" && region.id === "region-move") {
      const nextLeft = region.left >= 28 ? 10 : region.left + 4;
      return { ...region, left: clampRegionStart(nextLeft, region.width) };
    }

    if (label === "Sync edit" && region.id === "region-sync") {
      const nextLeft = region.left >= 58 ? 42 : region.left + 3;
      return { ...region, left: clampRegionStart(nextLeft, region.width) };
    }

    if (label === "Mark section" && region.id === "region-mark") {
      const nextLeft = region.left >= 58 ? 24 : region.left + 6;
      return { ...region, left: clampRegionStart(nextLeft, region.width) };
    }

    if (label === "Extend clip" && region.id === "region-extend") {
      const nextWidth = region.width >= 22 ? 12 : region.width + 3;
      return { ...region, width: nextWidth, left: clampRegionStart(region.left, nextWidth) };
    }

    return region;
  });
}

async function extractWaveformPeaks(file: File): Promise<number[] | null> {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    const channelData = audioBuffer.getChannelData(0);
    const bucketCount = 96;
    const bucketSize = Math.max(1, Math.floor(channelData.length / bucketCount));

    const rmsPeaks = Array.from({ length: bucketCount }, (_, bucketIndex) => {
      const start = bucketIndex * bucketSize;
      const end = bucketIndex === bucketCount - 1 ? channelData.length : Math.min(channelData.length, start + bucketSize);
      let sum = 0;

      for (let index = start; index < end; index += 1) {
        sum += channelData[index] * channelData[index];
      }

      return Math.sqrt(sum / Math.max(1, end - start));
    });

    const strongestPeak = Math.max(...rmsPeaks, 0.001);
    return rmsPeaks.map((peak) => Math.round(18 + (peak / strongestPeak) * 44));
  } catch {
    return null;
  } finally {
    void audioContext.close();
  }
}

type DemoRoomWorkspaceProps = {
  roomId?: string;
  initialTitle?: string;
};

export function DemoRoomWorkspace({ roomId = "demo", initialTitle = "Always session" }: DemoRoomWorkspaceProps) {
  const [roomTitle, setRoomTitle] = useState(initialTitle);
  const [events, setEvents] = useState<RoomEvent[]>(initialRoomEvents);
  const [notes, setNotes] = useState<RoomNote[]>(initialRoomNotes);
  const [uploadedFileName, setUploadedFileName] = useState<string>("always-reference.wav");
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [timelineRegions, setTimelineRegions] = useState<TimelineRegion[]>(initialTimelineRegions);
  const [syncStatus, setSyncStatus] = useState("Connecting Socket.io");
  const [shareStatus, setShareStatus] = useState("Share room");
  const [onlineCount, setOnlineCount] = useState(1);
  const socketRef = useRef<RoomSocket | null>(null);
  const audioEndpoint = `/api/rooms/${encodeURIComponent(roomId)}/audio`;

  const prependEvent = useCallback((event: RoomEvent) => {
    setEvents((current) =>
      current.some((item) => item.id === event.id)
        ? current
        : [event, ...current].slice(0, 8),
    );
  }, []);

  const prependNote = useCallback((note: RoomNote) => {
    setNotes((current) =>
      current.some((item) => item.id === note.id)
        ? current
        : [note, ...current].slice(0, 8),
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRoom() {
      try {
        const roomResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (roomResponse.ok) {
          const roomData = (await roomResponse.json()) as { room?: { title?: string } };
          if (active && roomData.room?.title) setRoomTitle(roomData.room.title);
        }

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`);
        if (!response.ok) return;

        const data = (await response.json()) as {
          events: RoomEvent[];
          notes?: RoomNote[];
          uploadedFileName: string;
          waveformPeaks?: number[] | null;
          audioAvailable?: boolean;
          timelineRegions?: TimelineRegion[];
        };
        if (!active) return;

        setEvents(data.events);
        setNotes(data.notes ?? initialRoomNotes);
        setUploadedFileName(data.uploadedFileName);
        setWaveformPeaks(data.waveformPeaks ?? null);
        setUploadedAudioUrl(data.audioAvailable ? audioEndpoint : null);
        setTimelineRegions(data.timelineRegions ?? initialTimelineRegions);
      } catch {
        if (active) setSyncStatus("Backend offline fallback");
      }
    }

    const socket: RoomSocket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSyncStatus("Socket.io connected");
      socket.emit("room:join", roomId);
    });

    socket.on("disconnect", () => {
      setSyncStatus("Socket.io reconnecting");
    });

    socket.on("room:snapshot", (payload) => {
      if (payload.roomId !== roomId) return;
      setRoomTitle(payload.title || initialTitle);
      setEvents(payload.events);
      setNotes(payload.notes ?? initialRoomNotes);
      setUploadedFileName(payload.uploadedFileName);
      setWaveformPeaks(payload.waveformPeaks ?? null);
      setUploadedAudioUrl(payload.audioAvailable ? audioEndpoint : null);
      setTimelineRegions(payload.timelineRegions ?? initialTimelineRegions);
      setSyncStatus("Room state loaded");
    });

    socket.on("room:event", (event) => {
      prependEvent(event);
      setSyncStatus("Synced from another window");
    });

    socket.on("room:upload", ({ fileName, waveformPeaks: syncedWaveformPeaks, audioAvailable, event }) => {
      setUploadedFileName(fileName);
      setWaveformPeaks(syncedWaveformPeaks ?? null);
      if (audioAvailable) setUploadedAudioUrl(`${audioEndpoint}?v=${event?.id ?? Date.now()}`);
      if (event) prependEvent(event);
      setSyncStatus("Upload synced from another window");
    });

    socket.on("room:note", ({ note, event }) => {
      prependNote(note);
      if (event) prependEvent(event);
      setSyncStatus("Room note synced from another window");
    });

    socket.on("room:timeline", ({ timelineRegions: syncedTimelineRegions, event }) => {
      setTimelineRegions(syncedTimelineRegions);
      if (event) prependEvent(event);
      setSyncStatus("Timeline edit synced from another window");
    });

    socket.on("room:presence", ({ roomId: presenceRoomId, count }) => {
      if (presenceRoomId === roomId) setOnlineCount(Math.max(1, count));
    });

    loadRoom();
    return () => {
      active = false;
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [audioEndpoint, initialTitle, prependEvent, prependNote, roomId]);

  const publishEvent = (event: RoomEvent) => {
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:event", { roomId, event });
      setSyncStatus("Broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    setSyncStatus("Saved through backend");
  };

  const publishTimelineChange = (nextTimelineRegions: TimelineRegion[], event: RoomEvent) => {
    setTimelineRegions(nextTimelineRegions);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:timeline", {
        roomId,
        timelineRegions: nextTimelineRegions,
        event,
      });
      setSyncStatus("Timeline edit broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}/timeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timelineRegions: nextTimelineRegions, event }),
    });
    setSyncStatus("Timeline edit saved through backend");
  };

  const handleUpload = async (file: File) => {
    setSyncStatus("Analyzing uploaded waveform");
    const extractedWaveformPeaks = await extractWaveformPeaks(file);
    const event = createEvent("upload", "Audio uploaded", `Added ${file.name}`);
    let audioAvailable = false;

    try {
      const uploadResponse = await fetch(`${audioEndpoint}?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Audio upload failed");
      audioAvailable = true;
      setUploadedAudioUrl(`${audioEndpoint}?v=${event.id}`);
    } catch {
      setUploadedAudioUrl((currentUrl) => {
        if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
        return URL.createObjectURL(file);
      });
    }

    setUploadedFileName(file.name);
    setWaveformPeaks(extractedWaveformPeaks);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:upload", {
        roomId,
        fileName: file.name,
        waveformPeaks: extractedWaveformPeaks,
        audioAvailable,
        event,
      });
      setSyncStatus("Upload broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadedFileName: file.name,
        waveformPeaks: extractedWaveformPeaks,
        audioAvailable,
      }),
    });
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    setSyncStatus("Upload saved through backend");
  };

  const handleSendNote = (message: string) => {
    const note = createNote(message);
    const event = createEvent("note", "Room note added", `Ziyi: ${message}`);

    prependNote(note);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:note", { roomId, note, event });
      setSyncStatus("Room note broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, event }),
    });
    setSyncStatus("Room note saved through backend");
  };

  const handleSelectionAction = (label: string) => {
    const actionCopy: Record<string, { kind: RoomEvent["kind"]; title: string; detail: string }> = {
      "Move clip": {
        kind: "move",
        title: "Clip move synced",
        detail: "Ziyi moved the red waveform selection in Always.",
      },
      "Sync edit": {
        kind: "sync",
        title: "Edit synced",
        detail: "The blue edit region shifted and was broadcast to the room.",
      },
      "Mark section": {
        kind: "remix",
        title: "Section marked",
        detail: "The yellow review marker moved to a new timeline section.",
      },
      "Add note": {
        kind: "note",
        title: "Room note added",
        detail: "A collaborator note was attached to the current edit.",
      },
      "Extend clip": {
        kind: "extend",
        title: "Clip extended",
        detail: "The green clip region changed duration in the shared timeline.",
      },
    };
    const action = actionCopy[label] ?? actionCopy["Sync edit"];
    const event = createEvent(action.kind, action.title, action.detail);

    if (label === "Add note") {
      publishEvent(event);
      return;
    }

    publishTimelineChange(getNextTimelineRegions(timelineRegions, label), event);
  };

  const handleShareRoom = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus("Share room"), 1800);
    } catch {
      setShareStatus("Copy unavailable");
    }
  };

  return (
    <main className="room-shell relative min-h-screen px-4 py-4">
      <section className="mx-auto max-w-[1800px]">
        <header className="sticky top-4 z-30 mb-4 rounded-[28px] border border-white/14 bg-white/[0.08] px-4 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/70 transition hover:bg-white/16 hover:text-white"
                title="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-sage">
                  <Circle className="h-2.5 w-2.5 fill-[#58e081] text-[#58e081]" />
                  Demo room online
                </div>
                <h1 className="mt-1 text-2xl font-semibold text-white">{roomTitle}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.07] px-3 py-2">
                <CollaboratorAvatars names={["ZZ", "FC", "LM"]} />
                <span className="pr-1 text-sm text-white/52">
                  {onlineCount} online
                </span>
              </div>
              <div className="rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 text-sm text-white/58">
                {syncStatus}
              </div>
              <GlassButton icon={RadioTower} variant="secondary" className="py-2">
                Live event sync
              </GlassButton>
              <GlassButton icon={Share2} className="py-2" onClick={handleShareRoom}>
                {shareStatus}
              </GlassButton>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <TrackList />
          <div className="space-y-4">
            <ControlPanel
              uploadedFileName={uploadedFileName}
              uploadedAudioUrl={uploadedAudioUrl}
              onAudioUpload={handleUpload}
            />
            <Timeline
              uploadedFileName={uploadedFileName}
              waveformPeaks={waveformPeaks}
              regions={timelineRegions}
              onSelectionAction={handleSelectionAction}
            />
            <EventActivity events={events} />
            <div className="grid gap-3 md:grid-cols-5">
              {roomStats.map((stat) => (
                <GlassCard key={stat.label} subtle className="rounded-3xl p-4">
                  <stat.icon className="h-4 w-4 text-[#58e081]" />
                  <p className="mt-3 text-xs text-white/38">{stat.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
                </GlassCard>
              ))}
            </div>
          </div>
          <ChatPanel notes={notes} onSendNote={handleSendNote} />
        </div>
      </section>
    </main>
  );
}
