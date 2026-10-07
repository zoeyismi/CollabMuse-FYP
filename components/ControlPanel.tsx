"use client";

import { useEffect, useRef, useState } from "react";
import { AudioWaveform, Circle, Download, Pause, Play, SkipBack, SkipForward, Upload } from "@/components/Icons";
import type { AudioClip, TimelineRegion, Track } from "@/lib/mock-data";

type ControlPanelProps = {
  readOnly?: boolean;
  uploadedFileName: string;
  uploadedAudioUrl: string | null;
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
  onRecordedClip?: (file: File, trackId: string) => void;
  bpm: number;
  timeSignature: string;
  onSessionSettingsChange: (settings: { bpm: number; timeSignature: string }) => void;
};

export type TransportCommand = {
  id: string;
  action: "play" | "pause" | "seek";
  position: number;
};

function audioBufferToWav(buffer: AudioBuffer) {
  const channelCount = buffer.numberOfChannels;
  const sampleCount = buffer.length;
  const bytesPerSample = 2;
  const dataLength = sampleCount * channelCount * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[sample]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export function ControlPanel({ readOnly = false, uploadedFileName, uploadedAudioUrl, onAudioUpload, roomId, tracks, regions, audioClips, onPlayheadChange, snapMode, onSnapModeChange, seekRequest, transportCommand, onTransportAction, onRecordedClip, bpm, timeSignature, onSessionSettingsChange }: ControlPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const clipTimersRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const clockOriginRef = useRef(0);
  const metronomeContextRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const metronomeBeatRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [recordingTrackId, setRecordingTrackId] = useState(tracks[0]?.id ?? "");
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "requesting" | "recording" | "error">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fallbackTimelineDuration = 120;
  const baseTimelineDuration = duration || fallbackTimelineDuration;
  const scheduledClipEnd = audioClips.reduce((end, clip) => {
    const region = regions.find((item) => item.clipId === clip.id);
    if (!region) return end;
    return Math.max(end, (region.left / 100) * baseTimelineDuration + (region.sourceDuration ?? clip.duration));
  }, 0);
  const timelineDuration = Math.max(duration, audioClips.length ? fallbackTimelineDuration : 0, scheduledClipEnd);
  const hasPlayableAudio = Boolean(uploadedAudioUrl || audioClips.length);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const stop = () => setIsPlaying(false);
    const updateTime = () => setCurrentTime(audio.currentTime || 0);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("ended", stop);
    audio.addEventListener("pause", stop);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    setCurrentTime(0);
    setDuration(0);
    return () => {
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [uploadedAudioUrl]);

  useEffect(() => () => {
    clipTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    clipAudioRefs.current.forEach((audio) => audio.pause());
    if (metronomeTimerRef.current) window.clearInterval(metronomeTimerRef.current);
    void metronomeContextRef.current?.close();
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!tracks.some((track) => track.id === recordingTrackId)) setRecordingTrackId(tracks[0]?.id ?? "");
  }, [recordingTrackId, tracks]);

  useEffect(() => {
    if (!metronomeOn) return;
    let cancelled = false;
    const start = async () => {
      const AudioContextConstructor = window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      if (!metronomeContextRef.current) metronomeContextRef.current = new AudioContextConstructor();
      const context = metronomeContextRef.current;
      if (context.state === "suspended") await context.resume();
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
    void start();
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

  const scheduleClips = (fromTime: number) => {
    stopClipPlayback();
    const hasSolo = tracks.some((track) => track.solo);
    regions.forEach((region) => {
      if (!region.clipId) return;
      const clip = audioClips.find((item) => item.id === region.clipId);
      if (!clip) return;
      const track = tracks[region.lane ?? -1] ?? tracks.find((item) => item.id === clip.trackId);
      const audio = clipAudioRefs.current.get(region.id);
      if (!track || !region || !audio || track.muted || (hasSolo && !track.solo)) return;
      const startTime = (region.left / 100) * timelineDuration;
      const offset = fromTime - startTime;
      const sourceOffset = Math.max(0, region.sourceOffset ?? 0);
      const sourceDuration = Math.max(0.05, Math.min(region.sourceDuration ?? clip.duration, clip.duration - sourceOffset));
      if (offset >= sourceDuration) return;
      audio.volume = track.volume ?? 0.8;
      if (offset >= 0) {
        audio.currentTime = sourceOffset + Math.max(0, offset);
        void audio.play().catch(() => undefined);
        const stopTimer = window.setTimeout(() => audio.pause(), Math.max(0, (sourceDuration - offset) * 1000));
        clipTimersRef.current.push(stopTimer);
        return;
      }
      const timer = window.setTimeout(() => {
        audio.currentTime = sourceOffset;
        void audio.play().catch(() => undefined);
        const stopTimer = window.setTimeout(() => audio.pause(), sourceDuration * 1000);
        clipTimersRef.current.push(stopTimer);
      }, Math.max(0, -offset * 1000));
      clipTimersRef.current.push(timer);
    });
  };

  const startPlayback = async (fromTime: number) => {
    if (!hasPlayableAudio || !timelineDuration) return;
    if (audioRef.current && uploadedAudioUrl) {
      audioRef.current.currentTime = Math.min(fromTime, audioRef.current.duration || fromTime);
      await audioRef.current.play().catch(() => undefined);
    }
    scheduleClips(fromTime);
    clockOriginRef.current = performance.now() - fromTime * 1000;
    setIsPlaying(true);
    const tick = (now: number) => {
      const nextTime = Math.min(timelineDuration, Math.max(0, (now - clockOriginRef.current) / 1000));
      setCurrentTime(nextTime);
      onPlayheadChange?.((nextTime / timelineDuration) * 100);
      const activeLoopEnd = loopEnd > loopStart ? loopEnd : timelineDuration;
      if (loopEnabled && nextTime >= activeLoopEnd) {
        void startPlayback(Math.min(loopStart, timelineDuration));
        return;
      }
      if (nextTime >= timelineDuration) {
        setIsPlaying(false);
        stopClipPlayback();
        audioRef.current?.pause();
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const play = () => {
    void startPlayback(currentTime);
    onTransportAction?.({ action: "play", position: currentTime });
  };

  const pausePlayback = () => {
    audioRef.current?.pause();
    stopClipPlayback();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setIsPlaying(false);
  };

  const pause = () => {
    pausePlayback();
    onTransportAction?.({ action: "pause", position: currentTime });
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    const nextTime = Math.max(0, Math.min(timelineDuration, currentTime + seconds));
    if (audio && uploadedAudioUrl) audio.currentTime = Math.min(audio.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    onPlayheadChange?.(timelineDuration ? (nextTime / timelineDuration) * 100 : 0);
    if (isPlaying) void startPlayback(nextTime);
    onTransportAction?.({ action: "seek", position: nextTime });
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    const nextTime = Math.max(0, Math.min(timelineDuration, seconds));
    if (audio && uploadedAudioUrl) audio.currentTime = Math.min(audio.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    onPlayheadChange?.(timelineDuration ? (nextTime / timelineDuration) * 100 : 0);
    if (isPlaying) void startPlayback(nextTime);
    onTransportAction?.({ action: "seek", position: nextTime });
  };

  useEffect(() => {
    if (!seekRequest || !timelineDuration) return;
    const nextTime = Math.max(0, Math.min(timelineDuration, (seekRequest.position / 100) * timelineDuration));
    if (audioRef.current && uploadedAudioUrl) audioRef.current.currentTime = Math.min(audioRef.current.duration || nextTime, nextTime);
    setCurrentTime(nextTime);
    if (isPlaying) void startPlayback(nextTime);
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
      if (isPlaying) void startPlayback(position);
    }
    // The command id identifies an explicit remote transport action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportCommand?.id]);

  const exportMix = async () => {
    if (!hasPlayableAudio || !timelineDuration || exportStatus === "exporting") return;
    setExportStatus("exporting");
    try {
      const decodeContext = new AudioContext();
      const items: Array<{ buffer: AudioBuffer; start: number; gain: number; duration: number; offset: number }> = [];
      const hasSolo = tracks.some((track) => track.solo);
      if (audioClips.length) {
        await Promise.all(regions.map(async (region) => {
          if (!region.clipId) return;
          const clip = audioClips.find((item) => item.id === region.clipId);
          if (!clip) return;
          const track = tracks[region.lane ?? -1] ?? tracks.find((item) => item.id === clip.trackId);
          if (!track || !region || track.muted || (hasSolo && !track.solo)) return;
          const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`);
          if (!response.ok) throw new Error(`Could not load ${clip.name}`);
          const buffer = await decodeContext.decodeAudioData(await response.arrayBuffer());
          const offset = Math.max(0, region.sourceOffset ?? 0);
          const duration = Math.max(0.05, Math.min(region.sourceDuration ?? clip.duration, buffer.duration - offset));
          items.push({ buffer, start: (region.left / 100) * timelineDuration, gain: track.volume ?? 0.8, duration, offset });
        }));
      } else if (uploadedAudioUrl) {
        const response = await fetch(uploadedAudioUrl);
        if (!response.ok) throw new Error("Could not load uploaded audio");
        const buffer = await decodeContext.decodeAudioData(await response.arrayBuffer());
        items.push({ buffer, start: 0, gain: 1, duration: buffer.duration, offset: 0 });
      }
      await decodeContext.close();
      if (!items.length) throw new Error("No audible clips to export");
      const sampleRate = 44100;
      const exportDuration = Math.max(0.1, ...items.map((item) => item.start + item.duration));
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
      const url = URL.createObjectURL(audioBufferToWav(rendered));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${roomId || "collabmuse"}-mix.wav`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus("done");
      window.setTimeout(() => setExportStatus("idle"), 2200);
    } catch (error) {
      console.error("Mix export failed", error);
      setExportStatus("error");
      window.setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const startRecording = async () => {
    if (readOnly || !onRecordedClip || !recordingTrackId || recordingStatus === "requesting") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingStatus("error");
      return;
    }
    pausePlayback();
    setRecordingStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
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
        setRecordingStatus("idle");
        setRecordingSeconds(0);
        if (blob.size) onRecordedClip(new File([blob], `room-take-${Date.now()}.${extension}`, { type }), recordingTrackId);
      });
      recorder.start(250);
      setRecordingSeconds(0);
      setRecordingStatus("recording");
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecordingStatus("error");
      window.setTimeout(() => setRecordingStatus("idle"), 2500);
    }
  };

  const controlClass = "grid h-9 w-9 place-items-center rounded-[8px] bg-[#172033]/[0.055] text-[#172033]/65 transition hover:bg-[#172033]/10 disabled:cursor-not-allowed disabled:opacity-25";
  return (
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-[#18202a]/10 bg-[#f7f5f0] px-4 py-2 text-[#172033]">
      <audio ref={audioRef} src={uploadedAudioUrl ?? undefined} preload="metadata" />
      {regions.map((region) => {
        const clip = audioClips.find((item) => item.id === region.clipId);
        return clip ? <audio key={region.id} ref={(element) => { if (element) clipAudioRefs.current.set(region.id, element); else clipAudioRefs.current.delete(region.id); }} src={`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`} preload="auto" /> : null;
      })}
      <div className="flex items-center gap-1.5">
        <button className={controlClass} title="Skip back 10 seconds" disabled={!hasPlayableAudio} onClick={() => seekBy(-10)}><SkipBack className="h-4 w-4" /></button>
        <button className="grid h-10 w-12 place-items-center rounded-[8px] bg-[#184eb6] text-white transition hover:bg-[#123f91] disabled:opacity-30" title="Play" disabled={!hasPlayableAudio || isPlaying} onClick={play}><Play className="h-5 w-5 fill-current" /></button>
        <button className={controlClass} title="Pause" disabled={!hasPlayableAudio || !isPlaying} onClick={pause}><Pause className="h-4 w-4" /></button>
        <button className={controlClass} title="Skip forward 10 seconds" disabled={!hasPlayableAudio} onClick={() => seekBy(10)}><SkipForward className="h-4 w-4" /></button>
      </div>
      <div className="min-w-[120px] text-sm font-semibold tabular-nums">{formatTime(currentTime)} <span className="font-normal text-[#172033]/36">/ {formatTime(timelineDuration)}</span></div>
      <div className="hidden h-8 w-px bg-[#18202a]/10 md:block" />
      <label className="flex items-center gap-1 rounded-[8px] border border-[#18202a]/10 bg-white/40 px-2 py-1.5 text-xs font-medium"><input type="number" min="40" max="220" value={bpm} disabled={readOnly} onChange={(event) => onSessionSettingsChange({ bpm: Math.max(40, Math.min(220, Number(event.target.value) || 96)), timeSignature })} className="w-10 bg-transparent text-right outline-none" aria-label="Tempo BPM" /> BPM</label>
      <select value={timeSignature} disabled={readOnly} onChange={(event) => onSessionSettingsChange({ bpm, timeSignature: event.target.value })} className="rounded-[8px] border border-[#18202a]/10 bg-white/40 px-2 py-2 text-xs font-medium" aria-label="Time signature"><option>4/4</option><option>3/4</option><option>6/8</option></select>
      <select value={snapMode} onChange={(event) => onSnapModeChange(event.target.value as "Bar" | "Beat" | "Off")} className="rounded-[8px] border border-[#18202a]/10 bg-white/40 px-2 py-2 text-xs font-medium" aria-label="Timeline snap"><option value="Bar">Snap: Bar</option><option value="Beat">Snap: Beat</option><option value="Off">Snap: Off</option></select>
      <button type="button" onClick={() => setMetronomeOn((value) => !value)} className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-xs font-semibold transition ${metronomeOn ? "border-[#184eb6]/25 bg-[#184eb6] text-white" : "border-[#18202a]/10 bg-white/40 text-[#172033]/65"}`} title="Toggle audible metronome"><AudioWaveform className="h-3.5 w-3.5" />{metronomeOn ? "Click on" : "Metronome"}</button>
      <div className="flex items-center rounded-[8px] border border-[#18202a]/10 bg-white/40 p-0.5 text-[11px] font-semibold">
        <button type="button" disabled={!hasPlayableAudio} onClick={() => { setLoopStart(currentTime); if (loopEnd <= currentTime) setLoopEnd(Math.min(timelineDuration, currentTime + 4)); }} className="rounded-[6px] px-2 py-1.5 disabled:opacity-30" title="Set loop start at playhead">In</button>
        <button type="button" disabled={!hasPlayableAudio} onClick={() => setLoopEnd(Math.max(currentTime, loopStart + 0.1))} className="rounded-[6px] px-2 py-1.5 disabled:opacity-30" title="Set loop end at playhead">Out</button>
        <button type="button" disabled={!hasPlayableAudio} onClick={() => { if (!loopEnd) setLoopEnd(timelineDuration); setLoopEnabled((value) => !value); }} className={`rounded-[6px] px-2 py-1.5 transition disabled:opacity-30 ${loopEnabled ? "bg-[#184eb6] text-white" : "text-[#172033]/60"}`} title="Toggle loop playback">Loop</button>
      </div>
      <div className="ml-auto hidden min-w-[180px] items-center gap-2 lg:flex">
        <input type="range" min="0" max={Math.max(timelineDuration,0.01)} step="0.01" value={Math.min(currentTime,Math.max(timelineDuration,0.01))} disabled={!hasPlayableAudio||timelineDuration<=0} onChange={(event)=>seekTo(Number(event.target.value))} className="h-1 flex-1 accent-[#184eb6] disabled:opacity-25" aria-label="Audio playback position" />
      </div>
      <span className="hidden max-w-[180px] truncate text-[11px] text-[#172033]/38 xl:block" title={uploadedFileName}>{uploadedFileName}</span>
      <button type="button" onClick={() => void exportMix()} disabled={!hasPlayableAudio || exportStatus === "exporting"} className="inline-flex items-center gap-2 rounded-[9px] border border-[#18202a]/14 bg-white/55 px-3 py-2 text-xs font-semibold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35" title="Export the audible timeline as WAV"><Download className="h-4 w-4" />{exportStatus === "exporting" ? "Mixing…" : exportStatus === "done" ? "Exported" : exportStatus === "error" ? "Export failed" : "Export WAV"}</button>
      {onRecordedClip ? <div className="flex items-center rounded-[9px] border border-[#18202a]/14 bg-white/55 p-0.5">
        <select value={recordingTrackId} disabled={readOnly || recordingStatus === "recording"} onChange={(event) => setRecordingTrackId(event.target.value)} className="max-w-[120px] bg-transparent px-2 py-1.5 text-[11px] outline-none" aria-label="Recording target track">{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select>
        <button type="button" onClick={recordingStatus === "recording" ? stopRecording : () => void startRecording()} disabled={readOnly || !recordingTrackId || recordingStatus === "requesting"} className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${recordingStatus === "recording" ? "bg-[#b42318] text-white" : "text-[#7f1d1d] hover:bg-[#b42318]/8"}`} title={recordingStatus === "recording" ? "Stop recording" : "Record microphone to selected track"}><Circle className={`h-3.5 w-3.5 ${recordingStatus === "recording" ? "fill-white" : "fill-[#b42318] text-[#b42318]"}`} />{recordingStatus === "requesting" ? "Mic…" : recordingStatus === "recording" ? `Stop ${formatTime(recordingSeconds)}` : recordingStatus === "error" ? "Mic blocked" : "Record"}</button>
      </div> : null}
      <label className={`inline-flex items-center gap-2 rounded-[9px] border border-[#18202a]/14 bg-white/55 px-4 py-2 text-xs font-semibold transition ${readOnly ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-white"}`}><Upload className="h-4 w-4" />Upload audio<input className="sr-only" type="file" accept="audio/*" disabled={readOnly} onChange={(event)=>{const file=event.target.files?.[0];if(file)onAudioUpload(file);event.target.value="";}} /></label>
    </div>
  );
}
