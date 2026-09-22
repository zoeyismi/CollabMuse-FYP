"use client";

import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2, Volume2, VolumeX } from "@/components/Icons";
import type { Track } from "@/lib/mock-data";

type TrackListProps = {
  tracks: Track[];
  onAddTrack: () => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onToggleMute: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
};

export function TrackList({
  tracks,
  onAddTrack,
  onRenameTrack,
  onToggleMute,
  onDeleteTrack,
}: TrackListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

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
    <aside className="surface-light flex h-full min-h-[520px] flex-col rounded-[28px] p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[#071014]/38">Tracks</p>
          <h2 className="mt-1 text-lg font-semibold text-[#071014]">Arrangement</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#071014]/10 bg-[#071014]/5 px-3 py-1 text-xs text-[#071014]/55">
            {tracks.length} lanes
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#071014]/12 bg-[#071014]/5 text-[#071014]/65 transition hover:bg-[#071014]/10"
            onClick={onAddTrack}
            disabled={tracks.length >= 12}
            title="Add track"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="rounded-2xl border border-[#071014]/10 bg-[#071014]/[0.045] p-3 transition hover:bg-[#071014]/[0.07]"
          >
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: track.color }} />
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
                  <p className="truncate text-sm font-medium text-[#071014]">{track.name}</p>
                )}
                <p className="text-xs text-[#071014]/45">{track.clips} clips synced</p>
                {track.source === "ai" ? (
                  <span className="mt-1 inline-flex rounded-full bg-[#235fba]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#235fba]">
                    AI melody
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-[#071014]/44 transition hover:bg-[#071014]/8 hover:text-[#071014]"
                  onClick={() => startRename(track)}
                  title="Rename track"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-[#071014]/44 transition hover:bg-[#071014]/8 hover:text-[#071014]"
                  onClick={() => onToggleMute(track.id)}
                  title={track.muted ? "Unmute track" : "Mute track"}
                >
                  {track.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-[#071014]/34 transition hover:bg-[#b71912]/10 hover:text-[#b71912] disabled:cursor-not-allowed disabled:opacity-20"
                  onClick={() => onDeleteTrack(track.id)}
                  disabled={tracks.length <= 1}
                  title="Delete track"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto rounded-2xl border border-[#58e081]/30 bg-[#58e081]/14 p-4 text-xs leading-5 text-[#071014]/58">
        Track changes are saved to this room and broadcast to every connected collaborator.
      </div>
    </aside>
  );
}
