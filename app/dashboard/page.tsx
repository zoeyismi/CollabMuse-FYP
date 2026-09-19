"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RadioTower, Search } from "@/components/Icons";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { DashboardProjectCarousel } from "@/components/DashboardProjectCarousel";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { Navbar } from "@/components/Navbar";

type RoomSummary = {
  id: string;
  title: string;
  uploadedFileName?: string;
  events?: unknown[];
  notes?: unknown[];
};

function roomIdFromTitle(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "music-room";

  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [search, setSearch] = useState("");
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomStatus, setRoomStatus] = useState("Loading saved rooms");

  useEffect(() => {
    let active = true;

    fetch("/api/rooms")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load rooms");
        return response.json() as Promise<{ rooms: RoomSummary[] }>;
      })
      .then((data) => {
        if (!active) return;
        setRooms(data.rooms);
        setRoomStatus(`${data.rooms.length} saved room${data.rooms.length === 1 ? "" : "s"}`);
      })
      .catch(() => {
        if (active) setRoomStatus("Room backend unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) =>
      [room.title, room.id, room.uploadedFileName].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [rooms, search]);

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newRoomTitle.trim();
    if (!title || isCreating) return;

    setIsCreating(true);
    setRoomStatus("Creating room");
    const id = roomIdFromTitle(title);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!response.ok) throw new Error("Unable to create room");
      router.push(`/room/${encodeURIComponent(id)}`);
    } catch {
      setRoomStatus("Could not create room");
      setIsCreating(false);
    }
  };

  return (
    <main className="relative min-h-screen">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-white/42">Workspace</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Choose a music room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/56">
              Create persistent rooms, reopen earlier sessions, and enter the shared editor with one link.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GlassButton icon={Plus} onClick={() => setShowCreate((current) => !current)}>
              Create new room
            </GlassButton>
            <GlassButton href="/room/demo" icon={RadioTower} variant="secondary">
              Enter demo room
            </GlassButton>
          </div>
        </div>

        {showCreate ? (
          <form
            className="mt-6 flex flex-col gap-3 rounded-[24px] border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl sm:flex-row"
            onSubmit={createRoom}
          >
            <input
              autoFocus
              className="min-w-0 flex-1 rounded-full border border-white/12 bg-black/20 px-5 py-3 text-sm text-white outline-none placeholder:text-white/32 focus:border-[#58e081]/60"
              value={newRoomTitle}
              onChange={(event) => setNewRoomTitle(event.target.value)}
              placeholder="Room name, for example: Chorus ideas"
              maxLength={60}
            />
            <GlassButton icon={Plus} disabled={!newRoomTitle.trim() || isCreating}>
              {isCreating ? "Creating..." : "Create and enter"}
            </GlassButton>
          </form>
        ) : null}

        <div className="mt-9">
          <DashboardProjectCarousel />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.42fr]">
          <GlassCard className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/38">Saved rooms</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Persistent room library</h2>
                <p className="mt-1 text-xs text-white/38">{roomStatus}</p>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-4 py-3 text-sm text-white/62">
                <Search className="h-4 w-4" />
                <input
                  className="w-40 bg-transparent outline-none placeholder:text-white/34"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search rooms"
                />
              </label>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {filteredRooms.map((room, index) => (
                <Link
                  key={room.id}
                  href={`/room/${encodeURIComponent(room.id)}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <span
                    className="block h-2.5 w-10 rounded-full"
                    style={{ background: ["#235fba", "#b71912", "#efd84c", "#58e081"][index % 4] }}
                  />
                  <h3 className="mt-5 text-sm font-semibold text-white">{room.title}</h3>
                  <p className="mt-2 truncate text-xs text-white/46">{room.uploadedFileName || "No audio uploaded"}</p>
                  <p className="mt-3 text-[11px] text-white/30">
                    {room.events?.length ?? 0} events · {room.notes?.length ?? 0} notes
                  </p>
                </Link>
              ))}
              {filteredRooms.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 p-6 text-sm text-white/42 sm:col-span-2">
                  No rooms match this search.
                </div>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-white/38">Live presence</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Collaborators online</h2>
            <CollaboratorAvatars names={["ZZ", "FC", "LM"]} className="mt-5" />
            <p className="mt-5 text-sm leading-7 text-white/52">
              The shared editor broadcasts timeline actions, uploads, and room notes between browser windows.
            </p>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-sm font-semibold text-white">Prototype status</p>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Dynamic rooms", "Ready"],
                  ["Waveform extraction", "Ready"],
                  ["Socket.io sync", "Ready"],
                  ["Persistent history", "Ready"],
                ].map(([label, status]) => (
                  <div key={label} className="flex items-center justify-between text-white/56">
                    <span>{label}</span>
                    <span className="rounded-full bg-[#58e081]/12 px-3 py-1 text-xs text-[#58e081]">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
