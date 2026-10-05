"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Copy, Scissors, Sparkles, Trash2 } from "@/components/Icons";
import type { AudioClip, RoomNote, TimelineRegion, Track } from "@/lib/mock-data";

type Props = {
  tracks: Track[];
  regions: TimelineRegion[];
  notes: RoomNote[];
  uploadedFileName: string;
  waveformPeaks?: number[] | null;
  audioClips: AudioClip[];
  playheadPosition?: number;
  onSelectionAction: (label: string, regionId?: string) => void;
  onRegionsChange: (regions: TimelineRegion[], changed: TimelineRegion, mode: "move" | "resize-start" | "resize-end") => void;
  snapMode: "Bar" | "Beat" | "Off";
  onPlayheadSeek: (position: number) => void;
};

type Drag = { id: string; mode: "move" | "resize-start" | "resize-end"; x: number; y: number; left: number; width: number; lane: number };
const fallbackBars = [24,38,52,31,46,28,57,35,42,26,49,34,55,30,44,22,50,37,58,29,45,33,53,27,41,36,56,25,48,32,52,30,43,24,54,35,46,28,59,31,47,26,51,34,44,29,55,32];

export function WorkstationTimeline({ tracks, regions, notes, uploadedFileName, waveformPeaks, audioClips, playheadPosition = 52, onSelectionAction, onRegionsChange, snapMode, onPlayheadSeek }: Props) {
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
        return;
      }
      if (!selectedId) return;
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
  }, [onSelectionAction, selectedId]);

  const start = (event: ReactPointerEvent<HTMLElement>, region: TimelineRegion, mode: Drag["mode"]) => {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(region.id);
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

  return (
    <section className="workstation-timeline flex min-h-0 flex-1 flex-col bg-[#f1f0eb] text-[#151922]">
      <div className="workstation-ruler h-14 shrink-0 border-b border-[#18202a]/10 px-4 text-[11px] text-[#18202a]/42">
        {[1,5,9,13,17,21,25,29,33].map((bar) => <span key={bar} className="border-l border-[#18202a]/8 pl-2 pt-3">{bar}</span>)}
      </div>
      <div ref={timelineRef} className="relative min-h-[520px] flex-1 cursor-crosshair overflow-y-auto overflow-x-hidden bg-[linear-gradient(90deg,rgba(25,34,46,.07)_1px,transparent_1px)] bg-[size:6.25%_100%]" onPointerDown={beginPlayheadSeek} onPointerMove={dragPlayhead} onPointerUp={finishPlayheadSeek} onPointerCancel={finishPlayheadSeek}>
        <div className="absolute bottom-0 top-0 z-30 w-px bg-[#184eb6] transition-[left] duration-300" style={{ left: `${playheadPosition}%` }}><span className="absolute -top-1 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-[#184eb6]" /></div>
        {visibleTracks.map((track, lane) => {
          const laneRegions = draft.filter((region, index) => (region.lane ?? Math.min(index, visibleTracks.length - 1)) === lane);
          return (
            <div key={track.id} className="relative border-b border-[#18202a]/10" style={{ height: 130 }}>
              {laneRegions.map((region) => {
                const isSelected = region.id === selectedId;
                const clipWaveform = audioClips.find((clip) => clip.id === region.clipId)?.waveformPeaks;
                const bars = clipWaveform?.length ? clipWaveform : fallbackWaveform;
                return (
                <button
                  key={region.id}
                  type="button"
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
                  {isSelected ? <><span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/18" onPointerDown={(event)=>start(event,region,"resize-start")} onPointerMove={move} onPointerUp={finish} /><span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/18" onPointerDown={(event)=>start(event,region,"resize-end")} onPointerMove={move} onPointerUp={finish} /></> : null}
                </button>
                );
              })}
            </div>
          );
        })}
        {notes.filter((note)=>typeof note.position==="number").map((note)=><span key={note.id} className="absolute top-2 z-40 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-[#f1f0eb] bg-[#184eb6]" style={{left:`${note.position}%`}} title={`${note.author}: ${note.message}`} />)}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-[#18202a]/10 bg-[#f7f5f0] px-3">
        <div className="flex items-center gap-1 text-xs text-[#172033]/68">
          <button className="workstation-tool" disabled={!selected || selected.width < 10} onClick={()=>onSelectionAction("Split", selected?.id)} title="Split selection"><Scissors className="h-4 w-4" />Split</button>
          <button className="workstation-tool" disabled={!selected} onClick={()=>onSelectionAction("Duplicate", selected?.id)} title="Duplicate selection"><Copy className="h-4 w-4" />Duplicate</button>
          <button className="workstation-tool" disabled={!selected} onClick={()=>onSelectionAction("Delete", selected?.id)} title="Delete selection"><Trash2 className="h-4 w-4" />Delete</button>
          <button className="workstation-tool text-[#123f91]" title="Use selection as AI context"><Sparkles className="h-4 w-4" />AI context</button>
        </div>
        <p className="text-[11px] text-[#172033]/42">{selected?.label ?? "No selection"} · 96 BPM · Medium energy</p>
      </div>
    </section>
  );
}
