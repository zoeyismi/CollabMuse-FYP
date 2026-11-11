"use client";

import { useRoomText } from "@/lib/i18n";
import { LANE_HEIGHT } from "@/components/WorkstationTimeline";
import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "@/components/Icons";
import type { TimelineRegion, Track } from "@/lib/mock-data";

type TrackListProps = {
  readOnly?: boolean;
  tracks: Track[];
  regions: TimelineRegion[];
  onAddTrack: () => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onSetVolume: (trackId: string, volume: number) => void;
  onDeleteTrack: (trackId: string) => void;
};

export function TrackList({
  readOnly = false,
  tracks,
  regions,
  onAddTrack,
  onRenameTrack,
  onToggleMute,
  onToggleSolo,
  onSetVolume,
  onDeleteTrack,
}: TrackListProps) {
  const tr = useRoomText();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [volumeDrafts, setVolumeDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setVolumeDrafts(Object.fromEntries(tracks.map((track) => [track.id, track.volume ?? 0.8])));
  }, [tracks]);

  const startRename = (track: Track) => {
    setEditingId(track.id);
    setDraftName(track.name);
  };

  const submitRename = (event: FormEvent<HTMLFormElement>, trackId: string) => {
    event.preventDefault();
    const name = draftName.trim();
    if (name) onRenameTrack(trackId, name);
    setEditingId(null);
  };

  return (
    <aside className="flex min-h-0 max-h-[420px] flex-col border-r border-stone bg-canvas text-black md:max-h-none">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-stone px-4">
        <div>
          <p className="text-sm text-black">{tr("Tracks")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-600">
            {tracks.length}
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-black transition-colors hover:bg-stone disabled:opacity-30" aria-label="Add track"
            onClick={onAddTrack}
            disabled={readOnly || tracks.length >= 12}
            title="Add track"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div id="track-list-scroll" onScroll={(event) => { const lanes = document.getElementById("timeline-lanes-scroll"); if (lanes && lanes.scrollTop !== event.currentTarget.scrollTop) lanes.scrollTop = event.currentTarget.scrollTop; }} className="min-h-0 flex-1 overflow-y-auto">
        {tracks.slice(0, 12).map((track, index) => {
          const clipCount = regions.filter((region, regionIndex) => (region.lane ?? Math.min(regionIndex, tracks.length - 1)) === index && region.clipId).length;
          const volume = volumeDrafts[track.id] ?? track.volume ?? 0.8;
          return (
          <div
            key={track.id}
            className="group flex flex-col justify-center gap-2 border-b border-stone px-3 transition-colors duration-150 ease-studio hover:bg-cream"
            style={{ height: LANE_HEIGHT }}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {editingId === track.id ? (
                  <form onSubmit={(event) => submitRename(event, track.id)}>
                    <input
                      autoFocus
                      aria-label={tr("Track name")}
                      className="h-7 w-full rounded-lg bg-white px-2 text-sm text-black shadow-ring outline-none"
                      value={draftName}
                      maxLength={36}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => {
                        const name = draftName.trim();
                        if (name) onRenameTrack(track.id, name);
                        setEditingId(null);
                      }}
                    />
                  </form>
                ) : (
                  <p className="truncate text-sm text-black" title={track.name}>{track.name}</p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-ink-600">
                  {track.source === "ai" ? <span className="rounded-full bg-copilot-wash px-1.5 text-[11px] text-copilot-ink">Copilot</span> : null}
                  <span>{clipCount} {tr(clipCount === 1 ? "clip" : "clips")}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-600 transition-colors hover:bg-stone hover:text-black"
                  onClick={() => startRename(track)}
                  disabled={readOnly}
                  aria-label={`Rename ${track.name}`}
                  title={tr("Rename track")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-600 transition-colors hover:bg-[#fbe9e7] hover:text-[#9d403b] disabled:cursor-not-allowed disabled:opacity-20"
                  onClick={() => onDeleteTrack(track.id)}
                  disabled={readOnly || tracks.length <= 1}
                  aria-label={`Delete ${track.name}`}
                  title={tr("Delete track")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={readOnly} aria-pressed={Boolean(track.muted)} onClick={() => onToggleMute(track.id)} className={`grid h-6 w-6 place-items-center rounded-full text-[11px] transition-colors disabled:opacity-35 ${track.muted ? "bg-black text-white" : "bg-stone text-black hover:bg-ink-400/40"}`} title={track.muted ? tr("Unmute track") : tr("Mute track")}>M</button>
              <button type="button" disabled={readOnly} aria-pressed={Boolean(track.solo)} onClick={() => onToggleSolo(track.id)} className={`grid h-6 w-6 place-items-center rounded-full text-[11px] transition-colors disabled:opacity-35 ${track.solo ? "bg-black text-white" : "bg-stone text-black hover:bg-ink-400/40"}`} title={track.solo ? tr("Disable solo") : tr("Solo track")}>S</button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolumeDrafts((current) => ({ ...current, [track.id]: Number(event.target.value) }))}
                onPointerUp={(event) => onSetVolume(track.id, Number(event.currentTarget.value))}
                onKeyUp={(event) => onSetVolume(track.id, Number(event.currentTarget.value))}
                className="h-1 min-w-0 flex-1 accent-black"
                aria-label={`${track.name} volume`}
                disabled={readOnly}
              />
              <span className="w-7 text-right font-mono text-[11px] text-ink-600">{Math.round(volume * 100)}</span>
            </div>
          </div>
          );
        })}
      </div>
    </aside>
  );
}
