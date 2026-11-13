"use client";

import { useRoomText } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Trash2, Upload } from "@/components/Icons";
import type { AudioClip, Track } from "@/lib/mock-data";

type ClipLibraryProps = {
  readOnly?: boolean;
  roomId: string;
  clips: AudioClip[];
  tracks: Track[];
  isUploading: boolean;
  onUpload: (file: File, trackId: string) => void;
  onDelete: (clip: AudioClip) => void;
  onUseForAI: (clip: AudioClip) => void;
  onAddToTimeline: (clip: AudioClip, targetTrackId: string) => void;
  onAddGeneratedTrack: (clip: AudioClip) => Promise<boolean>;
};

function formatDuration(seconds: number) {
  if (!seconds) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ClipLibrary({ readOnly = false, roomId, clips, tracks, isUploading, onUpload, onDelete, onUseForAI, onAddToTimeline, onAddGeneratedTrack }: ClipLibraryProps) {
  const tr = useRoomText();
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "track");
  const [addingClipId, setAddingClipId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());

  useLayoutEffect(() => () => {
    audioRefs.current.forEach((audio) => audio.pause());
  }, []);

  useEffect(() => {
    if (!tracks.some((track) => track.id === trackId)) setTrackId(tracks[0]?.id ?? "");
  }, [tracks, trackId]);

  return (
    <section className="text-black">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-medium">Room clip library</h2>
          <p className="mt-1 text-xs text-ink-600">Upload separate stems and audition them inside this room.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-700">Target track</span>
          <select
            className="rounded-[8px] border border-stone bg-white/55 px-4 py-2 text-xs text-black"
            aria-label="Target track for uploaded and added clips"
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
            disabled={readOnly}
          >
            {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
          </select>
          <label className={`inline-flex items-center gap-2 rounded-[8px] bg-human px-4 py-2 text-xs font-medium text-white transition ${readOnly ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-human-ink"}`}>
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Add clip"}
            <input
              className="sr-only"
              type="file"
              accept="audio/*"
              disabled={readOnly || isUploading || !trackId}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file, trackId);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {playbackError ? <p role="alert" className="mt-3 text-xs text-[#a92f2a]">{playbackError}</p> : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {clips.map((clip) => {
          const track = tracks.find((item) => item.id === clip.trackId);
          return (
            <div key={clip.id} className="flex items-center gap-3 border-b border-stone p-3">
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-human/10 text-human hover:bg-human/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-human" aria-label={`${playingClipId === clip.id ? tr("Pause") : tr("Play")} ${clip.name}`} title={`${playingClipId === clip.id ? tr("Pause") : tr("Play")} ${clip.name}`} onClick={() => {
                const audio = audioRefs.current.get(clip.id);
                if (!audio) return;
                if (!audio.paused) { audio.pause(); return; }
                setPlaybackError("");
                void audio.play().catch((error: unknown) => {
                  if (error instanceof DOMException && error.name === "AbortError") return;
                  setPlaybackError(`Could not play ${clip.name}. Check the audio file and browser sound settings.`);
                });
              }}>
                {playingClipId === clip.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{clip.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-600">
                  {track?.name ?? tr("Unassigned")} · {formatDuration(clip.duration)}
                  {clip.analysis?.bpm ? ` · ${clip.analysis.bpm} BPM · ${clip.analysis.energy} energy` : ""}
                </p>
                <audio
                  ref={(element) => { if (element) audioRefs.current.set(clip.id, element); else audioRefs.current.delete(clip.id); }}
                  className="mt-2 h-7 w-full opacity-75"
                  controls
                  preload="metadata"
                  src={`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`}
                  onPlay={() => {
                    audioRefs.current.forEach((audio, id) => { if (id !== clip.id) audio.pause(); });
                    setPlaybackError("");
                    setPlayingClipId(clip.id);
                  }}
                  onPause={() => setPlayingClipId((current) => current === clip.id ? null : current)}
                  onError={() => setPlaybackError(`Could not load ${clip.name}. Check that the audio file is available.`)}
                />
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-human px-3 py-1.5 text-[10px] font-medium text-white transition hover:bg-human-ink"
                onClick={() => {
                  if (clip.generation && !track) {
                    setAddingClipId(clip.id);
                    void onAddGeneratedTrack(clip).finally(() => setAddingClipId(null));
                  } else {
                    onAddToTimeline(clip, trackId);
                  }
                }}
                title={clip.generation && !track ? tr("Create a track for this generated audio") : tr("Add to the selected track")}
                disabled={readOnly || addingClipId !== null || (!trackId && !(clip.generation && !track))}
              >
                <Plus className="h-3.5 w-3.5" />{addingClipId === clip.id ? tr("Adding...") : clip.generation && !track ? tr("New track") : tr("Timeline")}
              </button>
              <button
                type="button"
                className="shrink-0 rounded-[7px] border border-stone bg-white/55 px-3 py-1.5 text-[10px] font-medium text-ink-600 transition hover:bg-white"
                onClick={() => onUseForAI(clip)}
                title={tr("Use this clip as Music Copilot context")}
                disabled={readOnly}
              >
                AI context
              </button>
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-600 transition hover:bg-black/8 hover:text-black"
                onClick={() => onDelete(clip)}
                title={tr("Delete clip")}
                disabled={readOnly}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {clips.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-stone p-5 text-sm text-ink-600 md:col-span-2">
            No separate stems yet. Choose a track and add an audio clip.
          </div>
        ) : null}
      </div>
    </section>
  );
}
