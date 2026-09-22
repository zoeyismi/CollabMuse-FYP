"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, MousePointer2, RadioTower, SlidersHorizontal } from "@/components/Icons";
import { initialTimelineRegions } from "@/lib/mock-data";
import type { RoomNote, TimelineRegion } from "@/lib/mock-data";

const bars = [
  18, 30, 42, 28, 52, 36, 24, 34, 46, 22, 28, 40, 33, 50, 26, 20, 38, 44, 24, 30, 54, 36, 28, 46,
  34, 24, 40, 58, 32, 44, 28, 36, 52, 22, 31, 46, 28, 40, 56, 34, 25, 48, 36, 30, 42, 26, 50, 38,
  24, 34, 54, 30, 43, 28, 36, 46, 22, 40, 58, 32, 45, 27, 35, 50, 30, 24, 42, 56, 34, 28, 46, 32,
  22, 38, 52, 30, 44, 26, 36, 48, 28, 40, 55, 32, 24, 46, 34, 28, 42, 50, 30, 38, 24, 44, 32, 20,
];

const tools = [
  { label: "Move clip", icon: MousePointer2, color: "#b71912" },
  { label: "Sync edit", icon: RadioTower, color: "#235fba" },
  { label: "Mark section", icon: SlidersHorizontal, color: "#efd84c" },
  { label: "Add note", icon: MessageCircle, color: "#58e081" },
];

type WaveformEditorProps = {
  compact?: boolean;
  uploadedFileName?: string;
  waveformPeaks?: number[] | null;
  regions?: TimelineRegion[];
  notes?: RoomNote[];
  onSelectionAction?: (label: string) => void;
  onRegionsChange?: (
    regions: TimelineRegion[],
    changedRegion: TimelineRegion,
    mode: "move" | "resize-start" | "resize-end",
  ) => void;
};

type ActiveDrag = {
  regionId: string;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  initialLeft: number;
  initialWidth: number;
};

function getBarColor(position: number, regions: TimelineRegion[]) {
  const activeRegion = regions.find(
    (region) => position >= region.left && position <= region.left + region.width,
  );

  if (activeRegion) return activeRegion.color;
  return "rgba(247,250,248,0.56)";
}

function getDisplayBars(fileName: string) {
  const source = fileName.length > 0 ? fileName : "always-reference.wav";

  return bars.map((height, index) => {
    const code = source.charCodeAt(index % source.length);
    const variation = ((code + index * 13) % 17) - 8;
    return Math.min(62, Math.max(18, height + variation));
  });
}

export function WaveformEditor({
  compact = false,
  uploadedFileName = "always-reference.wav",
  waveformPeaks,
  regions = initialTimelineRegions,
  notes = [],
  onSelectionAction,
  onRegionsChange,
}: WaveformEditorProps) {
  const displayBars = waveformPeaks?.length ? waveformPeaks : getDisplayBars(uploadedFileName);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const draftRegionsRef = useRef<TimelineRegion[]>(regions);
  const [draftRegions, setDraftRegions] = useState<TimelineRegion[]>(regions);

  useEffect(() => {
    if (activeDragRef.current) return;
    draftRegionsRef.current = regions;
    setDraftRegions(regions);
  }, [regions]);

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    region: TimelineRegion,
    mode: ActiveDrag["mode"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDragRef.current = {
      regionId: region.id,
      mode,
      startX: event.clientX,
      initialLeft: region.left,
      initialWidth: region.width,
    };
  };

  const dragRegion = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = activeDragRef.current;
    const timeline = timelineRef.current;
    if (!drag || !timeline) return;

    const timelineWidth = timeline.getBoundingClientRect().width;
    if (timelineWidth <= 0) return;
    const delta = ((event.clientX - drag.startX) / timelineWidth) * 100;
    const minWidth = 5;

    const nextRegions = draftRegionsRef.current.map((region) => {
      if (region.id !== drag.regionId) return region;

      if (drag.mode === "move") {
        return {
          ...region,
          left: Math.max(0, Math.min(100 - drag.initialWidth, drag.initialLeft + delta)),
        };
      }

      if (drag.mode === "resize-start") {
        const right = drag.initialLeft + drag.initialWidth;
        const left = Math.max(0, Math.min(right - minWidth, drag.initialLeft + delta));
        return { ...region, left, width: right - left };
      }

      return {
        ...region,
        width: Math.max(minWidth, Math.min(100 - drag.initialLeft, drag.initialWidth + delta)),
      };
    });

    draftRegionsRef.current = nextRegions;
    setDraftRegions(nextRegions);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = activeDragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeDragRef.current = null;
    const changedRegion = draftRegionsRef.current.find((region) => region.id === drag.regionId);
    if (changedRegion) onRegionsChange?.(draftRegionsRef.current, changedRegion, drag.mode);
  };

  return (
    <section
      className={`overflow-hidden rounded-[28px] border border-white/10 bg-[#05090b]/88 shadow-[0_22px_78px_rgba(0,0,0,0.28)] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`relative shrink-0 overflow-hidden rounded-[10px] border border-white/18 bg-[radial-gradient(circle_at_45%_42%,#58e081_0_7%,transparent_8%),radial-gradient(circle_at_34%_54%,#235fba_0_14%,transparent_15%),linear-gradient(145deg,#071f55,#05090b_58%,#0c1322)] shadow-[0_18px_46px_rgba(0,0,0,0.32)] ${
              compact ? "h-16 w-16" : "h-20 w-20"
            }`}
          >
            <div className="absolute inset-x-3 bottom-3 h-px bg-[#efd84c]/70" />
            <div className="absolute left-3 top-4 h-7 w-7 rounded-full bg-[#235fba]/60 blur-sm" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/36">Now editing</p>
            <h2 className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-semibold leading-tight text-white`}>
              Always
            </h2>
            <p className="mt-1 text-sm text-white/48">Daniel Caesar · R&B</p>
            <p className="mt-1 max-w-[220px] truncate text-xs text-white/32">Source clip · {uploadedFileName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              aria-label={`Trigger ${tool.label} action`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/72 transition hover:border-white/18 hover:bg-white/[0.075]"
              onClick={() => onSelectionAction?.(tool.label)}
            >
              <tool.icon className="h-4 w-4" style={{ color: tool.color }} />
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={timelineRef}
        className={`relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#071014]/62 ${
          compact ? "h-[150px]" : "h-[210px]"
        }`}
      >
        <div className="absolute inset-x-5 top-1/2 z-0 h-px -translate-y-1/2 bg-white/12" />
        <div className="absolute inset-x-5 top-1/2 z-30 h-[92px] -translate-y-1/2">
          <svg
            className="h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {displayBars.map((height, index) => {
              const x = (index / (displayBars.length - 1)) * 100;
              const lineHeight = Math.min(76, Math.max(20, height * 1.22));
              return (
                <line
                  key={index}
                  x1={x}
                  x2={x}
                  y1={50 - lineHeight / 2}
                  y2={50 + lineHeight / 2}
                  stroke={getBarColor(x, draftRegions)}
                  strokeWidth={0.24}
                  strokeLinecap="round"
                  opacity={x >= 39 && x <= 64 ? 0.9 : 0.72}
                />
              );
            })}
          </svg>
        </div>
        {draftRegions.map((region) => (
          <button
            key={region.id}
            type="button"
            aria-label={`Move or resize ${region.label} region`}
            title={`Drag ${region.label}; use edge handles to resize`}
            className="group absolute bottom-6 top-6 z-40 cursor-grab touch-none rounded-xl border border-transparent bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-white/35 active:cursor-grabbing"
            style={{
              left: `${region.left}%`,
              width: `${region.width}%`,
            }}
            onPointerDown={(event) => beginDrag(event, region, "move")}
            onPointerMove={dragRegion}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <span
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-xl bg-white/0 transition group-hover:bg-white/10"
              onPointerDown={(event) => beginDrag(event, region, "resize-start")}
              onPointerMove={dragRegion}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
            <span
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-xl bg-white/0 transition group-hover:bg-white/10"
              onPointerDown={(event) => beginDrag(event, region, "resize-end")}
              onPointerMove={dragRegion}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          </button>
        ))}
        {notes
          .filter((note) => typeof note.position === "number")
          .map((note, index) => (
            <span
              key={note.id}
              className="group/note absolute top-3 z-50 -translate-x-1/2"
              style={{ left: `${note.position}%` }}
            >
              <span
                className="block h-3 w-3 rounded-full border-2 border-[#071014] shadow-[0_0_0_2px_rgba(255,255,255,0.55)]"
                style={{ background: ["#b71912", "#235fba", "#efd84c", "#58e081"][index % 4] }}
              />
              <span className="absolute left-1/2 top-4 hidden w-48 -translate-x-1/2 rounded-xl border border-white/12 bg-[#10171b]/95 p-3 text-left text-[11px] leading-4 text-white/70 shadow-xl group-hover/note:block">
                <strong className="mb-1 block text-white">{note.author}</strong>
                {note.message}
              </span>
            </span>
          ))}
      </div>
    </section>
  );
}
