"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { FormEvent, SVGProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/GlassButton";
import { VinylMark } from "@/components/Navbar";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CloudUpload,
  Copy,
  LayoutDashboard,
  Music2,
  Pencil,
  Plus,
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
  Writing: "bg-human-wash text-human-ink",
  Mixing: "bg-copilot-wash text-copilot-ink",
  Review: "bg-stone text-ink-700",
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
    { id: "shared", label: "Shared with me", icon: UsersRound },
    { id: "owned", label: "Owned by me", icon: Music2 },
    { id: "favorites", label: "Starred rooms", icon: StarRoomIcon },
  ];

  const iconButton = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-600 transition-colors duration-150 ease-studio hover:bg-stone hover:text-black disabled:opacity-40";
  const textField = "h-9 min-w-0 flex-1 rounded-full bg-cream px-3.5 text-sm outline-none placeholder:text-ink-400 focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-offset-2 focus-visible:outline-[#2b7fff]";
  const currentFilter = filterItems.find((item) => item.id === filter)?.label;
  const counts: Record<RoomFilter, number | null> = {
    all: rooms.length,
    live: rooms.some((room) => room.id === "demo") ? 1 : 0,
    owned: rooms.filter((room) => room.currentRole === "owner").length,
    shared: rooms.filter((room) => room.currentRole !== "owner").length,
    favorites: rooms.filter((room) => favoriteRoomIds.includes(room.id)).length,
  };

  return (
    <main className="min-h-screen bg-canvas text-black">
      <div className="grid min-h-screen md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="flex items-center gap-2 border-b border-stone px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-0 md:border-b-0 md:border-r md:px-3 md:py-4">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 px-2 text-lg font-medium tracking-[-0.01em] md:h-9 md:flex-none">
            <VinylMark />
            <span className="truncate">CollabMuse</span>
          </Link>
          <div className="hidden md:mt-6 md:flex md:flex-col md:gap-1.5">
            <button type="button" onClick={() => setShowCreate(true)} className={cn(buttonClasses("primary"), "w-full")}><Plus className="h-4 w-4" aria-hidden="true" />New room</button>
            <button type="button" onClick={() => setShowJoin(true)} className={cn(buttonClasses("secondary"), "w-full")}><UsersRound className="h-4 w-4" aria-hidden="true" />Join with a code</button>
          </div>
          <nav aria-label="Rooms" className="hidden md:mt-6 md:flex md:flex-col md:gap-0.5">
            {filterItems.map((item) => {
              const Icon = item.icon;
              const active = filter === item.id;
              return (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-current={active ? "page" : undefined} className={cn("flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors duration-150 ease-studio", active ? "bg-cream text-black" : "text-ink-700 hover:bg-cream hover:text-black")}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!isLoadingRooms && counts[item.id] !== null ? <span className="font-mono text-xs text-ink-600">{counts[item.id]}</span> : null}
                </button>
              );
            })}
            <Link href="/room/demo" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-700 transition-colors duration-150 ease-studio hover:bg-cream hover:text-black"><CloudUpload className="h-4 w-4" aria-hidden="true" />Open the demo room</Link>
          </nav>
          <div className="hidden md:mt-auto md:flex md:items-center md:gap-2.5 md:rounded-xl md:bg-cream md:p-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-human text-xs text-white" aria-hidden="true">You</span>
            <div className="min-w-0"><p className="text-sm">Your workspace</p><p className="truncate text-xs text-ink-600">{roomStatus}</p></div>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className={cn(buttonClasses("primary"), "w-9 px-0 md:hidden")} aria-label="Create room"><Plus className="h-4 w-4" /></button>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 bg-canvas px-5 sm:px-8">
            <p className="truncate text-sm text-ink-600">Rooms <span aria-hidden="true">/</span> <span className="text-black">{currentFilter}</span></p>
            <label className="flex h-9 w-[min(340px,55vw)] items-center gap-2 rounded-full bg-cream px-3.5 text-ink-600 focus-within:outline focus-within:outline-[1.5px] focus-within:outline-offset-2 focus-within:outline-[#2b7fff]">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rooms or audio" aria-label="Search rooms or audio" className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-ink-400" />
              {search ? <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="text-sm text-ink-600 hover:text-black">Clear</button> : <kbd className="hidden font-mono text-xs text-ink-400 sm:inline">⌘K</kbd>}
            </label>
          </header>

          <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 pb-16 pt-6 sm:px-8">
            {needsLogin ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-human-wash px-4 py-3 text-sm text-human-ink"><span>Log in to create, duplicate or import a private room.</span><Link href="/auth?mode=login&returnTo=%2Fdashboard" className="underline">Log in</Link></div> : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-[36px] font-light leading-[1.17] tracking-[-0.02em]">Your rooms</h1>
                <p className="mt-1 text-[15px] text-ink-600">Open a session, pick up where the room left off, or start something new.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void openTrash()} aria-expanded={showTrash} className={buttonClasses("quiet")}><Trash2 className="h-4 w-4" aria-hidden="true" />Recently deleted</button>
                <label className={cn(buttonClasses("secondary"), importing ? "opacity-50" : "cursor-pointer")}>
                  <CloudUpload className="h-4 w-4" aria-hidden="true" />{importing ? "Importing…" : "Import backup"}
                  <input type="file" accept=".zip,application/zip" className="sr-only" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = ""; }} />
                </label>
                <button type="button" onClick={() => setShowCreate((value) => !value)} className={buttonClasses("primary")}><Plus className="h-4 w-4" aria-hidden="true" />New room</button>
              </div>
            </div>
            {importError ? <p role="alert" className="-mt-3 text-sm text-[#9d403b]">{importError}</p> : null}
            {importWarning ? <p role="status" className="-mt-3 text-sm text-copilot-ink">{importWarning}</p> : null}

            {showTrash ? (
              <section className="rounded-2xl bg-cream p-4" aria-label="Recently deleted rooms">
                <h2 className="text-[15px]">Recently deleted</h2>
                {trashError ? <p role="alert" className="mt-2 text-sm text-[#9d403b]">{trashError}</p> : null}
                {trashRooms.length ? (
                  <ul className="mt-2 divide-y divide-stone">
                    {trashRooms.map((room) => (
                      <li key={room.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-sm">{room.title}</p><p className="text-xs text-ink-600">Moved {formatUpdated(room.deletedAt ?? undefined)}</p></div>
                        <button type="button" onClick={() => void restoreRoom(room)} disabled={Boolean(workingRoomId)} className={cn(buttonClasses("secondary"), "h-8 disabled:opacity-40")}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Restore</button>
                      </li>
                    ))}
                  </ul>
                ) : !trashError ? <p className="mt-2 text-sm text-ink-600">Nothing deleted in the last 30 days.</p> : null}
              </section>
            ) : null}

            {showCreate ? (
              <form onSubmit={createRoom} className="flex gap-2 rounded-[30px] bg-white p-2 shadow-ring">
                <input autoFocus value={newRoomTitle} onChange={(event) => setNewRoomTitle(event.target.value)} maxLength={60} placeholder="Name your new room" aria-label="Room name" className={textField} />
                <button disabled={!newRoomTitle.trim() || isCreating} className={cn(buttonClasses("primary"), "disabled:opacity-40")}>{isCreating ? "Creating…" : "Create and open"}</button>
              </form>
            ) : null}
            {showJoin ? (
              <form onSubmit={joinRoom} className="flex gap-2 rounded-[30px] bg-white p-2 shadow-ring">
                <input autoFocus value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste a room ID or an invite link" aria-label="Room ID or invite link" className={textField} />
                <button disabled={!joinCode.trim()} className={cn(buttonClasses("primary"), "disabled:opacity-40")}>Join<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              </form>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))]">
              <div className="flex min-h-[104px] items-center gap-4 rounded-2xl bg-cream p-4 sm:col-span-3 xl:col-span-1">
                {isLoadingRooms ? (
                  <div className="flex items-center gap-4" role="status"><span className="h-16 w-[88px] animate-pulse rounded-[10px] bg-stone" /><p className="text-sm text-ink-600">Loading your rooms…</p></div>
                ) : latestRoom ? (
                  <>
                    <Image priority src={covers[0]} alt="" width={176} height={128} className="h-16 w-[88px] shrink-0 rounded-[10px] object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink-600">Continue · {latestRoom.id === "demo" ? "demo room" : `edited ${formatUpdated(latestRoom.updatedAt)}`}</p>
                      <h2 className="truncate text-lg">{latestRoom.title}</h2>
                      <p className="truncate font-mono text-xs text-ink-700">{latestRoom.bpm ?? 96} BPM · {latestRoom.audioClips?.length ?? 0} clips · {latestRoom.notes?.filter((note) => !note.resolved).length ?? 0} open notes</p>
                    </div>
                    <Link href={`/room/${encodeURIComponent(latestRoom.id)}`} className={cn(buttonClasses("primary"), "w-9 px-0")} aria-label={`Open ${latestRoom.title}`}><ArrowRight className="h-4 w-4" /></Link>
                  </>
                ) : roomsError ? (
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3"><p className="text-sm">Your rooms could not be loaded. Check your connection.</p><button type="button" onClick={() => void loadRooms(true)} className={buttonClasses("secondary")}>Try again</button></div>
                ) : (
                  <p className="text-sm text-ink-600">Create your first room to start a session.</p>
                )}
              </div>
              {[
                { label: "Rooms", value: projectRooms.length, hint: rooms.some((room) => room.id === "demo") ? "plus the demo room" : "in your workspace" },
                { label: "Audio clips", value: clipCount, hint: "across your rooms" },
                { label: "Open notes", value: noteCount, hint: "waiting for a reply" },
              ].map((metric) => (
                <div key={metric.label} className="flex min-h-[104px] flex-col justify-between rounded-2xl bg-cream p-4">
                  <p className="text-[13px] text-ink-600">{metric.label}</p>
                  <div>
                    <p className="font-display text-[28px] font-light leading-none">{isLoadingRooms ? <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-stone" aria-label="Loading" /> : metric.value}</p>
                    <p className="mt-1 text-xs text-ink-600">{metric.hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section aria-label="Room list" className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-0.5 rounded-full bg-cream p-[3px]" role="group" aria-label="Filter rooms">
                    {(["all", "owned", "shared", "favorites"] as const).map((id) => (
                      <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-[background-color,box-shadow,color] duration-150 ease-studio", filter === id ? "bg-white text-black shadow-ring" : "text-ink-700 hover:text-black")}>
                        {{ all: "All", owned: "Owned", shared: "Shared", favorites: "Starred" }[id]}
                        <span className="font-mono text-xs text-ink-600">{isLoadingRooms ? "…" : counts[id]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex h-9 items-center gap-2 rounded-full bg-cream pl-3.5 pr-2 text-sm text-ink-600">
                      Sort
                      <select value={sortMode} onChange={(event) => setSortMode(event.target.value as RoomSort)} className="cursor-pointer bg-transparent text-sm text-black outline-none">
                        <option value="recent">Recently updated</option>
                        <option value="name">Name</option>
                        <option value="activity">Most activity</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => void loadRooms()} disabled={isLoadingRooms || isRefreshingRooms} aria-label="Refresh rooms" title={roomsError ? "Could not refresh rooms" : "Refresh rooms"} className={iconButton}><RotateCcw className={cn("h-4 w-4", isRefreshingRooms && "animate-spin")} /></button>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[680px] table-fixed border-collapse text-left">
                    <thead>
                      <tr className="text-[13px] text-ink-600">
                        <th scope="col" className="py-2 pl-2 pr-3 font-normal">Room</th>
                        <th scope="col" className="w-[100px] px-3 py-2 font-normal">Stage</th>
                        <th scope="col" className="w-[88px] px-3 py-2 font-normal">Access</th>
                        <th scope="col" className="w-[104px] px-3 py-2 font-normal">Updated</th>
                        <th scope="col" className="w-[208px] py-2 pl-3 pr-2"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRooms.map((room, index) => {
                        const stage = roomStage(room);
                        const starred = favoriteRoomIds.includes(room.id);
                        return (
                          <tr key={room.id} className="border-t border-stone transition-colors duration-150 ease-studio hover:bg-cream/60">
                            <td className="py-2.5 pl-2 pr-3">
                              <div className="flex items-center gap-3">
                                <Image src={covers[index % covers.length]} alt="" width={80} height={80} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                <div className="min-w-0">
                                  <Link href={`/room/${encodeURIComponent(room.id)}`} className="block truncate text-sm hover:underline">{room.title}</Link>
                                  <p className="truncate font-mono text-xs text-ink-600">{room.bpm ?? 96} BPM · {room.audioClips?.length ?? 0} clips · {room.notes?.filter((note) => !note.resolved).length ?? 0} open notes</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5"><span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs", stageStyles[stage])}>{stage}</span></td>
                            <td className="px-3 py-2.5 text-sm capitalize text-ink-700">{room.currentRole ?? "viewer"}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-sm text-ink-700">{formatUpdated(room.updatedAt)}</td>
                            <td className="py-2.5 pl-3 pr-2">
                              <div className="flex items-center justify-end gap-0.5">
                                <button type="button" onClick={() => toggleFavorite(room.id)} aria-label={starred ? `Remove ${room.title} from starred rooms` : `Star ${room.title}`} aria-pressed={starred} title={starred ? "Remove from starred" : "Star room"} className={cn(iconButton, starred && "text-copilot")}><Star className={cn("h-4 w-4", starred && "fill-current")} /></button>
                                <button type="button" onClick={() => duplicateRoom(room)} disabled={workingRoomId === room.id} className={iconButton} aria-label={`Duplicate ${room.title}`} title="Duplicate"><Copy className="h-4 w-4" /></button>
                                {room.currentRole === "owner" ? <button type="button" onClick={() => renameRoom(room)} disabled={workingRoomId === room.id} className={iconButton} aria-label={`Rename ${room.title}`} title="Rename"><Pencil className="h-4 w-4" /></button> : <span className="w-8" aria-hidden="true" />}
                                {room.id !== "demo" && room.currentRole === "owner" ? <button type="button" onClick={() => deleteRoom(room)} disabled={deletingRoomId === room.id} className={cn(iconButton, "hover:bg-[#fbe9e7] hover:text-[#9d403b]")} aria-label={`Delete ${room.title}`} title="Delete"><Trash2 className="h-4 w-4" /></button> : <span className="w-8" aria-hidden="true" />}
                                <Link href={`/room/${encodeURIComponent(room.id)}`} className={cn(buttonClasses("secondary"), "ml-1 h-8 px-3")}>Open</Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!isLoadingRooms && !roomsError && filteredRooms.length === 0 ? (
                    <div className="rounded-2xl bg-cream px-5 py-10 text-center">
                      <p className="text-[15px]">{filter === "favorites" ? "No starred rooms yet" : "No rooms match"}</p>
                      <p className="mt-1 text-sm text-ink-600">{filter === "favorites" ? "Star a room to keep it here." : "Change the filter, or start a new room."}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <aside className="flex flex-col gap-2">
                <form onSubmit={joinRoom} className="flex flex-col gap-2 rounded-[30px] bg-white p-3 shadow-ring">
                  <label htmlFor="join-room" className="px-2 pt-1 text-[15px] text-black/50">Join a room</label>
                  <input id="join-room" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste an invite link or room ID" className="bg-transparent px-2 text-sm outline-none placeholder:text-ink-400" />
                  <button disabled={!joinCode.trim()} className={cn(buttonClasses("primary"), "self-end disabled:bg-ink-400")}>Join</button>
                </form>
                <section className="rounded-2xl bg-cream p-2">
                  <h2 className="px-2 pb-1 pt-1.5 text-[15px]">Recent activity</h2>
                  {activity.length ? (
                    <ul>
                      {activity.map(({ room, event }, index) => (
                        <li key={`${room.id}-${event.id ?? index}`}>
                          <Link href={`/room/${encodeURIComponent(room.id)}`} className="flex gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 ease-studio hover:bg-white" aria-label={`Open ${room.id === "demo" ? "demo room" : room.title}: ${event.title ?? "Room updated"}`}>
                            <span className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", /copilot|generat|ai/i.test(`${event.kind ?? ""} ${event.title ?? ""}`) ? "bg-copilot" : "bg-human")} aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-sm leading-snug">{event.title ?? "Room updated"}</span>
                              <span className="block truncate text-xs text-ink-600">{room.title}{room.id === "demo" ? " (demo)" : ""} · {event.time ?? formatUpdated(room.updatedAt)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-2 pb-3 text-sm text-ink-600">Activity shows up here once someone edits a room.</p>}
                </section>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
