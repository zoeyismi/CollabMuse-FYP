"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, SendHorizonal, Trash2 } from "@/components/Icons";
import type { RoomEvent, RoomNote, RoomVersion, TimelineRegion } from "@/lib/mock-data";
import { notePosition } from "@/lib/note-position";
import { renderVersionPreview } from "@/lib/version-preview";
import { VersionCompare } from "@/components/VersionCompare";
import { useLanguage, useRoomText } from "@/lib/i18n";
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
  const tr = useRoomText();
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
    <aside className="workstation-inspector flex min-h-[520px] flex-col border-l border-stone bg-canvas text-black md:min-h-0">
      <div className="flex h-14 shrink-0 items-center border-b border-stone px-3">
        <div role="tablist" aria-label={tr("Side panel")} className="workstation-inspector-tabs w-full gap-0.5 rounded-full bg-cream p-[3px]">
          {(["copilot", "notes", "events", "versions"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab===item} onClick={()=>setTab(item)} className={`flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1 text-[13px] capitalize transition-[background-color,box-shadow,color] duration-150 ease-studio ${tab===item ? "bg-white text-black shadow-ring" : "text-ink-700 hover:text-black"}`}>
              {item === "copilot" ? <span className="h-1.5 w-1.5 rounded-full bg-copilot" aria-hidden="true" /> : null}
              {t(`inspector.${item}`)}
              {item === "notes" && openNoteCount ? <span className="font-mono text-[11px] text-ink-600">{openNoteCount}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {tab === "notes" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div role="group" aria-label={t("inspector.notes")} className="sticky top-0 z-10 grid w-full grid-cols-3 gap-0.5 rounded-full bg-cream p-[3px]">
              {(["open", "resolved", "all"] as const).map((filter) => <button key={filter} type="button" onClick={() => setNoteFilter(filter)} aria-pressed={noteFilter === filter} className={`flex min-h-9 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[13px] transition-[background-color,box-shadow,color] ${noteFilter === filter ? "bg-white text-black shadow-ring" : "text-ink-700 hover:text-black"}`}><span>{t(`inspector.${filter}`)}</span>{filter === "open" ? <span>{openNoteCount}</span> : null}</button>)}
            </div>
            {visibleNotes.map((note, index) => (
              <article key={note.id} className={`border-b border-stone py-4 ${note.resolved ? "opacity-65" : ""}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelectNote(notePosition(note, regions))} title={`Jump to ${Math.round(notePosition(note, regions))}%`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-medium ${index===0 ? "bg-human text-white" : "bg-stone text-ink-700"}`}>{note.author.slice(0,1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><strong className="text-sm">{note.author}</strong><time className="text-[10px] text-ink-600">{note.time}</time></div>
                    <p className={`mt-1 text-sm leading-6 text-ink-700 ${note.resolved ? "line-through decoration-black/25" : ""}`}>{note.message}</p>
                    {note.regionId ? <p className="mt-1 truncate text-[10px] text-human">{regions.find((region) => region.id === note.regionId)?.label ?? tr("Original clip no longer on timeline")}</p> : null}
                  </div>
                </div>
                </button>
                {(note.replies ?? []).map((reply) => <div key={reply.id} className="ml-11 mt-3 border-l-2 border-human/20 pl-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs">{reply.author}</strong><time className="text-[10px] text-ink-600">{reply.time}</time></div><p className="mt-1 break-words text-xs leading-5 text-ink-700">{reply.message}</p></div>)}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pl-11">
                  <span className="whitespace-nowrap text-xs text-ink-600">{note.resolved ? `${tr("Resolved")}${note.resolvedBy ? ` · ${note.resolvedBy}` : ""}` : `${tr("Open")} · ${Math.round(notePosition(note, regions))}%`}</span>
                  {!readOnly ? <div className="flex items-center gap-1">
                    <button type="button" disabled={replySaving} onClick={() => setReplyTo(note.id)} className="rounded-full px-2 py-1 text-xs text-human-ink hover:bg-human-wash disabled:opacity-40">{tr("Reply")}</button>
                    <button type="button" onClick={() => onResolveNote(note, !note.resolved)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-human-ink transition-colors hover:bg-human-wash" title={note.resolved ? tr("Reopen note") : tr("Resolve note")}>{note.resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}{note.resolved ? tr("Reopen") : tr("Resolve")}</button>
                    <button type="button" onClick={() => onDeleteNote(note)} className="grid h-6 w-6 place-items-center rounded-full text-[#9d403b]/70 transition hover:bg-[#9d403b]/8 hover:text-[#9d403b]" title={tr("Delete note")}><Trash2 className="h-3 w-3" /></button>
                  </div> : null}
                </div>
                {replyTo === note.id && !readOnly ? <form className="ml-11 mt-2 flex items-center gap-1" onSubmit={async (event) => { event.preventDefault(); if (!replyDraft.trim() || replySavingRef.current) return; replySavingRef.current = true; setReplySaving(true); try { if (await onReplyToNote(note.id, replyDraft.trim())) { clearReplyDraft(note.id); setReplyTo(null); } } finally { replySavingRef.current = false; setReplySaving(false); } }}><input autoFocus aria-label={`Reply to ${note.author}`} value={replyDraft} maxLength={1000} disabled={replySaving} onChange={(event) => setReplyDrafts((current) => ({ ...current, [note.id]: event.target.value }))} placeholder={tr("Write a reply...")} className="min-w-0 flex-1 rounded-[6px] border border-stone bg-white px-2 py-1.5 text-xs outline-none" /><button type="submit" disabled={!replyDraft.trim() || replySaving} className="rounded-[6px] px-2 py-1.5 text-xs font-medium text-human disabled:opacity-40">{replySaving ? tr("Sending...") : tr("Send")}</button><button type="button" onClick={() => { setReplyTo(null); clearReplyDraft(note.id); }} disabled={replySaving} className="rounded-[6px] px-2 py-1.5 text-xs text-ink-600">{tr("Cancel")}</button></form> : null}
              </article>
            ))}
            {visibleNotes.length === 0 ? <p className="py-10 text-center text-xs leading-5 text-ink-600">{t(noteFilter === "open" ? "inspector.emptyOpen" : "inspector.emptyOther")}</p> : null}
          </div>
          <form onSubmit={submit} className="shrink-0 border-t border-stone p-3">
            {selectedRegion?.clipId ? <label className="mb-2 flex items-center gap-2 text-[10px] text-ink-700"><input type="checkbox" checked={attachToClip} disabled={readOnly} onChange={(event) => setAttachToClip(event.target.checked)} className="accent-human" /><span className="min-w-0 truncate">Attach to {selectedRegion.label}</span></label> : null}
            <div className="mb-2 flex items-center gap-2 text-[10px] text-ink-600"><span>@ {Math.round(position)}%</span><input type="range" min="0" max="100" value={position} disabled={readOnly} onChange={(e)=>setPosition(Number(e.target.value))} className="h-1 flex-1 accent-human" /></div>
            <div className="flex items-center gap-2 rounded-[10px] border border-stone bg-white/45 px-3 py-2"><input value={draft} disabled={readOnly || noteSaving} onChange={(e)=>setDraft(e.target.value)} maxLength={1000} placeholder={t(readOnly ? "inspector.viewOnly" : "inspector.notePlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-600" /><button type="submit" disabled={readOnly || noteSaving || !draft.trim()} aria-label={t(noteSaving ? "inspector.savingNote" : "inspector.sendNote")} title={t(noteSaving ? "inspector.savingNote" : "inspector.sendNote")} className="text-human disabled:opacity-25"><SendHorizonal className="h-5 w-5" /></button></div>
          </form>
        </>
      ) : null}
      {tab === "events" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {events.map((event)=><article key={event.id} className="border-b border-stone py-4"><div className="flex justify-between gap-3"><strong className="text-sm">{event.title}</strong><time className="text-[10px] text-ink-600">{event.time}</time></div><p className="mt-1 text-xs leading-5 text-ink-600">{event.detail}</p></article>)}
        </div>
      ) : null}
      {tab === "versions" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" onPlayCapture={(event) => { if (event.target instanceof HTMLAudioElement) pauseOtherAudioPlayers(event.currentTarget.querySelectorAll("audio"), event.target); }}>
          <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (versionSaving) return; setVersionSaving(true); try { if (await onCreateVersion(versionName.trim() || `Version ${versions.length + 1}`)) setVersionName(""); } finally { setVersionSaving(false); } }}>
            <input value={versionName} disabled={readOnly || versionSaving || versionOperationPending} onChange={(event) => setVersionName(event.target.value)} placeholder={language === "zh" ? "版本名称" : tr("Version name")} aria-label={language === "zh" ? "版本名称" : tr("Version name")} maxLength={80} className="min-w-0 flex-1 rounded-[8px] border border-stone bg-white/55 px-3 py-2 text-xs outline-none focus:border-human/35" />
            <button type="submit" disabled={readOnly || versionSaving || versionOperationPending} className="h-9 rounded-full bg-black px-3.5 text-sm text-white transition-colors hover:bg-ink-700 disabled:opacity-35">{versionSaving ? (language === "zh" ? "保存中..." : tr("Saving...")) : (language === "zh" ? "保存" : tr("Save"))}</button>
          </form>
          {versionOperationPending ? <p role="status" className="mt-2 text-xs text-ink-700">{language === "zh" ? "版本操作进行中，请稍候。" : tr("Version operation in progress. Please wait.")}</p> : null}
          <VersionCompare roomId={roomId} versions={versions} />
          <div className="mt-4">
            {versions.map((version) => (
              <article key={version.id} className="border-b border-stone py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{version.name}</p>
                    <p className="mt-1 text-[10px] text-ink-600">{new Date(version.createdAt).toLocaleString()} · {language === "zh" ? `${version.trackCount} 条音轨 · ${version.regionCount} 个时间线片段` : `${version.trackCount} tracks · ${version.regionCount} timeline regions`}</p>
                  </div>
                  <div className="flex shrink-0 gap-1"><button type="button" disabled={previewLoading} onClick={() => void previewVersion(version)} className="rounded-[7px] border border-stone bg-white/55 px-2.5 py-1.5 text-[10px] font-medium text-human disabled:opacity-35">{previewLoading && previewId === version.id ? (language === "zh" ? "准备中..." : tr("Preparing...")) : (language === "zh" ? "试听" : tr("Preview"))}</button><button type="button" disabled={readOnly || versionOperationPending} onClick={() => onRestoreVersion(version)} className="rounded-[7px] border border-stone bg-white/55 px-2.5 py-1.5 text-[10px] font-medium text-human disabled:opacity-35">{language === "zh" ? "恢复" : tr("Restore")}</button></div>
                </div>
                {previewId === version.id && previewUrl ? <audio controls preload="metadata" className="mt-3 h-9 w-full" aria-label={`Preview ${version.name}`} src={previewUrl} /> : null}
                {previewId === version.id && previewMessage ? <p role="status" className="mt-2 text-xs leading-5 text-[#8b5b10]">{previewMessage}</p> : null}
              </article>
            ))}
            {versions.length === 0 ? <p className="py-8 text-center text-xs leading-5 text-ink-600">{language === "zh" ? "重大修改前可以保存版本，以便之后恢复。" : tr("Save a version before a major edit. You can return to it later.")}</p> : null}
          </div>
        </div>
      ) : null}
      <div hidden={tab !== "copilot"} className="min-h-0 flex-1 overflow-y-auto p-3">{copilot}</div>
    </aside>
  );
}
