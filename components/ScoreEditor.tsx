"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Play, Square, Sparkles, Trash2 } from "lucide-react";
import {
  DRUM_NOTES,
  acceptProposal,
  applyProposal,
  createProposal,
  rejectProposal,
  voteProposal,
  createDefaultScore,
  diatonicChords,
  discardPart,
  draftParts,
  keepPart,
  makeId,
  midiToName,
  scaleChromas,
  scoreToMidi,
  setChord,
  setKey,
  updatePart,
  type PartRole,
  type Score,
  type ScoreNote,
  type ScorePart,
} from "@/lib/score.mjs";
import { playScore, previewNote, scorePosition, stopScore } from "@/lib/score-player";
import { cn } from "@/lib/utils";

type Props = {
  score: Score | null;
  bpm: number;
  readOnly: boolean;
  language: string;
  roomTitle: string;
  userName: string;
  onChange: (score: Score, title: string, detail: string) => void;
};

const KEYS = ["C major", "G major", "D major", "A major", "F major", "Bb major", "Eb major", "A minor", "E minor", "D minor", "C minor", "G minor", "F minor"];
const ROLE_ROWS: Record<PartRole, [number, number]> = { drums: [36, 42], bass: [33, 52], keys: [52, 76], melody: [64, 86], pad: [48, 72] };
const DRUM_ROWS = [
  { midi: DRUM_NOTES.hat, label: "Hat" },
  { midi: DRUM_NOTES.snare, label: "Snare" },
  { midi: DRUM_NOTES.kick, label: "Kick" },
];
const ROW_HEIGHT = 18;
const CELLS_PER_BEAT = 2;

const copy = {
  en: {
    emptyTitle: "Write with notes",
    emptyBody: "A score adds sections, a chord per bar and note parts you can edit one note at a time. Copilot drafts parts that follow your chords.",
    create: "Start a score",
    key: "Key",
    play: "Play score",
    stop: "Stop",
    whole: "Whole song",
    sections: "Sections",
    chords: "Chords",
    parts: "Parts",
    noChord: "No chord",
    ask: "Ask Copilot",
    promptLabel: "What should Copilot write?",
    promptPlaceholder: "e.g. half-time drums, let the keys breathe, lift the melody",
    draft: "Draft parts",
    draftSection: (name: string) => `Redraft ${name}`,
    keep: "Keep",
    discard: "Discard",
    suggestion: "Suggestion",
    copilotKept: "Copilot",
    human: "Written by people",
    mute: "Mute",
    unmute: "Unmute",
    export: "Export MIDI",
    rollHint: "Click to add a note. Drag to move, drag the right edge to lengthen, double-click to delete.",
    selectPart: "Pick a part to edit its notes",
    ruleBased: "Copilot here is rule-based: it reads your chord track and a few words (busy, sparse, half-time, lift). No AI model or paid API is called.",
    viewOnly: "View only",
    propose: (name: string) => `Propose a ${name} variation`,
    proposed: (who: string, name: string) => `${who} proposed a ${name} variation`,
    current: "A · current",
    variation: "B · variation",
    voteFor: (side: string, count: number) => `Vote ${side} · ${count}`,
    acceptB: "Accept B",
    keepA: "Keep A",
    previewBanner: "Previewing B. Editing is paused; play it, then vote or decide.",
    accepted: "B accepted",
    keptA: "Kept A",
    pickSection: "Pick a section to propose a variation",
  },
  zh: {
    emptyTitle: "用音符来写",
    emptyBody: "乐谱包含段落、每小节一个和弦，以及可以逐个音符编辑的声部。Copilot 会按你的和弦起草声部。",
    create: "开始写乐谱",
    key: "调",
    play: "播放乐谱",
    stop: "停止",
    whole: "整首",
    sections: "段落",
    chords: "和弦",
    parts: "声部",
    noChord: "无和弦",
    ask: "让 Copilot 写",
    promptLabel: "让 Copilot 写什么？",
    promptPlaceholder: "例如：鼓改成半拍感、键盘留白、旋律抬高",
    draft: "起草声部",
    draftSection: (name: string) => `重写${name}`,
    keep: "保留",
    discard: "丢弃",
    suggestion: "建议",
    copilotKept: "Copilot",
    human: "人写的",
    mute: "静音",
    unmute: "取消静音",
    export: "导出 MIDI",
    rollHint: "点击空白处加音符。拖动移动，拖右边缘拉长，双击删除。",
    selectPart: "选一个声部来编辑音符",
    ruleBased: "这里的 Copilot 是规则编曲器：读取和弦轨和提示里的几个词（热闹、稀疏、半拍、抬高），不调用 AI 模型或付费接口。",
    viewOnly: "只读",
    propose: (name: string) => `为 ${name} 提一个变奏`,
    proposed: (who: string, name: string) => `${who} 提议了 ${name} 的变奏`,
    current: "A · 现在的",
    variation: "B · 变奏",
    voteFor: (side: string, count: number) => `投 ${side} · ${count}`,
    acceptB: "采用 B",
    keepA: "保留 A",
    previewBanner: "正在试听 B，暂停编辑；播放后投票或决定。",
    accepted: "已采用 B",
    keptA: "已保留 A",
    pickSection: "先选一个段落再提变奏",
  },
};

type Drag = { noteId: string; mode: "move" | "resize"; originX: number; originY: number; start: number; midi: number; duration: number };

export function ScoreEditor({ score: liveScore, bpm, readOnly: readOnlyProp, language, roomTitle, userName, onChange }: Props) {
  const t = language === "zh" ? copy.zh : copy.en;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewing = Boolean(previewId && liveScore?.proposals?.some((item) => item.id === previewId && item.status === "open"));
  // While B is previewed the editor shows the proposal and editing is paused.
  const score = previewing && liveScore ? applyProposal(liveScore, previewId!) : liveScore;
  const readOnly = readOnlyProp || previewing;
  const [newKey, setNewKey] = useState("C minor");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [chordMenuBar, setChordMenuBar] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<ScoreNote[] | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const rollRef = useRef<HTMLDivElement>(null);

  const section = score?.sections.find((item) => item.id === sectionId) ?? null;
  const fromBar = section ? section.startBar : 0;
  const barCount = section ? section.bars : score?.bars ?? 0;
  const fromBeat = fromBar * (score?.beatsPerBar ?? 4);
  const visibleBeats = barCount * (score?.beatsPerBar ?? 4);
  const part = score?.parts.find((item) => item.id === partId) ?? score?.parts[0] ?? null;
  const notes = draftNotes ?? part?.notes ?? [];

  useEffect(() => () => stopScore(), []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const position = scorePosition();
      setBeat(position);
      if (position === null) {
        setPlaying(false);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const rows = useMemo(() => {
    if (!part || !score) return [];
    if (part.role === "drums") return DRUM_ROWS;
    const [low, high] = ROLE_ROWS[part.role];
    const inKey = new Set(scaleChromas(score.key));
    return Array.from({ length: high - low + 1 }, (_, index) => {
      const midi = high - index;
      return { midi, label: midiToName(midi), inKey: inKey.has(midi % 12), black: [1, 3, 6, 8, 10].includes(midi % 12) };
    });
  }, [part, score]);

  if (!score) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-8">
        <div className="flex max-w-[460px] flex-col gap-4">
          <h2 className="font-display text-[28px] font-light leading-tight tracking-[-0.02em]">{t.emptyTitle}</h2>
          <p className="text-[15px] text-ink-700">{t.emptyBody}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-full bg-cream pl-3.5 pr-2 text-sm text-ink-600">
              {t.key}
              <select value={newKey} onChange={(event) => setNewKey(event.target.value)} className="cursor-pointer bg-transparent font-mono text-[13px] text-black outline-none">
                {KEYS.map((key) => <option key={key}>{key}</option>)}
              </select>
            </label>
            <button type="button" disabled={readOnly} onClick={() => onChange(createDefaultScore({ key: newKey, bars: 16 }), "Score started", `${newKey} · 16 bars`)} className="h-9 rounded-full bg-black px-3.5 text-sm text-white transition-colors hover:bg-ink-700 disabled:opacity-40">{t.create}</button>
          </div>
        </div>
      </div>
    );
  }

  const beatsPerBar = score.beatsPerBar;
  const columns = visibleBeats * CELLS_PER_BEAT;
  const percent = (beatValue: number) => ((beatValue - fromBeat) / visibleBeats) * 100;
  const rowIndex = (midi: number) => rows.findIndex((row) => row.midi === midi);
  const isSuggestion = (item: ScorePart) => item.source === "copilot" && !item.kept;
  const diatonic = diatonicChords(score.key);

  const commitNotes = (next: ScoreNote[], title: string) => {
    if (!part) return;
    onChange(updatePart(score, part.id, { notes: next.sort((a, b) => a.start - b.start) }), title, `${part.name} · ${next.length} notes`);
  };

  const togglePlay = async () => {
    if (playing) {
      stopScore();
      setPlaying(false);
      setBeat(null);
      return;
    }
    await playScore(score, bpm, fromBeat, fromBeat + visibleBeats, Boolean(section));
    setPlaying(true);
  };

  const runDraft = () => {
    const next = draftParts(score, { sectionId: section?.id, prompt, seed: Date.now() % 100000 });
    const changed = next.parts.filter((item) => item.source === "copilot").length;
    onChange(next, section ? `Copilot redrafted ${section.name}` : "Copilot drafted parts", `${changed} parts${prompt ? ` · “${prompt.slice(0, 60)}”` : ""}`);
    if (!partId) setPartId(next.parts.find((item) => item.source === "copilot")?.id ?? null);
  };

  const exportMidi = () => {
    const bytes = scoreToMidi(score, { bpm, title: roomTitle });
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "audio/midi" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${roomTitle.replace(/[^\w\- ]+/g, "").trim() || "collabmuse"}.mid`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pointToCell = (event: ReactPointerEvent) => {
    const rect = rollRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width - 1);
    const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height - 1);
    return { cellBeat: fromBeat + Math.floor((x / rect.width) * columns) / CELLS_PER_BEAT, row: rows[Math.floor(y / ROW_HEIGHT)] };
  };

  const onRollPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly || !part || event.button !== 0 || event.target !== event.currentTarget) return;
    const { cellBeat, row } = pointToCell(event);
    if (!row) return;
    const note: ScoreNote = { id: makeId("n"), midi: row.midi, start: cellBeat, duration: part.role === "drums" ? 0.25 : 1, velocity: 0.8 };
    setSelectedNoteId(note.id);
    void previewNote(part.id, part.role, note.midi);
    commitNotes([...part.notes, note], `Added a note to ${part.name}`);
  };

  const onNotePointerDown = (event: ReactPointerEvent<HTMLDivElement>, note: ScoreNote) => {
    event.stopPropagation();
    setSelectedNoteId(note.id);
    if (readOnly || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mode = event.clientX > rect.right - 7 && part?.role !== "drums" ? "resize" : "move";
    dragRef.current = { noteId: note.id, mode, originX: event.clientX, originY: event.clientY, start: note.start, midi: note.midi, duration: note.duration };
    rollRef.current?.setPointerCapture(event.pointerId);
    setDraftNotes(part?.notes ?? []);
  };

  const onRollPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !rollRef.current || !part) return;
    const rect = rollRef.current.getBoundingClientRect();
    const cellWidth = rect.width / columns;
    const deltaCells = Math.round((event.clientX - drag.originX) / cellWidth);
    const deltaRows = Math.round((event.clientY - drag.originY) / ROW_HEIGHT);
    setDraftNotes(part.notes.map((note) => {
      if (note.id !== drag.noteId) return note;
      if (drag.mode === "resize") return { ...note, duration: Math.max(1 / CELLS_PER_BEAT, drag.duration + deltaCells / CELLS_PER_BEAT) };
      const start = Math.min(fromBeat + visibleBeats - 1 / CELLS_PER_BEAT, Math.max(fromBeat, drag.start + deltaCells / CELLS_PER_BEAT));
      const index = Math.min(rows.length - 1, Math.max(0, rowIndex(drag.midi) + deltaRows));
      return { ...note, start, midi: rows[index]?.midi ?? note.midi };
    }));
  };

  const onRollPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !draftNotes || !part) {
      setDraftNotes(null);
      return;
    }
    const moved = draftNotes.find((note) => note.id === drag.noteId);
    setDraftNotes(null);
    if (moved && (moved.start !== drag.start || moved.midi !== drag.midi || moved.duration !== drag.duration)) {
      if (moved.midi !== drag.midi) void previewNote(part.id, part.role, moved.midi);
      commitNotes(draftNotes, `Edited ${part.name} notes`);
    }
  };

  const deleteNote = (noteId: string) => {
    if (!part || readOnly) return;
    setSelectedNoteId(null);
    commitNotes(part.notes.filter((note) => note.id !== noteId), `Removed a note from ${part.name}`);
  };

  const sectionChip = (id: string | null, label: string) => (
    <button key={id ?? "all"} type="button" onClick={() => { setSectionId(id); if (playing) { stopScore(); setPlaying(false); } }} aria-pressed={sectionId === id} className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] transition-colors duration-150 ease-studio", sectionId === id ? "bg-human-ink text-white" : "bg-cream text-black/70 hover:bg-stone")}>{label}</button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas" onKeyDown={(event) => { if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteId && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); deleteNote(selectedNoteId); } }}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone px-4 py-2">
        <button type="button" onClick={() => void togglePlay()} className="flex h-9 items-center gap-2 rounded-full bg-black pl-2.5 pr-3.5 text-sm text-white transition-colors hover:bg-ink-700" aria-label={playing ? t.stop : t.play}>
          {playing ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}{playing ? t.stop : t.play}
        </button>
        <label className="flex h-9 items-center gap-2 rounded-full bg-cream pl-3.5 pr-2 text-sm text-ink-600">
          {t.key}
          <select value={score.key} disabled={readOnly} onChange={(event) => onChange(setKey(score, event.target.value), "Changed key", event.target.value)} className="cursor-pointer bg-transparent font-mono text-[13px] text-black outline-none">
            {[...new Set([score.key, ...KEYS])].map((key) => <option key={key}>{key}</option>)}
          </select>
        </label>
        <span className="flex h-9 items-center rounded-full bg-cream px-3 font-mono text-[13px] text-black/70">{bpm} BPM</span>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {sectionChip(null, t.whole)}
          {score.sections.map((item) => sectionChip(item.id, `${item.name} ${item.startBar + 1}–${item.startBar + item.bars}`))}
        </div>
        <button type="button" onClick={exportMidi} className="ml-auto flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-sm shadow-ring transition-colors hover:bg-cream"><Download className="h-4 w-4" />{t.export}</button>
      </div>

      <form
        className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-4 pr-1 shadow-ring"
        onSubmit={(event) => { event.preventDefault(); if (!readOnly) runDraft(); }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-copilot" aria-hidden="true" />
        <label htmlFor="score-prompt" className="sr-only">{t.promptLabel}</label>
        <input id="score-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t.promptPlaceholder} disabled={readOnly} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400" />
        <button type="submit" disabled={readOnly} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-black px-3 text-[13px] text-white transition-colors hover:bg-ink-700 disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" />{section ? t.draftSection(section.name) : t.draft}</button>
      </form>
      <div className="mx-4 mt-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-600">{previewing ? t.previewBanner : readOnly ? t.viewOnly : t.ruleBased}</p>
        {!readOnlyProp && !previewing ? (
          <button type="button" disabled={!section} title={section ? undefined : t.pickSection} onClick={() => { if (!liveScore || !section) return; const next = createProposal(liveScore, { sectionId: section.id, author: userName, prompt }); onChange(next, `${userName} proposed a ${section.name} variation`, next.proposals?.at(-1)?.note || section.name); }} className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] shadow-ring transition-colors hover:bg-cream disabled:opacity-40">
            {section ? t.propose(section.name) : t.pickSection}
          </button>
        ) : null}
      </div>
      {liveScore?.proposals?.some((item) => item.status === "open") ? (
        <div className="mx-4 mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1">
          {liveScore.proposals.filter((item) => item.status === "open").map((proposal) => {
            const target = liveScore.sections.find((item) => item.id === proposal.sectionId);
            const showingB = previewId === proposal.id;
            const myVote = proposal.votes.A.includes(userName) ? "A" : proposal.votes.B.includes(userName) ? "B" : null;
            return (
              <article key={proposal.id} className="flex w-[340px] shrink-0 flex-col gap-2.5 rounded-2xl bg-cream p-3">
                <p className="text-[13px]"><span className="font-medium">{t.proposed(proposal.author, target?.name ?? "")}</span>{proposal.note ? <span className="block truncate font-mono text-xs text-ink-600" title={proposal.note}>{proposal.note}</span> : null}</p>
                <div role="group" aria-label="A or B" className="grid grid-cols-2 gap-0.5 rounded-full bg-black/5 p-[3px]">
                  {(["A", "B"] as const).map((side) => {
                    const on = side === "B" ? showingB : !showingB;
                    return <button key={side} type="button" aria-pressed={on} onClick={() => { stopScore(); setPlaying(false); setBeat(null); setSectionId(proposal.sectionId); setPreviewId(side === "B" ? proposal.id : null); }} className={cn("h-8 rounded-full text-[13px] transition-[background-color,box-shadow]", on ? "bg-white shadow-ring" : "text-ink-700")}>{side === "A" ? t.current : t.variation}</button>;
                  })}
                </div>
                {!readOnlyProp ? (
                  <>
                    <div className="flex gap-1.5">
                      {(["A", "B"] as const).map((side) => (
                        <button key={side} type="button" aria-pressed={myVote === side} title={proposal.votes[side].join(", ") || undefined} onClick={() => onChange(voteProposal(liveScore, proposal.id, userName, side), `${userName} voted ${side}`, target?.name ?? "")} className={cn("h-7 flex-1 rounded-full text-xs transition-colors", myVote === side ? "bg-human-ink text-white" : "bg-white text-black hover:bg-stone")}>{t.voteFor(side, proposal.votes[side].length)}</button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => { setPreviewId(null); onChange(acceptProposal(liveScore, proposal.id), `Accepted ${target?.name ?? ""} variation B`, proposal.note || ""); }} className="h-8 flex-1 rounded-full bg-black text-[13px] text-white transition-colors hover:bg-ink-700">{t.acceptB}</button>
                      <button type="button" onClick={() => { setPreviewId(null); onChange(rejectProposal(liveScore, proposal.id), `Kept ${target?.name ?? ""} as A`, ""); }} className="h-8 rounded-full bg-white px-3 text-[13px] shadow-ring transition-colors hover:bg-cream">{t.keepA}</button>
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 grid shrink-0 grid-cols-[208px_minmax(0,1fr)] border-y border-stone">
        <div className="flex h-8 items-center border-b border-r border-stone px-3 text-xs text-ink-600">{t.sections}</div>
        <div className="relative h-8 border-b border-stone">
          {score.sections.filter((item) => item.startBar < fromBar + barCount && item.startBar + item.bars > fromBar).map((item) => (
            <button key={item.id} type="button" onClick={() => setSectionId(item.id === sectionId ? null : item.id)} className={cn("absolute inset-y-1 mx-0.5 truncate rounded-full px-3 text-left text-xs transition-colors", item.id === sectionId ? "bg-human-ink text-white" : "bg-cream text-ink-700 hover:bg-stone")} style={{ left: `${percent(Math.max(item.startBar, fromBar) * beatsPerBar)}%`, width: `calc(${(Math.min(item.bars, fromBar + barCount - item.startBar) / barCount) * 100}% - 4px)` }}>{item.name}</button>
          ))}
        </div>
        <div className="flex h-9 items-center justify-between border-b border-r border-stone px-3 text-xs text-ink-600"><span>{t.chords}</span><span className="font-mono">{score.key}</span></div>
        <div className="relative grid h-9 border-b border-stone" style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: barCount }, (_, index) => {
            const bar = fromBar + index;
            return (
              <div key={bar} className="relative border-l border-stone first:border-l-0">
                <button type="button" disabled={readOnly} onClick={() => setChordMenuBar(chordMenuBar === bar ? null : bar)} aria-haspopup="listbox" aria-expanded={chordMenuBar === bar} aria-label={`Bar ${bar + 1} chord ${score.chords[bar] || "none"}`} className={cn("flex h-full w-full items-center justify-center font-mono text-xs transition-colors hover:bg-cream", score.chords[bar] ? "text-black" : "text-ink-400")}>
                  {score.chords[bar] || "·"}
                </button>
                {chordMenuBar === bar ? (
                  <div role="listbox" className="absolute left-0 top-full z-30 mt-1 flex w-28 flex-col rounded-xl bg-white p-1 shadow-ring">
                    {[...diatonic, ""].map((symbol) => (
                      <button key={symbol || "none"} type="button" role="option" aria-selected={score.chords[bar] === symbol} onClick={() => { setChordMenuBar(null); onChange(setChord(score, bar, symbol), `Bar ${bar + 1} chord`, symbol || "none"); }} className={cn("h-7 rounded-lg px-2 text-left font-mono text-xs hover:bg-cream", score.chords[bar] === symbol && "bg-human-wash text-human-ink")}>{symbol || t.noChord}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {score.parts.map((item) => {
          const suggestion = isSuggestion(item);
          const active = item.id === part?.id;
          const [low, high] = item.role === "drums" ? [35, 43] : ROLE_ROWS[item.role];
          return [
            <div key={`${item.id}-head`} className={cn("flex h-14 flex-col justify-center gap-1 border-b border-r border-stone px-3", active && "bg-cream")}>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPartId(item.id)} className="min-w-0 flex-1 truncate text-left text-sm">{item.name}</button>
                <button type="button" disabled={readOnly} onClick={() => onChange(updatePart(score, item.id, { muted: !item.muted }), item.muted ? `Unmuted ${item.name}` : `Muted ${item.name}`, "")} aria-pressed={Boolean(item.muted)} aria-label={item.muted ? t.unmute : t.mute} className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px] transition-colors disabled:opacity-40", item.muted ? "bg-black text-white" : "bg-stone text-black")}>M</button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("truncate rounded-full px-1.5 text-[11px]", suggestion ? "border border-dashed border-copilot bg-copilot-wash text-copilot-ink" : item.source === "copilot" ? "bg-copilot-wash text-copilot-ink" : "bg-human-wash text-human-ink")}>{suggestion ? t.suggestion : item.source === "copilot" ? t.copilotKept : t.human}</span>
                {suggestion && !readOnly ? (
                  <>
                    <button type="button" onClick={() => onChange(keepPart(score, item.id), `Kept ${item.name}`, "Copilot part kept")} className="ml-auto h-6 rounded-full bg-black px-2 text-[11px] text-white">{t.keep}</button>
                    <button type="button" onClick={() => { if (partId === item.id) setPartId(null); onChange(discardPart(score, item.id), `Discarded ${item.name}`, "Copilot part removed"); }} aria-label={`${t.discard} ${item.name}`} className="grid h-6 w-6 place-items-center rounded-full text-ink-600 hover:bg-stone"><Trash2 className="h-3 w-3" /></button>
                  </>
                ) : null}
              </div>
            </div>,
            <button key={`${item.id}-lane`} type="button" onClick={() => setPartId(item.id)} aria-label={`Edit ${item.name}`} className={cn("relative h-14 overflow-hidden border-b border-stone text-left", active ? "bg-cream/70" : "hover:bg-cream/50", item.muted && "opacity-45")}>
              {item.notes.filter((note) => note.start >= fromBeat && note.start < fromBeat + visibleBeats).map((note) => (
                <i key={note.id} className={cn("absolute h-[3px] rounded-sm", suggestion ? "bg-copilot" : "bg-human")} style={{ left: `${percent(note.start)}%`, width: `${Math.max(0.4, (note.duration / visibleBeats) * 100)}%`, top: `${8 + (1 - (Math.min(high, Math.max(low, note.midi)) - low) / Math.max(1, high - low)) * 38}px` }} />
              ))}
              {beat !== null ? <span className="absolute inset-y-0 w-[1.5px] bg-black" style={{ left: `${percent(beat)}%` }} /> : null}
            </button>,
          ];
        })}
      </div>

      <div className="flex min-h-[320px] flex-1 shrink-0 flex-col px-4 pb-4 pt-3">
        {part ? (
          <>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-display text-xl font-light tracking-[-0.01em]">{part.name}</h3>
              <span className="text-xs text-ink-600">{section ? `${section.name} · bars ${section.startBar + 1}–${section.startBar + section.bars}` : `bars 1–${score.bars}`} · {part.notes.length} notes</span>
              <span className="ml-auto text-xs text-ink-600">{readOnly ? t.viewOnly : t.rollHint}</span>
            </div>
            <div className="grid max-h-[460px] min-h-[200px] flex-1 grid-cols-[52px_minmax(0,1fr)] overflow-auto rounded-2xl bg-white shadow-[inset_0_0_0_1px_var(--stone)]">
              <div className="sticky left-0 z-10 border-r border-stone bg-white">
                {rows.map((row) => (
                  <div key={row.midi} className={cn("flex items-center justify-end border-b border-cream pr-1.5 font-mono text-[10px]", "black" in row && row.black ? "bg-ink-700 text-white" : "text-ink-600")} style={{ height: ROW_HEIGHT }}>{row.label}</div>
                ))}
              </div>
              <div
                ref={rollRef}
                role="grid"
                aria-label={`${part.name} piano roll`}
                tabIndex={0}
                onPointerDown={onRollPointerDown}
                onPointerMove={onRollPointerMove}
                onPointerUp={onRollPointerUp}
                onPointerCancel={onRollPointerUp}
                className={cn("relative min-w-[640px]", readOnly ? "cursor-default" : "cursor-crosshair")}
                style={{
                  height: rows.length * ROW_HEIGHT,
                  backgroundImage: "linear-gradient(90deg, var(--stone) 1px, transparent 1px), linear-gradient(90deg, var(--cream) 1px, transparent 1px)",
                  backgroundSize: `calc(100% / ${barCount}) 100%, calc(100% / ${visibleBeats}) 100%`,
                }}
              >
                {rows.map((row, index) => <div key={row.midi} aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 border-b border-cream", "inKey" in row && !row.inKey && "bg-[#f8f6f4]/70")} style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }} />)}
                {notes.filter((note) => note.start >= fromBeat && note.start < fromBeat + visibleBeats && rowIndex(note.midi) >= 0).map((note) => {
                  const selected = note.id === selectedNoteId;
                  return (
                    <div
                      key={note.id}
                      role="gridcell"
                      aria-label={`${midiToName(note.midi)} at beat ${note.start + 1}`}
                      aria-selected={selected}
                      onPointerDown={(event) => onNotePointerDown(event, note)}
                      onDoubleClick={() => deleteNote(note.id)}
                      className={cn(
                        "absolute rounded-[4px]",
                        isSuggestion(part) ? "border-[1.5px] border-dashed border-copilot bg-copilot-wash" : "bg-human",
                        selected && "ring-2 ring-black ring-offset-1 ring-offset-white",
                        !readOnly && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{ left: `${percent(note.start)}%`, width: `calc(${(Math.min(note.duration, fromBeat + visibleBeats - note.start) / visibleBeats) * 100}% - 1px)`, top: rowIndex(note.midi) * ROW_HEIGHT + 1, height: ROW_HEIGHT - 2 }}
                    >
                      {!readOnly && part.role !== "drums" ? <span aria-hidden="true" className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" /> : null}
                    </div>
                  );
                })}
                {beat !== null ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-[1.5px] bg-black" style={{ left: `${percent(beat)}%` }} /> : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-600">{t.selectPart}</p>
        )}
      </div>
    </div>
  );
}
