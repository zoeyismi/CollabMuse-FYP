"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ArrowLeft, Circle, Redo2, Share2, Undo2 } from "@/components/Icons";
import { ClipLibrary } from "@/components/ClipLibrary";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { ControlPanel, type TransportCommand } from "@/components/ControlPanel";
import { GlassButton } from "@/components/GlassButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MusicAgentPanel } from "@/components/MusicAgentPanel";
import { TrackList } from "@/components/TrackList";
import { WorkstationInspector } from "@/components/WorkstationInspector";
import { WorkstationTimeline } from "@/components/WorkstationTimeline";
import {
  initialRoomEvents,
  initialRoomNotes,
  initialTimelineRegions,
  initialTracks,
} from "@/lib/mock-data";
import type { AudioClip, MusicComposition, RoomEvent, RoomNote, RoomVersion, TimelineRegion, Track } from "@/lib/mock-data";

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
      tracks: Track[];
      composition: MusicComposition | null;
      audioClips: AudioClip[];
      versions: RoomVersion[];
      bpm: number;
      timeSignature: string;
    }) => void;
    "room:event": (event: RoomEvent) => void;
    "room:upload": (payload: {
      fileName: string;
      waveformPeaks?: number[] | null;
      audioAvailable?: boolean;
      event?: RoomEvent;
    }) => void;
    "room:note": (payload: { note: RoomNote; event?: RoomEvent }) => void;
    "room:notes": (payload: { notes: RoomNote[]; event?: RoomEvent }) => void;
    "room:timeline": (payload: { timelineRegions: TimelineRegion[]; event?: RoomEvent }) => void;
    "room:tracks": (payload: { tracks: Track[]; event?: RoomEvent }) => void;
    "room:composition": (payload: { composition: MusicComposition; event?: RoomEvent }) => void;
    "room:clips": (payload: { audioClips: AudioClip[]; event?: RoomEvent }) => void;
    "room:presence": (payload: { roomId: string; count: number }) => void;
    "room:transport": (payload: TransportCommand & { userName: string }) => void;
    "room:settings": (payload: { bpm: number; timeSignature: string; event?: RoomEvent }) => void;
    "room:access-denied": (payload: { roomId: string }) => void;
    "room:deleted": (payload: { roomId: string }) => void;
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
    "room:notes": (payload: { roomId: string; notes: RoomNote[]; event: RoomEvent }) => void;
    "room:timeline": (payload: {
      roomId: string;
      timelineRegions: TimelineRegion[];
      event: RoomEvent;
    }) => void;
    "room:tracks": (payload: { roomId: string; tracks: Track[]; event: RoomEvent }) => void;
    "room:composition": (payload: {
      roomId: string;
      composition: MusicComposition;
      event: RoomEvent;
    }) => void;
    "room:clips": (payload: { roomId: string; audioClips: AudioClip[]; event?: RoomEvent }) => void;
    "room:transport": (payload: { roomId: string; command: TransportCommand; userName: string }) => void;
    "room:settings": (payload: { roomId: string; bpm: number; timeSignature: string; event: RoomEvent }) => void;
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

function createNote(message: string, author: string, position: number): RoomNote {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author,
    message,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    position: Math.max(0, Math.min(100, position)),
  };
}

function clampRegionStart(left: number, width: number) {
  return Math.min(96 - width, Math.max(4, left));
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

async function getAudioDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => resolve(0);
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function analyzeAudioFile(file: File) {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return { duration: await getAudioDuration(file), bpm: 0, loudnessDb: 0, energy: "medium" as const, dynamics: "steady" as const };
  }

  const context = new AudioContextConstructor();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const samples = buffer.getChannelData(0);
    let sumSquares = 0;
    let peak = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const value = Math.abs(samples[index]);
      sumSquares += value * value;
      peak = Math.max(peak, value);
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const loudnessDb = Math.round(20 * Math.log10(Math.max(rms, 0.00001)) * 10) / 10;
    const bucketSeconds = 0.05;
    const bucketSize = Math.max(1, Math.floor(buffer.sampleRate * bucketSeconds));
    const envelope: number[] = [];
    for (let start = 0; start < samples.length; start += bucketSize) {
      let bucketSum = 0;
      const end = Math.min(samples.length, start + bucketSize);
      for (let index = start; index < end; index += 1) bucketSum += Math.abs(samples[index]);
      envelope.push(bucketSum / Math.max(1, end - start));
    }
    let bestBpm = 0;
    let bestScore = -Infinity;
    for (let bpm = 60; bpm <= 180; bpm += 1) {
      const lag = Math.max(1, Math.round((60 / bpm) / bucketSeconds));
      let score = 0;
      for (let index = lag; index < envelope.length; index += 1) score += envelope[index] * envelope[index - lag];
      if (score > bestScore) {
        bestScore = score;
        bestBpm = bpm;
      }
    }
    const energy = rms < 0.045 ? "low" as const : rms > 0.13 ? "high" as const : "medium" as const;
    const dynamics = peak / Math.max(rms, 0.00001) > 4.5 ? "varied" as const : "steady" as const;
    return { duration: buffer.duration, bpm: bestBpm, loudnessDb, energy, dynamics };
  } catch {
    return { duration: await getAudioDuration(file), bpm: 0, loudnessDb: 0, energy: "medium" as const, dynamics: "steady" as const };
  } finally {
    void context.close();
  }
}

const compositionNoteOffsets: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

function compositionNoteFrequency(pitch: string) {
  const match = pitch.match(/^([A-G]#?)(\d)$/);
  if (!match) return 440;
  const midi = (Number(match[2]) + 1) * 12 + compositionNoteOffsets[match[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

function encodeAudioBufferAsWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const dataLength = buffer.length * channels * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wav);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF"); view.setUint32(4, 36 + dataLength, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true); text(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let sample = 0; sample < buffer.length; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[sample]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([wav], { type: "audio/wav" });
}

async function renderCompositionAsWav(composition: MusicComposition) {
  const secondsPerBeat = 60 / Math.max(40, composition.tempo);
  const duration = composition.notes.reduce((sum, note) => sum + note.beats * secondsPerBeat, 0);
  const sampleRate = 44100;
  const context = new OfflineAudioContext(2, Math.ceil((duration + 0.15) * sampleRate), sampleRate);
  let cursor = 0;
  composition.notes.forEach((note) => {
    const noteDuration = Math.max(0.08, note.beats * secondsPerBeat);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(compositionNoteFrequency(note.pitch), cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.025, note.velocity * 0.2), cursor + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + Math.max(0.06, noteDuration * 0.9));
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(cursor); oscillator.stop(cursor + noteDuration);
    cursor += note.beats * secondsPerBeat;
  });
  const buffer = await context.startRendering();
  const samples = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(samples.length / 96));
  const rawPeaks = Array.from({ length: 96 }, (_, bucket) => {
    const start = bucket * bucketSize;
    const end = bucket === 95 ? samples.length : Math.min(samples.length, start + bucketSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += samples[index] * samples[index];
    return Math.sqrt(sum / Math.max(1, end - start));
  });
  const strongest = Math.max(...rawPeaks, 0.001);
  const waveformPeaks = rawPeaks.map((peak) => Math.round(18 + (peak / strongest) * 44));
  return { blob: encodeAudioBufferAsWav(buffer), duration, waveformPeaks };
}

type DemoRoomWorkspaceProps = {
  roomId?: string;
  initialTitle?: string;
};

type RoomMember = {
  userId: string;
  name: string;
  email?: string;
  role: "owner" | "editor" | "viewer";
};

export function DemoRoomWorkspace({ roomId = "demo", initialTitle = "Always session" }: DemoRoomWorkspaceProps) {
  const [roomTitle, setRoomTitle] = useState(initialTitle);
  const [events, setEvents] = useState<RoomEvent[]>(initialRoomEvents);
  const [notes, setNotes] = useState<RoomNote[]>(initialRoomNotes);
  const [uploadedFileName, setUploadedFileName] = useState<string>("always-reference.wav");
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [timelineRegions, setTimelineRegions] = useState<TimelineRegion[]>(initialTimelineRegions);
  const [timelineUndoStack, setTimelineUndoStack] = useState<TimelineRegion[][]>([]);
  const [timelineRedoStack, setTimelineRedoStack] = useState<TimelineRegion[][]>([]);
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [composition, setComposition] = useState<MusicComposition | null>(null);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [versions, setVersions] = useState<RoomVersion[]>([]);
  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [copilotSourceClip, setCopilotSourceClip] = useState<AudioClip | null>(null);
  const [playheadPosition, setPlayheadPosition] = useState(52);
  const [seekRequest, setSeekRequest] = useState<{ id: number; position: number } | null>(null);
  const [transportCommand, setTransportCommand] = useState<TransportCommand | null>(null);
  const [bpm, setBpm] = useState(96);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [snapMode, setSnapMode] = useState<"Bar" | "Beat" | "Off">("Bar");
  const [isClipLibraryOpen, setIsClipLibraryOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Connecting Socket.io");
  const [shareStatus, setShareStatus] = useState("Share room");
  const [onlineCount, setOnlineCount] = useState(1);
  const [currentUserName, setCurrentUserName] = useState("Guest creator");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [currentRole, setCurrentRole] = useState<RoomMember["role"]>(roomId === "demo" ? "owner" : "viewer");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [showMembers, setShowMembers] = useState(false);
  const socketRef = useRef<RoomSocket | null>(null);
  const audioEndpoint = `/api/rooms/${encodeURIComponent(roomId)}/audio`;
  const canEdit = currentRole !== "viewer";

  const rejectViewerEdit = () => {
    if (canEdit) return false;
    setSyncStatus("View-only access: editing is locked");
    return true;
  };

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

  const refreshMembers = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members`);
    if (!response.ok) return;
    const data = await response.json() as { owner?: RoomMember; members?: RoomMember[]; currentRole?: RoomMember["role"] };
    setMembers([...(data.owner?.userId ? [data.owner] : []), ...(data.members ?? [])]);
    setCurrentRole(data.currentRole ?? (roomId === "demo" ? "owner" : "viewer"));
  }, [roomId]);

  useEffect(() => {
    let active = true;

    async function loadRoom() {
      try {
        const inviteToken = new URLSearchParams(window.location.search).get("invite");
        if (inviteToken && roomId !== "demo") {
          const joinResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken }),
          });
          if (!joinResponse.ok) {
            const joinData = await joinResponse.json().catch(() => ({ error: "Could not join room" })) as { error?: string };
            setSyncStatus(joinData.error ?? "Could not join room");
            if (joinResponse.status === 401) {
              const returnTo = `${window.location.pathname}${window.location.search}`;
              window.location.href = `/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
              return;
            }
          } else if (socketRef.current?.connected) {
            socketRef.current.emit("room:join", roomId);
            window.history.replaceState({}, "", window.location.pathname);
          } else {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }
        const roomResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (roomResponse.ok) {
          const roomData = (await roomResponse.json()) as { room?: { title?: string } };
          if (active && roomData.room?.title) setRoomTitle(roomData.room.title);
        } else if (roomResponse.status === 401 || roomResponse.status === 403) {
          setSyncStatus(roomResponse.status === 401 ? "Log in to access this private room" : "This room requires an invitation");
          if (roomResponse.status === 401) {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            window.location.href = `/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
          }
          return;
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
          tracks?: Track[];
          composition?: MusicComposition | null;
          audioClips?: AudioClip[];
          versions?: RoomVersion[];
          bpm?: number;
          timeSignature?: string;
        };
        if (!active) return;

        setEvents(data.events);
        setNotes(data.notes ?? initialRoomNotes);
        setUploadedFileName(data.uploadedFileName);
        setWaveformPeaks(data.waveformPeaks ?? null);
        setUploadedAudioUrl(data.audioAvailable ? audioEndpoint : null);
        setTimelineRegions(data.timelineRegions ?? initialTimelineRegions);
        setTracks(data.tracks ?? initialTracks);
        setComposition(data.composition ?? null);
        setAudioClips(data.audioClips ?? []);
        setVersions(data.versions ?? []);
        setBpm(data.bpm ?? 96);
        setTimeSignature(data.timeSignature ?? "4/4");
        void refreshMembers();
      } catch {
        if (active) setSyncStatus("Backend offline fallback");
      }
    }

    const socket: RoomSocket = io({
      path: "/api/socket",
      transports: ["polling", "websocket"],
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
      setTracks(payload.tracks ?? initialTracks);
      setComposition(payload.composition ?? null);
      setAudioClips(payload.audioClips ?? []);
      setVersions(payload.versions ?? []);
      setBpm(payload.bpm ?? 96);
      setTimeSignature(payload.timeSignature ?? "4/4");
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

    socket.on("room:notes", ({ notes: syncedNotes, event }) => {
      setNotes(syncedNotes);
      if (event) prependEvent(event);
      setSyncStatus("Note status synced from another window");
    });

    socket.on("room:timeline", ({ timelineRegions: syncedTimelineRegions, event }) => {
      setTimelineRegions(syncedTimelineRegions);
      setTimelineUndoStack([]);
      setTimelineRedoStack([]);
      if (event) prependEvent(event);
      setSyncStatus("Timeline edit synced from another window");
    });

    socket.on("room:tracks", ({ tracks: syncedTracks, event }) => {
      setTracks(syncedTracks);
      if (event) prependEvent(event);
      setSyncStatus("Track change synced from another window");
    });

    socket.on("room:composition", ({ composition: syncedComposition, event }) => {
      setComposition(syncedComposition);
      if (event) prependEvent(event);
      setSyncStatus("AI melody synced from another window");
    });

    socket.on("room:clips", ({ audioClips: syncedAudioClips, event }) => {
      setAudioClips(syncedAudioClips);
      if (event) prependEvent(event);
      setSyncStatus("Audio clip library synced from another window");
    });

    socket.on("room:presence", ({ roomId: presenceRoomId, count }) => {
      if (presenceRoomId === roomId) setOnlineCount(Math.max(1, count));
    });

    socket.on("room:transport", ({ userName, ...command }) => {
      setTransportCommand(command);
      setSyncStatus(`${userName} ${command.action === "play" ? "started playback" : command.action === "pause" ? "paused playback" : "moved the playhead"}`);
    });

    socket.on("room:settings", ({ bpm: syncedBpm, timeSignature: syncedTimeSignature, event }) => {
      setBpm(syncedBpm);
      setTimeSignature(syncedTimeSignature);
      if (event) prependEvent(event);
      setSyncStatus(`Session tempo synced at ${syncedBpm} BPM · ${syncedTimeSignature}`);
    });

    socket.on("room:access-denied", ({ roomId: deniedRoomId }) => {
      if (deniedRoomId === roomId) setSyncStatus("Room access denied");
    });

    socket.on("room:deleted", ({ roomId: deletedRoomId }) => {
      if (deletedRoomId !== roomId) return;
      setSyncStatus("This room was deleted by its owner");
      window.setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
    });

    loadRoom();
    return () => {
      active = false;
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [audioEndpoint, initialTitle, prependEvent, prependNote, refreshMembers, roomId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: { name?: string } | null }) => {
        if (data.user?.name) setCurrentUserName(data.user.name);
      })
      .catch(() => undefined);
  }, []);

  const publishTimelineChange = (
    nextTimelineRegions: TimelineRegion[],
    event: RoomEvent,
    recordHistory = true,
  ) => {
    if (rejectViewerEdit()) return;
    if (recordHistory) {
      setTimelineUndoStack((current) => [...current, timelineRegions].slice(-20));
      setTimelineRedoStack([]);
    }
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

  const handleUndoTimeline = () => {
    const previousRegions = timelineUndoStack[timelineUndoStack.length - 1];
    if (!previousRegions) return;
    setTimelineUndoStack((current) => current.slice(0, -1));
    setTimelineRedoStack((current) => [...current, timelineRegions].slice(-20));
    publishTimelineChange(
      previousRegions,
      createEvent("sync", "Timeline edit undone", `${currentUserName} restored the previous timeline layout.`),
      false,
    );
  };

  const handleRedoTimeline = () => {
    const nextRegions = timelineRedoStack[timelineRedoStack.length - 1];
    if (!nextRegions) return;
    setTimelineRedoStack((current) => current.slice(0, -1));
    setTimelineUndoStack((current) => [...current, timelineRegions].slice(-20));
    publishTimelineChange(
      nextRegions,
      createEvent("sync", "Timeline edit redone", `${currentUserName} reapplied a timeline layout.`),
      false,
    );
  };

  const publishTracksChange = (nextTracks: Track[], event: RoomEvent) => {
    if (rejectViewerEdit()) return;
    setTracks(nextTracks);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:tracks", { roomId, tracks: nextTracks, event });
      setSyncStatus("Track change broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}/tracks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: nextTracks, event }),
    });
    setSyncStatus("Track change saved through backend");
  };

  const handleAddTrack = () => {
    if (tracks.length >= 12) return;
    const colors = ["#b71912", "#235fba", "#efd84c", "#58e081"];
    const track: Track = {
      id: `track-${Date.now().toString(36)}`,
      name: `New track ${tracks.length + 1}`,
      color: colors[tracks.length % colors.length],
      muted: false,
      solo: false,
      volume: 0.8,
      clips: 0,
    };
    const event = createEvent("rename", "Track added", `${track.name} was added to ${roomTitle}.`);
    publishTracksChange([...tracks, track], event);
  };

  const handleRenameTrack = (trackId: string, name: string) => {
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack || currentTrack.name === name) return;
    const event = createEvent("rename", "Track renamed", `${currentTrack.name} changed to ${name}.`);
    publishTracksChange(tracks.map((track) => (track.id === trackId ? { ...track, name } : track)), event);
  };

  const handleToggleMute = (trackId: string) => {
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack) return;
    const nextMuted = !currentTrack.muted;
    const event = createEvent(
      "sync",
      nextMuted ? "Track muted" : "Track unmuted",
      `${currentTrack.name} was ${nextMuted ? "muted" : "unmuted"}.`,
    );
    publishTracksChange(
      tracks.map((track) => (track.id === trackId ? { ...track, muted: nextMuted } : track)),
      event,
    );
  };

  const handleToggleSolo = (trackId: string) => {
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack) return;
    const nextSolo = !currentTrack.solo;
    const event = createEvent("sync", nextSolo ? "Track solo enabled" : "Track solo disabled", `${currentTrack.name} solo was turned ${nextSolo ? "on" : "off"}.`);
    publishTracksChange(tracks.map((track) => track.id === trackId ? { ...track, solo: nextSolo } : track), event);
  };

  const handleSetTrackVolume = (trackId: string, volume: number) => {
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack) return;
    const normalizedVolume = Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
    if ((currentTrack.volume ?? 0.8) === normalizedVolume) return;
    const event = createEvent("sync", "Track volume changed", `${currentTrack.name} volume was set to ${Math.round(normalizedVolume * 100)}%.`);
    publishTracksChange(tracks.map((track) => track.id === trackId ? { ...track, volume: normalizedVolume } : track), event);
  };

  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    const deletedLane = tracks.findIndex((track) => track.id === trackId);
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack || deletedLane < 0) return;
    const removedRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) === deletedLane);
    const nextRegions = timelineRegions
      .filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) !== deletedLane)
      .map((region) => ({ ...region, lane: (region.lane ?? 0) > deletedLane ? (region.lane ?? 0) - 1 : region.lane }));
    const event = createEvent("rename", "Track removed", `${currentTrack.name} and ${removedRegions.length} timeline clip${removedRegions.length === 1 ? "" : "s"} were removed. Source audio remains in the clip library.`);
    publishTracksChange(tracks.filter((track) => track.id !== trackId), event);
    if (nextRegions.length !== timelineRegions.length || deletedLane < tracks.length - 1) publishTimelineChange(nextRegions, event);
  };

  const handleCompositionGenerated = (nextComposition: MusicComposition) => {
    if (rejectViewerEdit()) return;
    const event = createEvent(
      "remix",
      "Music Copilot melody created",
      `${nextComposition.title} · ${nextComposition.key} · ${nextComposition.tempo} BPM`,
    );
    setComposition(nextComposition);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:composition", {
        roomId,
        composition: nextComposition,
        event,
      });
      setSyncStatus("AI melody broadcast through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    setSyncStatus("AI melody saved through backend");
  };

  const handleCompositionEdited = (nextComposition: MusicComposition) => {
    if (rejectViewerEdit()) return;
    const event = createEvent(
      "remix",
      "AI melody edited",
      `${currentUserName} updated ${nextComposition.title} in the piano roll.`,
    );
    setComposition(nextComposition);
    prependEvent(event);

    if (socketRef.current?.connected) {
      socketRef.current.emit("room:composition", { roomId, composition: nextComposition, event });
      setSyncStatus("Piano roll edit synced through Socket.io");
      return;
    }

    fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ composition: nextComposition }),
    });
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    setSyncStatus("Piano roll edit saved through backend");
  };

  const handleAddCompositionToRoom = async (nextComposition: MusicComposition) => {
    if (rejectViewerEdit()) return;
    if (tracks.some((track) => track.compositionId === nextComposition.id)) return;
    if (tracks.length >= 12) {
      setSyncStatus("Track limit reached");
      return;
    }

    setSyncStatus("Rendering AI melody to audio");
    const track: Track = {
      id: `ai-track-${Date.now().toString(36)}`,
      name: nextComposition.title,
      color: "#235fba",
      muted: false,
      solo: false,
      volume: 0.8,
      clips: 1,
      source: "ai",
      compositionId: nextComposition.id,
    };
    try {
      const rendered = await renderCompositionAsWav(nextComposition);
      const fileName = `${nextComposition.title.replace(/[^a-zA-Z0-9-_]+/g, "-") || "ai-melody"}.wav`;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/clips?name=${encodeURIComponent(fileName)}&trackId=${encodeURIComponent(track.id)}&duration=${rendered.duration}`, {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          "X-Audio-Bpm": String(nextComposition.tempo),
          "X-Audio-Loudness": "-14",
          "X-Audio-Energy": "medium",
          "X-Audio-Dynamics": "varied",
          "X-Waveform-Peaks": JSON.stringify(rendered.waveformPeaks),
        },
        body: rendered.blob,
      });
      if (!response.ok) throw new Error("AI audio upload failed");
      const data = await response.json() as { clip: AudioClip };
      const width = Math.max(8, Math.min(32, Math.round(Math.max(rendered.duration, 8) / 2)));
      const region: TimelineRegion = {
        id: `region-${data.clip.id}`,
        clipId: data.clip.id,
        lane: tracks.length,
        label: fileName,
        actionLabel: "Move clip",
        left: 4,
        width,
        color: track.color,
        sourceOffset: 0,
        sourceDuration: rendered.duration,
      };
      const event = createEvent(
        "remix",
        "AI melody rendered to audio",
        `${currentUserName} added ${nextComposition.title} as a playable ${nextComposition.notes.length}-note WAV track.`,
      );
      const nextClips = [...audioClips, data.clip].slice(-24);
      publishTracksChange([...tracks, track], event);
      publishTimelineChange([...timelineRegions, region], event);
      broadcastClipLibrary(nextClips, event);
      setSyncStatus("AI melody added as a real audio track");
    } catch {
      setSyncStatus("Could not render the AI melody to audio");
    }
  };

  const handleGeneratedMusicReady = (clip: AudioClip) => {
    const nextClips = [...audioClips.filter((item) => item.id !== clip.id), clip].slice(-24);
    const event = createEvent(
      "remix",
      "AI music generated",
      `${currentUserName} generated ${clip.duration} seconds of real audio with ${clip.generation?.provider === "elevenlabs" ? "ElevenLabs Music" : "CollabMuse Composer"}.`,
    );
    broadcastClipLibrary(nextClips, event);
    setSyncStatus("AI-generated audio is ready to preview");
  };

  const handleAddGeneratedMusicToRoom = (clip: AudioClip) => {
    if (rejectViewerEdit()) return;
    if (tracks.some((track) => track.id === clip.trackId)) return;
    if (tracks.length >= 12) {
      setSyncStatus("Track limit reached");
      return;
    }

    const track: Track = {
      id: clip.trackId,
      name: clip.name.replace(/\.(mp3|wav)$/i, "").replace(/-/g, " "),
      color: "#235fba",
      muted: false,
      solo: false,
      volume: 0.8,
      clips: 1,
      source: "ai",
    };
    const region: TimelineRegion = {
      id: `region-${clip.id}`,
      clipId: clip.id,
      lane: tracks.length,
      label: clip.name,
      actionLabel: "Move clip",
      left: 4,
      width: Math.max(10, Math.min(46, Math.round(clip.duration / 2))),
      color: track.color,
      sourceOffset: 0,
      sourceDuration: clip.duration,
    };
    const event = createEvent(
      "remix",
      "AI music added to workstation",
      `${currentUserName} added ${clip.name} as a playable audio track.`,
    );
    publishTracksChange([...tracks, track], event);
    publishTimelineChange([...timelineRegions, region], event);
    setSyncStatus("AI-generated music added as a real audio track");
  };

  const handleUpload = async (file: File) => {
    if (rejectViewerEdit()) return;
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

  const broadcastClipLibrary = (nextClips: AudioClip[], event: RoomEvent) => {
    setAudioClips(nextClips);
    prependEvent(event);
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:clips", { roomId, audioClips: nextClips, event });
    }
  };

  const handleClipUpload = async (file: File, trackId: string) => {
    if (rejectViewerEdit()) return;
    if (isUploadingClip) return;
    setIsUploadingClip(true);
    setSyncStatus(`Uploading ${file.name}`);
    try {
      const [analysis, clipWaveformPeaks] = await Promise.all([analyzeAudioFile(file), extractWaveformPeaks(file)]);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/clips?name=${encodeURIComponent(file.name)}&trackId=${encodeURIComponent(trackId)}&duration=${analysis.duration}`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Audio-Bpm": String(analysis.bpm),
            "X-Audio-Loudness": String(analysis.loudnessDb),
            "X-Audio-Energy": analysis.energy,
            "X-Audio-Dynamics": analysis.dynamics,
            "X-Waveform-Peaks": JSON.stringify(clipWaveformPeaks ?? []),
          },
          body: file,
        },
      );
      if (!response.ok) throw new Error("Clip upload failed");
      const data = (await response.json()) as { clip: AudioClip };
      const nextClips = [...audioClips, data.clip].slice(-24);
      const event = createEvent("upload", "Track clip uploaded", `${currentUserName} added ${file.name} to the room clip library.`);
      const nextTracks = tracks.map((track) => track.id === trackId ? { ...track, clips: track.clips + 1, source: "audio" as const } : track);
      const lane = Math.max(0, tracks.findIndex((track) => track.id === trackId));
      const laneRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, 3)) === lane);
      const lastEnd = laneRegions.reduce((end, region) => Math.max(end, region.left + region.width), 2);
      const width = Math.max(8, Math.min(28, Math.round(Math.max(analysis.duration, 8) / 2)));
      const left = lastEnd + width <= 98 ? Math.min(90, lastEnd + 2) : 4;
      const timelineRegion: TimelineRegion = {
        id: `region-${data.clip.id}`,
        clipId: data.clip.id,
        lane,
        label: file.name,
        actionLabel: "Move clip",
        left,
        width,
        color: tracks[lane]?.color ?? "#235fba",
        sourceOffset: 0,
        sourceDuration: analysis.duration,
      };
      publishTracksChange(nextTracks, event);
      publishTimelineChange([...timelineRegions, timelineRegion], event);
      broadcastClipLibrary(nextClips, event);
      setSyncStatus("Audio clip uploaded and synced");
    } catch {
      setSyncStatus("Could not upload audio clip");
    } finally {
      setIsUploadingClip(false);
    }
  };

  const handleClipDelete = async (clip: AudioClip) => {
    if (rejectViewerEdit()) return;
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Clip deletion failed");
      const data = (await response.json()) as { audioClips: AudioClip[] };
      const event = createEvent("upload", "Track clip removed", `${currentUserName} removed ${clip.name}.`);
      const nextTracks = tracks.map((track) => track.id === clip.trackId ? { ...track, clips: Math.max(0, track.clips - 1) } : track);
      const nextTimelineRegions = timelineRegions.filter((region) => region.clipId !== clip.id);
      publishTracksChange(nextTracks, event);
      if (nextTimelineRegions.length !== timelineRegions.length) publishTimelineChange(nextTimelineRegions, event);
      broadcastClipLibrary(data.audioClips, event);
      setSyncStatus("Audio clip removed and synced");
    } catch {
      setSyncStatus("Could not remove audio clip");
    }
  };

  const handleAddClipToTimeline = (clip: AudioClip) => {
    const lane = Math.max(0, tracks.findIndex((track) => track.id === clip.trackId));
    const laneRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) === lane);
    const width = Math.max(8, Math.min(28, Math.round(Math.max(clip.duration, 8) / 2)));
    const occupiedEnd = laneRegions.reduce((end, region) => Math.max(end, region.left + region.width), 2);
    const left = occupiedEnd + width <= 98 ? occupiedEnd + 2 : 4;
    const region: TimelineRegion = {
      id: `region-${clip.id}-${Date.now().toString(36)}`,
      clipId: clip.id,
      lane,
      label: clip.name,
      actionLabel: "Move clip",
      left,
      width,
      color: tracks[lane]?.color ?? "#235fba",
      sourceOffset: 0,
      sourceDuration: clip.duration,
    };
    const event = createEvent("sync", "Clip added to timeline", `${currentUserName} placed ${clip.name} on ${tracks[lane]?.name ?? "a track"}.`);
    publishTimelineChange([...timelineRegions, region], event);
    setSyncStatus(`${clip.name} added to timeline`);
  };

  const handleSendNote = (message: string, position: number) => {
    if (rejectViewerEdit()) return;
    const note = createNote(message, currentUserName, position);
    const event = createEvent("note", "Timestamped note added", `${currentUserName} added a note at ${Math.round(position)}% of the waveform.`);

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

  const handleResolveNote = async (note: RoomNote, resolved: boolean) => {
    if (rejectViewerEdit()) return;
    const event = createEvent(
      "note",
      resolved ? "Note resolved" : "Note reopened",
      `${currentUserName} ${resolved ? "resolved" : "reopened"} “${note.message.slice(0, 70)}”.`,
    );
    setSyncStatus(resolved ? "Resolving note" : "Reopening note");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/notes/${encodeURIComponent(note.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved, resolvedBy: currentUserName, event }),
      });
      if (!response.ok) throw new Error("Note update failed");
      const data = await response.json() as { notes: RoomNote[] };
      setNotes(data.notes);
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:notes", { roomId, notes: data.notes, event });
      setSyncStatus(resolved ? "Note resolved" : "Note reopened");
    } catch {
      setSyncStatus("Could not update note");
    }
  };

  const handleDeleteNote = async (note: RoomNote) => {
    if (rejectViewerEdit()) return;
    const event = createEvent("note", "Note deleted", `${currentUserName} removed “${note.message.slice(0, 70)}”.`);
    setSyncStatus("Deleting note");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/notes/${encodeURIComponent(note.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (!response.ok) throw new Error("Note deletion failed");
      const data = await response.json() as { notes: RoomNote[] };
      setNotes(data.notes);
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:notes", { roomId, notes: data.notes, event });
      setSyncStatus("Note deleted");
    } catch {
      setSyncStatus("Could not delete note");
    }
  };

  const handleCreateVersion = async (name: string) => {
    if (rejectViewerEdit()) return;
    const event = createEvent("sync", "Project version saved", `${currentUserName} saved “${name}”.`);
    setSyncStatus("Saving project version");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, event }),
      });
      if (!response.ok) throw new Error("Version save failed");
      const data = (await response.json()) as { versions: RoomVersion[] };
      setVersions(data.versions);
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:event", { roomId, event });
      setSyncStatus("Project version saved");
    } catch {
      setSyncStatus("Could not save project version");
    }
  };

  const handleRestoreVersion = async (version: RoomVersion) => {
    if (rejectViewerEdit()) return;
    const event = createEvent("sync", "Project version restored", `${currentUserName} restored “${version.name}”.`);
    setSyncStatus(`Restoring ${version.name}`);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/versions/${encodeURIComponent(version.id)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (!response.ok) throw new Error("Version restore failed");
      const data = (await response.json()) as {
        tracks: Track[];
        timelineRegions: TimelineRegion[];
        composition: MusicComposition | null;
        audioClips: AudioClip[];
        versions: RoomVersion[];
        bpm: number;
        timeSignature: string;
      };
      setTracks(data.tracks);
      setTimelineRegions(data.timelineRegions);
      setComposition(data.composition);
      setAudioClips(data.audioClips);
      setVersions(data.versions);
      setBpm(data.bpm ?? 96);
      setTimeSignature(data.timeSignature ?? "4/4");
      setTimelineUndoStack([]);
      setTimelineRedoStack([]);
      prependEvent(event);
      if (socketRef.current?.connected) {
        socketRef.current.emit("room:tracks", { roomId, tracks: data.tracks, event });
        socketRef.current.emit("room:timeline", { roomId, timelineRegions: data.timelineRegions, event });
        socketRef.current.emit("room:settings", { roomId, bpm: data.bpm ?? 96, timeSignature: data.timeSignature ?? "4/4", event });
      }
      setSyncStatus(`${version.name} restored`);
    } catch {
      setSyncStatus("Could not restore project version");
    }
  };

  const handleSelectionAction = (label: string, regionId?: string) => {
    const selectedIndex = timelineRegions.findIndex((region) => region.id === regionId);
    if (selectedIndex < 0) return;
    const selected = timelineRegions[selectedIndex];
    const lane = selected.lane ?? Math.min(selectedIndex, Math.max(0, tracks.length - 1));
    let nextRegions = timelineRegions;
    let event: RoomEvent;

    if (label === "Split" && selected.width >= 10) {
      const firstWidth = Math.round((selected.width / 2) * 10) / 10;
      const secondWidth = Math.round((selected.width - firstWidth) * 10) / 10;
      const sourceClip = audioClips.find((clip) => clip.id === selected.clipId);
      const sourceDuration = selected.sourceDuration ?? sourceClip?.duration;
      const firstSourceDuration = sourceDuration ? sourceDuration * (firstWidth / selected.width) : undefined;
      const first = { ...selected, lane, width: firstWidth, label: `${selected.label} A`, sourceDuration: firstSourceDuration };
      const second: TimelineRegion = {
        ...selected,
        id: `${selected.id}-split-${Date.now().toString(36)}`,
        lane,
        left: Math.round((selected.left + firstWidth) * 10) / 10,
        width: secondWidth,
        label: `${selected.label} B`,
        sourceOffset: sourceDuration ? (selected.sourceOffset ?? 0) + firstSourceDuration! : selected.sourceOffset,
        sourceDuration: sourceDuration ? sourceDuration - firstSourceDuration! : undefined,
      };
      nextRegions = [...timelineRegions.slice(0, selectedIndex), first, second, ...timelineRegions.slice(selectedIndex + 1)];
      event = createEvent("remix", "Clip split", `${currentUserName} split ${selected.label} into two timeline clips.`);
    } else if (label === "Duplicate") {
      const duplicate: TimelineRegion = {
        ...selected,
        id: `${selected.id}-copy-${Date.now().toString(36)}`,
        lane,
        left: clampRegionStart(selected.left + Math.max(3, selected.width + 1), selected.width),
        label: `${selected.label} copy`,
      };
      nextRegions = [...timelineRegions, duplicate];
      event = createEvent("sync", "Clip duplicated", `${currentUserName} duplicated ${selected.label}.`);
    } else if (label === "Delete") {
      nextRegions = timelineRegions.filter((region) => region.id !== selected.id);
      event = createEvent("sync", "Clip deleted", `${currentUserName} removed ${selected.label} from the timeline.`);
    } else {
      return;
    }

    publishTimelineChange(nextRegions, event);
  };

  const handleRegionsChange = (
    nextRegions: TimelineRegion[],
    changedRegion: TimelineRegion,
    mode: "move" | "resize-start" | "resize-end",
  ) => {
    const previousRegion = timelineRegions.find((region) => region.id === changedRegion.id);
    const sourceClip = audioClips.find((clip) => clip.id === changedRegion.clipId);
    const previousSourceDuration = previousRegion?.sourceDuration ?? sourceClip?.duration;
    const sourceChange = previousRegion && previousSourceDuration && mode !== "move"
      ? previousSourceDuration * (Math.abs(changedRegion.width - previousRegion.width) / Math.max(previousRegion.width, 0.1))
      : 0;
    const normalizedRegions = nextRegions.map((region) => {
      if (region.id !== changedRegion.id || !previousRegion || !previousSourceDuration || mode === "move") {
        return { ...region, left: Math.round(region.left * 10) / 10, width: Math.round(region.width * 10) / 10 };
      }
      const growing = region.width > previousRegion.width;
      const nextSourceOffset = mode === "resize-start"
        ? Math.max(0, (previousRegion.sourceOffset ?? 0) + (growing ? -sourceChange : sourceChange))
        : previousRegion.sourceOffset;
      const unclampedDuration = Math.max(0.05, growing ? previousSourceDuration + sourceChange : previousSourceDuration - sourceChange);
      const nextSourceDuration = sourceClip
        ? Math.min(unclampedDuration, Math.max(0.05, sourceClip.duration - (nextSourceOffset ?? 0)))
        : unclampedDuration;
      return {
        ...region,
        left: Math.round(region.left * 10) / 10,
        width: Math.round(region.width * 10) / 10,
        sourceOffset: nextSourceOffset,
        sourceDuration: nextSourceDuration,
      };
    });
    const action = mode === "move" ? "moved" : "resized";
    const previousLane = previousRegion?.lane ?? 0;
    const nextLane = changedRegion.lane ?? previousLane;
    const laneDetail = mode === "move" && previousLane !== nextLane
      ? ` from ${tracks[previousLane]?.name ?? `track ${previousLane + 1}`} to ${tracks[nextLane]?.name ?? `track ${nextLane + 1}`}`
      : "";
    const event = createEvent(
      mode === "move" ? "move" : "extend",
      `Timeline region ${action}`,
      `${changedRegion.label} was ${action}${laneDetail} directly on the timeline.`,
    );
    publishTimelineChange(normalizedRegions, event);
  };

  const handleShareRoom = async (role: "editor" | "viewer" = inviteRole) => {
    try {
      let shareUrl = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
      if (roomId !== "demo") {
        setShareStatus("Creating invite");
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const data = await response.json() as { token?: string; error?: string };
        if (!response.ok || !data.token) throw new Error(data.error ?? "Could not create invite");
        shareUrl += `?invite=${encodeURIComponent(data.token)}`;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus(roomId === "demo" ? "Link copied" : `${role === "viewer" ? "Viewer" : "Editor"} invite copied`);
      window.setTimeout(() => setShareStatus("Share room"), 1800);
    } catch (error) {
      setShareStatus(error instanceof Error && error.message.includes("owner") ? "Owner only" : "Invite unavailable");
      window.setTimeout(() => setShareStatus("Share room"), 2200);
    }
  };

  const handleTransportAction = (action: Omit<TransportCommand, "id">) => {
    if (!canEdit || !socketRef.current?.connected) return;
    socketRef.current.emit("room:transport", {
      roomId,
      command: { ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      userName: currentUserName,
    });
  };

  const handleSessionSettingsChange = ({ bpm: nextBpm, timeSignature: nextTimeSignature }: { bpm: number; timeSignature: string }) => {
    if (rejectViewerEdit()) return;
    setBpm(nextBpm);
    setTimeSignature(nextTimeSignature);
    const event = createEvent("sync", "Session timing changed", `${currentUserName} set the room to ${nextBpm} BPM · ${nextTimeSignature}.`);
    prependEvent(event);
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:settings", { roomId, bpm: nextBpm, timeSignature: nextTimeSignature, event });
      setSyncStatus("Session timing broadcast through Socket.io");
      return;
    }
    fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bpm: nextBpm, timeSignature: nextTimeSignature }),
    });
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
  };

  const handleMemberRole = async (member: RoomMember, role: "editor" | "viewer") => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member.userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (response.ok) {
      setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, role } : item));
      setSyncStatus(`${member.name} is now ${role}`);
    } else {
      setSyncStatus("Only the room owner can change member roles");
    }
  };

  const handleRemoveMember = async (member: RoomMember) => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member.userId)}`, { method: "DELETE" });
    if (response.ok) {
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
      setSyncStatus(`${member.name} was removed from the room`);
    } else {
      setSyncStatus("Only the room owner can remove members");
    }
  };

  const copilotPanel = (
    <MusicAgentPanel
      roomId={roomId}
      onGeneratedAudioReady={handleGeneratedMusicReady}
      onAddGeneratedAudioToRoom={handleAddGeneratedMusicToRoom}
      sourceClip={copilotSourceClip}
      readOnly={!canEdit}
      compact
    />
  );

  return (
    <main className="min-h-screen bg-[#f7f7f5] p-2 text-white lg:h-screen lg:overflow-hidden">
      <section className="relative mx-auto flex min-h-[calc(100vh-16px)] max-w-[1920px] flex-col overflow-hidden rounded-[18px] bg-[#f1f0eb] shadow-2xl md:h-[calc(100vh-16px)]">
        <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 bg-[#174a78] px-4 py-2">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-[8px] text-white/60 transition hover:bg-white/8 hover:text-white" title="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="h-7 w-px bg-white/12" />
            <div><h1 className="text-[17px] font-semibold text-white">{roomTitle}</h1><p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/42"><Circle className="h-2 w-2 fill-[#2f69c8] text-[#2f69c8]" />Room online</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="flex items-center gap-2 rounded-[8px] px-2 py-1 transition hover:bg-white/8" onClick={() => setShowMembers((value) => !value)} title="Room members" aria-label="Room members"><CollaboratorAvatars names={members.length ? members.slice(0, 3).map((member) => member.name.slice(0, 2).toUpperCase()) : ["ZZ", "FC", "LM"]} /><span className="hidden text-xs text-white/42 lg:inline">{onlineCount} online · {currentRole}</span></button>
            <span className="hidden max-w-[220px] truncate text-[11px] text-white/45 xl:inline" title={syncStatus}>{syncStatus}</span>
            <div className="flex items-center border-x border-white/10 px-2">
              <button className="workstation-dark-tool" onClick={handleUndoTimeline} disabled={!canEdit || !timelineUndoStack.length} title="Undo"><Undo2 className="h-4 w-4" /></button>
              <button className="workstation-dark-tool" onClick={handleRedoTimeline} disabled={!canEdit || !timelineRedoStack.length} title="Redo"><Redo2 className="h-4 w-4" /></button>
            </div>
            <LanguageSwitcher compact />
            <GlassButton icon={Share2} className="rounded-[9px] border-white/10 bg-white/8 px-4 py-2 text-xs" onClick={() => void handleShareRoom(inviteRole)}>{shareStatus}</GlassButton>
          </div>
        </header>

        {showMembers ? <div className="absolute right-4 top-16 z-50 w-80 rounded-[12px] border border-[#18202a]/12 bg-[#f7f5f0] p-3 text-[#172033] shadow-2xl">
          <div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.2em] text-[#172033]/42">Room access</p><h2 className="mt-1 text-sm font-semibold">Members</h2></div><span className="rounded-full bg-[#184eb6]/10 px-2 py-1 text-[10px] font-semibold text-[#184eb6]">{currentRole}</span></div>
          {currentRole === "owner" && roomId !== "demo" ? <div className="mt-3 flex gap-2 rounded-[8px] bg-[#18202a]/[0.045] p-2"><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")} className="min-w-0 flex-1 rounded-[7px] border border-[#18202a]/10 bg-white px-2 py-1.5 text-xs"><option value="editor">Can edit</option><option value="viewer">View only</option></select><button type="button" onClick={() => void handleShareRoom(inviteRole)} className="rounded-[7px] bg-[#184eb6] px-3 py-1.5 text-xs font-semibold text-white">Copy invite</button></div> : null}
          <div className="mt-3 space-y-1.5">{members.length ? members.map((member) => <div key={member.userId} className="flex items-center gap-2 rounded-[8px] bg-[#18202a]/[0.045] px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#184eb6] text-[10px] font-bold text-white">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{member.name}</p><p className="truncate text-[10px] text-[#172033]/42">{member.email ?? member.role}</p></div>{member.role === "owner" || currentRole !== "owner" ? <span className="text-[10px] capitalize text-[#172033]/48">{member.role}</span> : <><select value={member.role} onChange={(event) => void handleMemberRole(member, event.target.value as "editor" | "viewer")} className="rounded-[6px] border border-[#18202a]/10 bg-white px-1.5 py-1 text-[10px]"><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button type="button" onClick={() => void handleRemoveMember(member)} className="text-[10px] text-[#a33a36]">Remove</button></>}</div>) : <p className="rounded-[8px] border border-dashed border-[#18202a]/12 p-3 text-xs text-[#172033]/46">No invited members yet. Use Share room to invite an editor.</p>}</div>
        </div> : null}

        {!canEdit ? <div className="shrink-0 bg-[#dfe8f4] px-4 py-1.5 text-center text-[11px] font-medium text-[#174a78]">View-only access: playback, navigation and export are available. Editing is locked.</div> : null}
        <ControlPanel readOnly={!canEdit} uploadedFileName={uploadedFileName} uploadedAudioUrl={uploadedAudioUrl} onAudioUpload={handleUpload} onRecordedClip={handleClipUpload} roomId={roomId} tracks={tracks} regions={timelineRegions} audioClips={audioClips} onPlayheadChange={setPlayheadPosition} snapMode={snapMode} onSnapModeChange={setSnapMode} seekRequest={seekRequest} transportCommand={transportCommand} onTransportAction={handleTransportAction} bpm={bpm} timeSignature={timeSignature} onSessionSettingsChange={handleSessionSettingsChange} />

        <div className="grid min-h-0 flex-1 md:grid-cols-[170px_minmax(0,1fr)_230px] xl:grid-cols-[210px_minmax(0,1fr)_300px]">
          <TrackList readOnly={!canEdit} tracks={tracks} onAddTrack={handleAddTrack} onRenameTrack={handleRenameTrack} onToggleMute={handleToggleMute} onToggleSolo={handleToggleSolo} onSetVolume={handleSetTrackVolume} onDeleteTrack={handleDeleteTrack} />
          <WorkstationTimeline readOnly={!canEdit} tracks={tracks} regions={timelineRegions} notes={notes} uploadedFileName={uploadedFileName} waveformPeaks={waveformPeaks} audioClips={audioClips} playheadPosition={playheadPosition} onSelectionAction={handleSelectionAction} onRegionsChange={handleRegionsChange} snapMode={snapMode} onPlayheadSeek={(position) => { setPlayheadPosition(position); setSeekRequest((current) => ({ id: (current?.id ?? 0) + 1, position })); }} />
          <WorkstationInspector readOnly={!canEdit} notes={notes} events={events} copilot={copilotPanel} onSendNote={handleSendNote} onResolveNote={handleResolveNote} onDeleteNote={handleDeleteNote} onSelectNote={(position) => { setPlayheadPosition(position); setSeekRequest((current) => ({ id: (current?.id ?? 0) + 1, position })); setSyncStatus(`Jumped to note at ${Math.round(position)}%`); }} versions={versions} onCreateVersion={handleCreateVersion} onRestoreVersion={handleRestoreVersion} />
        </div>

        <div className="shrink-0 border-t border-[#18202a]/12 bg-[#f6f4ef] text-[#172033]">
          <button type="button" className="flex h-12 w-full items-center justify-between px-5 text-sm" onClick={()=>setIsClipLibraryOpen((value)=>!value)}><span className="font-semibold">{isClipLibraryOpen ? "Hide clips" : "Clips"} <span className="ml-1 font-normal text-[#172033]/42">{audioClips.length}</span></span><span className="text-xs text-[#172033]/42">Upload stems and send clips to Copilot</span></button>
          {isClipLibraryOpen ? <div className="max-h-[300px] overflow-y-auto border-t border-[#18202a]/10 p-3"><ClipLibrary readOnly={!canEdit} roomId={roomId} clips={audioClips} tracks={tracks} isUploading={isUploadingClip} onUpload={handleClipUpload} onDelete={handleClipDelete} onAddToTimeline={handleAddClipToTimeline} onUseForAI={(clip)=>{setCopilotSourceClip(clip);setSyncStatus(`${clip.name} selected as Music Copilot context`);}} /></div> : null}
        </div>
      </section>
    </main>
  );
}
