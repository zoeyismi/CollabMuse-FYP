"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { FormEvent, SVGProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AudioWaveform,
  Circle,
  CloudUpload,
  Copy,
  LayoutDashboard,
  Music2,
  Pencil,
  Plus,
  RadioTower,
  RotateCcw,
  Search,
  Trash2,
  UsersRound,
} from "@/components/Icons";

type RoomEvent = {
  id?: string;
  title?: string;
  detail?: string;
  time?: string;
  kind?: string;
};

type RoomNoteSummary = {
  resolved?: boolean;
};

type RoomSummary = {
  id: string;
  title: string;
  uploadedFileName?: string;
  events?: RoomEvent[];
  notes?: RoomNoteSummary[];
  audioClips?: unknown[];
  tracks?: unknown[];
  bpm?: number;
  updatedAt?: string;
  deletedAt?: string | null;
  currentRole?: "owner" | "editor" | "viewer";
};

type RoomFilter = "all" | "live" | "shared" | "owned" | "favorites";
type RoomSort = "recent" | "name" | "activity";

function StarRoomIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return <Star {...props} />;
}

const covers = [
  "/features/room-vinyl.jpg",
  "/features/clips-keyboard.jpg",
  "/features/events-turntable.jpg",
  "/features/notes-headphones.jpg",
];

const stageStyles = {
  Writing: "bg-[#edf3ff] text-[#315ba6]",
  Mixing: "bg-[#fcebee] text-[#9b3542]",
  Review: "bg-[#eaf5ed] text-[#35714d]",
};

function roomIdFromTitle(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "music-room";
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function roomStage(room: RoomSummary): keyof typeof stageStyles {
  if ((room.notes?.length ?? 0) >= 8) return "Review";
  if ((room.events?.length ?? 0) >= 8 || (room.audioClips?.length ?? 0) >= 6) return "Mixing";
  return "Writing";
}

function formatUpdated(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (elapsed < 172_800_000) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function parseJoinTarget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, window.location.origin);
    const roomMatch = url.pathname.match(/^\/room\/([^/]+)/);
    if (roomMatch) return `${url.pathname}${url.search}`;
  } catch {
    // Fall through to treating the value as a room ID.
  }
  return `/room/${encodeURIComponent(trimmed)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [favoriteRoomIds, setFavoriteRoomIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<RoomSort>("recent");
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomStatus, setRoomStatus] = useState("Loading rooms");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [workingRoomId, setWorkingRoomId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashRooms, setTrashRooms] = useState<RoomSummary[]>([]);
  const [trashError, setTrashError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importWarning, setImportWarning] = useState("");

  const loadRooms = useCallback(async (initial = false) => {
    if (initial) setIsLoadingRooms(true);
    else setIsRefreshingRooms(true);
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load rooms");
      const data = await response.json() as { rooms: RoomSummary[] };
      setRooms(data.rooms);
      setRoomsError(false);
      setRoomStatus(`${data.rooms.length} active room${data.rooms.length === 1 ? "" : "s"}`);
    } catch {
      setRoomsError(true);
      setRoomStatus("Room backend unavailable");
    } finally {
      setIsLoadingRooms(false);
      setIsRefreshingRooms(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms(true);
  }, [loadRooms]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("collabmuse-favorite-rooms");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) setFavoriteRoomIds(parsed);
      }
    } catch {
      setFavoriteRoomIds([]);
    }
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedRooms.filter((room) => {
      const matchesQuery = !query || [room.title, room.id, room.uploadedFileName].some((value) => value?.toLowerCase().includes(query));
      const matchesFilter = filter === "all"
        || (filter === "live" && room.id === "demo")
        || (filter === "shared" && room.currentRole !== "owner")
        || (filter === "owned" && room.currentRole === "owner")
        || (filter === "favorites" && favoriteRoomIds.includes(room.id));
      return matchesQuery && matchesFilter;
    });
  }, [favoriteRoomIds, filter, search, sortedRooms]);

  const displayedRooms = useMemo(() => {
    if (sortMode === "name") return [...filteredRooms].sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "activity") return [...filteredRooms].sort((a, b) => {
      const activityCount = (room: RoomSummary) => (room.events?.length ?? 0) + (room.notes?.length ?? 0) + (room.audioClips?.length ?? 0);
      return activityCount(b) - activityCount(a);
    });
    return filteredRooms;
  }, [filteredRooms, sortMode]);

  const latestRoom = sortedRooms[0];
  const projectRooms = rooms.filter((room) => room.id !== "demo");
  const clipCount = projectRooms.reduce((total, room) => total + (room.audioClips?.length ?? 0), 0);
  const noteCount = projectRooms.reduce((total, room) => total + (room.notes?.filter((note) => !note.resolved).length ?? 0), 0);
  const activity = sortedRooms.flatMap((room) => (room.events ?? []).slice(0, 2).map((event) => ({ room, event }))).slice(0, 4);

  const toggleFavorite = (roomId: string) => {
    setFavoriteRoomIds((current) => {
      const next = current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId];
      try {
        window.localStorage.setItem("collabmuse-favorite-rooms", JSON.stringify(next));
      } catch {
        setRoomStatus("Could not save favorites on this device");
      }
      return next;
    });
  };

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
      if (response.status === 401) { setNeedsLogin(true); throw new Error("Log in to create a private room."); }
      if (!response.ok) throw new Error("Unable to create room");
      router.push(`/room/${encodeURIComponent(id)}`);
    } catch (error) {
      setRoomStatus(error instanceof Error ? error.message : "Could not create room");
      setIsCreating(false);
    }
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = parseJoinTarget(joinCode);
    if (target) router.push(target);
  };

  const deleteRoom = async (room: RoomSummary) => {
    if (room.id === "demo" || deletingRoomId) return;
    if (!window.confirm(`Move “${room.title}” to Recently deleted? Its audio will be kept for recovery.`)) return;
    setDeletingRoomId(room.id);
    setRoomStatus(`Deleting ${room.title}`);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete room");
      setRooms((current) => current.filter((item) => item.id !== room.id));
      setRoomStatus("Room moved to Recently deleted");
      setTrashRooms((current) => [{ ...room, deletedAt: new Date().toISOString() }, ...current]);
    } catch {
      setRoomStatus("Could not delete room");
    } finally {
      setDeletingRoomId(null);
    }
  };

  const openTrash = async () => {
    if (showTrash) { setShowTrash(false); return; }
    setShowTrash(true);
    setTrashError("");
    try {
      const response = await fetch("/api/rooms/trash", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load recently deleted rooms");
      const data = await response.json() as { rooms: RoomSummary[] };
      setTrashRooms(data.rooms);
    } catch {
      setTrashError("Could not load recently deleted rooms. Try again.");
    }
  };

  const restoreRoom = async (room: RoomSummary) => {
    if (workingRoomId) return;
    setWorkingRoomId(room.id);
    setTrashError("");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/restore`, { method: "POST" });
      if (!response.ok) throw new Error("Unable to restore room");
      setTrashRooms((current) => current.filter((item) => item.id !== room.id));
      await loadRooms();
      setRoomStatus(`${room.title} restored`);
    } catch {
      setTrashError("Could not restore this room. Try again.");
    } finally {
      setWorkingRoomId(null);
    }
  };

  const importBackup = async (file: File) => {
    if (importing) return;
    setImportError("");
    setImportWarning("");
    if (file.size > 100 * 1024 * 1024) {
      setImportError("This backup exceeds the 100 MB import limit.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/rooms/import", { method: "POST", headers: { "Content-Type": "application/zip" }, body: file });
      if (response.status === 401) setNeedsLogin(true);
      const data = await response.json() as { room?: RoomSummary; error?: string; warning?: string };
      if (!response.ok || !data.room) throw new Error(data.error ?? "Could not import backup");
      await loadRooms();
      setRoomStatus(`${data.room.title} imported`);
      if (data.warning) setImportWarning(data.warning);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import backup.");
    } finally {
      setImporting(false);
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
      if (response.status === 401) setNeedsLogin(true);
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "Unable to duplicate room");
      }
      const data = await response.json() as { room: RoomSummary };
      setRooms((current) => [data.room, ...current]);
      setRoomStatus("Room duplicated");
    } catch (error) {
      setRoomStatus(error instanceof Error ? error.message : "Could not duplicate room");
    } finally {
      setWorkingRoomId(null);
    }
  };

  const filterItems: Array<{ id: RoomFilter; label: string; icon: typeof LayoutDashboard }> = [
    { id: "all", label: "All rooms", icon: LayoutDashboard },
    { id: "live", label: "Demo workspace", icon: RadioTower },
    { id: "shared", label: "Shared with me", icon: UsersRound },
    { id: "owned", label: "Owned by me", icon: Music2 },
    { id: "favorites", label: "Starred rooms", icon: StarRoomIcon },
  ];

  return (
    <main className="min-h-screen bg-[#f4f4f1] text-[#171a1f]">
      <div className="grid min-h-screen md:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="flex border-b border-white/10 bg-[#181b20] p-4 text-white md:min-h-screen md:flex-col md:border-b-0 md:border-r md:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[8px] bg-white text-[#171a1f]"><AudioWaveform className="h-5 w-5" /></span>
              <span className="truncate">CollabMuse</span>
            </Link>
          </div>
          <div className="hidden md:block">
            <button type="button" onClick={() => setShowCreate(true)} className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-[7px] bg-white text-sm font-semibold text-[#171a1f] transition hover:bg-white/90"><Plus className="h-4 w-4" />New room</button>
            <button type="button" onClick={() => setShowJoin(true)} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[7px] border border-white/20 text-sm text-white/76 transition hover:bg-white/8"><UsersRound className="h-4 w-4" />Join with code</button>
            <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">Workspace</p>
            <nav className="space-y-1">
              {filterItems.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`flex h-10 w-full items-center gap-3 rounded-[7px] px-3 text-left text-sm transition ${filter === item.id ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/5 hover:text-white"}`}><Icon className="h-[17px] w-[17px]" />{item.label}</button>;
              })}
            </nav>
            <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">Library</p>
            <Link href="/room/demo" className="flex h-10 items-center gap-3 rounded-[7px] px-3 text-sm text-white/58 transition hover:bg-white/5 hover:text-white"><CloudUpload className="h-[17px] w-[17px]" />Demo room</Link>
          </div>
          <div className="hidden border-t border-white/10 pt-4 md:mt-auto md:flex md:items-center md:gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#456bc2] text-[10px] font-semibold">ZZ</span>
            <div><p className="text-xs font-semibold">Your workspace</p><p className="mt-0.5 text-[10px] text-white/35">{roomStatus}</p></div>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="ml-3 grid h-9 w-9 place-items-center rounded-[7px] bg-white text-[#171a1f] md:hidden" aria-label="Create room"><Plus className="h-4 w-4" /></button>
        </aside>

        <section className="min-w-0">
          <header className="flex h-[66px] items-center justify-between border-b border-[#171a1f]/10 bg-white/82 px-5 backdrop-blur-xl sm:px-7">
            <p className="text-xs text-[#171a1f]/46">Workspace / <span className="font-semibold text-[#171a1f]">{filterItems.find((item) => item.id === filter)?.label}</span></p>
            <label className="flex h-9 w-[min(320px,55vw)] items-center gap-2 rounded-[7px] border border-[#171a1f]/10 bg-[#f7f7f5] px-3 text-[#171a1f]/44"><Search className="h-4 w-4" /><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rooms or audio" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#171a1f]/34" /><kbd className="hidden rounded border border-[#171a1f]/10 bg-white px-1.5 py-0.5 text-[9px] text-[#171a1f]/42 sm:inline">⌘ K</kbd>{search ? <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="text-xs text-[#171a1f]/50">×</button> : null}</label>
          </header>

          <div className="mx-auto max-w-[1220px] p-5 sm:p-7">
            {needsLogin ? <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#184eb6]/20 bg-[#eef4ff] px-4 py-3 text-sm text-[#172033]"><span>Log in to create, duplicate or import a private project.</span><Link href="/auth?mode=login&returnTo=%2Fdashboard" className="font-semibold text-[#184eb6] underline">Log in</Link></div> : null}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><h1 className="text-3xl font-semibold tracking-[-0.02em]">Rooms</h1><p className="mt-1.5 text-sm text-[#171a1f]/48">Manage every music project and open the right session.</p></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void openTrash()} aria-expanded={showTrash} className="flex h-10 items-center gap-2 rounded-[7px] border border-[#171a1f]/12 bg-white px-3 text-xs font-semibold"><Trash2 className="h-4 w-4" />Recently deleted</button><button type="button" onClick={() => setShowJoin((value) => !value)} className="h-10 rounded-[7px] border border-[#171a1f]/12 bg-white px-4 text-xs font-semibold">Join a room</button><button type="button" onClick={() => setShowCreate((value) => !value)} className="flex h-10 items-center gap-2 rounded-[7px] bg-[#171a1f] px-4 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Create room</button></div>
            </div>

            {showTrash ? <section className="mt-4 border-y border-[#171a1f]/10 py-3" aria-label="Recently deleted rooms"><h2 className="text-sm font-semibold">Recently deleted</h2>{trashError ? <p role="alert" className="mt-2 text-xs text-[#a53a35]">{trashError}</p> : null}{trashRooms.length ? <ul className="mt-2 divide-y divide-[#171a1f]/10">{trashRooms.map((room) => <li key={room.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{room.title}</p><p className="text-xs text-[#171a1f]/50">Moved {formatUpdated(room.deletedAt ?? undefined)}</p></div><button type="button" onClick={() => void restoreRoom(room)} disabled={Boolean(workingRoomId)} className="flex items-center gap-1.5 rounded-[6px] border border-[#171a1f]/15 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Restore</button></li>)}</ul> : !trashError ? <p className="mt-2 text-xs text-[#171a1f]/50">No recently deleted rooms.</p> : null}</section> : null}

            <div className="mt-3 flex flex-wrap items-center gap-3"><label className={`inline-flex items-center gap-2 text-xs font-semibold text-[#315ba6] ${importing ? "opacity-50" : "cursor-pointer hover:underline"}`}><CloudUpload className="h-4 w-4" />{importing ? "Importing backup..." : "Import project backup"}<input type="file" accept=".zip,application/zip" className="sr-only" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = ""; }} /></label><span className="text-[11px] text-[#171a1f]/45">ZIP up to 100 MB</span>{importError ? <p role="alert" className="text-xs text-[#a53a35]">{importError}</p> : null}{importWarning ? <p role="status" className="text-xs text-[#8b5b10]">{importWarning}</p> : null}</div>

            {showCreate ? <form onSubmit={createRoom} className="mt-4 flex gap-2 rounded-[8px] border border-[#171a1f]/10 bg-white p-3"><input autoFocus value={newRoomTitle} onChange={(event) => setNewRoomTitle(event.target.value)} maxLength={60} placeholder="Name your new music room" className="min-w-0 flex-1 rounded-[6px] border border-[#171a1f]/10 bg-[#f7f7f5] px-3 text-sm outline-none focus:border-[#456bc2]/50" /><button disabled={!newRoomTitle.trim() || isCreating} className="h-10 rounded-[6px] bg-[#171a1f] px-4 text-xs font-semibold text-white disabled:opacity-40">{isCreating ? "Creating..." : "Create and open"}</button></form> : null}
            {showJoin ? <form onSubmit={joinRoom} className="mt-3 flex gap-2 rounded-[8px] border border-[#171a1f]/10 bg-white p-3"><input autoFocus value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste a room ID or full invite link" className="min-w-0 flex-1 rounded-[6px] border border-[#171a1f]/10 bg-[#f7f7f5] px-3 text-sm outline-none focus:border-[#456bc2]/50" /><button disabled={!joinCode.trim()} className="flex h-10 items-center gap-2 rounded-[6px] bg-[#171a1f] px-4 text-xs font-semibold text-white disabled:opacity-40">Join <ArrowRight className="h-4 w-4" /></button></form> : null}

            <div className="mt-5 grid overflow-hidden rounded-[8px] border border-[#171a1f]/10 bg-white sm:grid-cols-3">
              {[{ label: "Your rooms", value: projectRooms.length, hint: rooms.some((room) => room.id === "demo") ? "demo available separately" : "" }, { label: "Audio clips", value: clipCount, hint: "in your rooms" }, { label: "Open feedback", value: noteCount, hint: "in your rooms" }].map((metric, index) => <div key={metric.label} className={`px-5 py-4 ${index ? "border-t border-[#171a1f]/10 sm:border-l sm:border-t-0" : ""}`}><p className="text-[11px] text-[#171a1f]/45">{metric.label}</p><p className="mt-1 text-2xl font-semibold">{isLoadingRooms ? <span className="inline-block h-7 w-10 animate-pulse rounded-[4px] bg-[#171a1f]/8" aria-label="Loading" /> : metric.value}<span className="ml-2 text-[10px] font-normal text-[#171a1f]/42">{metric.hint}</span></p></div>)}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <section className="overflow-hidden rounded-[8px] border border-[#171a1f]/10 bg-white">
                <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[#171a1f]/10 px-4 py-2.5"><h2 className="text-sm font-semibold">Continue working</h2><div className="flex items-center gap-3"><span className={`text-[10px] ${roomsError ? "text-[#a53a35]" : "text-[#171a1f]/40"}`}>{roomsError ? "Could not refresh rooms" : isLoadingRooms ? "Loading..." : latestRoom ? `Updated ${formatUpdated(latestRoom.updatedAt)}` : "No rooms yet"}</span><button type="button" onClick={() => void loadRooms()} disabled={isLoadingRooms || isRefreshingRooms} aria-label="Refresh rooms" title="Refresh rooms" className="grid h-8 w-8 place-items-center rounded-[5px] text-[#171a1f]/52 transition hover:bg-[#171a1f]/6 disabled:opacity-40"><RotateCcw className={`h-4 w-4 ${isRefreshingRooms ? "animate-spin" : ""}`} /></button></div></div>
                {isLoadingRooms ? <div className="flex items-center gap-4 border-b border-[#171a1f]/10 p-4" role="status"><span className="h-[82px] w-[124px] animate-pulse rounded-[6px] bg-[#171a1f]/8" /><div><p className="text-sm font-semibold">Loading your rooms...</p><p className="mt-1 text-xs text-[#171a1f]/42">Connecting to your workspace</p></div></div> : latestRoom ? <div className="grid items-center gap-4 border-b border-[#171a1f]/10 p-4 sm:grid-cols-[124px_minmax(0,1fr)_auto]"><Image priority src={covers[0]} alt="Recent room cover" width={248} height={156} className="h-[82px] w-[124px] rounded-[6px] object-cover" /><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#36805a]">{latestRoom.id === "demo" ? "Demo workspace" : "Recent project"}</p><h3 className="mt-1 truncate text-xl font-semibold">{latestRoom.title}</h3><p className="mt-1 text-xs text-[#171a1f]/45">{latestRoom.bpm ?? 96} BPM · {latestRoom.audioClips?.length ?? 0} clips · {latestRoom.notes?.filter((note) => !note.resolved).length ?? 0} open notes</p></div><Link href={`/room/${encodeURIComponent(latestRoom.id)}`} className="grid h-11 w-11 place-items-center rounded-full bg-[#171a1f] text-white" aria-label={`Open ${latestRoom.title}`}><ArrowRight className="h-5 w-5" /></Link></div> : roomsError ? <div className="flex flex-wrap items-center justify-between gap-3 p-6"><div><p className="text-sm font-semibold">Your rooms could not be loaded</p><p className="mt-1 text-xs text-[#171a1f]/45">Check your connection, then try again.</p></div><button type="button" onClick={() => void loadRooms(true)} className="h-9 rounded-[6px] bg-[#171a1f] px-3 text-xs font-semibold text-white">Try again</button></div> : <div className="p-6 text-sm text-[#171a1f]/45">Create your first room to begin a session.</div>}

                <div className="flex flex-wrap items-center gap-4 border-b border-[#171a1f]/10 px-4 py-3 text-[11px] text-[#171a1f]/45"><button type="button" onClick={() => setFilter("all")} className={filter === "all" ? "font-semibold text-[#171a1f]" : ""}>All {isLoadingRooms ? "..." : rooms.length}</button><button type="button" onClick={() => setFilter("owned")} className={filter === "owned" ? "font-semibold text-[#171a1f]" : ""}>Owned {isLoadingRooms ? "..." : rooms.filter((room) => room.currentRole === "owner").length}</button><button type="button" onClick={() => setFilter("shared")} className={filter === "shared" ? "font-semibold text-[#171a1f]" : ""}>Shared {isLoadingRooms ? "..." : rooms.filter((room) => room.currentRole !== "owner").length}</button><button type="button" onClick={() => setFilter("favorites")} className={filter === "favorites" ? "font-semibold text-[#171a1f]" : ""}>Starred {rooms.filter((room) => favoriteRoomIds.includes(room.id)).length}</button><label className="ml-auto flex items-center gap-2">Sort <select value={sortMode} onChange={(event) => setSortMode(event.target.value as RoomSort)} className="rounded-[5px] border border-[#171a1f]/10 bg-white px-2 py-1 text-[10px] text-[#171a1f]/70"><option value="recent">Recently updated</option><option value="name">Name</option><option value="activity">Most activity</option></select></label><span>{isLoadingRooms ? "Loading" : `${displayedRooms.length} shown`}</span></div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[690px] border-collapse">
                    <thead><tr className="bg-[#fafaf8] text-left text-[9px] font-semibold uppercase tracking-[0.12em] text-[#171a1f]/38"><th className="px-4 py-3">Project</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {displayedRooms.map((room, index) => {
                        const stage = roomStage(room);
                        return <tr key={room.id} className="border-t border-[#171a1f]/8 transition hover:bg-[#f8f8f6]"><td className="px-4 py-3"><div className="flex items-center gap-3"><Image src={covers[index % covers.length]} alt="" width={80} height={80} className="h-10 w-10 rounded-[5px] object-cover" /><div className="min-w-0"><Link href={`/room/${encodeURIComponent(room.id)}`} className="block max-w-[250px] truncate text-xs font-semibold hover:underline">{room.title}</Link><p className="mt-1 max-w-[250px] truncate text-[10px] text-[#171a1f]/40">{room.audioClips?.length ?? 0} clips · {room.notes?.filter((note) => !note.resolved).length ?? 0} open notes</p></div></div></td><td className="px-3 py-3"><span className={`rounded-[4px] px-2 py-1 text-[9px] font-semibold ${stageStyles[stage]}`}>{stage}</span></td><td className="px-3 py-3 text-[10px] capitalize text-[#171a1f]/52">{room.currentRole ?? "viewer"}</td><td className="whitespace-nowrap px-3 py-3 text-[10px] text-[#171a1f]/52">{formatUpdated(room.updatedAt)}</td><td className="px-3 py-3"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => toggleFavorite(room.id)} aria-label={favoriteRoomIds.includes(room.id) ? `Remove ${room.title} from starred rooms` : `Star ${room.title}`} aria-pressed={favoriteRoomIds.includes(room.id)} title={favoriteRoomIds.includes(room.id) ? "Remove from starred" : "Star room"} className={`grid h-8 w-8 place-items-center rounded-[5px] transition hover:bg-[#171a1f]/6 ${favoriteRoomIds.includes(room.id) ? "text-[#b68619]" : "text-[#171a1f]/35"}`}><Star className="h-3.5 w-3.5" /></button><Link href={`/room/${encodeURIComponent(room.id)}`} className="rounded-[5px] border border-[#171a1f]/12 bg-white px-3 py-2 text-[10px] font-semibold">Open</Link><button type="button" onClick={() => duplicateRoom(room)} disabled={workingRoomId === room.id} className="grid h-8 w-8 place-items-center rounded-[5px] text-[#171a1f]/42 hover:bg-[#171a1f]/6" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>{room.currentRole === "owner" ? <button type="button" onClick={() => renameRoom(room)} disabled={workingRoomId === room.id} className="grid h-8 w-8 place-items-center rounded-[5px] text-[#171a1f]/42 hover:bg-[#171a1f]/6" title="Rename"><Pencil className="h-3.5 w-3.5" /></button> : null}{room.id !== "demo" && room.currentRole === "owner" ? <button type="button" onClick={() => deleteRoom(room)} disabled={deletingRoomId === room.id} className="grid h-8 w-8 place-items-center rounded-[5px] text-[#171a1f]/42 hover:bg-[#b71912]/8 hover:text-[#b71912]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button> : null}</div></td></tr>;
                      })}
                    </tbody>
                  </table>
                  {!isLoadingRooms && !roomsError && filteredRooms.length === 0 ? <div className="border-t border-[#171a1f]/8 px-5 py-10 text-center"><p className="text-sm font-semibold">{filter === "favorites" ? "No starred rooms yet" : "No rooms found"}</p><p className="mt-1 text-xs text-[#171a1f]/42">{filter === "favorites" ? "Use the star beside a project to keep it in this list." : "Change the filter or create a new room."}</p></div> : null}
                </div>
              </section>

              <aside className="space-y-4">
                <section className="rounded-[8px] border border-[#171a1f]/10 bg-white"><div className="flex items-center justify-between border-b border-[#171a1f]/10 px-4 py-3"><h2 className="text-sm font-semibold">Recent activity</h2><Circle className="h-2.5 w-2.5 fill-[#35a16b] text-[#35a16b]" /></div><div className="px-4">{activity.length ? activity.map(({ room, event }, index) => <Link href={`/room/${encodeURIComponent(room.id)}`} key={`${room.id}-${event.id ?? index}`} className="block border-b border-[#171a1f]/8 py-3 last:border-0 hover:bg-[#f8f8f6]" aria-label={`Open ${room.id === "demo" ? "demo room" : room.title}: ${event.title ?? "Room updated"}`}><p className="text-[11px] font-semibold leading-5">{event.title ?? "Room updated"}</p><p className="mt-0.5 text-[10px] leading-4 text-[#171a1f]/44">{room.title}{room.id === "demo" ? " (demo)" : ""}{event.detail ? ` · ${event.detail}` : ""}</p><p className="mt-1 text-[9px] text-[#171a1f]/30">{event.time ?? formatUpdated(room.updatedAt)}</p></Link>) : <p className="py-5 text-xs text-[#171a1f]/42">Activity will appear after collaborators edit a room.</p>}</div></section>
                <section className="rounded-[8px] border border-[#171a1f]/10 bg-white p-4"><h2 className="text-sm font-semibold">Join another room</h2><p className="mt-1.5 text-[11px] leading-5 text-[#171a1f]/45">Use a room ID or the full invitation link sent by its owner.</p><form onSubmit={joinRoom} className="mt-3 flex gap-2"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Invite code" aria-label="Room ID or invitation link" className="min-w-0 flex-1 rounded-[6px] border border-[#171a1f]/10 bg-[#f7f7f5] px-3 text-xs outline-none" /><button disabled={!joinCode.trim()} aria-label="Join room" title="Join room" className="grid h-9 w-9 place-items-center rounded-[6px] bg-[#171a1f] text-white disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button></form></section>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
