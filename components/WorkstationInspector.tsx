"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, SendHorizonal, Trash2 } from "@/components/Icons";
import type { RoomEvent, RoomNote, RoomVersion, TimelineRegion } from "@/lib/mock-data";
import { notePosition } from "@/lib/note-position";
import { renderVersionPreview } from "@/lib/version-preview";
import { VersionCompare } from "@/components/VersionCompare";
import { useLanguage } from "@/lib/i18n";
import { pauseOtherAudioPlayers } from "@/lib/audio-players";

type Props = {
  readOnly?: boolean;
  roomId: string;
  notes: RoomNote[];
  events: RoomEvent[];
  copilot: ReactNode;
  openCopilotRequest?: number;
  onSendNote: (message: string, position: number, regionId?: string) => Promise<boolean>;
  onReplyToNote: (noteId: string, message: string) => Promise<boolean>;
  onDraftPresenceChange: (hasDraft: boolean) => void;
  regions: TimelineRegion[];
  selectedRegion?: TimelineRegion;
  onResolveNote: (note: RoomNote, resolved: boolean) => void;
  onDeleteNote: (note: RoomNote) => void;
  onSelectNote: (position: number) => void;
  versions: RoomVersion[];
  versionOperationPending: boolean;
  onCreateVersion: (name: string) => Promise<boolean>;
  onRestoreVersion: (version: RoomVersion) => void;
};

export function WorkstationInspector({ readOnly = false, roomId, notes, events, copilot, openCopilotRequest = 0, onSendNote, onReplyToNote, onDraftPresenceChange, regions, selectedRegion, onResolveNote, onDeleteNote, onSelectNote, versions, versionOperationPending, onCreateVersion, onRestoreVersion }: Props) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<"notes" | "events" | "versions" | "copilot">("notes");
  const [noteFilter, setNoteFilter] = useState<"open" | "resolved" | "all">("open");
  const [draft, setDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const noteSavingRef = useRef(false);
  const [versionName, setVersionName] = useState("");
  const [versionSaving, setVersionSaving] = useState(false);
  const [position, setPosition] = useState(50);
  const [attachToClip, setAttachToClip] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySaving, setReplySaving] = useState(false);
  const replySavingRef = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const previewRequestGenerationRef = useRef(0);
  const replyDraft = replyTo ? replyDrafts[replyTo] ?? "" : "";
  useEffect(() => {
    setPreviewId(null);
    setPreviewUrl(null);
    setPreviewMessage("");
    setPreviewLoading(false);
    return () => {
      previewRequestGenerationRef.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, [roomId]);
  useEffect(() => {
    const hasDraft = Boolean(draft.trim()) || Object.values(replyDrafts).some((text) => text.trim());
    onDraftPresenceChange(hasDraft);
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft, replyDrafts, onDraftPresenceChange]);
  useEffect(() => () => onDraftPresenceChange(false), [onDraftPresenceChange]);

  const clearReplyDraft = (noteId: string) => setReplyDrafts((current) => {
    const next = { ...current };
    delete next[noteId];
    return next;
  });

  const previewVersion = async (version: RoomVersion) => {
    if (previewLoading) return;
    const generation = ++previewRequestGenerationRef.current;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPreviewId(version.id);
    setPreviewMessage("");
    setPreviewLoading(true);
    try {
      const result = await renderVersionPreview(roomId, version.id);
      if (generation !== previewRequestGenerationRef.current) return;
      const url = URL.createObjectURL(result.blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      if (result.legacyReferenceUnknown) setPreviewMessage("Older version: reference audio was not captured, so this preview may be incomplete.");
    } catch (error) {
      if (generation === previewRequestGenerationRef.current) setPreviewMessage(error instanceof Error ? error.message : "Could not preview this version.");
    } finally {
      if (generation === previewRequestGenerationRef.current) setPreviewLoading(false);
    }
  };
  useEffect(() => {
    if (openCopilotRequest > 0) setTab("copilot");
  }, [openCopilotRequest]);
  const visibleNotes = notes.filter((note) => noteFilter === "all" || (noteFilter === "resolved" ? note.resolved : !note.resolved));
  const openNoteCount = notes.filter((note) => !note.resolved).length;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || noteSavingRef.current) return;
    noteSavingRef.current = true;
    setNoteSaving(true);
    try {
      if (await onSendNote(draft.trim(), position, attachToClip && selectedRegion?.clipId ? selectedRegion.id : undefined)) setDraft("");
    } finally {
      noteSavingRef.current = false;
      setNoteSaving(false);
    }
  };

  return (
    <aside className="workstation-inspector flex min-h-[520px] flex-col border-l border-[#18202a]/10 bg-[#f5f3ee] text-[#172033] md:min-h-0">
      <div className="workstation-inspector-tabs h-16 shrink-0 border-b border-[#18202a]/10 px-3">
        {(["notes", "events", "versions", "copilot"] as const).map((item) => (
          <button key={item} type="button" onClick={()=>setTab(item)} className={`relative text-xs capitalize ${tab===item ? "font-semibold text-[#123f91]" : "text-[#172033]/48"}`}>
            {t(`inspector.${item}`)}
            {tab===item ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#184eb6]" /> : null}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div role="group" aria-label={t("inspector.notes")} className="sticky top-0 z-10 grid w-full grid-cols-3 gap-1 bg-[#f5f3ee] pb-2">
              {(["open", "resolved", "all"] as const).map((filter) => <button key={filter} type="button" onClick={() => setNoteFilter(filter)} aria-pressed={noteFilter === filter} className={`flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-[7px] px-2 text-xs font-medium transition ${noteFilter === filter ? "bg-[#184eb6] text-white" : "bg-[#18202a]/[0.055] text-[#172033]/65 hover:bg-[#18202a]/10"}`}><span>{t(`inspector.${filter}`)}</span>{filter === "open" ? <span>{openNoteCount}</span> : null}</button>)}
            </div>
            {visibleNotes.map((note, index) => (
              <article key={note.id} className={`border-b border-[#18202a]/10 py-4 ${note.resolved ? "opacity-65" : ""}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelectNote(notePosition(note, regions))} title={`Jump to ${Math.round(notePosition(note, regions))}%`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${index===0 ? "bg-[#184eb6] text-white" : "bg-[#d8dbe0] text-[#172033]/62"}`}>{note.author.slice(0,1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><strong className="text-sm">{note.author}</strong><time className="text-[10px] text-[#172033]/34">{note.time}</time></div>
                    <p className={`mt-1 text-sm leading-6 text-[#172033]/62 ${note.resolved ? "line-through decoration-[#172033]/25" : ""}`}>{note.message}</p>
                    {note.regionId ? <p className="mt-1 truncate text-[10px] text-[#184eb6]">{regions.find((region) => region.id === note.regionId)?.label ?? "Original clip no longer on timeline"}</p> : null}
                  </div>
                </div>
                </button>
                {(note.replies ?? []).map((reply) => <div key={reply.id} className="ml-11 mt-3 border-l-2 border-[#184eb6]/20 pl-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs">{reply.author}</strong><time className="text-[10px] text-[#172033]/34">{reply.time}</time></div><p className="mt-1 break-words text-xs leading-5 text-[#172033]/65">{reply.message}</p></div>)}
                <div className="mt-2 flex items-center justify-between gap-2 pl-11">
                  <span className="text-[9px] text-[#172033]/35">{note.resolved ? `Resolved${note.resolvedBy ? ` by ${note.resolvedBy}` : ""}` : `Open · ${Math.round(notePosition(note, regions))}%`}</span>
                  {!readOnly ? <div className="flex items-center gap-1">
                    <button type="button" disabled={replySaving} onClick={() => setReplyTo(note.id)} className="rounded-[6px] px-2 py-1 text-[10px] font-medium text-[#184eb6] hover:bg-[#184eb6]/8 disabled:opacity-40">Reply</button>
                    <button type="button" onClick={() => onResolveNote(note, !note.resolved)} className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[9px] font-medium text-[#184eb6] transition hover:bg-[#184eb6]/8" title={note.resolved ? "Reopen note" : "Resolve note"}>{note.resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}{note.resolved ? "Reopen" : "Resolve"}</button>
                    <button type="button" onClick={() => onDeleteNote(note)} className="grid h-6 w-6 place-items-center rounded-[6px] text-[#9d403b]/55 transition hover:bg-[#9d403b]/8 hover:text-[#9d403b]" title="Delete note"><Trash2 className="h-3 w-3" /></button>
                  </div> : null}
                </div>
                {replyTo === note.id && !readOnly ? <form className="ml-11 mt-2 flex items-center gap-1" onSubmit={async (event) => { event.preventDefault(); if (!replyDraft.trim() || replySavingRef.current) return; replySavingRef.current = true; setReplySaving(true); try { if (await onReplyToNote(note.id, replyDraft.trim())) { clearReplyDraft(note.id); setReplyTo(null); } } finally { replySavingRef.current = false; setReplySaving(false); } }}><input autoFocus aria-label={`Reply to ${note.author}`} value={replyDraft} maxLength={1000} disabled={replySaving} onChange={(event) => setReplyDrafts((current) => ({ ...current, [note.id]: event.target.value }))} placeholder="Write a reply..." className="min-w-0 flex-1 rounded-[6px] border border-[#18202a]/12 bg-white px-2 py-1.5 text-xs outline-none" /><button type="submit" disabled={!replyDraft.trim() || replySaving} className="rounded-[6px] px-2 py-1.5 text-xs font-semibold text-[#184eb6] disabled:opacity-40">{replySaving ? "Sending..." : "Send"}</button><button type="button" onClick={() => { setReplyTo(null); clearReplyDraft(note.id); }} disabled={replySaving} className="rounded-[6px] px-2 py-1.5 text-xs text-[#172033]/55">Cancel</button></form> : null}
              </article>
            ))}
            {visibleNotes.length === 0 ? <p className="py-10 text-center text-xs leading-5 text-[#172033]/38">{t(noteFilter === "open" ? "inspector.emptyOpen" : "inspector.emptyOther")}</p> : null}
          </div>
          <form onSubmit={submit} className="shrink-0 border-t border-[#18202a]/10 p-3">
            {selectedRegion?.clipId ? <label className="mb-2 flex items-center gap-2 text-[10px] text-[#172033]/65"><input type="checkbox" checked={attachToClip} disabled={readOnly} onChange={(event) => setAttachToClip(event.target.checked)} className="accent-[#184eb6]" /><span className="min-w-0 truncate">Attach to {selectedRegion.label}</span></label> : null}
            <div className="mb-2 flex items-center gap-2 text-[10px] text-[#172033]/38"><span>@ {Math.round(position)}%</span><input type="range" min="0" max="100" value={position} disabled={readOnly} onChange={(e)=>setPosition(Number(e.target.value))} className="h-1 flex-1 accent-[#184eb6]" /></div>
            <div className="flex items-center gap-2 rounded-[10px] border border-[#18202a]/12 bg-white/45 px-3 py-2"><input value={draft} disabled={readOnly || noteSaving} onChange={(e)=>setDraft(e.target.value)} maxLength={1000} placeholder={t(readOnly ? "inspector.viewOnly" : "inspector.notePlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#172033]/32" /><button type="submit" disabled={readOnly || noteSaving || !draft.trim()} aria-label={t(noteSaving ? "inspector.savingNote" : "inspector.sendNote")} title={t(noteSaving ? "inspector.savingNote" : "inspector.sendNote")} className="text-[#184eb6] disabled:opacity-25"><SendHorizonal className="h-5 w-5" /></button></div>
          </form>
        </>
      ) : null}
      {tab === "events" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {events.map((event)=><article key={event.id} className="border-b border-[#18202a]/10 py-4"><div className="flex justify-between gap-3"><strong className="text-sm">{event.title}</strong><time className="text-[10px] text-[#172033]/34">{event.time}</time></div><p className="mt-1 text-xs leading-5 text-[#172033]/52">{event.detail}</p></article>)}
        </div>
      ) : null}
      {tab === "versions" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" onPlayCapture={(event) => { if (event.target instanceof HTMLAudioElement) pauseOtherAudioPlayers(event.currentTarget.querySelectorAll("audio"), event.target); }}>
          <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (versionSaving) return; setVersionSaving(true); try { if (await onCreateVersion(versionName.trim() || `Version ${versions.length + 1}`)) setVersionName(""); } finally { setVersionSaving(false); } }}>
            <input value={versionName} disabled={readOnly || versionSaving || versionOperationPending} onChange={(event) => setVersionName(event.target.value)} placeholder={language === "zh" ? "版本名称" : "Version name"} aria-label={language === "zh" ? "版本名称" : "Version name"} maxLength={80} className="min-w-0 flex-1 rounded-[8px] border border-[#18202a]/12 bg-white/55 px-3 py-2 text-xs outline-none focus:border-[#184eb6]/35" />
            <button type="submit" disabled={readOnly || versionSaving || versionOperationPending} className="rounded-[8px] bg-[#184eb6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-35">{versionSaving ? (language === "zh" ? "保存中..." : "Saving...") : (language === "zh" ? "保存" : "Save")}</button>
          </form>
          {versionOperationPending ? <p role="status" className="mt-2 text-xs text-[#172033]/65">{language === "zh" ? "版本操作进行中，请稍候。" : "Version operation in progress. Please wait."}</p> : null}
          <VersionCompare roomId={roomId} versions={versions} />
          <div className="mt-4">
            {versions.map((version) => (
              <article key={version.id} className="border-b border-[#18202a]/10 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{version.name}</p>
                    <p className="mt-1 text-[10px] text-[#172033]/42">{new Date(version.createdAt).toLocaleString()} · {language === "zh" ? `${version.trackCount} 条音轨 · ${version.regionCount} 个时间线片段` : `${version.trackCount} tracks · ${version.regionCount} timeline regions`}</p>
                  </div>
                  <div className="flex shrink-0 gap-1"><button type="button" disabled={previewLoading} onClick={() => void previewVersion(version)} className="rounded-[7px] border border-[#18202a]/12 bg-white/55 px-2.5 py-1.5 text-[10px] font-semibold text-[#184eb6] disabled:opacity-35">{previewLoading && previewId === version.id ? (language === "zh" ? "准备中..." : "Preparing...") : (language === "zh" ? "试听" : "Preview")}</button><button type="button" disabled={readOnly || versionOperationPending} onClick={() => onRestoreVersion(version)} className="rounded-[7px] border border-[#18202a]/12 bg-white/55 px-2.5 py-1.5 text-[10px] font-semibold text-[#184eb6] disabled:opacity-35">{language === "zh" ? "恢复" : "Restore"}</button></div>
                </div>
                {previewId === version.id && previewUrl ? <audio controls preload="metadata" className="mt-3 h-9 w-full" aria-label={`Preview ${version.name}`} src={previewUrl} /> : null}
                {previewId === version.id && previewMessage ? <p role="status" className="mt-2 text-xs leading-5 text-[#8b5b10]">{previewMessage}</p> : null}
              </article>
            ))}
            {versions.length === 0 ? <p className="py-8 text-center text-xs leading-5 text-[#172033]/38">{language === "zh" ? "重大修改前可以保存版本，以便之后恢复。" : "Save a version before a major edit. You can return to it later."}</p> : null}
          </div>
        </div>
      ) : null}
      <div hidden={tab !== "copilot"} className="min-h-0 flex-1 overflow-y-auto p-3">{copilot}</div>
    </aside>
  );
}
