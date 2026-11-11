"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Circle, Download, Pause, Play, SkipBack, SkipForward, Upload, Volume2, VolumeX } from "@/components/Icons";
import type { AudioClip, TimelineRegion, Track } from "@/lib/mock-data";
import { audioBufferExceedsPcmRange, audioBufferToWav } from "@/lib/audio-wav";
import { displayRecordingSizeWarning, recordingMustStop, recordingSizeWarning } from "@/lib/audio-limits.mjs";
import { referenceHasEnded } from "@/lib/reference-playback.mjs";
import { getTimelineDuration, hasTimelineDurationMismatch } from "@/lib/timeline-duration";
import { recordingAtRisk, recordingButtonDisabled, recordingRequestCanStart } from "@/lib/recording-controls";
import { getLoopRestartTime } from "@/lib/playback-loop";
import { playbackLayoutKey } from "@/lib/playback-layout";
import { exportSegmentRange } from "@/lib/export-segment";
import { playClipSegment, startTrackedAudio } from "@/lib/clip-playback";
import { hasPlayableAudio as roomHasPlayableAudio } from "@/lib/playable-audio";
import { playScore, renderScore, stopScore } from "@/lib/score-player";
import type { Score } from "@/lib/score.mjs";
import { resolveTempoEdit } from "@/lib/tempo-input";
import { useLanguage, useRoomText } from "@/lib/i18n";

type ControlPanelProps = {
  readOnly?: boolean;
  uploadedFileName: string;
  uploadedAudioUrl: string | null;
  referenceMuted: boolean;
  onReferenceMuteChange: (muted: boolean) => void;
  onAudioUpload: (file: File) => void;
  roomId: string;
  tracks: Track[];
  regions: TimelineRegion[];
  audioClips: AudioClip[];
  onPlayheadChange?: (position: number) => void;
  snapMode: "Bar" | "Beat" | "Off";
  onSnapModeChange: (mode: "Bar" | "Beat" | "Off") => void;
  seekRequest?: { id: number; position: number } | null;
  transportCommand?: TransportCommand | null;
  onTransportAction?: (action: Omit<TransportCommand, "id">) => void;
  /** Note score; its people-written and kept parts play along with the timeline. */
  score?: Score | null;
  onRecordedClip?: (file: File, trackId: string) => Promise<boolean>;
  onRecordingAtRiskChange?: (atRisk: boolean) => void;
  bpm: number;
  timeSignature: string;
  onSessionSettingsChange: (settings: { bpm: number; timeSignature: string }) => void;
};

export type TransportCommand = {
  id: string;
  action: "play" | "pause" | "seek";
  position: number;
};

export function ControlPanel({ readOnly = false, uploadedFileName, uploadedAudioUrl, referenceMuted, onReferenceMuteChange, onAudioUpload, roomId, tracks, regions, audioClips, onPlayheadChange, snapMode, onSnapModeChange, seekRequest, transportCommand, onTransportAction, score, onRecordedClip, onRecordingAtRiskChange, bpm, timeSignature, onSessionSettingsChange }: ControlPanelProps) {
  const tr = useRoomText();
  const { language } = useLanguage();
  const [tempoDraft, setTempoDraft] = useState(String(bpm));
  const tempoEditingRef = useRef(false);
  const tempoInitialDraftRef = useRef(String(bpm));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const clipTimersRef = useRef<number[]>([]);
  const lastPlayheadReportRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const playbackGenerationRef = useRef(0);
  const clockOriginRef = useRef(0);
  const metronomeContextRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const metronomeBeatRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingBytesRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingRequestGenerationRef = useRef(0);
  const recordingRequestInFlightRef = useRef(false);
  const recordingContextRef = useRef({ readOnly, trackIds: tracks.map((track) => track.id) });
  const exportInProgressRef = useRef(false);
  const exportStatusTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const loopSettingsRef = useRef({ enabled: false, start: 0, end: 0 });
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [exportError, setExportError] = useState("");
  const [exportWarning, setExportWarning] = useState("");
  const [recordingTrackId, setRecordingTrackId] = useState(tracks[0]?.id ?? "");
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "requesting" | "recording" | "uploading" | "error">("idle");
  const [recordingError, setRecordingError] = useState("");
  const [recordingWarning, setRecordingWarning] = useState("");
  const [unsavedRecording, setUnsavedRecording] = useState<{ file: File; trackId: string } | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const hasRecordingAtRisk = recordingAtRisk(recordingStatus, Boolean(unsavedRecording));
  const arrangementScore = useMemo(() => {
    if (!score) return null;
    const parts = score.parts.filter((part) => !part.muted && (part.source === "human" || part.kept) && part.notes.length);
    return parts.length ? { ...score, parts } : null;
  }, [score]);
  const scoreBeats = arrangementScore ? arrangementScore.bars * arrangementScore.beatsPerBar : 0;
  const scoreSeconds = scoreBeats ? (scoreBeats * 60) / Math.max(20, bpm) : 0;
  // Region positions are percentages of the audio timeline, so the score only sets the length when there is no audio.
  const timelineDuration = getTimelineDuration(duration, audioClips, regions) || scoreSeconds;
  const timelineDurationMismatch = hasTimelineDurationMismatch(timelineDuration, audioClips, regions);
  const layoutKey = playbackLayoutKey(regions, audioClips, tracks, timelineDuration, uploadedAudioUrl);
  const previousLayoutRef = useRef(layoutKey);
  const hasPlayableAudio = roomHasPlayableAudio(uploadedAudioUrl, audioClips, regions);
  const canPlay = hasPlayableAudio || scoreSeconds > 0;
  const referenceSuppressedBySolo = tracks.some((track) => track.solo);

  useEffect(() => {
    onRecordingAtRiskChange?.(hasRecordingAtRisk);
    if (!hasRecordingAtRisk) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasRecordingAtRisk, onRecordingAtRiskChange]);
  useEffect(() => () => onRecordingAtRiskChange?.(false), [onRecordingAtRiskChange]);

  useEffect(() => {
    if (!tempoEditingRef.current) setTempoDraft(String(bpm));
  }, [bpm]);

  useEffect(() => {
    recordingContextRef.current = { readOnly, trackIds: tracks.map((track) => track.id) };
  }, [readOnly, tracks]);

  useEffect(() => {
    loopSettingsRef.current = { enabled: loopEnabled, start: loopStart, end: loopEnd };
  }, [loopEnabled, loopStart, loopEnd]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    setCurrentTime(0);
    setDuration(0);
    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [uploadedAudioUrl]);

  useEffect(() => {
    return () => {
      recordingRequestGenerationRef.current += 1;
      playbackGenerationRef.current += 1;
      clipTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      clipAudioRefs.current.forEach((audio) => audio.pause());
      if (metronomeTimerRef.current) window.clearInterval(metronomeTimerRef.current);
      void metronomeContextRef.current?.close();
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (exportStatusTimerRef.current !== null) window.clearTimeout(exportStatusTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!tracks.some((track) => track.id === recordingTrackId)) setRecordingTrackId(tracks[0]?.id ?? "");
  }, [recordingTrackId, tracks]);

  useEffect(() => {
    if (!unsavedRecording && recordingStatus !== "recording" && recordingStatus !== "uploading") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedRecording, recordingStatus]);

  useEffect(() => {
    const hasSolo = tracks.some((track) => track.solo);
    if (audioRef.current) audioRef.current.muted = referenceMuted || hasSolo;
    regions.forEach((region) => {
      const clip = audioClips.find((item) => item.id === region.clipId);
      const track = tracks[region.lane ?? -1] ?? tracks.find((item) => item.id === clip?.trackId);
      const audio = clipAudioRefs.current.get(region.id);
      if (audio && track) audio.volume = track.muted || (hasSolo && !track.solo) ? 0 : Math.max(0, Math.min(1, track.volume ?? 0.8));
    });
  }, [tracks, regions, audioClips, referenceMuted]);

  useEffect(() => {
    if (!metronomeOn) return;
    let cancelled = false;
    const start = async () => {
      const AudioContextConstructor = window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Audio context unavailable");
      if (!metronomeContextRef.current) metronomeContextRef.current = new AudioContextConstructor();
      const context = metronomeContextRef.current;
      if (context.state === "suspended") await context.resume();
      if (cancelled) return;
      if (context.state !== "running") throw new Error("Audio context could not start");
      const beatsPerBar = Number(timeSignature.split("/")[0]) || 4;
      const click = () => {
        if (cancelled) return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const accent = metronomeBeatRef.current % beatsPerBar === 0;
        oscillator.frequency.value = accent ? 1120 : 760;
        gain.gain.setValueAtTime(0.16, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.055);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.06);
        metronomeBeatRef.current += 1;
      };
      metronomeBeatRef.current = 0;
      click();
      metronomeTimerRef.current = window.setInterval(click, 60000 / bpm);
    };
    void start().catch(() => {
      if (cancelled) return;
      setMetronomeOn(false);
      setPlaybackError("The metronome could not start. Check your browser audio permissions and try again.");
    });
    return () => {
      cancelled = true;
      if (metronomeTimerRef.current) window.clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    };
  }, [bpm, metronomeOn, timeSignature]);

  const formatTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
  };

  const stopClipPlayback = () => {
    clipTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    clipTimersRef.current = [];
    clipAudioRefs.current.forEach((audio) => audio.pause());
  };

  const reportPlaybackError = (error: unknown, ignoreAbort = false) => {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    if (aborted && ignoreAbort) return;
    playbackGenerationRef.current += 1;
    stopClipPlayback();
    audioRef.current?.pause();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setIsPlaying(false);
    setIsStartingPlayback(false);
    if (!aborted) {
      setPlaybackError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Playback was blocked by your browser. Press Play to listen."
        : "Audio could not be played. Check your connection and try again.");
    }
  };

  const scheduleClips = (fromTime: number, generation: number) => {
    stopClipPlayback();
    const startedClips: Promise<void>[] = [];
    const hasSolo = tracks.some((track) => track.solo);
    regions.forEach((region) => {
      if (!region.clipId) return;
      const clip = audioClips.find((item) => item.id === region.clipId);
      if (!clip) return;
      const track = tracks[region.lane ?? -1] ?? tracks.find((item) => item.id === clip.trackId);
      const audio = clipAudioRefs.current.get(region.id);
      if (!track || !audio) return;
      const startTime = (region.left / 100) * timelineDuration;
      const offset = fromTime - startTime;
      const sourceOffset = Math.max(0, region.sourceOffset ?? 0);
      const sourceDuration = Math.min(region.sourceDuration ?? clip.duration, clip.duration - sourceOffset);
      if (sourceDuration <= 0) return;
      if (offset >= sourceDuration) return;
      audio.volume = track.muted || (hasSolo && !track.solo) ? 0 : Math.max(0, Math.min(1, track.volume ?? 0.8));
      if (offset >= 0) {
        audio.currentTime = sourceOffset + Math.max(0, offset);
        startedClips.push(playClipSegment(audio, sourceDuration - offset, () => generation === playbackGenerationRef.current, (callback, delay) => {
          clipTimersRef.current.push(window.setTimeout(callback, delay));
        }));
        return;
      }
      const timer = window.setTimeout(() => {
        if (generation !== playbackGenerationRef.current) return;
        audio.currentTime = sourceOffset;
        void playClipSegment(audio, sourceDuration, () => generation === playbackGenerationRef.current, (callback, delay) => {
          clipTimersRef.current.push(window.setTimeout(callback, delay));
        }).catch((error) => { if (generation === playbackGenerationRef.current) reportPlaybackError(error, true); });
      }, Math.max(0, -offset * 1000));
      clipTimersRef.current.push(timer);
    });
    return Promise.all(startedClips);
  };

  const startPlayback = async (fromTime: number) => {
    if (!canPlay || !timelineDuration) return false;
    const generation = ++playbackGenerationRef.current;
    setIsStartingPlayback(true);
    try {
      stopClipPlayback();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      setPlaybackError("");
      if (audioRef.current && uploadedAudioUrl) {
        const audio = audioRef.current;
        if (referenceHasEnded(fromTime, audio.duration)) {
          audio.pause();
          audio.currentTime = audio.duration;
        } else {
          audio.currentTime = Math.max(0, fromTime);
          try {
            if (!await startTrackedAudio(audio, () => generation === playbackGenerationRef.current)) return false;
          } catch (error) {
            if (generation === playbackGenerationRef.current) reportPlaybackError(error);
            return false;
          }
        }
      }
      if (generation !== playbackGenerationRef.current) return false;
      try {
        await scheduleClips(fromTime, generation);
      } catch (error) {
        if (generation === playbackGenerationRef.current) reportPlaybackError(error);
        return false;
      }
      if (generation !== playbackGenerationRef.current) return false;
      clockOriginRef.current = performance.now() - fromTime * 1000;
      setIsPlaying(true);
      if (arrangementScore && fromTime < scoreSeconds) {
        void playScore(arrangementScore, bpm, (fromTime * bpm) / 60, scoreBeats, false).catch(() => setPlaybackError("The score could not start. Click play again."));
      } else {
        stopScore();
      }
      const tick = (now: number) => {
        if (generation !== playbackGenerationRef.current) return;
        const nextTime = Math.min(timelineDuration, Math.max(0, (now - clockOriginRef.current) / 1000));
        setCurrentTime(nextTime);
        // The whole room re-renders on a playhead change, so report it about ten times a second, not every frame.
        if (now - lastPlayheadReportRef.current >= 100 || nextTime >= timelineDuration) {
          lastPlayheadReportRef.current = now;
          onPlayheadChange?.((nextTime / timelineDuration) * 100);
        }
        const loop = loopSettingsRef.current;
        const restartAt = getLoopRestartTime(nextTime, timelineDuration, loop.enabled, loop.start, loop.end);
        if (restartAt !== null) {
          void startPlayback(restartAt);
          return;
        }
        if (nextTime >= timelineDuration) {
          playbackGenerationRef.current += 1;
          setIsPlaying(false);
          stopClipPlayback();
          stopScore();
          audioRef.current?.pause();
          animationFrameRef.current = null;
          return;
        }
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(tick);
      return true;
    } finally {
      if (generation === playbackGenerationRef.current) setIsStartingPlayback(false);
    }
  };

  const play = async () => {
    const position = currentTime >= timelineDuration ? 0 : currentTime;
    if (await startPlayback(position)) onTransportAction?.({ action: "play", position });
  };

  const pausePlayback = () => {
    playbackGenerationRef.current += 1;
    audioRef.current?.pause();
    stopClipPlayback();
    stopScore();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setIsPlaying(false);
    setIsStartingPlayback(false);
  };

  const pause = () => {
    pausePlayback();
    onTransportAction?.({ action: "pause", position: currentTime });
  };

  useEffect(() => {
    if (previousLayoutRef.current === layoutKey) return;
    previousLayoutRef.current = layoutKey;
    if (isPlaying || isStartingPlayback) {
      if (!canPlay || !timelineDuration) pausePlayback();
      else void startPlayback(Math.min(currentTime, timelineDuration));
    }
    // Rebuild only when the playable layout changes, not on each playhead update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    const nextTime = Math.max(0, Math.min(timelineDuration, currentTime + seconds));
    if (audio && uploadedAudioUrl) audio.currentTime = Math.min(audio.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    onPlayheadChange?.(timelineDuration ? (nextTime / timelineDuration) * 100 : 0);
    if (isPlaying || isStartingPlayback) void startPlayback(nextTime);
    onTransportAction?.({ action: "seek", position: nextTime });
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    const nextTime = Math.max(0, Math.min(timelineDuration, seconds));
    if (audio && uploadedAudioUrl) audio.currentTime = Math.min(audio.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    onPlayheadChange?.(timelineDuration ? (nextTime / timelineDuration) * 100 : 0);
    if (isPlaying || isStartingPlayback) void startPlayback(nextTime);
    onTransportAction?.({ action: "seek", position: nextTime });
  };

  useEffect(() => {
    if (!seekRequest || !timelineDuration) return;
    const nextTime = Math.max(0, Math.min(timelineDuration, (seekRequest.position / 100) * timelineDuration));
    if (audioRef.current && uploadedAudioUrl) audioRef.current.currentTime = Math.min(audioRef.current.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    if (isPlaying || isStartingPlayback) void startPlayback(nextTime);
    // A request id changes only for an explicit timeline or note seek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest?.id]);

  useEffect(() => {
    if (!transportCommand || !timelineDuration) return;
    const position = Math.max(0, Math.min(timelineDuration, transportCommand.position));
    if (transportCommand.action === "play") {
      void startPlayback(position);
    } else if (transportCommand.action === "pause") {
      if (audioRef.current && uploadedAudioUrl) audioRef.current.currentTime = Math.min(audioRef.current.duration || position, position);
      setCurrentTime(position);
      onPlayheadChange?.((position / timelineDuration) * 100);
      pausePlayback();
    } else {
      if (audioRef.current && uploadedAudioUrl) audioRef.current.currentTime = Math.min(audioRef.current.duration || position, position);
      setCurrentTime(position);
      onPlayheadChange?.((position / timelineDuration) * 100);
      if (isPlaying || isStartingPlayback) void startPlayback(position);
    }
    // The command id identifies an explicit remote transport action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportCommand?.id]);

  const exportMix = async () => {
    if (!canPlay || !timelineDuration || exportInProgressRef.current) return;
    exportInProgressRef.current = true;
    if (exportStatusTimerRef.current !== null) window.clearTimeout(exportStatusTimerRef.current);
    exportStatusTimerRef.current = null;
    setExportStatus("exporting");
    setExportError("");
    setExportWarning("");
    let decodeContext: AudioContext | null = null;
    try {
      decodeContext = new AudioContext();
      const context = decodeContext;
      const decodedClips = new Map<string, Promise<AudioBuffer>>();
      const items: Array<{ buffer: AudioBuffer; start: number; gain: number; duration: number; offset: number }> = [];
      const hasSolo = tracks.some((track) => track.solo);
      await Promise.all(regions.map(async (region) => {
          if (!region.clipId) return;
          const clip = audioClips.find((item) => item.id === region.clipId);
          if (!clip) throw new Error(`Audio for “${region.label}” is missing. Restore the clip before exporting.`);
          const track = tracks[region.lane ?? -1] ?? tracks.find((item) => item.id === clip.trackId);
          if (!track) throw new Error(`The track for “${region.label}” is missing. Check the timeline before exporting.`);
          const gain = Math.max(0, Math.min(1, track.volume ?? 0.8));
          if (track.muted || (hasSolo && !track.solo) || gain === 0) return;
          if (!decodedClips.has(clip.id)) decodedClips.set(clip.id, (async () => {
            const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`);
            if (!response.ok) throw new Error(`Could not load ${clip.name}. Check your connection and try again.`);
            return context.decodeAudioData(await response.arrayBuffer());
          })());
          const buffer = await decodedClips.get(clip.id)!;
          const range = exportSegmentRange(buffer.duration, region.sourceOffset ?? 0, region.sourceDuration ?? clip.duration);
          if (!range) throw new Error(`Audio range for “${region.label}” is invalid. Check the clip before exporting.`);
          items.push({ buffer, start: (region.left / 100) * timelineDuration, gain, ...range });
      }));
      if (uploadedAudioUrl && !referenceMuted && !hasSolo) {
        const response = await fetch(uploadedAudioUrl);
        if (!response.ok) throw new Error("Could not load uploaded audio");
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        items.push({ buffer, start: 0, gain: 1, duration: buffer.duration, offset: 0 });
      }
      if (arrangementScore && !(hasSolo)) {
        const scoreBuffer = await renderScore(arrangementScore, bpm);
        if (scoreBuffer) items.push({ buffer: scoreBuffer, start: 0, gain: 1, duration: scoreBuffer.duration, offset: 0 });
      }
      if (!items.length) throw new Error("No audible clips to export");
      const sampleRate = 44100;
      const exportDuration = Math.max(0.1, ...items.map((item) => item.start + item.duration));
      if (!Number.isFinite(exportDuration) || exportDuration > 300) throw new Error("Mix exports are limited to five minutes. Shorten the arrangement before exporting.");
      const offline = new OfflineAudioContext(2, Math.ceil(exportDuration * sampleRate), sampleRate);
      items.forEach((item) => {
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        source.buffer = item.buffer;
        gain.gain.value = item.gain;
        source.connect(gain);
        gain.connect(offline.destination);
        source.start(item.start, item.offset, item.duration);
      });
      const rendered = await offline.startRendering();
      if (audioBufferExceedsPcmRange(rendered)) {
        setExportWarning("The exported mix exceeded the audio range and may sound distorted. Lower track volumes and export again.");
      }
      const url = URL.createObjectURL(audioBufferToWav(rendered));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${roomId || "collabmuse"}-mix.wav`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus("done");
      exportStatusTimerRef.current = window.setTimeout(() => setExportStatus("idle"), 2200);
    } catch (error) {
      setExportStatus("error");
      setExportError(error instanceof Error ? error.message : "Could not export the mix. Please try again.");
      exportStatusTimerRef.current = window.setTimeout(() => setExportStatus("idle"), 3000);
    } finally {
      try {
        if (decodeContext && decodeContext.state !== "closed") await decodeContext.close();
      } finally {
        exportInProgressRef.current = false;
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const saveRecording = async (recording: { file: File; trackId: string }) => {
    if (!onRecordedClip) return;
    setUnsavedRecording(recording);
    if (recordingMustStop(recording.file.size)) {
      setRecordingWarning(recordingSizeWarning(recording.file.size));
      setRecordingStatus("idle");
      return;
    }
    setRecordingStatus("uploading");
    try {
      if (await onRecordedClip(recording.file, recording.trackId)) { setUnsavedRecording(null); setRecordingWarning(""); }
    } catch {
      // Keep the recorded file available for download or another upload attempt.
    } finally {
      setRecordingStatus("idle");
    }
  };

  const startRecording = async () => {
    if (readOnly || !onRecordedClip || !recordingTrackId || recordingStatus !== "idle" || unsavedRecording || recordingRequestInFlightRef.current) return;
    setRecordingError("");
    setRecordingWarning("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Recording is unavailable in this browser or connection. Use a supported browser on a secure connection.");
      setRecordingStatus("error");
      window.setTimeout(() => setRecordingStatus("idle"), 2500);
      return;
    }
    pausePlayback();
    recordingRequestInFlightRef.current = true;
    setRecordingStatus("requesting");
    const requestGeneration = recordingRequestGenerationRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (requestGeneration !== recordingRequestGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const latest = recordingContextRef.current;
      if (!recordingRequestCanStart(latest.readOnly, latest.trackIds, recordingTrackId)) {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingStatus("idle");
        setPlaybackError("Recording was cancelled because editing is unavailable or the selected track was removed.");
        return;
      }
      recordingStreamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingBytesRef.current = 0;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) {
          recordingChunksRef.current.push(event.data);
          recordingBytesRef.current += event.data.size;
          setRecordingWarning(recordingSizeWarning(recordingBytesRef.current));
          if (recordingMustStop(recordingBytesRef.current) && recorder.state === "recording") recorder.stop();
        }
      });
      recorder.addEventListener("stop", () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(recordingChunksRef.current, { type });
        recordingChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        setRecordingSeconds(0);
        if (blob.size) void saveRecording({ file: new File([blob], `room-take-${Date.now()}.${extension}`, { type }), trackId: recordingTrackId });
        else { setRecordingError("The recording was empty. Check your microphone and try again."); setRecordingStatus("error"); window.setTimeout(() => setRecordingStatus("idle"), 2500); }
      });
      recorder.start(250);
      setRecordingSeconds(0);
      setRecordingStatus("recording");
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch (error) {
      if (requestGeneration !== recordingRequestGenerationRef.current) return;
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecordingError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser settings and try again."
        : error instanceof DOMException && error.name === "NotFoundError"
          ? "No microphone was found. Connect one and try again."
          : "Could not start the microphone. Check your device and browser settings.");
      setRecordingStatus("error");
      window.setTimeout(() => setRecordingStatus("idle"), 2500);
    } finally {
      recordingRequestInFlightRef.current = false;
    }
  };

  const controlClass = "grid h-9 w-9 place-items-center rounded-full text-black transition-colors duration-150 ease-studio hover:bg-stone disabled:cursor-not-allowed disabled:opacity-25";
  const chipClass = "flex h-9 items-center gap-1 rounded-full bg-cream px-3 font-mono text-[13px] text-black/70 outline-none transition-colors hover:bg-stone disabled:cursor-not-allowed";
  const segmentClass = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 transition-[background-color,box-shadow,color] duration-150 ease-studio disabled:opacity-30";
  const segmentOn = "bg-white text-black shadow-ring";
  const segmentOff = "text-ink-700 hover:text-black";
  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-stone bg-canvas px-4 py-2 text-black">
      <audio ref={audioRef} src={uploadedAudioUrl ?? undefined} preload="metadata" />
      {regions.map((region) => {
        const clip = audioClips.find((item) => item.id === region.clipId);
        return clip ? <audio key={region.id} ref={(element) => { if (element) clipAudioRefs.current.set(region.id, element); else clipAudioRefs.current.delete(region.id); }} src={`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`} preload="auto" /> : null;
      })}
      {playbackError ? <div role="alert" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{playbackError}</div> : null}
      {timelineDurationMismatch ? <div role="status" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{language === "zh" ? "部分片段的显示宽度与实际音频时长不一致。请以播放和导出结果为准，剪辑前先试听。" : tr("Some clip widths do not match their audio durations. Check playback before editing; exports use the actual audio duration.")}</div> : null}
      {recordingError ? <div role="alert" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{recordingError}</div> : null}
      {recordingWarning ? <div role="status" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{displayRecordingSizeWarning(recordingWarning, language)}</div> : null}
      {isStartingPlayback && !isPlaying ? <div role="status" className="w-full text-xs text-ink-700">{tr("Preparing audio...")}</div> : null}
      {exportError ? <div role="alert" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{exportError}</div> : null}
      {exportWarning ? <div role="status" className="w-full rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink">{exportWarning}</div> : null}
      {unsavedRecording && recordingStatus !== "uploading" ? <div role="alert" className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-copilot-wash px-3 py-2 text-[13px] text-copilot-ink"><span>{recordingMustStop(unsavedRecording.file.size) ? (language === "zh" ? "录音超过上传上限，请下载保留。" : tr("Recording exceeds the upload limit. Download it to keep it.")) : (language === "zh" ? "录音尚未保存。离开前请下载，或选择录音音轨后重试上传。" : tr("Recording not saved. Download it before leaving or retry using the selected recording track."))}</span><button type="button" disabled={readOnly || !recordingTrackId || recordingMustStop(unsavedRecording.file.size)} onClick={() => void saveRecording({ ...unsavedRecording, trackId: recordingTrackId })} className="font-medium underline disabled:opacity-40">{language === "zh" ? "重试上传" : tr("Retry upload")}</button><button type="button" onClick={() => { const url = URL.createObjectURL(unsavedRecording.file); const link = document.createElement("a"); link.href = url; link.download = unsavedRecording.file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }} className="font-medium underline">{language === "zh" ? "下载录音" : tr("Download recording")}</button><button type="button" onClick={() => { if (window.confirm(language === "zh" ? "确定丢弃这段未保存的录音吗？如需保留，请先下载。" : tr("Discard this unsaved recording? Download it first if you need to keep it."))) { setUnsavedRecording(null); setRecordingWarning(""); } }} className="font-medium underline">{language === "zh" ? "丢弃" : tr("Discard")}</button></div> : null}
      <div className="flex items-center gap-1 rounded-full bg-cream p-1">
        <button className={controlClass} title={tr("Skip back 10 seconds")} aria-label={tr("Skip back 10 seconds")} disabled={!canPlay} onClick={() => seekBy(-10)}><SkipBack className="h-4 w-4" /></button>
        {isPlaying || isStartingPlayback ? (
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black text-white transition-colors duration-150 ease-studio hover:bg-ink-700" title={tr("Pause")} aria-label={tr("Pause")} onClick={pause}><Pause className="h-4 w-4 fill-current" /></button>
        ) : (
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black text-white transition-colors duration-150 ease-studio hover:bg-ink-700 disabled:opacity-30" title={tr("Play")} aria-label={tr("Play")} disabled={!canPlay} onClick={() => void play()}><Play className="ml-0.5 h-4 w-4 fill-current" /></button>
        )}
        <button className={controlClass} title={tr("Skip forward 10 seconds")} aria-label={tr("Skip forward 10 seconds")} disabled={!canPlay} onClick={() => seekBy(10)}><SkipForward className="h-4 w-4" /></button>
        <div className="min-w-[104px] px-2 font-mono text-[13px] leading-tight"><span>{formatTime(currentTime)}</span><span className="text-ink-600"> / {formatTime(timelineDuration)}</span></div>
        <input type="range" min="0" max={Math.max(timelineDuration,0.01)} step="0.01" value={Math.min(currentTime,Math.max(timelineDuration,0.01))} disabled={!canPlay||timelineDuration<=0} onChange={(event)=>seekTo(Number(event.target.value))} className="mr-2 hidden h-1 w-28 accent-black disabled:opacity-25 xl:block" aria-label={tr("Audio playback position")} />
      </div>
      <div className="flex items-center gap-1.5">
        <label className={chipClass}><input type="number" min="40" max="220" value={tempoDraft} disabled={readOnly} onFocus={() => { tempoEditingRef.current = true; tempoInitialDraftRef.current = tempoDraft; }} onChange={(event) => setTempoDraft(event.target.value)} onBlur={() => { tempoEditingRef.current = false; const nextBpm = resolveTempoEdit(tempoDraft, tempoInitialDraftRef.current, bpm); setTempoDraft(String(nextBpm)); if (!readOnly && nextBpm !== bpm) onSessionSettingsChange({ bpm: nextBpm, timeSignature }); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-9 bg-transparent text-right text-black outline-none" aria-label={tr("Tempo BPM")} />BPM</label>
        <select value={timeSignature} disabled={readOnly} onChange={(event) => onSessionSettingsChange({ bpm, timeSignature: event.target.value })} className={`${chipClass} cursor-pointer appearance-none`} aria-label={tr("Time signature")}><option>4/4</option><option>3/4</option><option>6/8</option></select>
        <select value={snapMode} onChange={(event) => onSnapModeChange(event.target.value as "Bar" | "Beat" | "Off")} className={`${chipClass} cursor-pointer appearance-none`} aria-label={tr("Timeline snap")}><option value="Bar">{tr("Snap bar")}</option><option value="Beat">{tr("Snap beat")}</option><option value="Off">{tr("Snap off")}</option></select>
      </div>
      <div className="flex items-center gap-0.5 rounded-full bg-cream p-[3px] text-[13px]">
        <button type="button" onClick={() => setMetronomeOn((value) => !value)} aria-pressed={metronomeOn} className={`${segmentClass} ${metronomeOn ? segmentOn : segmentOff}`} title={tr("Toggle audible metronome")}><AudioWaveform className="h-3.5 w-3.5" />{tr("Click")}</button>
        <button type="button" disabled={!canPlay} onClick={() => { setLoopStart(currentTime); if (loopEnd <= currentTime) setLoopEnd(Math.min(timelineDuration, currentTime + 4)); }} className={`${segmentClass} ${segmentOff}`} title={tr("Set loop start at playhead")}>{tr("In")}</button>
        <button type="button" disabled={!canPlay} onClick={() => setLoopEnd(Math.max(currentTime, loopStart + 0.1))} className={`${segmentClass} ${segmentOff}`} title={tr("Set loop end at playhead")}>{tr("Out")}</button>
        <button type="button" disabled={!canPlay} aria-pressed={loopEnabled} onClick={() => { if (!loopEnd) setLoopEnd(timelineDuration); setLoopEnabled((value) => !value); }} className={`${segmentClass} ${loopEnabled ? segmentOn : segmentOff}`} title={tr("Toggle loop playback")}>{tr("Loop")}</button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {uploadedAudioUrl ? <button type="button" disabled={readOnly} onClick={() => onReferenceMuteChange(!referenceMuted)} aria-pressed={referenceMuted} aria-label={referenceMuted ? tr("Unmute reference audio") : tr("Mute reference audio")} title={referenceSuppressedBySolo && !referenceMuted ? `Reference is silent while a track is soloed: ${uploadedFileName}` : `${referenceMuted ? tr("Unmute") : tr("Mute")} reference: ${uploadedFileName}`} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors disabled:opacity-50 ${referenceMuted ? "bg-black text-white" : "bg-cream text-ink-700 hover:bg-stone"}`}>{referenceMuted || referenceSuppressedBySolo ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{referenceSuppressedBySolo && !referenceMuted ? tr("Reference (solo)") : tr("Reference")}</button> : null}
        {onRecordedClip ? <div className="flex h-9 items-center rounded-full bg-white pl-1 shadow-ring">
          <select value={recordingTrackId} disabled={readOnly || recordingStatus === "recording" || recordingStatus === "requesting"} onChange={(event) => setRecordingTrackId(event.target.value)} className="max-w-[124px] cursor-pointer truncate bg-transparent pl-2.5 pr-1 text-[13px] text-ink-700 outline-none" aria-label={tr("Recording target track")}>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select>
          <span className="h-5 w-px bg-stone" aria-hidden="true" />
          <button type="button" onClick={recordingStatus === "recording" ? stopRecording : () => void startRecording()} disabled={recordingButtonDisabled(recordingStatus, readOnly, !!recordingTrackId, !!unsavedRecording)} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors disabled:opacity-40 ${recordingStatus === "recording" ? "bg-[#b42318] text-white" : "text-black hover:bg-cream"}`} title={recordingStatus === "recording" ? tr("Stop recording") : tr("Record microphone to selected track")}><Circle className={`h-3 w-3 ${recordingStatus === "recording" ? "fill-white text-white" : "fill-[#b42318] text-[#b42318]"}`} />{recordingStatus === "requesting" ? tr("Mic…") : recordingStatus === "uploading" ? tr("Saving…") : recordingStatus === "recording" ? `Stop ${formatTime(recordingSeconds)}` : recordingStatus === "error" ? tr("Mic blocked") : tr("Record")}</button>
        </div> : null}
        <label className={`inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-sm shadow-ring transition-colors ${readOnly ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-cream"}`}><Upload className="h-4 w-4" />{tr("Import audio")}<input className="sr-only" type="file" accept="audio/*" disabled={readOnly} onChange={(event)=>{const file=event.target.files?.[0];if(file)onAudioUpload(file);event.target.value="";}} /></label>
        <button type="button" onClick={() => void exportMix()} disabled={!canPlay || exportStatus === "exporting"} className="inline-flex h-9 items-center gap-2 rounded-full bg-black px-3.5 text-sm text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-35" title={tr("Export the audible timeline as WAV")}><Download className="h-4 w-4" />{exportStatus === "exporting" ? tr("Mixing…") : exportStatus === "done" ? tr("Exported") : exportStatus === "error" ? tr("Export failed") : tr("Export WAV")}</button>
      </div>
    </div>
  );
}
