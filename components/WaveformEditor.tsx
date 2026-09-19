"use client";

import { MessageCircle, MousePointer2, RadioTower, SlidersHorizontal } from "@/components/Icons";
import { initialTimelineRegions } from "@/lib/mock-data";
import type { TimelineRegion } from "@/lib/mock-data";

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
  onSelectionAction?: (label: string) => void;
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
  onSelectionAction,
}: WaveformEditorProps) {
  const displayBars = waveformPeaks?.length ? waveformPeaks : getDisplayBars(uploadedFileName);

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
                  stroke={getBarColor(x, regions)}
                  strokeWidth={0.24}
                  strokeLinecap="round"
                  opacity={x >= 39 && x <= 64 ? 0.9 : 0.72}
                />
              );
            })}
          </svg>
        </div>
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            aria-label={`Trigger ${region.label} region action`}
            title={region.label}
            className="absolute bottom-6 top-6 z-40 cursor-pointer rounded-xl bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-white/35"
            style={{
              left: `${region.left}%`,
              width: `${region.width}%`,
            }}
            onClick={() => onSelectionAction?.(region.actionLabel)}
          />
        ))}
      </div>
    </section>
  );
}
