"use client";

import { useState } from "react";
import { SendHorizonal } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";
import type { RoomNote } from "@/lib/mock-data";

type ChatPanelProps = {
  notes: RoomNote[];
  onSendNote: (message: string, position: number) => void;
};

function formatTimelinePosition(position: number) {
  const totalSeconds = Math.round((position / 100) * 208);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function ChatPanel({ notes, onSendNote }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [position, setPosition] = useState(50);

  const submitNote = () => {
    const message = draft.trim();
    if (!message) return;
    onSendNote(message, position);
    setDraft("");
  };

  return (
    <aside className="surface-light flex h-full min-h-[520px] flex-col rounded-[28px] p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-[#071014]/38">Room chat</p>
        <h2 className="mt-1 text-lg font-semibold text-[#071014]">Creative notes</h2>
      </div>
      <div className="mt-5 flex-1 space-y-4">
        {notes.map((message) => (
          <div key={message.id} className="rounded-2xl border border-[#071014]/10 bg-[#071014]/[0.045] p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#071014]">{message.author}</span>
              <span className="text-[#071014]/35">
                {typeof message.position === "number" ? `@ ${formatTimelinePosition(message.position)}` : message.time}
              </span>
            </div>
            <p className="text-sm leading-6 text-[#071014]/62">{message.message}</p>
          </div>
        ))}
      </div>
      <form
        className="mt-5 rounded-2xl border border-[#071014]/10 bg-[#071014]/[0.045] p-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitNote();
        }}
      >
        <div className="mb-2 flex items-center gap-3 px-3 pt-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#071014]/38">
            {formatTimelinePosition(position)}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            className="h-1 w-full cursor-pointer accent-[#235fba]"
            aria-label="Attach note to waveform position"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#071014] outline-none placeholder:text-[#071014]/35"
            value={draft}
            placeholder="Write a room note..."
            onChange={(event) => setDraft(event.target.value)}
          />
          <GlassButton icon={SendHorizonal} className="h-10 px-3 py-0" disabled={!draft.trim()}>
            Send
          </GlassButton>
        </div>
      </form>
    </aside>
  );
}
