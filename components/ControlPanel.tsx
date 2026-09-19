"use client";

import { Pause, Play, Plus, SkipBack, SkipForward, Upload } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";

type ControlPanelProps = {
  uploadedFileName: string;
  onAudioUpload: (file: File) => void;
};

export function ControlPanel({ uploadedFileName, onAudioUpload }: ControlPanelProps) {
  return (
    <div className="rounded-[28px] border border-white/14 bg-white/[0.07] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" title="Skip back">
            <SkipBack className="h-4 w-4" />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[#58e081] text-[#071014] shadow-[0_0_30px_rgba(88,224,129,0.22)] transition hover:bg-[#75efa0]" title="Play">
            <Play className="h-5 w-5 fill-current" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" title="Pause">
            <Pause className="h-4 w-4" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" title="Skip forward">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 text-sm text-white/60">
            79 BPM · 4/4 · Event sync
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2 text-sm font-medium text-white shadow-glass backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/14 active:scale-[0.98]">
            <Upload className="h-4 w-4" />
            Upload audio
            <input
              className="sr-only"
              type="file"
              accept="audio/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAudioUpload(file);
              }}
            />
          </label>
          <GlassButton icon={Plus} className="py-2">
            Add track
          </GlassButton>
          <div className="max-w-[260px] truncate rounded-full border border-[#58e081]/24 bg-[#58e081]/10 px-4 py-2 text-sm text-white/68">
            {uploadedFileName}
          </div>
        </div>
      </div>
    </div>
  );
}
