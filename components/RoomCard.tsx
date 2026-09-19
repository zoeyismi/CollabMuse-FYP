"use client";

import Link from "next/link";
import { ArrowUpRight, AudioLines } from "@/components/Icons";
import { GlassCard } from "@/components/GlassCard";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";

type RoomCardProps = {
  title: string;
  genre: string;
  status: string;
  updated: string;
  collaborators: string[];
  clips: number;
};

export function RoomCard({
  title,
  genre,
  status,
  updated,
  collaborators,
  clips,
}: RoomCardProps) {
  return (
    <div className="transition duration-300 hover:-translate-y-1">
      <Link href="/room/demo">
        <GlassCard className="group p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-sage">
              <AudioLines className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-white/35 transition group-hover:text-white" />
          </div>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.28em] text-brass/80">{status}</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-white/55">{genre}</p>
          </div>
          <div className="mt-7 flex items-center justify-between">
            <CollaboratorAvatars names={collaborators} />
            <div className="text-right text-xs text-white/48">
              <p>{clips} clips</p>
              <p>{updated}</p>
            </div>
          </div>
        </GlassCard>
      </Link>
    </div>
  );
}
