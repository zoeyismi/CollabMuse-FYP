"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Upload } from "@/components/Icons";

type ControlPanelProps = {
  uploadedFileName: string;
  uploadedAudioUrl: string | null;
  onAudioUpload: (file: File) => void;
};

export function ControlPanel({ uploadedFileName, uploadedAudioUrl, onAudioUpload }: ControlPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const stop = () => setIsPlaying(false);
    audio.addEventListener("ended", stop);
    audio.addEventListener("pause", stop);
    return () => {
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("pause", stop);
    };
  }, [uploadedAudioUrl]);

  const play = async () => {
    if (!audioRef.current || !uploadedAudioUrl) return;
    await audioRef.current.play();
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !uploadedAudioUrl) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  };

  return (
    <div className="rounded-[28px] border border-white/14 bg-white/[0.07] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <audio ref={audioRef} src={uploadedAudioUrl ?? undefined} preload="metadata" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-30"
            title="Skip back 10 seconds"
            disabled={!uploadedAudioUrl}
            onClick={() => seekBy(-10)}
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#58e081] text-[#071014] shadow-[0_0_30px_rgba(88,224,129,0.22)] transition hover:bg-[#75efa0] disabled:cursor-not-allowed disabled:opacity-35"
            title="Play uploaded audio"
            disabled={!uploadedAudioUrl || isPlaying}
            onClick={play}
          >
            <Play className="h-5 w-5 fill-current" />
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-30"
            title="Pause"
            disabled={!uploadedAudioUrl || !isPlaying}
            onClick={pause}
          >
            <Pause className="h-4 w-4" />
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-30"
            title="Skip forward 10 seconds"
            disabled={!uploadedAudioUrl}
            onClick={() => seekBy(10)}
          >
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
          <div className="max-w-[260px] truncate rounded-full border border-[#58e081]/24 bg-[#58e081]/10 px-4 py-2 text-sm text-white/68">
            {uploadedFileName}
          </div>
        </div>
      </div>
    </div>
  );
}
