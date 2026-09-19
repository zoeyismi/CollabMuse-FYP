import {
  AudioWaveform,
  BotMessageSquare,
  CloudUpload,
  Layers3,
  MessageCircle,
  MousePointer2,
  RadioTower,
  SlidersHorizontal,
  UsersRound,
} from "@/components/Icons";

export const features = [
  {
    icon: UsersRound,
    title: "Collaboration rooms",
    description:
      "Create focused music rooms where collaborators can join the same project state.",
  },
  {
    icon: CloudUpload,
    title: "Clip management",
    description:
      "Upload, name, organise and reuse short audio clips without sending files manually.",
  },
  {
    icon: MousePointer2,
    title: "Event-based sync",
    description:
      "Synchronise actions such as clip moves, track edits and timeline changes in real time.",
  },
  {
    icon: MessageCircle,
    title: "Room chat",
    description:
      "Keep creative decisions beside the timeline with lightweight collaborative chat.",
  },
];

export const howItWorks = [
  {
    step: "01",
    title: "Create a room",
    description: "Start a shared project space and invite collaborators into the same session.",
  },
  {
    step: "02",
    title: "Add clips and tracks",
    description: "Upload short audio ideas, organise track lanes and shape the arrangement.",
  },
  {
    step: "03",
    title: "Sync actions",
    description:
      "Send editing events through the room so every client sees the same project state.",
  },
];

export const mockProjects = [
  {
    title: "Always",
    genre: "Daniel Caesar · R&B",
    status: "Demo song ready",
    updated: "Today",
    collaborators: ["ZZ", "FC", "LM"],
    clips: 12,
    accent: "yellow" as const,
  },
  {
    title: "Verse Edit",
    genre: "Alt R&B draft",
    status: "Planning",
    updated: "Yesterday",
    collaborators: ["ZZ", "AK"],
    clips: 8,
    accent: "red" as const,
  },
  {
    title: "Blue Room",
    genre: "Slow groove",
    status: "Draft",
    updated: "3 days ago",
    collaborators: ["ZZ", "MJ", "RH", "YC"],
    clips: 16,
    accent: "blue" as const,
  },
];

export type Track = {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  clips: number;
};

export const initialTracks: Track[] = [
  { id: "drums", name: "Percussion bed", color: "#b71912", muted: false, clips: 3 },
  { id: "bass", name: "Warm bass", color: "#235fba", muted: false, clips: 2 },
  { id: "keys", name: "Soft keys", color: "#efd84c", muted: false, clips: 4 },
  { id: "vox", name: "Vocal layer", color: "#58e081", muted: true, clips: 2 },
];

export const tracks = initialTracks;

export type RoomEventKind = "upload" | "move" | "rename" | "note" | "sync" | "remix" | "extend";

export type RoomEvent = {
  id: string;
  kind: RoomEventKind;
  title: string;
  detail: string;
  time: string;
};

export type RoomNote = {
  id: string;
  author: string;
  message: string;
  time: string;
};

export type TimelineRegion = {
  id: string;
  label: string;
  actionLabel: "Move clip" | "Mark section" | "Sync edit" | "Extend clip";
  left: number;
  width: number;
  color: string;
};

export type CompositionNote = {
  pitch: string;
  beats: number;
  velocity: number;
};

export type MusicComposition = {
  id: string;
  title: string;
  key: string;
  tempo: number;
  style: string;
  explanation: string;
  notes: CompositionNote[];
  provider: "openai" | "local";
};

export const initialRoomEvents: RoomEvent[] = [
  {
    id: "event-upload",
    kind: "upload",
    title: "Clip uploaded",
    detail: "Lina added always-reference.wav",
    time: "11:20",
  },
  {
    id: "event-move",
    kind: "move",
    title: "Clip move synced",
    detail: "Ziyi moved a waveform selection",
    time: "11:22",
  },
  {
    id: "event-remix",
    kind: "remix",
    title: "Section marked",
    detail: "Yellow region marked for review",
    time: "11:23",
  },
  {
    id: "event-note",
    kind: "note",
    title: "Room note",
    detail: "Franky: keep action sync focused",
    time: "11:24",
  },
];

export const initialRoomNotes: RoomNote[] = [
  {
    id: "note-ziyi",
    author: "Ziyi",
    message: "Marked the chorus section for the Always edit.",
    time: "11:20",
  },
  {
    id: "note-franky",
    author: "Franky",
    message: "The blue selection feels like the cleanest inpoint area.",
    time: "11:22",
  },
  {
    id: "note-lina",
    author: "Lina",
    message: "I added a soft vocal layer note for the second pass.",
    time: "11:24",
  },
];

export const chatMessages = initialRoomNotes;

export const initialTimelineRegions: TimelineRegion[] = [
  { id: "region-move", label: "Move clip", actionLabel: "Move clip", left: 12, width: 16, color: "#b71912" },
  { id: "region-mark", label: "Mark section", actionLabel: "Mark section", left: 31, width: 9, color: "#efd84c" },
  { id: "region-sync", label: "Sync edit", actionLabel: "Sync edit", left: 44, width: 25, color: "#235fba" },
  { id: "region-extend", label: "Extend clip", actionLabel: "Extend clip", left: 78, width: 16, color: "#58e081" },
];

export const roomStats = [
  { icon: RadioTower, label: "Sync mode", value: "Events only" },
  { icon: Layers3, label: "Tracks", value: "4 lanes" },
  { icon: AudioWaveform, label: "Selections", value: "3 regions" },
  { icon: BotMessageSquare, label: "Chat", value: "Room scoped" },
  { icon: SlidersHorizontal, label: "Latency goal", value: "UI state sync" },
];
