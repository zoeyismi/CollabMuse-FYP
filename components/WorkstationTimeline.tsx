"use client";

import { useRoomText } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Copy, Scissors, Sparkles, Trash2 } from "@/components/Icons";
import type { AudioClip, RoomNote, TimelineRegion, Track } from "@/lib/mock-data";
import { notePosition } from "@/lib/note-position";

type Props = {
  readOnly?: boolean;
  tracks: Track[];
  regions: TimelineRegion[];
  notes: RoomNote[];
  uploadedFileName: string;
  waveformPeaks?: number[] | null;
  audioClips: AudioClip[];
  bpm: number;
  playheadPosition?: number;
  onSelectionAction: (label: string, regionId?: string) => void;
  onUseAIContext: (regionId?: string) => void;
  onRegionsChange: (regions: TimelineRegion[], changed: TimelineRegion, mode: "move" | "resize-start" | "resize-end") => void;
  snapMode: "Bar" | "Beat" | "Off";
  onPlayheadSeek: (position: number) => void;
  onSelectionChange: (regionId: string | null) => void;
};

type Drag = { id: string; mode: "move" | "resize-start" | "resize-end"; x: number; y: number; left: number; width: number; lane: number };
const fallbackBars = [24,38,52,31,46,28,57,35,42,26,49,34,55,30,44,22,50,37,58,29,45,33,53,27,41,36,56,25,48,32,52,30,43,24,54,35,46,28,59,31,47,26,51,34,44,29,55,32];

/** Shared with TrackList so each track header lines up with its lane. */
export const LANE_HEIGHT = 96;

export function WorkstationTimeline({ readOnly = false, tracks, regions, notes, uploadedFileName, waveformPeaks, audioClips, bpm, playheadPosition = 52, onSelectionAction, onUseAIContext, onRegionsChange, snapMode, onPlayheadSeek, onSelectionChange }: Props) {
  const tr = useRoomText();
  const [draft, setDraft] = useState(regions);
  const [selectedId, setSelectedId] = useState(regions[2]?.id ?? regions[0]?.id ?? "");
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const seekingRef = useRef(false);

  useEffect(() => {
    if (!dragRef.current) setDraft(regions);
  }, [regions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        setSelectedId("");
        onSelectionChange(null);
        return;
      }
      if (!selectedId || readOnly) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onSelectionAction("Delete", selectedId);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        onSelectionAction("Duplicate", selectedId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectionAction, onSelectionChange, readOnly, selectedId]);

  const start = (event: ReactPointerEvent<HTMLElement>, region: TimelineRegion, mode: Drag["mode"]) => {
    event.preventDefault(); event.stopPropagation();
    setSelectedId(region.id);
    onSelectionChange(region.id);
    if (readOnly) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: region.id, mode, x: event.clientX, y: event.clientY, left: region.left, width: region.width, lane: region.lane ?? 0 };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragRef.current;
    const width = timelineRef.current?.getBoundingClientRect().width ?? 0;
    if (!state || !width) return;
    const delta = ((event.clientX - state.x) / width) * 100;
    const grid = snapMode === "Bar" ? 100 / 32 : snapMode === "Beat" ? 100 / 128 : 0;
    const snap = (value: number) => grid ? Math.round(value / grid) * grid : value;
    setDraft((current) => current.map((region) => {
      if (region.id !== state.id) return region;
      if (state.mode === "move") {
        const laneDelta = Math.round((event.clientY - state.y) / 130);
        return {
          ...region,
          left: Math.max(0, Math.min(100 - state.width, snap(state.left + delta))),
          lane: Math.max(0, Math.min(visibleTracks.length - 1, state.lane + laneDelta)),
        };
      }
      if (state.mode === "resize-start") {
        const right = state.left + state.width;
        const left = Math.max(0, Math.min(right - 5, snap(state.left + delta)));
        return { ...region, left, width: right - left };
      }
      return { ...region, width: Math.max(5, Math.min(100 - state.left, snap(state.width + delta))) };
    }));
  };
  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragRef.current;
    if (!state) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    const changed = draft.find((region) => region.id === state.id);
    if (changed) onRegionsChange(draft, changed, state.mode);
  };

  const updatePlayhead = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onPlayheadSeek(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)));
  };

  const beginPlayheadSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    seekingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePlayhead(event);
  };

  const dragPlayhead = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (seekingRef.current) updatePlayhead(event);
  };

  const finishPlayheadSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekingRef.current) return;
    seekingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    updatePlayhead(event);
  };

  const fallbackWaveform = waveformPeaks?.length ? waveformPeaks : fallbackBars;
  const visibleTracks = tracks.slice(0, 12);
  const selected = draft.find((region) => region.id === selectedId);
  const selectedClip = audioClips.find((clip) => clip.id === selected?.clipId);

  return (
    <section className="workstation-timeline flex min-h-0 flex-1 flex-col bg-canvas text-black">
      <div className="workstation-ruler h-14 shrink-0 border-b border-stone font-mono text-[11px] text-ink-600">
        {[1,5,9,13,17,21,25,29,33].map((bar) => <span key={bar} className="flex items-end border-l border-stone pb-2 pl-1.5">{bar}</span>)}
      </div>
      <div ref={timelineRef} id="timeline-lanes-scroll" onScroll={(event) => { const list = document.getElementById("track-list-scroll"); if (list && list.scrollTop !== event.currentTarget.scrollTop) list.scrollTop = event.currentTarget.scrollTop; }} className="workstation-timeline-lanes timeline-bars relative min-h-[420px] flex-1 cursor-crosshair overflow-y-auto overflow-x-hidden sm:min-h-[520px]" onPointerDown={beginPlayheadSeek} onPointerMove={dragPlayhead} onPointerUp={finishPlayheadSeek} onPointerCancel={finishPlayheadSeek}>
        <div className="absolute bottom-0 top-0 z-30 w-[1.5px] bg-black transition-[left] duration-100 ease-linear will-change-[left]" style={{ left: `${playheadPosition}%` }}><span className="absolute -top-0.5 left-[0.75px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black" /></div>
        {visibleTracks.map((track, lane) => {
          const laneRegions = draft.filter((region, index) => (region.lane ?? Math.min(index, visibleTracks.length - 1)) === lane);
          return (
            <div key={track.id} className="relative border-b border-stone" style={{ height: LANE_HEIGHT }}>
              {laneRegions.map((region) => {
                const isSelected = region.id === selectedId;
                const clipWaveform = audioClips.find((clip) => clip.id === region.clipId)?.waveformPeaks;
                const bars = clipWaveform?.length ? clipWaveform : fallbackWaveform;
                return (
                <button
                  key={region.id}
                  type="button"
                  title={!region.clipId ? tr("Example region: no audio attached") : !audioClips.some((clip) => clip.id === region.clipId) ? tr("Audio clip is unavailable") : region.label}
                  className={`workstation-region ${isSelected ? "is-selected" : ""}`}
                  style={{ left: `${region.left}%`, width: `${region.width}%` }}
                  onPointerDown={(event) => start(event, region, "move")}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerCancel={finish}
                >
                  <span className="workstation-region-label">{region.clipId ? region.label : lane === 1 ? uploadedFileName : region.label || track.name}</span>
                  <svg className="workstation-region-waveform" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                    {bars.map((height, index) => { const x=(index/Math.max(1,bars.length-1))*100; const h=Math.min(44,Math.max(10,height*.7)); return <line key={index} x1={x} x2={x} y1={30-h/2} y2={30+h/2} stroke="currentColor" strokeWidth=".45" />; })}
                  </svg>
                  {isSelected && !readOnly ? <><span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/18" onPointerDown={(event)=>start(event,region,"resize-start")} onPointerMove={move} onPointerUp={finish} /><span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/18" onPointerDown={(event)=>start(event,region,"resize-end")} onPointerMove={move} onPointerUp={finish} /></> : null}
                </button>
                );
              })}
            </div>
          );
        })}
        {notes.filter((note)=>typeof note.position==="number").map((note)=><span key={note.id} className={`absolute top-2 z-40 -translate-x-1/2 rounded-full border-2 border-cream ${note.resolved ? "h-2 w-2 bg-ink-400" : "h-2.5 w-2.5 bg-human"}`} style={{left:`${notePosition(note, draft)}%`}} title={`${note.resolved ? "Resolved · " : ""}${note.author}: ${note.message}`} />)}
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-1 border-t border-stone bg-canvas px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1 text-xs text-ink-700">
          <button className="workstation-tool" disabled={readOnly || !selected || selected.width < 10} onClick={()=>onSelectionAction(tr("Split"), selected?.id)} title={tr("Split selection")}><Scissors className="h-4 w-4" />{tr("Split")}</button>
          <button className="workstation-tool" disabled={readOnly || !selected} onClick={()=>onSelectionAction(tr("Duplicate"), selected?.id)} title={tr("Duplicate selection")}><Copy className="h-4 w-4" />{tr("Duplicate")}</button>
          <button className="workstation-tool" disabled={readOnly || !selected} onClick={()=>onSelectionAction(tr("Delete"), selected?.id)} title={tr("Delete selection")}><Trash2 className="h-4 w-4" />{tr("Delete")}</button>
          <button className="workstation-tool text-copilot-ink" disabled={readOnly || !selectedClip} onClick={() => onUseAIContext(selected?.id)} title={selectedClip ? tr("Use selected audio clip as AI context") : tr("Select an uploaded audio clip first")}><Sparkles className="h-4 w-4" />{tr("AI context")}</button>
        </div>
        <p className="hidden font-mono text-xs text-ink-600 sm:block">{selected?.label ?? tr("No selection")} · Session {bpm} BPM{selected && !selected.clipId ? " · Example, no audio" : selected?.clipId && !selectedClip ? " · Audio unavailable" : selectedClip?.analysis?.energy ? ` · ${selectedClip.analysis.energy} energy` : ""}</p>
      </div>
    </section>
  );
}
