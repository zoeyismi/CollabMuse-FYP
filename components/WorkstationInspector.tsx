"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Check, RotateCcw, SendHorizonal, Trash2 } from "@/components/Icons";
import type { RoomEvent, RoomNote, RoomVersion } from "@/lib/mock-data";

type Props = {
  readOnly?: boolean;
  notes: RoomNote[];
  events: RoomEvent[];
  copilot: ReactNode;
  onSendNote: (message: string, position: number) => void;
  onResolveNote: (note: RoomNote, resolved: boolean) => void;
  onDeleteNote: (note: RoomNote) => void;
  onSelectNote: (position: number) => void;
  versions: RoomVersion[];
  onCreateVersion: (name: string) => void;
  onRestoreVersion: (version: RoomVersion) => void;
};

export function WorkstationInspector({ readOnly = false, notes, events, copilot, onSendNote, onResolveNote, onDeleteNote, onSelectNote, versions, onCreateVersion, onRestoreVersion }: Props) {
  const [tab, setTab] = useState<"notes" | "events" | "versions" | "copilot">("notes");
  const [noteFilter, setNoteFilter] = useState<"open" | "resolved" | "all">("open");
  const [draft, setDraft] = useState("");
  const [versionName, setVersionName] = useState("");
  const [position, setPosition] = useState(50);
  const visibleNotes = notes.filter((note) => noteFilter === "all" || (noteFilter === "resolved" ? note.resolved : !note.resolved));
  const openNoteCount = notes.filter((note) => !note.resolved).length;
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
            <div className="sticky top-0 z-10 flex items-center gap-1 bg-[#f5f3ee] pb-2">
              {(["open", "resolved", "all"] as const).map((filter) => <button key={filter} type="button" onClick={() => setNoteFilter(filter)} className={`rounded-[7px] px-2.5 py-1.5 text-[10px] font-medium capitalize transition ${noteFilter === filter ? "bg-[#184eb6] text-white" : "bg-[#18202a]/[0.055] text-[#172033]/52 hover:bg-[#18202a]/10"}`}>{filter}{filter === "open" ? ` ${openNoteCount}` : ""}</button>)}
            </div>
            {visibleNotes.map((note, index) => (
              <article key={note.id} className={`border-b border-[#18202a]/10 py-4 ${note.resolved ? "opacity-65" : ""}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelectNote(note.position ?? 0)} title={`Jump to ${Math.round(note.position ?? 0)}%`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${index===0 ? "bg-[#184eb6] text-white" : "bg-[#d8dbe0] text-[#172033]/62"}`}>{note.author.slice(0,1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><strong className="text-sm">{note.author}</strong><time className="text-[10px] text-[#172033]/34">{note.time}</time></div>
                    <p className={`mt-1 text-sm leading-6 text-[#172033]/62 ${note.resolved ? "line-through decoration-[#172033]/25" : ""}`}>{note.message}</p>
                  </div>
                </div>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2 pl-11">
                  <span className="text-[9px] text-[#172033]/35">{note.resolved ? `Resolved${note.resolvedBy ? ` by ${note.resolvedBy}` : ""}` : `Open · ${Math.round(note.position ?? 0)}%`}</span>
                  {!readOnly ? <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onResolveNote(note, !note.resolved)} className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[9px] font-medium text-[#184eb6] transition hover:bg-[#184eb6]/8" title={note.resolved ? "Reopen note" : "Resolve note"}>{note.resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}{note.resolved ? "Reopen" : "Resolve"}</button>
                    <button type="button" onClick={() => onDeleteNote(note)} className="grid h-6 w-6 place-items-center rounded-[6px] text-[#9d403b]/55 transition hover:bg-[#9d403b]/8 hover:text-[#9d403b]" title="Delete note"><Trash2 className="h-3 w-3" /></button>
                  </div> : null}
                </div>
              </article>
            ))}
            {visibleNotes.length === 0 ? <p className="py-10 text-center text-xs leading-5 text-[#172033]/38">{noteFilter === "open" ? "All feedback is resolved." : "No notes in this view."}</p> : null}
          </div>
          <form onSubmit={submit} className="shrink-0 border-t border-[#18202a]/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-[#172033]/38"><span>@ {Math.round(position)}%</span><input type="range" min="0" max="100" value={position} disabled={readOnly} onChange={(e)=>setPosition(Number(e.target.value))} className="h-1 flex-1 accent-[#184eb6]" /></div>
            <div className="flex items-center gap-2 rounded-[10px] border border-[#18202a]/12 bg-white/45 px-3 py-2"><input value={draft} disabled={readOnly} onChange={(e)=>setDraft(e.target.value)} placeholder={readOnly ? "View-only access" : "Add a note..."} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#172033]/32" /><button type="submit" disabled={readOnly || !draft.trim()} className="text-[#184eb6] disabled:opacity-25"><SendHorizonal className="h-5 w-5" /></button></div>
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
            <input value={versionName} disabled={readOnly} onChange={(event) => setVersionName(event.target.value)} placeholder="Version name" maxLength={80} className="min-w-0 flex-1 rounded-[8px] border border-[#18202a]/12 bg-white/55 px-3 py-2 text-xs outline-none focus:border-[#184eb6]/35" />
            <button type="submit" disabled={readOnly} className="rounded-[8px] bg-[#184eb6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-35">Save</button>
          </form>
          <div className="mt-4">
            {versions.map((version) => (
              <article key={version.id} className="border-b border-[#18202a]/10 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{version.name}</p>
                    <p className="mt-1 text-[10px] text-[#172033]/42">{new Date(version.createdAt).toLocaleString()} · {version.trackCount} tracks · {version.regionCount} clips</p>
                  </div>
                  <button type="button" disabled={readOnly} onClick={() => onRestoreVersion(version)} className="shrink-0 rounded-[7px] border border-[#18202a]/12 bg-white/55 px-2.5 py-1.5 text-[10px] font-semibold text-[#184eb6] disabled:opacity-35">Restore</button>
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
