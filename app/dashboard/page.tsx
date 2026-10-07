"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, RadioTower, Search, Trash2 } from "@/components/Icons";
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
  currentRole?: "owner" | "editor" | "viewer";
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
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [workingRoomId, setWorkingRoomId] = useState<string | null>(null);

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

  const deleteRoom = async (room: RoomSummary) => {
    if (room.id === "demo" || deletingRoomId) return;
    if (!window.confirm(`Delete “${room.title}” and its uploaded audio? This cannot be undone.`)) return;

    setDeletingRoomId(room.id);
    setRoomStatus(`Deleting ${room.title}`);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete room");
      setRooms((current) => current.filter((item) => item.id !== room.id));
      setRoomStatus("Room deleted");
    } catch {
      setRoomStatus("Could not delete room");
    } finally {
      setDeletingRoomId(null);
    }
  };

  const renameRoom = async (room: RoomSummary) => {
    const title = window.prompt("Rename room", room.title)?.trim();
    if (!title || title === room.title || workingRoomId) return;
    setWorkingRoomId(room.id);
    setRoomStatus(`Renaming ${room.title}`);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.slice(0, 60) }),
      });
      if (!response.ok) throw new Error("Unable to rename room");
      const data = await response.json() as { room: RoomSummary };
      setRooms((current) => current.map((item) => item.id === room.id ? data.room : item));
      setRoomStatus("Room renamed");
    } catch {
      setRoomStatus("Could not rename room");
    } finally {
      setWorkingRoomId(null);
    }
  };

  const duplicateRoom = async (room: RoomSummary) => {
    if (workingRoomId) return;
    const title = `${room.title} copy`;
    const id = roomIdFromTitle(title);
    setWorkingRoomId(room.id);
    setRoomStatus(`Duplicating ${room.title}`);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title, sourceRoomId: room.id }),
      });
      if (!response.ok) throw new Error("Unable to duplicate room");
      const data = await response.json() as { room: RoomSummary };
      setRooms((current) => [data.room, ...current]);
      setRoomStatus("Room duplicated with its project data");
    } catch {
      setRoomStatus("Could not duplicate room");
    } finally {
      setWorkingRoomId(null);
    }
  };

  return (
    <main className="dashboard-page relative min-h-screen bg-[#f7f7f5]">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[#172033]/48">Workspace</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[#172033] sm:text-6xl">
              Choose a music room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#172033]/62">
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
                <div
                  key={room.id}
                  className="group relative rounded-3xl border border-white/10 bg-white/[0.055] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <Link href={`/room/${encodeURIComponent(room.id)}`} className="block pr-24">
                    <span
                      className="block h-2.5 w-10 rounded-full"
                      style={{ background: ["#235fba", "#b71912", "#efd84c", "#58e081"][index % 4] }}
                    />
                    <h3 className="mt-5 text-sm font-semibold text-white">{room.title}</h3>
                    <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-medium capitalize text-white/52">{room.currentRole ?? "viewer"}</span>
                    <p className="mt-2 truncate text-xs text-white/46">{room.uploadedFileName || "No audio uploaded"}</p>
                    <p className="mt-3 text-[11px] text-white/30">
                      {room.events?.length ?? 0} events · {room.notes?.length ?? 0} notes
                    </p>
                  </Link>
                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white" onClick={() => duplicateRoom(room)} disabled={workingRoomId === room.id} title="Duplicate room"><Copy className="h-4 w-4" /></button>
                    {room.currentRole === "owner" ? <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white" onClick={() => renameRoom(room)} disabled={workingRoomId === room.id} title="Rename room"><Pencil className="h-4 w-4" /></button> : null}
                  {room.id !== "demo" && room.currentRole === "owner" ? (
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white"
                      onClick={() => deleteRoom(room)}
                      disabled={deletingRoomId === room.id}
                      title="Delete room"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                  </div>
                </div>
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
