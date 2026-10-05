"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "@/components/Icons";
import type { Track } from "@/lib/mock-data";

type TrackListProps = {
  tracks: Track[];
  onAddTrack: () => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onSetVolume: (trackId: string, volume: number) => void;
  onDeleteTrack: (trackId: string) => void;
};

export function TrackList({
  tracks,
  onAddTrack,
  onRenameTrack,
  onToggleMute,
  onToggleSolo,
  onSetVolume,
  onDeleteTrack,
}: TrackListProps) {
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
    <aside className="flex min-h-0 flex-col border-r border-[#18202a]/10 bg-[#f5f3ee] text-[#172033]">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#18202a]/10 px-4">
        <div>
          <p className="text-[11px] font-semibold text-[#172033]/48">Tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#172033]/38">
            {tracks.length} lanes
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-[8px] text-[#172033]/58 transition hover:bg-[#172033]/8"
            onClick={onAddTrack}
            disabled={tracks.length >= 12}
            title="Add track"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tracks.slice(0, 12).map((track, index) => (
          <div
            key={track.id}
            className={`border-b border-[#18202a]/10 px-3 py-4 transition hover:bg-[#184eb6]/[0.04] ${index === 1 ? "border-l-[3px] border-l-[#184eb6] bg-[#184eb6]/[0.06]" : "border-l-[3px] border-l-transparent"}`}
          >
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: index === 1 ? "#184eb6" : "#8a929d" }} />
              <div className="min-w-0 flex-1">
                {editingId === track.id ? (
                  <form onSubmit={(event) => submitRename(event, track.id)}>
                    <input
                      autoFocus
                      className="w-full rounded-lg border border-[#071014]/14 bg-white/55 px-2 py-1 text-sm text-[#071014] outline-none focus:border-[#235fba]/45"
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
                  <p className="truncate text-[13px] font-medium text-[#172033]">{track.name}</p>
                )}
                <p className="text-[10px] text-[#172033]/38">{track.clips} clips</p>
                {track.source === "ai" ? (
                  <span className="mt-1 inline-flex rounded-full bg-[#235fba]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#235fba]">
                    AI melody
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="hidden h-7 w-7 place-items-center rounded-full text-[#071014]/44 transition hover:bg-[#071014]/8 hover:text-[#071014] xl:grid"
                  onClick={() => startRename(track)}
                  title="Rename track"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="hidden h-7 w-7 place-items-center rounded-full text-[#071014]/34 transition hover:bg-[#b71912]/10 hover:text-[#b71912] disabled:cursor-not-allowed disabled:opacity-20 xl:grid"
                  onClick={() => onDeleteTrack(track.id)}
                  disabled={tracks.length <= 1}
                  title="Delete track"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 pl-5">
              <button type="button" onClick={() => onToggleMute(track.id)} className={`grid h-6 w-6 place-items-center rounded-[5px] text-[10px] font-semibold ${track.muted ? "bg-[#184eb6] text-white" : "border border-[#18202a]/12 text-[#172033]/48"}`} title={track.muted ? "Unmute track" : "Mute track"}>M</button>
              <button type="button" onClick={() => onToggleSolo(track.id)} className={`grid h-6 w-6 place-items-center rounded-[5px] text-[10px] font-semibold ${track.solo ? "bg-[#172033] text-white" : "border border-[#18202a]/12 text-[#172033]/48"}`} title={track.solo ? "Disable solo" : "Solo track"}>S</button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumeDrafts[track.id] ?? track.volume ?? 0.8}
                onChange={(event) => setVolumeDrafts((current) => ({ ...current, [track.id]: Number(event.target.value) }))}
                onPointerUp={(event) => onSetVolume(track.id, Number(event.currentTarget.value))}
                onKeyUp={(event) => onSetVolume(track.id, Number(event.currentTarget.value))}
                className="h-1 min-w-0 flex-1 accent-[#184eb6]"
                aria-label={`${track.name} volume`}
              />
              <span className="w-8 text-right text-[9px] tabular-nums text-[#172033]/38">{Math.round((volumeDrafts[track.id] ?? track.volume ?? 0.8) * 100)}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
