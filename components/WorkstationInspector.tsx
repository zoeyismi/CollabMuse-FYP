"use client";

import { FormEvent, ReactNode, useState } from "react";
import { SendHorizonal } from "@/components/Icons";
import type { RoomEvent, RoomNote, RoomVersion } from "@/lib/mock-data";

type Props = {
  notes: RoomNote[];
  events: RoomEvent[];
  copilot: ReactNode;
  onSendNote: (message: string, position: number) => void;
  onSelectNote: (position: number) => void;
  versions: RoomVersion[];
  onCreateVersion: (name: string) => void;
  onRestoreVersion: (version: RoomVersion) => void;
};

export function WorkstationInspector({ notes, events, copilot, onSendNote, onSelectNote, versions, onCreateVersion, onRestoreVersion }: Props) {
  const [tab, setTab] = useState<"notes" | "events" | "versions" | "copilot">("notes");
  const [draft, setDraft] = useState("");
  const [versionName, setVersionName] = useState("");
  const [position, setPosition] = useState(50);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onSendNote(draft.trim(), position);
    setDraft("");
  };

  return (
    <aside className="flex min-h-0 flex-col border-l border-[#18202a]/10 bg-[#f5f3ee] text-[#172033]">
      <div className="workstation-inspector-tabs h-16 shrink-0 border-b border-[#18202a]/10 px-3">
        {(["notes", "events", "versions", "copilot"] as const).map((item) => (
          <button key={item} type="button" onClick={()=>setTab(item)} className={`relative text-xs capitalize ${tab===item ? "font-semibold text-[#123f91]" : "text-[#172033]/48"}`}>
            {item === "versions" ? "history" : item}
            {tab===item ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#184eb6]" /> : null}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {notes.map((note, index) => (
              <article key={note.id} className="border-b border-[#18202a]/10 py-4">
                <button type="button" className="w-full text-left" onClick={() => onSelectNote(note.position ?? 0)} title={`Jump to ${Math.round(note.position ?? 0)}%`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${index===0 ? "bg-[#184eb6] text-white" : "bg-[#d8dbe0] text-[#172033]/62"}`}>{note.author.slice(0,1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><strong className="text-sm">{note.author}</strong><time className="text-[10px] text-[#172033]/34">{note.time}</time></div>
                    <p className="mt-1 text-sm leading-6 text-[#172033]/62">{note.message}</p>
                  </div>
                </div>
                </button>
              </article>
            ))}
          </div>
          <form onSubmit={submit} className="shrink-0 border-t border-[#18202a]/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-[#172033]/38"><span>@ {Math.round(position)}%</span><input type="range" min="0" max="100" value={position} onChange={(e)=>setPosition(Number(e.target.value))} className="h-1 flex-1 accent-[#184eb6]" /></div>
            <div className="flex items-center gap-2 rounded-[10px] border border-[#18202a]/12 bg-white/45 px-3 py-2"><input value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="Add a note..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#172033]/32" /><button type="submit" disabled={!draft.trim()} className="text-[#184eb6] disabled:opacity-25"><SendHorizonal className="h-5 w-5" /></button></div>
          </form>
        </>
      ) : null}
      {tab === "events" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {events.map((event)=><article key={event.id} className="border-b border-[#18202a]/10 py-4"><div className="flex justify-between gap-3"><strong className="text-sm">{event.title}</strong><time className="text-[10px] text-[#172033]/34">{event.time}</time></div><p className="mt-1 text-xs leading-5 text-[#172033]/52">{event.detail}</p></article>)}
        </div>
      ) : null}
      {tab === "versions" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onCreateVersion(versionName.trim() || `Version ${versions.length + 1}`); setVersionName(""); }}>
            <input value={versionName} onChange={(event) => setVersionName(event.target.value)} placeholder="Version name" maxLength={80} className="min-w-0 flex-1 rounded-[8px] border border-[#18202a]/12 bg-white/55 px-3 py-2 text-xs outline-none focus:border-[#184eb6]/35" />
            <button type="submit" className="rounded-[8px] bg-[#184eb6] px-3 py-2 text-xs font-semibold text-white">Save</button>
          </form>
          <div className="mt-4">
            {versions.map((version) => (
              <article key={version.id} className="border-b border-[#18202a]/10 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{version.name}</p>
                    <p className="mt-1 text-[10px] text-[#172033]/42">{new Date(version.createdAt).toLocaleString()} · {version.trackCount} tracks · {version.regionCount} clips</p>
                  </div>
                  <button type="button" onClick={() => onRestoreVersion(version)} className="shrink-0 rounded-[7px] border border-[#18202a]/12 bg-white/55 px-2.5 py-1.5 text-[10px] font-semibold text-[#184eb6]">Restore</button>
                </div>
              </article>
            ))}
            {versions.length === 0 ? <p className="py-8 text-center text-xs leading-5 text-[#172033]/38">Save a version before a major edit. You can return to it later.</p> : null}
          </div>
        </div>
      ) : null}
      {tab === "copilot" ? <div className="min-h-0 flex-1 overflow-y-auto p-3">{copilot}</div> : null}
    </aside>
  );
}
