"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ArrowLeft, AudioWaveform, Circle, Download, Redo2, Share2, Undo2, UsersRound } from "@/components/Icons";
import { ClipLibrary } from "@/components/ClipLibrary";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { ControlPanel, type TransportCommand } from "@/components/ControlPanel";
import { GlassButton } from "@/components/GlassButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MusicAgentPanel } from "@/components/MusicAgentPanel";
import { TrackList } from "@/components/TrackList";
import { WorkstationInspector } from "@/components/WorkstationInspector";
import { WorkstationTimeline } from "@/components/WorkstationTimeline";
import { availableRegionDuration, canEditRegionTiming } from "@/lib/clip-source";
import { isLoopbackHostname } from "@/lib/local-share";
import { requestVersionChange } from "@/lib/version-request";
import { audioFileSizeError } from "@/lib/audio-limits.mjs";
import { getAudioDuration } from "@/lib/audio-metadata";
import { waveformPeaksFromSamples } from "@/lib/waveform-peaks";
import { findFreeTimelineStart } from "@/lib/timeline-placement";
import { useLanguage } from "@/lib/i18n";
import { hasPendingVersionChanges } from "@/lib/version-readiness";
import { isCurrentUpload } from "@/lib/upload-result";
import { shouldApplyRestore } from "@/lib/restore-order";
import { hasPlayableAudio } from "@/lib/playable-audio";
import { roomConnectionLabel, roomConnectionMessage, type RoomConnectionState } from "@/lib/room-connection-status";
import {
  initialRoomEvents,
  initialRoomNotes,
  initialTimelineRegions,
  initialTracks,
} from "@/lib/mock-data";
import type { AudioClip, MusicComposition, RoomEvent, RoomNote, RoomNoteReply, RoomVersion, TimelineRegion, Track } from "@/lib/mock-data";
import { hasPendingEdit, settlePendingEdit } from "@/lib/pending-room-edits.mjs";

type ClipDeletion = { clipId: string; clipTrackId?: string; arrangementEpoch: number; recoveryVersion: RoomVersion; affectedNotePositions: Array<{ id: string; position: number }>; event: RoomEvent };

type RoomSocket = Socket<
  {
    "room:snapshot": (payload: {
      arrangementEpoch: number;
      roomId: string;
      title: string;
      events: RoomEvent[];
      notes: RoomNote[];
      uploadedFileName: string;
      waveformPeaks: number[] | null;
      audioAvailable: boolean;
      referenceMuted: boolean;
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
      arrangementEpoch: number;
      fileName: string;
      waveformPeaks?: number[] | null;
      audioAvailable?: boolean;
      versions?: RoomVersion[];
      event?: RoomEvent;
    }) => void;
    "room:note": (payload: { note: RoomNote; event?: RoomEvent }) => void;
    "room:note-reply": (payload: { noteId: string; reply: RoomNoteReply }) => void;
    "room:note-state": (payload: { noteId: string; state: { resolved?: boolean; resolvedBy?: string; resolvedAt?: string } | null; event?: RoomEvent }) => void;
    "room:notes": (payload: { notes: RoomNote[]; event?: RoomEvent }) => void;
    "room:timeline": (payload: { arrangementEpoch: number; timelineRegions: TimelineRegion[]; notes?: RoomNote[]; event?: RoomEvent }) => void;
    "room:tracks": (payload: { arrangementEpoch: number; tracks: Track[]; event?: RoomEvent }) => void;
    "room:reference-mute": (payload: { muted: boolean; arrangementEpoch: number }) => void;
    "room:restored": (payload: { reason?: "track-deleted"; arrangementEpoch: number; tracks: Track[]; timelineRegions: TimelineRegion[]; notes?: RoomNote[]; composition: MusicComposition | null; audioClips: AudioClip[]; uploadedFileName: string; audioAvailable: boolean; referenceMuted: boolean; waveformPeaks: number[] | null; versions: RoomVersion[]; bpm: number; timeSignature: string; event?: RoomEvent }) => void;
    "room:composition": (payload: { arrangementEpoch: number; composition: MusicComposition; event?: RoomEvent }) => void;
    "room:clips": (payload: { arrangementEpoch?: number; audioClips: AudioClip[]; event?: RoomEvent }) => void;
    "room:clip-deleted": (payload: ClipDeletion) => void;
    "room:presence": (payload: { roomId: string; count: number }) => void;
    "room:transport": (payload: TransportCommand & { userName: string }) => void;
    "room:settings": (payload: { arrangementEpoch: number; bpm: number; timeSignature: string; event?: RoomEvent }) => void;
    "room:access-denied": (payload: { roomId: string }) => void;
    "room:access-changed": (payload: { roomId: string; role: "editor" | "viewer" }) => void;
    "room:sync-error": (payload: { message: string }) => void;
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
    "room:note": (payload: { roomId: string; note: RoomNote; event: RoomEvent }, acknowledge: (result: { ok: boolean; error?: string; note?: RoomNote }) => void) => void;
    "room:note-reply": (payload: { roomId: string; noteId: string; reply: RoomNoteReply }, acknowledge: (result: { ok: boolean; error?: string }) => void) => void;
    "room:note-state": (payload: { roomId: string; noteId: string; event: RoomEvent }) => void;
    "room:notes": (payload: { roomId: string; notes: RoomNote[]; event: RoomEvent }) => void;
    "room:timeline": (payload: {
      roomId: string;
      arrangementEpoch: number;
      timelineRegions: TimelineRegion[];
      previousRegions?: TimelineRegion[];
      split?: { originalId: string; newId: string };
      merge?: { originalId: string; newId: string };
      event: RoomEvent;
    }) => void;
    "room:tracks": (payload: { roomId: string; arrangementEpoch: number; tracks: Track[]; previousTracks?: Track[]; event: RoomEvent }) => void;
    "room:reference-mute": (payload: { roomId: string; arrangementEpoch: number; muted: boolean }) => void;
    "room:composition": (payload: {
      roomId: string;
      arrangementEpoch: number;
      composition: MusicComposition;
      event: RoomEvent;
    }) => void;
    "room:clips": (payload: { roomId: string; audioClips: AudioClip[]; event?: RoomEvent }) => void;
    "room:transport": (payload: { roomId: string; command: TransportCommand; userName: string }) => void;
    "room:settings": (payload: { roomId: string; arrangementEpoch: number; bpm: number; timeSignature: string; event: RoomEvent }) => void;
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

function createLocalId(prefix: string) {
  const unique = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

async function extractWaveformPeaks(file: File): Promise<number[] | null> {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    return waveformPeaksFromSamples(audioBuffer.getChannelData(0));
  } catch {
    return null;
  } finally {
    void audioContext.close();
  }
}

async function analyzeAudioFile(file: File) {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return { duration: await getAudioDuration(file), bpm: 0, loudnessDb: 0, energy: "medium" as const, dynamics: "steady" as const, waveformPeaks: null };
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
    for (let bpm = 60; rms >= 0.003 && buffer.duration >= 3 && bpm <= 180; bpm += 1) {
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
    return { duration: buffer.duration, bpm: bestBpm, loudnessDb, energy, dynamics, waveformPeaks: waveformPeaksFromSamples(samples) };
  } catch {
    return { duration: await getAudioDuration(file), bpm: 0, loudnessDb: 0, energy: "medium" as const, dynamics: "steady" as const, waveformPeaks: null };
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

type TimelineHistoryEntry = { regions: TimelineRegion[]; split?: { originalId: string; newId: string } };

export function DemoRoomWorkspace({ roomId = "demo", initialTitle = "Always session" }: DemoRoomWorkspaceProps) {
  const { t, language } = useLanguage();
  const arrangementEpochRef = useRef(0);
  const [roomTitle, setRoomTitle] = useState(initialTitle);
  const [events, setEvents] = useState<RoomEvent[]>(roomId === "demo" ? initialRoomEvents : []);
  const [notes, setNotes] = useState<RoomNote[]>(roomId === "demo" ? initialRoomNotes : []);
  const [uploadedFileName, setUploadedFileName] = useState<string>(roomId === "demo" ? "always-reference.wav" : "");
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [referenceMuted, setReferenceMuted] = useState(false);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [timelineRegions, setTimelineRegions] = useState<TimelineRegion[]>(roomId === "demo" ? initialTimelineRegions : []);
  const [timelineUndoStack, setTimelineUndoStack] = useState<TimelineHistoryEntry[]>([]);
  const [timelineRedoStack, setTimelineRedoStack] = useState<TimelineHistoryEntry[]>([]);
  const [tracks, setTracks] = useState<Track[]>(roomId === "demo" ? initialTracks : []);
  const [composition, setComposition] = useState<MusicComposition | null>(null);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [versions, setVersions] = useState<RoomVersion[]>([]);
  const [versionOperationPending, setVersionOperationPending] = useState(false);
  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [copilotSourceClip, setCopilotSourceClip] = useState<AudioClip | null>(null);
  const [openCopilotRequest, setOpenCopilotRequest] = useState(0);
  const [playheadPosition, setPlayheadPosition] = useState(52);
  const [seekRequest, setSeekRequest] = useState<{ id: number; position: number } | null>(null);
  const [transportCommand, setTransportCommand] = useState<TransportCommand | null>(null);
  const [bpm, setBpm] = useState(96);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [snapMode, setSnapMode] = useState<"Bar" | "Beat" | "Off">("Bar");
  const [isClipLibraryOpen, setIsClipLibraryOpen] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState(roomId !== "demo");
  const [roomError, setRoomError] = useState("");
  const [legacyOpenRoom, setLegacyOpenRoom] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasUnsavedNoteDraft, setHasUnsavedNoteDraft] = useState(false);
  const [hasRecordingAtRisk, setHasRecordingAtRisk] = useState(false);
  const [editSaveState, setEditSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [connectionState, setConnectionState] = useState<RoomConnectionState>("connecting");
  const [syncStatus, setSyncStatus] = useState("Connecting Socket.io");
  const [shareStatus, setShareStatus] = useState("Share room");
  const [onlineCount, setOnlineCount] = useState(1);
  const [currentUserName, setCurrentUserName] = useState("Guest creator");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [currentRole, setCurrentRole] = useState<RoomMember["role"]>(roomId === "demo" ? "owner" : "viewer");
  const [isAccessLoading, setIsAccessLoading] = useState(roomId !== "demo");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [showMembers, setShowMembers] = useState(false);
  const socketRef = useRef<RoomSocket | null>(null);
  const pendingTimelineEventsRef = useRef(new Set<string>());
  const pendingEditsRef = useRef(new Set<string>());
  const processedClipDeletionsRef = useRef(new Set<string>());
  const pendingNoteRef = useRef<{ key: string; note: RoomNote; event: RoomEvent } | null>(null);
  const pendingReplyRef = useRef<{ key: string; reply: RoomNoteReply } | null>(null);
  const replyInFlightRef = useRef(false);
  const noteInFlightRef = useRef(false);
  const referenceUploadInFlightRef = useRef(false);
  const referenceRefreshRef = useRef(0);
  const clipUploadInFlightRef = useRef(false);
  const versionOperationInFlightRef = useRef(false);
  const audioEndpoint = `/api/rooms/${encodeURIComponent(roomId)}/audio`;
  const canEdit = !isAccessLoading && currentRole !== "viewer" && connectionState === "online";

  useEffect(() => {
    if (!versionOperationPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [versionOperationPending]);

  const rejectViewerEdit = () => {
    if (canEdit) return false;
    setSyncStatus(connectionState !== "online" ? roomConnectionMessage(connectionState, language) : "View-only access: editing is locked");
    return true;
  };

  const persistRoomChanges = async (...operations: Array<{ url: string; init: RequestInit }>) => {
    try {
      const responses = await Promise.all(operations.map(({ url, init }) => fetch(url, init)));
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({})) as { error?: string };
        socketRef.current?.emit("room:join", roomId);
        throw new Error(data.error || "Room update failed. Reload the room and try again.");
      }
      setSyncStatus("Changes saved to this room");
    } catch (error) {
      setSyncStatus("Save failed. Your latest changes may not be available to collaborators.");
      setSaveError(error instanceof Error ? error.message : "Some changes could not be saved. Check your connection and try again.");
    }
  };

  const prependEvent = useCallback((event: RoomEvent) => {
    setEvents((current) =>
      current.some((item) => item.id === event.id)
        ? current
        : [event, ...current].slice(0, 8),
    );
  }, []);

  const applyClipDeletion = useCallback((data: ClipDeletion) => {
    if (data.arrangementEpoch !== arrangementEpochRef.current || processedClipDeletionsRef.current.has(data.event.id)) return;
    processedClipDeletionsRef.current.add(data.event.id);
    setAudioClips((current) => current.filter((clip) => clip.id !== data.clipId));
    setTimelineRegions((current) => current.filter((region) => region.clipId !== data.clipId));
    setTracks((current) => current.map((track) => track.id === data.clipTrackId ? { ...track, clips: Math.max(0, track.clips - 1) } : track));
    setVersions((current) => current.some((version) => version.id === data.recoveryVersion.id) ? current : [data.recoveryVersion, ...current]);
    setNotes((current) => current.map((note) => {
      const affected = data.affectedNotePositions.find((item) => item.id === note.id);
      return affected ? { ...note, position: affected.position } : note;
    }));
    setTimelineUndoStack([]);
    setTimelineRedoStack([]);
    setSelectedRegionId(null);
    prependEvent(data.event);
    setSyncStatus("Audio clip removed; a recovery version was saved");
  }, [prependEvent]);

  const prependNote = useCallback((note: RoomNote) => {
    setNotes((current) =>
      current.some((item) => item.id === note.id)
        ? current
        : [note, ...current],
    );
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members`);
      if (!response.ok) return;
      const data = await response.json() as { owner?: RoomMember; members?: RoomMember[]; currentRole?: RoomMember["role"] };
      setMembers([...(data.owner?.userId ? [data.owner] : []), ...(data.members ?? [])]);
      setCurrentRole(data.currentRole ?? (roomId === "demo" ? "owner" : "viewer"));
    } finally {
      setIsAccessLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    let active = true;
    let snapshotReceived = false;

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
        await refreshMembers();
        const roomResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (roomResponse.ok) {
          const roomData = (await roomResponse.json()) as { room?: { title?: string; ownerId?: string | null } };
          if (active && roomData.room?.title) setRoomTitle(roomData.room.title);
          if (active) setLegacyOpenRoom(roomId !== "demo" && !roomData.room?.ownerId);
        } else if (roomResponse.status === 404) {
          if (active) { setRoomError("This room could not be found. Check the link or return to your workspace."); setIsRoomLoading(false); }
          return;
        } else if (roomResponse.status === 401 || roomResponse.status === 403) {
          setSyncStatus(roomResponse.status === 401 ? "Log in to access this private room" : "This room requires an invitation");
          if (roomResponse.status === 401) {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            window.location.href = `/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
          }
          return;
        }

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`);
        if (!response.ok) {
          if (active) setIsRoomLoading(false);
          return;
        }

        const data = (await response.json()) as {
          events: RoomEvent[];
          notes?: RoomNote[];
          uploadedFileName: string;
          waveformPeaks?: number[] | null;
          audioAvailable?: boolean;
          referenceMuted?: boolean;
          timelineRegions?: TimelineRegion[];
          tracks?: Track[];
          composition?: MusicComposition | null;
          audioClips?: AudioClip[];
          versions?: RoomVersion[];
          bpm?: number;
          timeSignature?: string;
        };
        if (!active) return;
        if (snapshotReceived) { setIsRoomLoading(false); return; }

        setEvents(data.events);
        setNotes(data.notes ?? (roomId === "demo" ? initialRoomNotes : []));
        setUploadedFileName(data.uploadedFileName);
        setWaveformPeaks(data.waveformPeaks ?? null);
        setUploadedAudioUrl(data.audioAvailable ? audioEndpoint : null);
        setReferenceMuted(Boolean(data.referenceMuted));
        setTimelineRegions(data.timelineRegions ?? (roomId === "demo" ? initialTimelineRegions : []));
        setTracks(data.tracks ?? (roomId === "demo" ? initialTracks : []));
        setComposition(data.composition ?? null);
        setAudioClips(data.audioClips ?? []);
        setVersions(data.versions ?? []);
        setBpm(data.bpm ?? 96);
        setTimeSignature(data.timeSignature ?? "4/4");
        setIsRoomLoading(false);
      } catch {
        if (active) {
          setIsAccessLoading(false);
          setIsRoomLoading(false);
          setSyncStatus("Backend offline fallback");
        }
      }
    }

    const socket: RoomSocket = io({
      path: "/api/socket",
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connecting");
      setSyncStatus("Socket.io connected");
      socket.emit("room:join", roomId);
    });

    socket.on("disconnect", () => {
      if (pendingEditsRef.current.size) {
        setEditSaveState("error");
        setSaveError("Connection lost while saving room changes. Check the room after reconnecting and reapply any missing edits.");
        pendingEditsRef.current.clear();
      }
      pendingTimelineEventsRef.current.clear();
      setConnectionState("offline");
      setSyncStatus("Socket.io reconnecting");
    });

    socket.on("room:snapshot", (payload) => {
      if (payload.roomId !== roomId) return;
      const snapshotEpoch = payload.arrangementEpoch ?? 0;
      if (snapshotReceived && snapshotEpoch < arrangementEpochRef.current) return;
      const epochChanged = snapshotEpoch !== arrangementEpochRef.current;
      if (epochChanged && pendingEditsRef.current.size) {
        pendingEditsRef.current.clear();
        pendingTimelineEventsRef.current.clear();
        setEditSaveState("error");
        setSaveError("The room changed while edits were still saving. Check the restored room and reapply any missing edits.");
      }
      arrangementEpochRef.current = snapshotEpoch;
      snapshotReceived = true;
      setConnectionState("online");
      setRoomTitle(payload.title || initialTitle);
      setEvents(payload.events);
      setNotes(payload.notes ?? (roomId === "demo" ? initialRoomNotes : []));
      setUploadedFileName(payload.uploadedFileName);
      setWaveformPeaks(payload.waveformPeaks ?? null);
      setUploadedAudioUrl(payload.audioAvailable ? `${audioEndpoint}?snapshot=${++referenceRefreshRef.current}` : null);
      setReferenceMuted(Boolean(payload.referenceMuted));
      if (!hasPendingEdit(pendingEditsRef.current, "timeline")) setTimelineRegions(payload.timelineRegions ?? (roomId === "demo" ? initialTimelineRegions : []));
      if (!hasPendingEdit(pendingEditsRef.current, "track")) setTracks(payload.tracks ?? (roomId === "demo" ? initialTracks : []));
      if (!hasPendingEdit(pendingEditsRef.current, "composition")) setComposition(payload.composition ?? null);
      setAudioClips(payload.audioClips ?? []);
      setVersions(payload.versions ?? []);
      if (!hasPendingEdit(pendingEditsRef.current, "settings")) {
        setBpm(payload.bpm ?? 96);
        setTimeSignature(payload.timeSignature ?? "4/4");
      }
      setSyncStatus(pendingEditsRef.current.size ? "Saving room changes" : "Room state loaded");
    });

    socket.on("room:event", (event) => {
      prependEvent(event);
      setSyncStatus("Synced from another window");
    });

    socket.on("room:upload", ({ arrangementEpoch, fileName, waveformPeaks: syncedWaveformPeaks, audioAvailable, versions: syncedVersions, event }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      setUploadedFileName(fileName);
      setWaveformPeaks(syncedWaveformPeaks ?? null);
      if (audioAvailable) setUploadedAudioUrl(`${audioEndpoint}?v=${event?.id ?? Date.now()}`);
      else setUploadedAudioUrl(null);
      if (syncedVersions) setVersions(syncedVersions);
      if (event) prependEvent(event);
      setSyncStatus("Upload synced from another window");
    });

    socket.on("room:note", ({ note, event }) => {
      prependNote(note);
      if (event) prependEvent(event);
      setSyncStatus("Room note synced from another window");
    });

    socket.on("room:note-reply", ({ noteId, reply }) => {
      setNotes((current) => current.map((note) => note.id === noteId && !(note.replies ?? []).some((item) => item.id === reply.id)
        ? { ...note, replies: [...(note.replies ?? []), reply] }
        : note));
      setSyncStatus("Reply saved and synced");
    });

    socket.on("room:note-state", ({ noteId, state, event }) => {
      setNotes((current) => state === null ? current.filter((note) => note.id !== noteId) : current.map((note) => note.id === noteId ? { ...note, ...state } : note));
      if (event) prependEvent(event);
      setSyncStatus("Note updated and synced");
    });

    socket.on("room:notes", ({ notes: syncedNotes, event }) => {
      setNotes(syncedNotes);
      if (event) prependEvent(event);
      setSyncStatus("Note status synced from another window");
    });

    socket.on("room:timeline", ({ arrangementEpoch, timelineRegions: syncedTimelineRegions, notes: syncedNotes, event }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      const isOwnEdit = Boolean(event && pendingTimelineEventsRef.current.delete(event.id));
      const { stillSaving: timelineStillSaving } = settlePendingEdit(pendingEditsRef.current, "timeline", event?.id);
      if (!timelineStillSaving) setTimelineRegions(syncedTimelineRegions);
      if (syncedNotes) setNotes((current) => current.map((note) => {
        const updated = syncedNotes.find((item) => item.id === note.id);
        return updated ? { ...note, regionId: updated.regionId, regionOffset: updated.regionOffset, position: updated.position } : note;
      }));
      if (!isOwnEdit) {
        setTimelineUndoStack([]);
        setTimelineRedoStack([]);
      }
      if (event) prependEvent(event);
      if (isOwnEdit) setEditSaveState(pendingEditsRef.current.size ? "saving" : "saved");
      setSyncStatus(timelineStillSaving ? "Saving timeline edit" : "Timeline changes saved and synced");
    });

    socket.on("room:tracks", ({ arrangementEpoch, tracks: syncedTracks, event }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      const { own: isOwnEdit, stillSaving: tracksStillSaving } = settlePendingEdit(pendingEditsRef.current, "track", event?.id);
      if (!tracksStillSaving) setTracks(syncedTracks);
      if (event) prependEvent(event);
      if (isOwnEdit) setEditSaveState(pendingEditsRef.current.size ? "saving" : "saved");
      setSyncStatus(tracksStillSaving ? "Saving track edit" : "Track changes saved and synced");
    });

    socket.on("room:reference-mute", ({ muted, arrangementEpoch }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      setReferenceMuted(muted);
      setSyncStatus("Reference audio setting saved and synced");
    });

    socket.on("room:restored", (data) => {
      if (!shouldApplyRestore(arrangementEpochRef.current, data.arrangementEpoch, snapshotReceived)) return;
      arrangementEpochRef.current = data.arrangementEpoch ?? 0;
      snapshotReceived = true;
      if (pendingEditsRef.current.size) {
        pendingEditsRef.current.clear();
        pendingTimelineEventsRef.current.clear();
        setEditSaveState("error");
        setSaveError(data.reason === "track-deleted" ? "A track was removed while edits were still saving. Check the room and reapply any missing edits." : "A version was restored while edits were still saving. Check the restored room and reapply any missing edits.");
      }
      setTracks(data.tracks);
      setTimelineRegions(data.timelineRegions);
      if (data.notes) setNotes((current) => current.map((note) => {
        const saved = data.notes?.find((item) => item.id === note.id);
        return saved ? { ...note, position: saved.position } : note;
      }));
      setComposition(data.composition);
      setAudioClips(data.audioClips);
      setUploadedFileName(data.uploadedFileName);
      setWaveformPeaks(data.waveformPeaks);
      setUploadedAudioUrl(data.audioAvailable ? `${audioEndpoint}?v=${Date.now()}` : null);
      setReferenceMuted(Boolean(data.referenceMuted));
      setVersions(data.versions);
      setBpm(data.bpm);
      setTimeSignature(data.timeSignature);
      setTimelineUndoStack([]);
      setTimelineRedoStack([]);
      if (data.event) prependEvent(data.event);
      setSyncStatus(data.reason === "track-deleted" ? "Track removed; a recovery version was saved" : "Project version restored and synced");
    });

    socket.on("room:composition", ({ arrangementEpoch, composition: syncedComposition, event }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      const { own, stillSaving } = settlePendingEdit(pendingEditsRef.current, "composition", event?.id);
      if (!stillSaving) setComposition(syncedComposition);
      if (event) prependEvent(event);
      if (own) setEditSaveState(pendingEditsRef.current.size ? "saving" : "saved");
      setSyncStatus(stillSaving ? "Saving melody edit" : "Melody changes saved and synced");
    });

    socket.on("room:clips", ({ arrangementEpoch, audioClips: syncedAudioClips, event }) => {
      if (arrangementEpoch !== undefined && arrangementEpoch !== arrangementEpochRef.current) return;
      setAudioClips(syncedAudioClips);
      if (event) prependEvent(event);
      setSyncStatus("Audio clip library synced from another window");
    });

    socket.on("room:clip-deleted", applyClipDeletion);

    socket.on("room:presence", ({ roomId: presenceRoomId, count }) => {
      if (presenceRoomId === roomId) setOnlineCount(Math.max(1, count));
    });

    socket.on("room:transport", ({ userName, ...command }) => {
      setTransportCommand(command);
      setSyncStatus(`${userName} ${command.action === "play" ? "started playback" : command.action === "pause" ? "paused playback" : "moved the playhead"}`);
    });

    socket.on("room:settings", ({ arrangementEpoch, bpm: syncedBpm, timeSignature: syncedTimeSignature, event }) => {
      if (arrangementEpoch !== arrangementEpochRef.current) return;
      const { own, stillSaving } = settlePendingEdit(pendingEditsRef.current, "settings", event?.id);
      if (!stillSaving) { setBpm(syncedBpm); setTimeSignature(syncedTimeSignature); }
      if (event) prependEvent(event);
      if (own) setEditSaveState(pendingEditsRef.current.size ? "saving" : "saved");
      setSyncStatus(stillSaving ? "Saving session timing" : `Session tempo synced at ${syncedBpm} BPM · ${syncedTimeSignature}`);
    });

    socket.on("room:access-denied", ({ roomId: deniedRoomId }) => {
      if (deniedRoomId === roomId) { setConnectionState("denied"); setSyncStatus("Room access denied"); }
    });

    socket.on("room:access-changed", ({ roomId: changedRoomId, role }) => {
      if (changedRoomId !== roomId) return;
      setCurrentRole(role);
      setSyncStatus(role === "viewer" ? "Your access is now view-only" : "You can now edit this room");
    });

    socket.on("room:sync-error", ({ message }) => {
      if (pendingEditsRef.current.size) { pendingEditsRef.current.clear(); setEditSaveState("error"); }
      pendingTimelineEventsRef.current.clear();
      setSyncStatus(message);
      setSaveError(message);
      socket.emit("room:join", roomId);
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
  }, [applyClipDeletion, audioEndpoint, initialTitle, prependEvent, prependNote, refreshMembers, roomId]);

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
    split?: { originalId: string; newId: string },
    merge?: { originalId: string; newId: string },
  ) => {
    if (rejectViewerEdit()) return;
    if (recordHistory) {
      setTimelineUndoStack((current) => [...current, { regions: timelineRegions, split }].slice(-20));
      setTimelineRedoStack([]);
    }
    setTimelineRegions(nextTimelineRegions);
    prependEvent(event);

    if (socketRef.current?.connected) {
      pendingTimelineEventsRef.current.add(event.id);
      pendingEditsRef.current.add(`timeline:${event.id}`);
      setEditSaveState("saving");
      socketRef.current.emit("room:timeline", {
        roomId,
        arrangementEpoch: arrangementEpochRef.current,
        timelineRegions: nextTimelineRegions,
        previousRegions: timelineRegions,
        split,
        merge,
        event,
      });
      setSyncStatus("Saving timeline edit");
      return;
    }

    void persistRoomChanges({
      url: `/api/rooms/${encodeURIComponent(roomId)}/timeline`,
      init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timelineRegions: nextTimelineRegions, previousRegions: timelineRegions, split, merge, arrangementEpoch: arrangementEpochRef.current, event }) },
    });
  };

  const handleUndoTimeline = () => {
    const previous = timelineUndoStack[timelineUndoStack.length - 1];
    if (!previous) return;
    setTimelineUndoStack((current) => current.slice(0, -1));
    setTimelineRedoStack((current) => [...current, { regions: timelineRegions, split: previous.split }].slice(-20));
    publishTimelineChange(
      previous.regions,
      createEvent("sync", "Timeline edit undone", `${currentUserName} restored the previous timeline layout.`),
      false,
      undefined,
      previous.split,
    );
  };

  const handleRedoTimeline = () => {
    const next = timelineRedoStack[timelineRedoStack.length - 1];
    if (!next) return;
    setTimelineRedoStack((current) => current.slice(0, -1));
    setTimelineUndoStack((current) => [...current, { regions: timelineRegions, split: next.split }].slice(-20));
    publishTimelineChange(
      next.regions,
      createEvent("sync", "Timeline edit redone", `${currentUserName} reapplied a timeline layout.`),
      false,
      next.split,
    );
  };

  const publishTracksChange = (nextTracks: Track[], event: RoomEvent) => {
    if (rejectViewerEdit()) return;
    setTracks(nextTracks);
    prependEvent(event);

    if (socketRef.current?.connected) {
      pendingEditsRef.current.add(`track:${event.id}`);
      setEditSaveState("saving");
      socketRef.current.emit("room:tracks", { roomId, arrangementEpoch: arrangementEpochRef.current, tracks: nextTracks, previousTracks: tracks, event });
      setSyncStatus("Saving track edit");
      return;
    }

    void persistRoomChanges({
      url: `/api/rooms/${encodeURIComponent(roomId)}/tracks`,
      init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks: nextTracks, previousTracks: tracks, arrangementEpoch: arrangementEpochRef.current, event }) },
    });
  };

  const handleAddTrack = () => {
    if (tracks.length >= 12) return;
    const colors = ["#b71912", "#235fba", "#efd84c", "#58e081"];
    const track: Track = {
      id: createLocalId("track"),
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

  const handleReferenceMute = (muted: boolean) => {
    if (rejectViewerEdit() || !socketRef.current?.connected) return;
    socketRef.current.emit("room:reference-mute", { roomId, arrangementEpoch: arrangementEpochRef.current, muted });
    setSyncStatus("Saving reference audio setting");
  };

  const handleSetTrackVolume = (trackId: string, volume: number) => {
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack) return;
    const normalizedVolume = Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
    if ((currentTrack.volume ?? 0.8) === normalizedVolume) return;
    const event = createEvent("sync", "Track volume changed", `${currentTrack.name} volume was set to ${Math.round(normalizedVolume * 100)}%.`);
    publishTracksChange(tracks.map((track) => track.id === trackId ? { ...track, volume: normalizedVolume } : track), event);
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (rejectViewerEdit()) return;
    if (tracks.length <= 1) return;
    const deletedLane = tracks.findIndex((track) => track.id === trackId);
    const currentTrack = tracks.find((track) => track.id === trackId);
    if (!currentTrack || deletedLane < 0) return;
    const removedRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) === deletedLane);
    if (pendingEditsRef.current.size) { setSaveError("Wait for current edits to finish saving before deleting a track."); return; }
    if (!window.confirm(`Remove "${currentTrack.name}" and its ${removedRegions.length} timeline ${removedRegions.length === 1 ? "clip" : "clips"}? Source audio stays in the library and a recovery version will be saved.`)) return;
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/tracks/${encodeURIComponent(trackId)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrangementEpoch: arrangementEpochRef.current, previousTracks: tracks, previousRegions: timelineRegions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove the track.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not remove the track.");
      socketRef.current?.emit("room:join", roomId);
    }
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
      pendingEditsRef.current.add(`composition:${event.id}`);
      setEditSaveState("saving");
      socketRef.current.emit("room:composition", {
        roomId,
        arrangementEpoch: arrangementEpochRef.current,
        composition: nextComposition,
        event,
      });
      setSyncStatus("Saving melody");
      return;
    }

    void persistRoomChanges(
      { url: `/api/rooms/${encodeURIComponent(roomId)}`, init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ composition: nextComposition, arrangementEpoch: arrangementEpochRef.current }) } },
      { url: `/api/rooms/${encodeURIComponent(roomId)}/events`, init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) } },
    );
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
      pendingEditsRef.current.add(`composition:${event.id}`);
      setEditSaveState("saving");
      socketRef.current.emit("room:composition", { roomId, arrangementEpoch: arrangementEpochRef.current, composition: nextComposition, event });
      setSyncStatus("Saving melody edit");
      return;
    }

    void persistRoomChanges(
      { url: `/api/rooms/${encodeURIComponent(roomId)}`, init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ composition: nextComposition, arrangementEpoch: arrangementEpochRef.current }) } },
      { url: `/api/rooms/${encodeURIComponent(roomId)}/events`, init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) } },
    );
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
      id: createLocalId("ai-track"),
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
      const nextClips = [...audioClips, data.clip];
      publishTracksChange([...tracks, track], event);
      publishTimelineChange([...timelineRegions, region], event);
      broadcastClipLibrary(nextClips, event);
      setSyncStatus("AI melody added as a real audio track");
    } catch {
      setSyncStatus("Could not render the AI melody to audio");
    }
  };

  const handleGeneratedMusicReady = (clip: AudioClip) => {
    const nextClips = [...audioClips.filter((item) => item.id !== clip.id), clip];
    const event = createEvent(
      "remix",
      clip.generation?.provider === "elevenlabs" ? "AI music generated" : "Arrangement generated",
      `${currentUserName} generated ${clip.duration} seconds of real audio with ${clip.generation?.provider === "elevenlabs" ? "ElevenLabs Music" : "CollabMuse Composer"}.`,
    );
    broadcastClipLibrary(nextClips, event);
    setSyncStatus(clip.generation?.provider === "elevenlabs" ? "AI-generated audio is ready to preview" : "Rule-based arrangement is ready to preview");
  };

  const handleAddGeneratedMusicToRoom = async (clip: AudioClip) => {
    if (rejectViewerEdit()) return false;
    if (tracks.some((track) => track.id === clip.trackId)) return false;
    if (tracks.length >= 12) {
      setSyncStatus("Track limit reached");
      return false;
    }

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/tracks/from-clip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: clip.id, arrangementEpoch: arrangementEpochRef.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add generated audio.");
      setSyncStatus(clip.generation?.provider === "elevenlabs" ? "AI-generated music added as an audio track" : "Rule-based arrangement added as an audio track");
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not add generated audio.");
      socketRef.current?.emit("room:join", roomId);
      return false;
    }
  };

  const handleUpload = async (file: File) => {
    if (rejectViewerEdit() || referenceUploadInFlightRef.current) return;
    const sizeError = audioFileSizeError(file.size);
    if (sizeError) { setSyncStatus("Audio upload rejected"); setSaveError(sizeError); return; }
    referenceUploadInFlightRef.current = true;
    const uploadEpoch = arrangementEpochRef.current;
    try {
      setSyncStatus("Analyzing uploaded waveform");
      const extractedWaveformPeaks = await extractWaveformPeaks(file);
      if (!extractedWaveformPeaks && !(await getAudioDuration(file))) {
        throw new Error("This audio file could not be read. The previous reference audio was kept.");
      }
      const event = createEvent("upload", "Audio uploaded", `Added ${file.name}`);
      if (!isCurrentUpload(uploadEpoch, arrangementEpochRef.current)) throw new Error("The room changed while preparing the upload. Check the restored room and try again.");
      const uploadResponse = await fetch(`${audioEndpoint}?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Waveform-Peaks": JSON.stringify(extractedWaveformPeaks ?? []), "X-Arrangement-Epoch": String(uploadEpoch) },
        body: file,
      });
      if (!uploadResponse.ok) {
        const data = await uploadResponse.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Audio upload failed");
      }
      if (!isCurrentUpload(uploadEpoch, arrangementEpochRef.current)) throw new Error("The room changed while uploading. Check the restored room before trying again.");
      prependEvent(event);
      if (socketRef.current?.connected) {
        socketRef.current.emit("room:event", { roomId, event });
        setSyncStatus("Audio uploaded and saved");
      } else {
        setSyncStatus("Audio uploaded. Reconnecting to refresh the room.");
      }
    } catch (error) {
      setSyncStatus("Audio upload failed");
      setSaveError(error instanceof Error ? error.message : "Audio upload failed. The previous audio was kept; check your connection and try again.");
    } finally {
      referenceUploadInFlightRef.current = false;
    }
  };

  const broadcastClipLibrary = (nextClips: AudioClip[], event: RoomEvent) => {
    setAudioClips(nextClips);
    prependEvent(event);
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:clips", { roomId, audioClips: nextClips, event });
    }
  };

  const handleClipUpload = async (file: File, trackId: string) => {
    if (rejectViewerEdit()) return false;
    const sizeError = audioFileSizeError(file.size);
    if (sizeError) { setSyncStatus("Audio upload rejected"); setSaveError(sizeError); return false; }
    if (clipUploadInFlightRef.current) {
      setSaveError("Another audio upload is already in progress. Please wait and try again.");
      return false;
    }
    if (!tracks.some((track) => track.id === trackId)) {
      setSaveError("The target track no longer exists. Download the recording to keep it.");
      return false;
    }
    clipUploadInFlightRef.current = true;
    const uploadEpoch = arrangementEpochRef.current;
    setIsUploadingClip(true);
    setSyncStatus(`Uploading ${file.name}`);
    try {
      const analysis = await analyzeAudioFile(file);
      const clipWaveformPeaks = analysis.waveformPeaks;
      if (!Number.isFinite(analysis.duration) || analysis.duration <= 0) throw new Error("The audio duration could not be read. Choose a playable audio file and try again.");
      if (!isCurrentUpload(uploadEpoch, arrangementEpochRef.current)) throw new Error("The room changed while preparing the upload. Check the restored room and try again.");
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
            "X-Arrangement-Epoch": String(uploadEpoch),
          },
          body: file,
        },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || "Clip upload failed");
      }
      const data = (await response.json()) as { clip: AudioClip };
      if (!isCurrentUpload(uploadEpoch, arrangementEpochRef.current)) throw new Error("The room changed while uploading. Check the restored room before trying again.");
      const nextClips = [...audioClips, data.clip];
      const event = createEvent("upload", "Track clip uploaded", `${currentUserName} added ${file.name} to the room clip library.`);
      const nextTracks = tracks.map((track) => track.id === trackId ? { ...track, clips: track.clips + 1, source: "audio" as const } : track);
      const lane = Math.max(0, tracks.findIndex((track) => track.id === trackId));
      const laneRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, 3)) === lane);
      const width = Math.max(1, Math.min(100, (analysis.duration / 120) * 100));
      const left = findFreeTimelineStart(laneRegions, width);
      const timelineRegion: TimelineRegion | null = left === null ? null : {
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
      if (timelineRegion) publishTimelineChange([...timelineRegions, timelineRegion], event);
      broadcastClipLibrary(nextClips, event);
      setSyncStatus(timelineRegion ? "Audio clip uploaded and synced" : "Audio saved to the clip library. No space on this track; choose another track or move clips first.");
      if (!timelineRegion) setSaveError("The audio was saved in the clip library, but this track has no space. Select another track or move clips before adding it to the timeline.");
      return true;
    } catch (error) {
      setSyncStatus("Could not upload audio clip");
      setSaveError(error instanceof Error ? error.message : "Audio clip upload failed. Check your connection and try again.");
      return false;
    } finally {
      clipUploadInFlightRef.current = false;
      setIsUploadingClip(false);
    }
  };

  const handleClipDelete = async (clip: AudioClip) => {
    if (rejectViewerEdit()) return;
    const regionCount = timelineRegions.filter((region) => region.clipId === clip.id).length;
    if (!window.confirm(`Remove "${clip.name}" and its ${regionCount} timeline ${regionCount === 1 ? "clip" : "clips"}? A recovery version will be saved.`)) return;
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}`,
        { method: "DELETE", headers: { "X-Arrangement-Epoch": String(arrangementEpochRef.current) } },
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) socketRef.current?.emit("room:join", roomId);
        throw new Error(data.error || "Clip deletion failed");
      }
      applyClipDeletion(data as ClipDeletion);
    } catch (error) {
      setSyncStatus("Could not remove audio clip");
      setSaveError(error instanceof Error ? error.message : "Could not remove audio clip.");
    }
  };

  const handleAddClipToTimeline = (clip: AudioClip, targetTrackId: string) => {
    if (rejectViewerEdit()) return;
    const lane = tracks.findIndex((track) => track.id === targetTrackId);
    if (lane < 0) {
      setSyncStatus("Choose an available track before adding this clip");
      return;
    }
    const laneRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) === lane);
    const width = Math.max(1, Math.min(100, (clip.duration / 120) * 100));
    const left = findFreeTimelineStart(laneRegions, width);
    if (left === null) {
      setSyncStatus("No space on this track. Move clips or choose another track.");
      return;
    }
    const region: TimelineRegion = {
      id: createLocalId(`region-${clip.id}`),
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

  const handleSendNote = async (message: string, position: number, regionId?: string): Promise<boolean> => {
    if (rejectViewerEdit() || !socketRef.current?.connected || noteInFlightRef.current) return false;
    const key = JSON.stringify([message, position, regionId ?? null]);
    const existing = pendingNoteRef.current?.key === key ? pendingNoteRef.current : null;
    const note = existing?.note ?? createNote(message, currentUserName, position);
    const region = regionId ? timelineRegions.find((item) => item.id === regionId && item.clipId) : undefined;
    if (!existing && region && region.width > 0) {
      note.regionId = region.id;
      note.regionOffset = Math.max(0, Math.min(1, (position - region.left) / region.width));
      note.position = region.left + region.width * note.regionOffset;
    }
    const event = existing?.event ?? createEvent("note", "Timestamped note added", `${currentUserName} added a note at ${Math.round(position)}% of the waveform.`);
    pendingNoteRef.current = { key, note, event };
    const socket = socketRef.current;
    setSyncStatus("Saving note...");
    noteInFlightRef.current = true;
    return new Promise((resolve) => {
      socket.timeout(10000).emit("room:note", { roomId, note, event }, (error, result) => {
        noteInFlightRef.current = false;
        if (error || !result?.ok) {
          setSaveError(result?.error ?? "The note could not be confirmed. Your text is kept; check the connection and retry.");
          setSyncStatus("Note could not be confirmed");
          if (socket.connected) socket.emit("room:join", roomId);
          resolve(false);
          return;
        }
        pendingNoteRef.current = null;
        prependNote(result.note ?? note);
        prependEvent(event);
        setSyncStatus("Note saved and synced");
        resolve(true);
      });
    });
  };

  const handleReplyToNote = async (noteId: string, message: string): Promise<boolean> => {
    if (rejectViewerEdit() || !socketRef.current?.connected || replyInFlightRef.current) return false;
    const key = JSON.stringify([noteId, message]);
    const reply: RoomNoteReply = pendingReplyRef.current?.key === key ? pendingReplyRef.current.reply : { id: createLocalId("reply"), author: currentUserName, message, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    pendingReplyRef.current = { key, reply };
    replyInFlightRef.current = true;
    const socket = socketRef.current;
    setSyncStatus("Saving reply...");
    return new Promise((resolve) => {
      socket.timeout(10000).emit("room:note-reply", { roomId, noteId, reply }, (error, result) => {
        replyInFlightRef.current = false;
        if (error || !result?.ok) {
          setSaveError(result?.error ?? "The reply could not be confirmed. Your text is kept; check the connection and retry.");
          setSyncStatus("Reply could not be confirmed");
          if (socket.connected) socket.emit("room:join", roomId);
          resolve(false);
        } else {
          pendingReplyRef.current = null;
          setSyncStatus("Reply saved and synced");
          resolve(true);
        }
      });
    });
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
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Note update could not be confirmed.");
      }
      const data = await response.json() as { notes: RoomNote[] };
      const updated = data.notes.find((item) => item.id === note.id);
      if (updated) setNotes((current) => current.map((item) => item.id === note.id ? { ...item, resolved: updated.resolved, resolvedBy: updated.resolvedBy, resolvedAt: updated.resolvedAt } : item));
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:note-state", { roomId, noteId: note.id, event });
      setSyncStatus(resolved ? "Note resolved" : "Note reopened");
    } catch (error) {
      setSyncStatus("Note update could not be confirmed");
      setSaveError(error instanceof Error ? error.message : "The note update could not be confirmed. Check the connection and try again.");
      if (socketRef.current?.connected) socketRef.current.emit("room:join", roomId);
    }
  };

  const handleDeleteNote = async (note: RoomNote) => {
    if (rejectViewerEdit()) return;
    const replyCount = note.replies?.length ?? 0;
    if (!window.confirm(`Delete this note${replyCount ? ` and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : ""}? This cannot be undone unless you have a saved version.`)) return;
    const event = createEvent("note", "Note deleted", `${currentUserName} removed “${note.message.slice(0, 70)}”.`);
    setSyncStatus("Deleting note");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/notes/${encodeURIComponent(note.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Note deletion could not be confirmed.");
      }
      setNotes((current) => current.filter((item) => item.id !== note.id));
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:note-state", { roomId, noteId: note.id, event });
      setSyncStatus("Note deleted");
    } catch (error) {
      setSyncStatus("Note deletion could not be confirmed");
      setSaveError(error instanceof Error ? error.message : "The note deletion could not be confirmed. Check the connection and try again.");
      if (socketRef.current?.connected) socketRef.current.emit("room:join", roomId);
    }
  };

  const handleCreateVersion = async (name: string) => {
    if (rejectViewerEdit()) return false;
    if (versionOperationInFlightRef.current) {
      setSaveError(language === "zh" ? "版本操作正在进行，请等待完成。" : "A version operation is already in progress. Please wait.");
      return false;
    }
    if (hasPendingVersionChanges(pendingEditsRef.current.size, noteInFlightRef.current || replyInFlightRef.current, clipUploadInFlightRef.current || referenceUploadInFlightRef.current)) {
      setSaveError("Wait for your current edits, note or audio upload to finish saving before creating a version.");
      return false;
    }
    const event = createEvent("sync", "Project version saved", `${currentUserName} saved “${name}”.`);
    versionOperationInFlightRef.current = true;
    setVersionOperationPending(true);
    setSyncStatus("Saving project version");
    try {
      const { response, data } = await requestVersionChange<{ versions: RoomVersion[]; error?: string }>(`/api/rooms/${encodeURIComponent(roomId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, event }),
      });
      if (!response.ok) throw new Error(data.error || "Version save failed");
      if (!Array.isArray(data.versions)) throw new Error("The version list was not returned.");
      setVersions(data.versions);
      prependEvent(event);
      if (socketRef.current?.connected) socketRef.current.emit("room:event", { roomId, event });
      setSyncStatus("Project version saved");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save project version";
      setSyncStatus(message);
      setSaveError(language === "zh" ? `无法确认版本是否保存：${message}。服务器可能仍在处理，请稍等并检查版本历史后再决定是否重试。` : `Could not confirm whether the version was saved: ${message}. The server may still be processing it; wait and check version history before retrying.`);
      if (socketRef.current?.connected) socketRef.current.emit("room:join", roomId);
      return false;
    } finally {
      versionOperationInFlightRef.current = false;
      setVersionOperationPending(false);
    }
  };

  const handleRestoreVersion = async (version: RoomVersion) => {
    if (rejectViewerEdit()) return;
    if (versionOperationInFlightRef.current) {
      setSaveError(language === "zh" ? "版本操作正在进行，请等待完成。" : "A version operation is already in progress. Please wait.");
      return;
    }
    if (hasPendingVersionChanges(pendingEditsRef.current.size, noteInFlightRef.current || replyInFlightRef.current, clipUploadInFlightRef.current || referenceUploadInFlightRef.current)) {
      setSaveError("Wait for your current edits, note or audio upload to finish saving before restoring a version.");
      return;
    }
    if (!window.confirm(language === "zh" ? `恢复“${version.name}”吗？当前编曲会先保存为一个版本。` : `Restore “${version.name}”? The current arrangement will be saved as a version first.`)) return;
    versionOperationInFlightRef.current = true;
    setVersionOperationPending(true);
    const event = createEvent("sync", "Project version restored", `${currentUserName} restored “${version.name}”.`);
    setSyncStatus(`Restoring ${version.name}`);
    try {
      const { response, data } = await requestVersionChange<{ error?: string }>(`/api/rooms/${encodeURIComponent(roomId)}/versions/${encodeURIComponent(version.id)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (!response.ok) throw new Error(data.error || "Version restore failed");
      setSyncStatus(`${version.name} restored`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not restore project version";
      setSyncStatus(message);
      setSaveError(language === "zh" ? `无法确认版本恢复结果：${message}。服务器可能仍在处理，请稍等并检查当前房间和版本历史后再重试。` : `Could not confirm the version restore: ${message}. The server may still be processing it; wait and check the current room and version history before retrying.`);
      if (socketRef.current?.connected) socketRef.current.emit("room:join", roomId);
    } finally {
      versionOperationInFlightRef.current = false;
      setVersionOperationPending(false);
    }
  };

  const handleSelectionAction = (label: string, regionId?: string) => {
    const selectedIndex = timelineRegions.findIndex((region) => region.id === regionId);
    if (selectedIndex < 0) return;
    const selected = timelineRegions[selectedIndex];
    const lane = selected.lane ?? Math.min(selectedIndex, Math.max(0, tracks.length - 1));
    let nextRegions = timelineRegions;
    let split: { originalId: string; newId: string } | undefined;
    let event: RoomEvent;

    if (label === "Split" && selected.width >= 10) {
      const firstWidth = Math.round((selected.width / 2) * 10) / 10;
      const secondWidth = Math.round((selected.width - firstWidth) * 10) / 10;
      const sourceClip = audioClips.find((clip) => clip.id === selected.clipId);
      const sourceDuration = availableRegionDuration(selected, sourceClip);
      if (!canEditRegionTiming(sourceDuration)) {
        const message = selected.clipId && !sourceClip
          ? (language === "zh" ? "无法拆分：找不到关联的音频素材，请先检查素材库。" : "Cannot split: the source audio is missing from the clip library.")
          : (language === "zh" ? "无法拆分：音频片段的源时长无效或为空。" : "Cannot split this clip because its source timing is invalid or empty.");
        setSyncStatus(message);
        setSaveError(message);
        return;
      }
      const firstSourceDuration = sourceDuration ? sourceDuration * (firstWidth / selected.width) : undefined;
      const first = { ...selected, lane, width: firstWidth, label: `${selected.label} A`, sourceDuration: firstSourceDuration };
      const second: TimelineRegion = {
        ...selected,
        id: createLocalId(`${selected.id}-split`),
        lane,
        left: Math.round((selected.left + firstWidth) * 10) / 10,
        width: secondWidth,
        label: `${selected.label} B`,
        sourceOffset: sourceDuration ? (selected.sourceOffset ?? 0) + firstSourceDuration! : selected.sourceOffset,
        sourceDuration: sourceDuration ? sourceDuration - firstSourceDuration! : undefined,
      };
      nextRegions = [...timelineRegions.slice(0, selectedIndex), first, second, ...timelineRegions.slice(selectedIndex + 1)];
      split = { originalId: selected.id, newId: second.id };
      event = createEvent("remix", "Clip split", `${currentUserName} split ${selected.label} into two timeline clips.`);
    } else if (label === "Duplicate") {
      const laneRegions = timelineRegions.filter((region, index) => (region.lane ?? Math.min(index, Math.max(0, tracks.length - 1))) === lane);
      const left = findFreeTimelineStart(laneRegions, selected.width, selected.left + selected.width);
      if (left === null) {
        const message = language === "zh" ? "此音轨没有足够的空位来复制片段。" : "Not enough free space on this track to duplicate the clip.";
        setSyncStatus(message);
        setSaveError(message);
        return;
      }
      const duplicate: TimelineRegion = {
        ...selected,
        id: createLocalId(`${selected.id}-copy`),
        lane,
        left,
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

    publishTimelineChange(nextRegions, event, true, split);
  };

  const handleTimelineAIContext = (regionId?: string) => {
    const region = timelineRegions.find((item) => item.id === regionId);
    const clip = audioClips.find((item) => item.id === region?.clipId);
    if (!clip) {
      setSyncStatus("Select an uploaded audio clip to give it to Music Copilot as context");
      return;
    }
    setCopilotSourceClip(clip);
    setOpenCopilotRequest((current) => current + 1);
    setSyncStatus(`${clip.name} added as Music Copilot context`);
  };

  const handleRegionsChange = (
    nextRegions: TimelineRegion[],
    changedRegion: TimelineRegion,
    mode: "move" | "resize-start" | "resize-end",
  ) => {
    const previousRegion = timelineRegions.find((region) => region.id === changedRegion.id);
    const sourceClip = audioClips.find((clip) => clip.id === changedRegion.clipId);
    const previousSourceDuration = previousRegion ? availableRegionDuration(previousRegion, sourceClip) : undefined;
    if (mode !== "move" && !canEditRegionTiming(previousSourceDuration)) {
      const message = previousRegion?.clipId && !sourceClip
        ? (language === "zh" ? "无法调整长度：找不到关联的音频素材，请先检查素材库。" : "Cannot resize: the source audio is missing from the clip library.")
        : (language === "zh" ? "无法调整长度：音频片段的源时长无效或为空。" : "Cannot resize this clip because its source timing is invalid or empty.");
      setSyncStatus(message);
      setSaveError(message);
      return;
    }
    const normalizedRegions = nextRegions.map((region) => {
      if (region.id !== changedRegion.id || !previousRegion || !previousSourceDuration || mode === "move") {
        return { ...region, left: Math.round(region.left * 10) / 10, width: Math.round(region.width * 10) / 10 };
      }
      let width = region.width;
      let left = region.left;
      if (sourceClip && width > previousRegion.width) {
        const availableDuration = mode === "resize-start"
          ? (previousRegion.sourceOffset ?? 0) + previousSourceDuration
          : sourceClip.duration - (previousRegion.sourceOffset ?? 0);
        const maxWidth = previousRegion.width * Math.max(0, availableDuration) / previousSourceDuration;
        if (width > maxWidth) {
          width = maxWidth;
          if (mode === "resize-start") left = previousRegion.left + previousRegion.width - width;
        }
      }
      const sourceChange = previousSourceDuration * (Math.abs(width - previousRegion.width) / Math.max(previousRegion.width, 0.1));
      const growing = width > previousRegion.width;
      const nextSourceOffset = mode === "resize-start"
        ? Math.max(0, (previousRegion.sourceOffset ?? 0) + (growing ? -sourceChange : sourceChange))
        : previousRegion.sourceOffset;
      const unclampedDuration = Math.max(0.05, growing ? previousSourceDuration + sourceChange : previousSourceDuration - sourceChange);
      const nextSourceDuration = sourceClip
        ? Math.min(unclampedDuration, Math.max(0.05, sourceClip.duration - (nextSourceOffset ?? 0)))
        : unclampedDuration;
      return {
        ...region,
        left: Math.round(left * 10) / 10,
        width: Math.round(width * 10) / 10,
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
      if (isLoopbackHostname(window.location.hostname)) {
        setSaveError(language === "zh" ? "链接已复制，但这是本机地址，其他设备无法通过它访问。远程协作需要部署可访问的网站。" : "Link copied, but this is a local address and cannot be opened from another device. Remote collaboration requires an accessible deployment.");
      }
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
      pendingEditsRef.current.add(`settings:${event.id}`);
      setEditSaveState("saving");
      socketRef.current.emit("room:settings", { roomId, arrangementEpoch: arrangementEpochRef.current, bpm: nextBpm, timeSignature: nextTimeSignature, event });
      setSyncStatus("Saving session timing");
      return;
    }
    void persistRoomChanges(
      { url: `/api/rooms/${encodeURIComponent(roomId)}`, init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bpm: nextBpm, timeSignature: nextTimeSignature, arrangementEpoch: arrangementEpochRef.current }) } },
      { url: `/api/rooms/${encodeURIComponent(roomId)}/events`, init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) } },
    );
  };

  const handleMemberRole = async (member: RoomMember, role: "editor" | "viewer") => {
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member.userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Role update failed");
      setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, role } : item));
      setSyncStatus(`${member.name} is now ${role}`);
    } catch {
      setSyncStatus("Could not update member access. Check your connection and try again.");
    }
  };

  const handleRemoveMember = async (member: RoomMember) => {
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member.userId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Member removal failed");
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
      setSyncStatus(`${member.name} was removed from the room`);
    } catch {
      setSyncStatus("Could not remove member. Check your access and try again.");
    }
  };

  const copilotPanel = (
    <MusicAgentPanel
      key={roomId}
      roomId={roomId}
      onGeneratedAudioReady={handleGeneratedMusicReady}
      onAddGeneratedAudioToRoom={handleAddGeneratedMusicToRoom}
      sourceClip={copilotSourceClip}
      onClearSourceClip={() => setCopilotSourceClip(null)}
      readOnly={!canEdit}
      compact
    />
  );

  return (
    <main className="min-h-screen bg-[#f7f7f5] p-2 text-white lg:h-screen lg:overflow-hidden">
      <section className="relative mx-auto flex min-h-[calc(100vh-16px)] max-w-[1920px] flex-col overflow-hidden rounded-[18px] bg-[#f1f0eb] shadow-2xl md:h-[calc(100vh-16px)]">
        <header className="flex min-h-16 shrink-0 flex-col items-stretch justify-between gap-2 bg-[#174a78] px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link href="/dashboard" onClick={(event) => { const warning = hasRecordingAtRisk ? (language === "zh" ? "录音正在进行或尚未保存，离开可能丢失录音和未发送的草稿。确定离开吗？" : "A recording is in progress or not yet saved. Leaving may lose it and any unsent drafts. Leave anyway?") : hasUnsavedNoteDraft ? (language === "zh" ? "有未发送的留言或回复，离开后草稿会丢失。确定离开吗？" : "You have an unsent note or reply. Leave and discard the draft?") : versionOperationPending ? (language === "zh" ? "版本操作尚未完成，离开后可能无法确认结果。确定离开吗？" : "A version operation is still in progress. Leaving may prevent confirmation of its result. Leave anyway?") : ""; if (warning && !window.confirm(warning)) event.preventDefault(); }} className="grid h-9 w-9 place-items-center rounded-[8px] text-white/60 transition hover:bg-white/8 hover:text-white" title="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="h-7 w-px bg-white/12" />
            <div><h1 className="text-[17px] font-semibold text-white">{roomTitle}</h1><p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70"><Circle className={`h-2 w-2 ${connectionState === "online" ? "fill-[#58e081] text-[#58e081]" : "fill-[#f0be64] text-[#f0be64]"}`} />{roomConnectionLabel(connectionState, language)}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="flex items-center gap-2 rounded-[8px] px-2 py-1 transition hover:bg-white/8" onClick={() => setShowMembers((value) => !value)} title={language === "zh" ? "房间成员" : "Room members"} aria-label={language === "zh" ? "房间成员" : "Room members"}>{members.length ? <CollaboratorAvatars names={members.slice(0, 3).map((member) => member.name.slice(0, 2).toUpperCase())} /> : <UsersRound className="h-5 w-5 text-white/70" />}<span className="hidden text-xs text-white/70 lg:inline">{connectionState === "online" ? (language === "zh" ? `${onlineCount} 人在线` : `${onlineCount} online`) : (language === "zh" ? "未连接" : "Not connected")} · {isAccessLoading ? (language === "zh" ? "正在检查权限" : "checking access") : language === "zh" ? ({ owner: "所有者", editor: "编辑者", viewer: "查看者" }[currentRole] ?? currentRole) : currentRole}</span></button>
            <span className="hidden max-w-[220px] truncate text-[11px] text-white/45 xl:inline" title={syncStatus}>{syncStatus}</span>
            {editSaveState !== "idle" ? <span role="status" className={`text-[11px] ${editSaveState === "error" ? "text-[#ffe0ad]" : "text-white/75"}`}>{editSaveState === "saving" ? "Saving edits..." : editSaveState === "saved" ? "Edits saved" : "Save needs attention"}</span> : null}
            <div className="hidden items-center border-x border-white/10 px-2 sm:flex">
              <button className="workstation-dark-tool" onClick={handleUndoTimeline} disabled={!canEdit || !timelineUndoStack.length} title="Undo"><Undo2 className="h-4 w-4" /></button>
              <button className="workstation-dark-tool" onClick={handleRedoTimeline} disabled={!canEdit || !timelineRedoStack.length} title="Redo"><Redo2 className="h-4 w-4" /></button>
            </div>
            <LanguageSwitcher compact />
            {currentRole === "owner" && !isAccessLoading ? <a href={`/api/rooms/${encodeURIComponent(roomId)}/backup`} download className="grid h-9 w-9 place-items-center rounded-[8px] text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="Download project backup" title="Download project backup (ZIP)"><Download className="h-4 w-4" /></a> : null}
            <GlassButton icon={Share2} className="min-w-0 rounded-[9px] border-white/10 bg-white/8 px-3 py-2 text-xs sm:px-4" onClick={() => void handleShareRoom(inviteRole)}>{shareStatus}</GlassButton>
          </div>
        </header>

        {showMembers ? <div className="absolute right-4 top-16 z-50 w-80 rounded-[12px] border border-[#18202a]/12 bg-[#f7f5f0] p-3 text-[#172033] shadow-2xl">
          <div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.2em] text-[#172033]/42">Room access</p><h2 className="mt-1 text-sm font-semibold">Members</h2></div><span className="rounded-full bg-[#184eb6]/10 px-2 py-1 text-[10px] font-semibold text-[#184eb6]">{currentRole}</span></div>
          {currentRole === "owner" && roomId !== "demo" ? <div className="mt-3 flex gap-2 rounded-[8px] bg-[#18202a]/[0.045] p-2"><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")} className="min-w-0 flex-1 rounded-[7px] border border-[#18202a]/10 bg-white px-2 py-1.5 text-xs"><option value="editor">Can edit</option><option value="viewer">View only</option></select><button type="button" onClick={() => void handleShareRoom(inviteRole)} className="rounded-[7px] bg-[#184eb6] px-3 py-1.5 text-xs font-semibold text-white">Copy invite</button></div> : null}
          <div className="mt-3 space-y-1.5">{members.length ? members.map((member) => <div key={member.userId} className="flex items-center gap-2 rounded-[8px] bg-[#18202a]/[0.045] px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#184eb6] text-[10px] font-bold text-white">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{member.name}</p><p className="truncate text-[10px] text-[#172033]/42">{member.email ?? member.role}</p></div>{member.role === "owner" || currentRole !== "owner" ? <span className="text-[10px] capitalize text-[#172033]/48">{member.role}</span> : <><select value={member.role} onChange={(event) => void handleMemberRole(member, event.target.value as "editor" | "viewer")} className="rounded-[6px] border border-[#18202a]/10 bg-white px-1.5 py-1 text-[10px]"><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button type="button" onClick={() => void handleRemoveMember(member)} className="text-[10px] text-[#a33a36]">Remove</button></>}</div>) : <p className="rounded-[8px] border border-dashed border-[#18202a]/12 p-3 text-xs text-[#172033]/46">No invited members yet. Use Share room to invite an editor.</p>}</div>
        </div> : null}

        {roomError ? <div className="grid min-h-0 flex-1 place-items-center bg-[#f1f0eb] p-6 text-center text-[#172033]" role="alert"><div><p className="text-sm font-semibold">Room not found</p><p className="mt-2 text-sm text-[#172033]/60">{roomError}</p><Link href="/dashboard" className="mt-4 inline-block rounded-[7px] bg-[#184eb6] px-4 py-2 text-sm font-semibold text-white">Back to dashboard</Link></div></div> : isRoomLoading ? <div className="grid min-h-0 flex-1 place-items-center bg-[#f1f0eb] text-[#172033]" role="status"><div className="text-center"><AudioWaveform className="mx-auto h-7 w-7 animate-pulse text-[#184eb6]" /><p className="mt-3 text-sm font-semibold">Loading workspace...</p><p className="mt-1 text-xs text-[#172033]/42">Restoring tracks, clips and room access</p></div></div> : <>
        {saveError ? <div className="flex shrink-0 items-center justify-center gap-3 bg-[#fff0e9] px-4 py-2 text-xs text-[#8b2d20]" role="alert"><span>{saveError}</span><button type="button" onClick={() => setSaveError("")} className="font-semibold underline">{language === "zh" ? "关闭" : "Dismiss"}</button></div> : null}
        {legacyOpenRoom ? <div role="alert" className="shrink-0 bg-[#fff0e9] px-4 py-2 text-center text-xs text-[#8b2d20]">This older room has no account owner and is not private. Log in and duplicate it from the dashboard to create a private copy.</div> : null}
        {roomId === "demo" && timelineRegions.some((region) => !region.clipId) ? <div className="shrink-0 bg-[#f2f0dc] px-4 py-2 text-center text-xs text-[#5d5424]">{t(hasPlayableAudio(uploadedAudioUrl, audioClips, timelineRegions) ? "room.demoPlayableNotice" : "room.demoSampleNotice")}</div> : null}
        {isAccessLoading ? <div className="shrink-0 bg-[#eef2f6] px-4 py-1.5 text-center text-[11px] font-medium text-[#174a78]" role="status">{language === "zh" ? "正在检查房间权限……" : "Checking room access..."}</div> : connectionState !== "online" ? <div className="shrink-0 bg-[#fff0e9] px-4 py-1.5 text-center text-[11px] font-medium text-[#8b2d20]" role="status">{roomConnectionMessage(connectionState, language)}</div> : !canEdit ? <div className="shrink-0 bg-[#dfe8f4] px-4 py-1.5 text-center text-[11px] font-medium text-[#174a78]">{language === "zh" ? "只读权限：可以播放、浏览和导出，但不能编辑。" : "View-only access: playback, navigation and export are available. Editing is locked."}</div> : null}
        <ControlPanel readOnly={!canEdit} uploadedFileName={uploadedFileName} uploadedAudioUrl={uploadedAudioUrl} referenceMuted={referenceMuted} onReferenceMuteChange={handleReferenceMute} onAudioUpload={handleUpload} onRecordedClip={handleClipUpload} onRecordingAtRiskChange={setHasRecordingAtRisk} roomId={roomId} tracks={tracks} regions={timelineRegions} audioClips={audioClips} onPlayheadChange={setPlayheadPosition} snapMode={snapMode} onSnapModeChange={setSnapMode} seekRequest={seekRequest} transportCommand={transportCommand} onTransportAction={handleTransportAction} bpm={bpm} timeSignature={timeSignature} onSessionSettingsChange={handleSessionSettingsChange} />

        <div className="workstation-grid grid min-h-0 flex-1 md:grid-cols-[170px_minmax(0,1fr)_230px] xl:grid-cols-[210px_minmax(0,1fr)_300px]">
          <TrackList readOnly={!canEdit} tracks={tracks} regions={timelineRegions} onAddTrack={handleAddTrack} onRenameTrack={handleRenameTrack} onToggleMute={handleToggleMute} onToggleSolo={handleToggleSolo} onSetVolume={handleSetTrackVolume} onDeleteTrack={handleDeleteTrack} />
          <WorkstationTimeline readOnly={!canEdit} tracks={tracks} regions={timelineRegions} notes={notes} uploadedFileName={uploadedFileName} waveformPeaks={waveformPeaks} audioClips={audioClips} bpm={bpm} playheadPosition={playheadPosition} onSelectionAction={handleSelectionAction} onUseAIContext={handleTimelineAIContext} onRegionsChange={handleRegionsChange} snapMode={snapMode} onSelectionChange={setSelectedRegionId} onPlayheadSeek={(position) => { setPlayheadPosition(position); setSeekRequest((current) => ({ id: (current?.id ?? 0) + 1, position })); }} />
          <WorkstationInspector readOnly={!canEdit} roomId={roomId} notes={notes} events={events} copilot={copilotPanel} openCopilotRequest={openCopilotRequest} regions={timelineRegions} selectedRegion={timelineRegions.find((region) => region.id === selectedRegionId)} onSendNote={handleSendNote} onReplyToNote={handleReplyToNote} onDraftPresenceChange={setHasUnsavedNoteDraft} onResolveNote={handleResolveNote} onDeleteNote={handleDeleteNote} onSelectNote={(position) => { setPlayheadPosition(position); setSeekRequest((current) => ({ id: (current?.id ?? 0) + 1, position })); setSyncStatus(`Jumped to note at ${Math.round(position)}%`); }} versions={versions} versionOperationPending={versionOperationPending} onCreateVersion={handleCreateVersion} onRestoreVersion={handleRestoreVersion} />
        </div>

        <div className="shrink-0 border-t border-[#18202a]/12 bg-[#f6f4ef] text-[#172033]">
          <button type="button" className="flex h-12 w-full items-center justify-between px-5 text-sm" onClick={()=>setIsClipLibraryOpen((value)=>!value)}><span className="font-semibold">{isClipLibraryOpen ? "Hide clips" : "Clips"} <span className="ml-1 font-normal text-[#172033]/42">{audioClips.length}</span></span><span className="text-xs text-[#172033]/42">Upload stems and send clips to Copilot</span></button>
          {isClipLibraryOpen ? <div className="max-h-[300px] overflow-y-auto border-t border-[#18202a]/10 p-3"><ClipLibrary readOnly={!canEdit} roomId={roomId} clips={audioClips} tracks={tracks} isUploading={isUploadingClip} onUpload={handleClipUpload} onDelete={handleClipDelete} onAddToTimeline={handleAddClipToTimeline} onAddGeneratedTrack={handleAddGeneratedMusicToRoom} onUseForAI={(clip)=>{setCopilotSourceClip(clip);setOpenCopilotRequest((current)=>current+1);setSyncStatus(`${clip.name} selected as Music Copilot context`);}} /></div> : null}
        </div>
        </>}
      </section>
    </main>
  );
}
