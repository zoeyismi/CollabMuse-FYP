"use client";

import { useState } from "react";
import { Play, Plus, Trash2, Upload } from "@/components/Icons";
import type { AudioClip, Track } from "@/lib/mock-data";

type ClipLibraryProps = {
  roomId: string;
  clips: AudioClip[];
  tracks: Track[];
  isUploading: boolean;
  onUpload: (file: File, trackId: string) => void;
  onDelete: (clip: AudioClip) => void;
  onUseForAI: (clip: AudioClip) => void;
  onAddToTimeline: (clip: AudioClip) => void;
};

function formatDuration(seconds: number) {
  if (!seconds) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ClipLibrary({ roomId, clips, tracks, isUploading, onUpload, onDelete, onUseForAI, onAddToTimeline }: ClipLibraryProps) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "track");

  return (
    <section className="text-[#172033]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Room clip library</h2>
          <p className="mt-1 text-xs text-[#172033]/42">Upload separate stems and audition them inside this room.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-[8px] border border-[#18202a]/12 bg-white/55 px-4 py-2 text-xs text-[#172033]"
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
          >
            {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] bg-[#184eb6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#123f91]">
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Add clip"}
            <input
              className="sr-only"
              type="file"
              accept="audio/*"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file, trackId);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {clips.map((clip) => {
          const track = tracks.find((item) => item.id === clip.trackId);
          return (
            <div key={clip.id} className="flex items-center gap-3 border-b border-[#18202a]/10 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#184eb6]/10 text-[#184eb6]">
                <Play className="h-4 w-4 fill-current" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{clip.name}</p>
                <p className="mt-0.5 text-[11px] text-[#172033]/42">
                  {track?.name ?? "Unassigned"} · {formatDuration(clip.duration)}
                  {clip.analysis?.bpm ? ` · ${clip.analysis.bpm} BPM · ${clip.analysis.energy} energy` : ""}
                </p>
                <audio
                  className="mt-2 h-7 w-full opacity-75"
                  controls
                  preload="metadata"
                  src={`/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`}
                />
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-[#184eb6] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#123f91]"
                onClick={() => onAddToTimeline(clip)}
                title="Add another instance of this clip to the timeline"
              >
                <Plus className="h-3.5 w-3.5" />Timeline
              </button>
              <button
                type="button"
                className="shrink-0 rounded-[7px] border border-[#18202a]/10 bg-white/55 px-3 py-1.5 text-[10px] font-semibold text-[#172033]/58 transition hover:bg-white"
                onClick={() => onUseForAI(clip)}
                title="Use this clip as Music Copilot context"
              >
                AI context
              </button>
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#172033]/32 transition hover:bg-[#172033]/8 hover:text-[#172033]"
                onClick={() => onDelete(clip)}
                title="Delete clip"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {clips.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#18202a]/12 p-5 text-sm text-[#172033]/38 md:col-span-2">
            No separate stems yet. Choose a track and add an audio clip.
          </div>
        ) : null}
      </div>
    </section>
  );
}
