import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Worker } from "node:worker_threads";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import next from "next";
import { Server } from "socket.io";
import { Zip, ZipPassThrough, strFromU8, strToU8, unzipSync } from "fflate";
import { createJsonStore } from "./lib/json-store.mjs";
import { mergeRoomEdits } from "./lib/merge-room-edits.mjs";
import { getUploadEpoch } from "./lib/upload-epoch.mjs";
import { discardMusicErrorResponse, readBoundedJson, readMp3Response } from "./lib/music-provider.mjs";
import { preserveRemovedRegionNotePositions, remapMergedNotes, remapSplitNotes } from "./lib/split-note-remap.mjs";
import { audioRange } from "./lib/audio-range.mjs";
import { MAX_AUDIO_BYTES } from "./lib/audio-limits.mjs";
import { createMusicWorkerRunner } from "./lib/music-worker-runner.mjs";
import { createBackupVerifier } from "./lib/backup-verifier.mjs";
import { readJsonRequest } from "./lib/json-request.mjs";
import { readBinaryRequest } from "./lib/binary-request.mjs";
import { validateTimingPatch } from "./lib/session-timing.mjs";
import { referenceTempo } from "./lib/reference-tempo.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME_BIND || "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const dataDir = process.env.COLLABMUSE_DATA_DIR ? path.resolve(process.env.COLLABMUSE_DATA_DIR) : path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "rooms.json");
const authStorePath = path.join(dataDir, "auth.json");
const uploadsDir = path.join(dataDir, "uploads");
const maxAudioBytes = MAX_AUDIO_BYTES;
const maxBackupBytes = 100 * 1024 * 1024;
const maxRoomVersions = 100;
function sendAudio(req, res, data, mimeType) {
  const range = audioRange(req.headers.range, data.length);
  const headers = { "Content-Type": mimeType || "audio/mpeg", "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
  if (range === false) {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${data.length}`, "Content-Length": 0 });
    res.end();
    return;
  }
  if (range) {
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${data.length}`, "Content-Length": range.end - range.start + 1 });
    res.end(data.subarray(range.start, range.end + 1));
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": data.length });
  res.end(data);
}
const renderLocalMusicAsync = createMusicWorkerRunner({
  createWorker: (input) => new Worker(new URL("./lib/local-music-worker.mjs", import.meta.url), { workerData: input }),
});
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const compositionPitches = [
  "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
  "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
];
const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10];

const initialEvents = [
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

const initialNotes = [
  {
    id: "note-ziyi",
    author: "Ziyi",
    message: "Marked the chorus section for the Always edit.",
    time: "11:20",
    position: 28,
  },
  {
    id: "note-franky",
    author: "Franky",
    message: "The blue selection feels like the cleanest inpoint area.",
    time: "11:22",
    position: 52,
  },
  {
    id: "note-lina",
    author: "Lina",
    message: "I added a soft vocal layer note for the second pass.",
    time: "11:24",
    position: 76,
  },
];

const initialTimelineRegions = [
  { id: "region-move", label: "Move clip", actionLabel: "Move clip", left: 12, width: 16, color: "#b71912" },
  { id: "region-mark", label: "Mark section", actionLabel: "Mark section", left: 31, width: 9, color: "#efd84c" },
  { id: "region-sync", label: "Sync edit", actionLabel: "Sync edit", left: 44, width: 25, color: "#235fba" },
  { id: "region-extend", label: "Extend clip", actionLabel: "Extend clip", left: 78, width: 16, color: "#58e081" },
];

const initialTracks = [
  { id: "drums", name: "Percussion bed", color: "#b71912", muted: false, solo: false, volume: 0.82, clips: 3 },
  { id: "bass", name: "Warm bass", color: "#235fba", muted: false, solo: false, volume: 0.76, clips: 2 },
  { id: "keys", name: "Soft keys", color: "#efd84c", muted: false, solo: false, volume: 0.68, clips: 4 },
  { id: "vox", name: "Vocal layer", color: "#58e081", muted: true, solo: false, volume: 0.74, clips: 2 },
];

const defaultRoom = {
  id: "demo",
  title: "Always session",
  uploadedFileName: "always-reference.wav",
  audioAvailable: false,
  audioStorageName: null,
  audioMimeType: null,
  waveformPeaks: null,
  events: initialEvents,
  notes: initialNotes,
  timelineRegions: initialTimelineRegions,
  tracks: initialTracks,
  composition: null,
  audioClips: [],
  versions: [],
  bpm: 96,
  timeSignature: "4/4",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const roomStore = createJsonStore(storePath, () => ({ rooms: { demo: defaultRoom } }), (value) => isRecord(value) && isRecord(value.rooms));
const authStore = createJsonStore(authStorePath, () => ({ users: [], sessions: {} }), (value) => isRecord(value) && Array.isArray(value.users) && isRecord(value.sessions));
const readStore = () => roomStore.read();
const readAuthStore = () => authStore.read();

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key]) => key)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
}

async function getSessionUser(req) {
  const token = parseCookies(req).collabmuse_session;
  if (!token) return null;
  const store = await readAuthStore();
  const session = store.sessions[token];
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return store.users.find((user) => user.id === session.userId) ?? null;
}

function canAccessRoom(room, user) {
  if (room.deletedAt) return false;
  if (room.id === "demo" || !room.ownerId) return true;
  if (!user) return false;
  return room.ownerId === user.id || (room.members ?? []).some((member) => member.userId === user.id);
}

function roomAccessRole(room, user) {
  if (room.id === "demo" || !room.ownerId || room.ownerId === user?.id) return "owner";
  return (room.members ?? []).find((member) => member.userId === user?.id)?.role ?? "viewer";
}

function isRoomOwner(room, user) {
  return room.id === "demo" || !room.ownerId || Boolean(user && room.ownerId === user.id);
}

function canEditRoom(room, user) {
  if (isRoomOwner(room, user)) return true;
  return Boolean(user && (room.members ?? []).some((member) => member.userId === user.id && member.role === "editor"));
}

function assertRoomEditor(room, user) {
  if (!canAccessRoom(room, user) || !canEditRoom(room, user)) {
    throw Object.assign(new Error("Editing access is no longer available. Your audio was not saved."), { statusCode: 403 });
  }
}

async function createSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  await authStore.update((store) => {
    store.sessions[token] = {
      userId,
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString(),
    };
  });
  res.setHeader(
    "Set-Cookie",
    `collabmuse_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`,
  );
}

async function clearSession(req, res) {
  const token = parseCookies(req).collabmuse_session;
  if (token) {
    await authStore.update((store) => { delete store.sessions[token]; });
  }
  res.setHeader("Set-Cookie", "collabmuse_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

async function ensureRoom(roomId, roomPatch = {}, allowCreate = false) {
  if (typeof roomPatch !== "function" && Object.keys(roomPatch).length === 0) {
    const store = await readStore();
    if (store.rooms[roomId]) return store.rooms[roomId];
    if (!allowCreate) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
  }

  return roomStore.update(async (store) => {
  const existing = store.rooms[roomId];
  if (existing && allowCreate) throw Object.assign(new Error("Room already exists"), { statusCode: 409 });
  if (!existing && !allowCreate) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
  if (existing && typeof roomPatch !== "function" && Object.keys(roomPatch).length === 0) return existing;
  roomPatch = typeof roomPatch === "function" ? await roomPatch(existing) : roomPatch;

  const now = new Date().toISOString();

  store.rooms[roomId] = existing
    ? {
        ...existing,
        events: existing.events ?? initialEvents,
        waveformPeaks: existing.waveformPeaks ?? null,
        audioAvailable: existing.audioAvailable ?? false,
        audioStorageName: existing.audioStorageName ?? null,
        audioMimeType: existing.audioMimeType ?? null,
        notes: existing.notes ?? initialNotes,
        timelineRegions: existing.timelineRegions ?? initialTimelineRegions,
        tracks: existing.tracks ?? initialTracks,
        composition: existing.composition ?? null,
        audioClips: existing.audioClips ?? [],
        versions: existing.versions ?? [],
        bpm: existing.bpm ?? 96,
        timeSignature: existing.timeSignature ?? "4/4",
        members: existing.members ?? [],
        invites: existing.invites ?? [],
        ...roomPatch,
        id: roomId,
        updatedAt: now,
      }
    : {
        id: roomId,
        title: roomPatch.title ?? `${roomId} room`,
        ownerId: roomPatch.ownerId ?? null,
        ownerName: roomPatch.ownerName ?? "Guest creator",
        uploadedFileName: roomPatch.uploadedFileName ?? "",
        waveformPeaks: roomPatch.waveformPeaks ?? null,
        audioAvailable: roomPatch.audioAvailable ?? false,
        audioStorageName: roomPatch.audioStorageName ?? null,
        audioMimeType: roomPatch.audioMimeType ?? null,
        events: roomPatch.events ?? [],
        notes: roomPatch.notes ?? [],
        timelineRegions: roomPatch.timelineRegions ?? [],
        tracks: roomPatch.tracks ?? initialTracks.map((track) => ({ ...track, clips: 0 })),
        composition: roomPatch.composition ?? null,
        audioClips: roomPatch.audioClips ?? [],
        versions: roomPatch.versions ?? [],
        bpm: roomPatch.bpm ?? 96,
        timeSignature: roomPatch.timeSignature ?? "4/4",
        members: roomPatch.members ?? [],
        invites: roomPatch.invites ?? [],
        createdAt: now,
        updatedAt: now,
      };

  return store.rooms[roomId];
  });
}

function eventsWithEvent(events, event) {
  if (!event || events.some((item) => item.id === event.id)) return events;
  return [event, ...events].slice(0, 30);
}

async function appendEvent(roomId, event) {
  return ensureRoom(roomId, (room) => ({ events: eventsWithEvent(room?.events ?? [], event) }));
}

async function appendNote(roomId, note, event) {
  if (!note || typeof note.id !== "string" || !note.id.trim() || note.id.length > 160 ||
      typeof note.author !== "string" || !note.author.trim() || note.author.length > 60 ||
      typeof note.message !== "string" || !note.message.trim() || note.message.length > 1000 ||
      typeof note.time !== "string" || !note.time.trim() || note.time.length > 80) {
    throw Object.assign(new Error("Note must include a valid id, author, message and time."), { statusCode: 400 });
  }
  return ensureRoom(roomId, (room) => {
    const notes = room?.notes ?? [];
    return { notes: notes.some((item) => item.id === note.id) ? notes : [note, ...notes], events: eventsWithEvent(room.events ?? [], event) };
  });
}

async function updateTimelineRegions(roomId, timelineRegions) {
  return ensureRoom(roomId, { timelineRegions });
}

function assertArrangementEpoch(room, epoch) {
  if ((epoch ?? 0) !== (room.arrangementEpoch ?? 0)) {
    throw Object.assign(new Error("The room was restored while you were editing. Reload the saved room before editing again."), { statusCode: 409 });
  }
}

function assertKnownRegionClips(current, regions) {
  const clipIds = new Set((current.audioClips ?? []).map((clip) => clip.id));
  if (regions.some((region) => region.clipId && !clipIds.has(region.clipId) && !(current.timelineRegions ?? []).some((saved) => saved.id === region.id && saved.clipId === region.clipId))) {
    throw Object.assign(new Error("An audio clip was removed. Reload the room before editing it."), { statusCode: 409 });
  }
}

async function updateTracks(roomId, tracks) {
  return ensureRoom(roomId, { tracks });
}

async function updateComposition(roomId, composition) {
  return ensureRoom(roomId, { composition });
}

function stringSeed(value) {
  return Array.from(value).reduce((seed, character) => ((seed * 31) + character.charCodeAt(0)) >>> 0, 17);
}

function generateLocalComposition({ prompt = "", key = "C", mood = "warm", style = "R&B", bars = 2, sourceAnalysis = null }) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootIndex = Math.max(0, noteNames.indexOf(key));
  const isMinor = /minor|sad|dark|moody/i.test(`${mood} ${prompt}`);
  const intervals = isMinor ? minorScaleIntervals : majorScaleIntervals;
  let seed = stringSeed(`${prompt}-${key}-${mood}-${style}-${bars}`);
  const count = Math.max(8, Math.min(24, Number(bars) * 8));
  const durationPattern = [0.5, 0.5, 1, 0.5, 0.5, 1, 1, 1];
  const notes = Array.from({ length: count }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const degree = (seed + index * 2) % intervals.length;
    const semitone = rootIndex + intervals[degree];
    const octave = 4 + Math.floor(semitone / 12) + (index % 8 === 7 ? 1 : 0);
    const pitch = `${noteNames[semitone % 12]}${Math.min(5, octave)}`;
    return {
      pitch,
      beats: durationPattern[index % durationPattern.length],
      velocity: Math.round((0.58 + ((seed % 30) / 100)) * 100) / 100,
    };
  });

  return {
    id: `composition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `${mood.charAt(0).toUpperCase()}${mood.slice(1)} ${style} idea`,
    key: `${key} ${isMinor ? "minor" : "major"}`,
    tempo: sourceAnalysis?.bpm || (/slow|calm|dream/i.test(mood) ? 72 : /energetic|bright|dance/i.test(mood) ? 112 : 88),
    style,
    explanation: `A ${count}-note ${style} motif shaped around a ${mood} ${key} ${isMinor ? "minor" : "major"} scale${sourceAnalysis?.bpm ? ` and matched to the source clip at ${sourceAnalysis.bpm} BPM` : ""}.`,
    notes,
    provider: "local",
  };
}

function extractResponseText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

async function generateAiComposition(input) {
  if (!process.env.OPENAI_API_KEY) return generateLocalComposition(input);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(90000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      store: false,
      max_output_tokens: 1200,
      instructions: "You are a music composition copilot. Create an original, short, playable monophonic melody. Return only data matching the schema. Avoid copying any existing song or artist melody.",
      input: `Create ${input.bars ?? 2} bars in ${input.key ?? "C"}, style ${input.style ?? "R&B"}, mood ${input.mood ?? "warm"}. Creative direction: ${input.prompt ?? "original melodic idea"}. ${input.sourceAnalysis ? `Match this uploaded clip analysis: ${JSON.stringify(input.sourceAnalysis)}.` : ""}`,
      text: {
        format: {
          type: "json_schema",
          name: "music_composition",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "key", "tempo", "style", "explanation", "notes"],
            properties: {
              title: { type: "string" },
              key: { type: "string" },
              tempo: { type: "integer", minimum: 50, maximum: 160 },
              style: { type: "string" },
              explanation: { type: "string" },
              notes: {
                type: "array",
                minItems: 8,
                maxItems: 32,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["pitch", "beats", "velocity"],
                  properties: {
                    pitch: { type: "string", enum: compositionPitches },
                    beats: { type: "number", enum: [0.25, 0.5, 1, 2] },
                    velocity: { type: "number", minimum: 0.3, maximum: 1 },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    discardMusicErrorResponse(response);
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }
  const responseData = await readBoundedJson(response, 256 * 1024);
  const outputText = extractResponseText(responseData);
  if (!outputText) throw new Error("OpenAI response did not contain composition data");
  const composition = JSON.parse(outputText);
  return {
    ...composition,
    id: `composition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    provider: "openai",
  };
}

const readBody = readJsonRequest;

const readBinaryBody = (req, byteLimit = maxAudioBytes) => readBinaryRequest(req, byteLimit);

function safePathSegment(value, fallback) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function isValidRoomId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value) && !Object.hasOwn(Object.prototype, value);
}

function isSafeAudioName(name) {
  return typeof name === "string" && name.length > 0 && name !== "." && name !== ".." && path.basename(name) === name && !name.includes("\\");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function publicAudioClips(clips = []) {
  return clips.map((clip) => ({
    id: clip.id,
    name: clip.name,
    trackId: clip.trackId,
    duration: clip.duration,
    createdAt: clip.createdAt,
    analysis: clip.analysis,
    waveformPeaks: clip.waveformPeaks ?? [],
    generation: clip.generation ?? undefined,
  }));
}

function publicVersions(versions = []) {
  return versions.map((version) => ({
    id: version.id,
    name: version.name,
    createdAt: version.createdAt,
    trackCount: version.snapshot?.tracks?.length ?? 0,
    regionCount: version.snapshot?.timelineRegions?.length ?? 0,
  }));
}

function publicRoom(room) {
  const { invites, revokedInvites, audioStorageName, audioMimeType, ...visible } = room;
  return { ...visible, audioClips: publicAudioClips(room.audioClips), versions: publicVersions(room.versions) };
}

function versionSnapshot(room) {
  return {
    tracks: room.tracks ?? initialTracks,
    timelineRegions: room.timelineRegions ?? initialTimelineRegions,
    composition: room.composition ?? null,
    audioClips: room.audioClips ?? [],
    uploadedFileName: room.uploadedFileName ?? "",
    audioAvailable: room.audioAvailable ?? false,
    referenceMuted: Boolean(room.referenceMuted),
    audioStorageName: room.audioStorageName ?? null,
    audioMimeType: room.audioMimeType ?? null,
    waveformPeaks: room.waveformPeaks ?? null,
    bpm: room.bpm ?? 96,
    timeSignature: room.timeSignature ?? "4/4",
  };
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/auth/me" && req.method === "GET") {
    const user = await getSessionUser(req);
    sendJson(res, 200, { user: user ? publicUser(user) : null });
    return true;
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name ?? "").trim().slice(0, 60);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      sendJson(res, 400, { error: "Use a name, valid email, and password of at least 8 characters" });
      return true;
    }
    const salt = randomBytes(16).toString("hex");
    const user = {
      id: `user-${randomBytes(8).toString("hex")}`,
      name,
      email,
      salt,
      passwordHash: scryptSync(password, salt, 64).toString("hex"),
      createdAt: new Date().toISOString(),
    };
    const created = await authStore.update((store) => {
      if (store.users.some((existing) => existing.email === email)) return false;
      store.users.push(user);
      return true;
    });
    if (!created) {
      sendJson(res, 409, { error: "An account already exists for this email" });
      return true;
    }
    await createSession(res, user.id);
    sendJson(res, 201, { user: publicUser(user) });
    return true;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const store = await readAuthStore();
    const user = store.users.find((item) => item.email === email);
    const suppliedHash = user ? scryptSync(String(body.password ?? ""), user.salt, 64) : null;
    const storedHash = user ? Buffer.from(user.passwordHash, "hex") : null;
    if (!user || !suppliedHash || !storedHash || !timingSafeEqual(suppliedHash, storedHash)) {
      sendJson(res, 401, { error: "Email or password is incorrect" });
      return true;
    }
    await createSession(res, user.id);
    sendJson(res, 200, { user: publicUser(user) });
    return true;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    await clearSession(req, res);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/rooms/import" && req.method === "POST") {
    const user = await getSessionUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Log in to import a project into your account." });
      return true;
    }
    if (Number(req.headers["content-length"] ?? 0) > maxBackupBytes) {
      sendJson(res, 413, { error: "Backup exceeds the 100 MB import limit." });
      return true;
    }
    let archive;
    let manifest;
    try {
      const bytes = await readBinaryBody(req, maxBackupBytes);
      const names = new Set();
      let total = 0;
      archive = unzipSync(bytes, { filter: (entry) => {
        const isAudio = entry.name.startsWith("audio/") && entry.name.length > 6;
        const name = isAudio ? entry.name.slice(6) : "";
        if (names.has(entry.name) || names.size >= 3000 || entry.compression !== 0 || entry.originalSize !== entry.size ||
            (!isAudio && entry.name !== "project.json") || (isAudio && (!/^[a-zA-Z0-9._-]{1,255}$/.test(name) || name === "." || name === ".."))) {
          throw new Error("Invalid backup entry");
        }
        names.add(entry.name);
        total += entry.originalSize;
        if (total > maxBackupBytes || (entry.name === "project.json" && entry.originalSize > 5 * 1024 * 1024)) throw new Error("Backup is too large");
        return true;
      } });
      if (!archive["project.json"]) throw new Error("Missing project metadata");
      manifest = JSON.parse(strFromU8(archive["project.json"]));
      if (manifest?.format !== "collabmuse-project" || ![1, 2].includes(manifest.formatVersion) || !manifest.project) throw new Error("Unsupported backup format");
      const audioNames = Object.keys(archive).filter((name) => name.startsWith("audio/")).map((name) => name.slice(6));
      if (manifest.formatVersion === 2) {
        if (!manifest.checksums || typeof manifest.checksums !== "object" || Object.keys(manifest.checksums).length !== audioNames.length) throw new Error("Audio checksum list is incomplete");
        for (const name of audioNames) {
          if (createHash("sha256").update(archive[`audio/${name}`]).digest("hex") !== manifest.checksums[name]) throw new Error("Audio checksum mismatch");
        }
      }
      const project = manifest.project;
      const validArray = (items, limit) => Array.isArray(items) && items.length <= limit && items.every((item) => item && typeof item === "object" && !Array.isArray(item));
      const validateSnapshot = (snapshot) => {
        if (!snapshot || typeof snapshot !== "object" || !validArray(snapshot.tracks, 12) || !validArray(snapshot.timelineRegions, 5000) || !validArray(snapshot.audioClips, 3000)) throw new Error("Invalid project data");
        if (snapshot.tracks.some((track) => typeof track.id !== "string" || typeof track.name !== "string") || snapshot.timelineRegions.some((region) => typeof region.id !== "string" || !Number.isFinite(region.left) || !Number.isFinite(region.width))) throw new Error("Invalid timeline data");
        if (snapshot.audioClips.some((clip) => typeof clip.id !== "string" || typeof clip.name !== "string" || !Number.isFinite(clip.duration) || clip.duration <= 0)) throw new Error("Invalid audio metadata");
        const clipIds = new Set(snapshot.audioClips.map((clip) => clip.id));
        if (clipIds.size !== snapshot.audioClips.length || new Set(snapshot.timelineRegions.map((region) => region.id)).size !== snapshot.timelineRegions.length || new Set(snapshot.tracks.map((track) => track.id)).size !== snapshot.tracks.length) throw new Error("Duplicate project item identifiers");
        if (snapshot.timelineRegions.some((region) => region.clipId != null && (typeof region.clipId !== "string" || !clipIds.has(region.clipId)))) throw new Error("Timeline references a missing audio clip");
        const references = snapshot.audioClips.map((clip) => clip.storageName);
        if (snapshot.audioStorageName) references.push(snapshot.audioStorageName);
        if (snapshot.audioAvailable && !snapshot.audioStorageName) throw new Error("Missing reference audio");
        if (references.some((name) => typeof name !== "string" || !audioNames.includes(name))) throw new Error("Missing audio file");
      };
      validateSnapshot(project);
      if (!validArray(project.versions ?? [], maxRoomVersions) || !validArray(project.notes ?? [], 5000) || !validArray(project.events ?? [], 5000)) throw new Error("Invalid project data");
      if ((project.notes ?? []).some((note) => typeof note.id !== "string" || typeof note.author !== "string" || typeof note.message !== "string" || typeof note.time !== "string")) throw new Error("Invalid note data");
      for (const version of project.versions ?? []) {
        if (typeof version.id !== "string" || typeof version.name !== "string") throw new Error("Invalid version metadata");
        validateSnapshot(version.snapshot);
      }
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, { error: `Invalid or unsupported backup: ${error instanceof Error ? error.message : "unknown error"}` });
      return true;
    }
    const roomId = `import-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
    const directory = path.join(uploadsDir, roomId);
    await mkdir(uploadsDir, { recursive: true });
    await mkdir(directory);
    let commitStarted = false;
    try {
      for (const [name, data] of Object.entries(archive)) {
        if (name.startsWith("audio/")) await writeFile(path.join(directory, name.slice(6)), data, { flag: "wx" });
      }
      const project = manifest.project;
      commitStarted = true;
      const room = await ensureRoom(roomId, {
        title: `${String(project.title ?? "Imported room").slice(0, 48)} (imported)`,
        ownerId: user?.id ?? null, ownerName: user?.name ?? "Guest creator",
        uploadedFileName: project.uploadedFileName, waveformPeaks: project.waveformPeaks,
        audioAvailable: project.audioAvailable, audioStorageName: project.audioStorageName, audioMimeType: project.audioMimeType,
        referenceMuted: Boolean(project.referenceMuted),
        events: project.events, notes: project.notes, timelineRegions: project.timelineRegions, tracks: project.tracks,
        composition: project.composition, audioClips: project.audioClips, versions: project.versions,
        bpm: project.bpm, timeSignature: project.timeSignature, members: [], invites: [],
      }, true);
      sendJson(res, 201, { room: publicRoom(room), ...(manifest.formatVersion === 1 ? { warning: "This older backup has no audio checksums. Verify the imported audio before relying on it." } : {}) });
    } catch (error) {
      if (!commitStarted) await rm(directory, { recursive: true, force: true });
      throw error;
    }
    return true;
  }

  if (pathname === "/api/rooms/trash" && req.method === "GET") {
    const store = await readStore();
    const user = await getSessionUser(req);
    const rooms = Object.values(store.rooms)
      .filter((room) => room.deletedAt && isRoomOwner(room, user))
      .map(publicRoom);
    sendJson(res, 200, { rooms });
    return true;
  }

  const restoreRoomMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/restore$/);
  if (restoreRoomMatch && req.method === "POST") {
    const roomId = decodeURIComponent(restoreRoomMatch[1]);
    const user = await getSessionUser(req);
    const restored = await ensureRoom(roomId, (room) => {
      if (!room.deletedAt) throw Object.assign(new Error("Room is not in recently deleted"), { statusCode: 404 });
      if (!isRoomOwner(room, user)) throw Object.assign(new Error("Only the room owner can restore this room"), { statusCode: 403 });
      return { deletedAt: null };
    });
    sendJson(res, 200, { room: publicRoom(restored) });
    return true;
  }

  if (pathname === "/api/rooms" && req.method === "GET") {
    const store = await readStore();
    const user = await getSessionUser(req);
    sendJson(res, 200, {
      rooms: Object.values(store.rooms)
        .filter((room) => canAccessRoom(room, user))
        .map((room) => ({ ...publicRoom(room), currentRole: roomAccessRole(room, user) })),
    });
    return true;
  }

  if (pathname === "/api/rooms" && req.method === "POST") {
    const body = await readBody(req);
    const roomId = body.id ?? "demo";
    const user = await getSessionUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Log in to create or duplicate a private room." });
      return true;
    }
    if (!isValidRoomId(roomId)) {
      sendJson(res, 400, { error: "Invalid room identifier." });
      return true;
    }
    if (Object.keys(body).some((key) => !["id", "title", "sourceRoomId"].includes(key))) {
      sendJson(res, 400, { error: "Room data must be added through upload, invitation, or import." });
      return true;
    }
    if (body.sourceRoomId) {
      if (!isValidRoomId(body.sourceRoomId)) {
        sendJson(res, 400, { error: "Invalid source room identifier." });
        return true;
      }
      const sourceRoomId = body.sourceRoomId;
      const store = await readStore();
      const sourceRoom = store.rooms[sourceRoomId];
      if (!sourceRoom) {
        sendJson(res, 404, { error: "Source room not found" });
        return true;
      }
      if (!canAccessRoom(sourceRoom, user)) {
        sendJson(res, user ? 403 : 401, { error: "You cannot duplicate this room" });
        return true;
      }
      const sourceDirectory = path.join(uploadsDir, sourceRoomId);
      const targetDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
      const references = new Set();
      for (const snapshot of [sourceRoom, ...(sourceRoom.versions ?? []).map((version) => version.snapshot)]) {
        if (snapshot?.audioAvailable) {
          if (!snapshot.audioStorageName) throw Object.assign(new Error("Source reference audio is missing; room was not duplicated."), { statusCode: 409 });
          references.add(snapshot.audioStorageName);
        }
        for (const clip of snapshot?.audioClips ?? []) {
          if (!clip.storageName) throw Object.assign(new Error("Source clip audio is missing; room was not duplicated."), { statusCode: 409 });
          references.add(clip.storageName);
        }
      }
      const sourceEntries = await readdir(sourceDirectory).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      if ([...references].some((name) => typeof name !== "string" || path.basename(name) !== name || !sourceEntries.includes(name))) {
        throw Object.assign(new Error("Source audio file is missing; room was not duplicated."), { statusCode: 409 });
      }
      await mkdir(uploadsDir, { recursive: true });
      try { await mkdir(targetDirectory); }
      catch (error) {
        if (error.code === "EEXIST") throw Object.assign(new Error("Room storage already exists."), { statusCode: 409 });
        throw error;
      }
      let room;
      let commitStarted = false;
      try {
        for (const name of references) await cp(path.join(sourceDirectory, name), path.join(targetDirectory, name), { errorOnExist: true, force: false });
        commitStarted = true;
        room = await ensureRoom(roomId, {
        ...sourceRoom,
        id: roomId,
        title: body.title ?? `${sourceRoom.title} copy`,
        ownerId: user?.id ?? null,
        ownerName: user?.name ?? "Guest creator",
        members: [],
        invites: [],
        revokedInvites: {},
        createdAt: undefined,
        updatedAt: undefined,
        events: [{
          id: `event-copy-${Date.now()}`,
          kind: "sync",
          title: "Room duplicated",
          detail: `Created from ${sourceRoom.title}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }, ...(sourceRoom.events ?? [])].slice(0, 40),
        }, true);
      } catch (error) {
        if (!commitStarted) await rm(targetDirectory, { recursive: true, force: true });
        throw error;
      }
      sendJson(res, 201, { room: publicRoom(room) });
      return true;
    }
    const room = await ensureRoom(roomId, {
      title: body.title,
      ownerId: user.id,
      ownerName: user.name,
    }, true);
    sendJson(res, 200, { room: publicRoom(room) });
    return true;
  }

  const inviteMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/invites$/);
  const joinMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
  const membersMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/members$/);
  const memberMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/members\/([^/]+)$/);

  if (joinMatch && req.method === "POST") {
    const user = await getSessionUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Log in before joining a room" });
      return true;
    }
    const roomId = decodeURIComponent(joinMatch[1]);
    const body = await readBody(req);
    let member;
    const joinedRoom = await ensureRoom(roomId, (room) => {
      if (room.deletedAt) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      const invite = (room.invites ?? []).find((item) => item.token === body.token && Date.parse(item.expiresAt) > Date.now());
      if (!invite || (room.revokedInvites?.[user.id] ?? []).includes(body.token)) throw Object.assign(new Error("This invitation is invalid or expired"), { statusCode: 403 });
      const existingMember = (room.members ?? []).find((item) => item.userId === user.id);
      const invitedRole = invite.role === "viewer" ? "viewer" : "editor";
      const role = existingMember?.role ?? invitedRole;
      member = { userId: user.id, name: user.name, email: user.email, role, joinedAt: existingMember?.joinedAt ?? new Date().toISOString() };
      return { members: [...(room.members ?? []).filter((item) => item.userId !== user.id), member] };
    });
    sendJson(res, 200, { room: publicRoom(joinedRoom), member });
    return true;
  }

  if (inviteMatch && req.method === "POST") {
    const user = await getSessionUser(req);
    const roomId = decodeURIComponent(inviteMatch[1]);
    const room = await ensureRoom(roomId);
    if (room.deletedAt) { sendJson(res, 404, { error: "Room not found" }); return true; }
    if (!isRoomOwner(room, user)) {
      sendJson(res, 403, { error: "Only the room owner can invite collaborators" });
      return true;
    }
    const body = await readBody(req);
    const role = body.role === "viewer" ? "viewer" : "editor";
    const invite = {
      token: randomBytes(18).toString("hex"),
      role,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await ensureRoom(roomId, (current) => ({ invites: [invite, ...(current.invites ?? [])].slice(0, 10) }));
    sendJson(res, 201, { token: invite.token, expiresAt: invite.expiresAt, role: invite.role });
    return true;
  }

  if (membersMatch && req.method === "GET") {
    const room = await ensureRoom(decodeURIComponent(membersMatch[1]));
    const user = await getSessionUser(req);
    if (!canAccessRoom(room, user)) {
      sendJson(res, user ? 403 : 401, { error: "Room access denied" });
      return true;
    }
    sendJson(res, 200, {
      owner: { userId: room.ownerId, name: room.ownerName ?? "Room owner", role: "owner" },
      members: room.members ?? [],
      currentRole: roomAccessRole(room, user),
    });
    return true;
  }

  if (memberMatch && (req.method === "PATCH" || req.method === "DELETE")) {
    const roomId = decodeURIComponent(memberMatch[1]);
    const memberId = decodeURIComponent(memberMatch[2]);
    const room = await ensureRoom(roomId);
    if (room.deletedAt) { sendJson(res, 404, { error: "Room not found" }); return true; }
    const user = await getSessionUser(req);
    if (!isRoomOwner(room, user)) {
      sendJson(res, 403, { error: "Only the room owner can manage members" });
      return true;
    }
    let role;
    if (req.method === "PATCH") {
      const body = await readBody(req);
      role = body.role === "viewer" ? "viewer" : "editor";
    }
    const updatedRoom = await ensureRoom(roomId, (current) => {
      const members = req.method === "PATCH"
        ? (current.members ?? []).map((member) => member.userId === memberId ? { ...member, role } : member)
        : (current.members ?? []).filter((member) => member.userId !== memberId);
      if (req.method !== "DELETE") return { members };
      const previous = current.revokedInvites?.[memberId] ?? [];
      const tokens = (current.invites ?? []).map((invite) => invite.token);
      return { members, revokedInvites: { ...current.revokedInvites, [memberId]: [...new Set([...previous, ...tokens])] } };
    });
    const sockets = await io.in(roomId).fetchSockets();
    for (const connected of sockets) {
      const socketUser = await getSessionUser(connected.request);
      if (socketUser?.id !== memberId) continue;
      if (req.method === "DELETE") {
        connected.emit("room:access-denied", { roomId });
        connected.leave(roomId);
        connected.data.roomId = null;
      } else {
        connected.emit("room:access-changed", { roomId, role });
      }
    }
    if (req.method === "DELETE") await broadcastPresence(roomId);
    sendJson(res, 200, { members: updatedRoom.members });
    return true;
  }

  const protectedRoomMatch = pathname.match(/^\/api\/rooms\/([^/]+)/);
  if (protectedRoomMatch) {
    const room = await ensureRoom(decodeURIComponent(protectedRoomMatch[1]));
    if (room.deletedAt) {
      sendJson(res, 404, { error: "Room not found" });
      return true;
    }
    const user = await getSessionUser(req);
    if (!canAccessRoom(room, user)) {
      sendJson(res, user ? 403 : 401, { error: user ? "You are not a member of this room" : "Log in to access this room" });
      return true;
    }
    if (req.method !== "GET" && !canEditRoom(room, user)) {
      sendJson(res, 403, { error: "Viewer access is read-only" });
      return true;
    }
  }

  const backupMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/backup$/);
  if (backupMatch && req.method === "GET") {
    const roomId = decodeURIComponent(backupMatch[1]);
    const room = await ensureRoom(roomId);
    const user = await getSessionUser(req);
    if (!isRoomOwner(room, user)) {
      sendJson(res, 403, { error: "Only the room owner can download a project backup" });
      return true;
    }
    const directory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    let entries = [];
    try {
      entries = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const referenced = new Set();
    let missingReference = false;
    const collect = (snapshot) => {
      if (snapshot?.audioAvailable) {
        if (typeof snapshot.audioStorageName === "string" && snapshot.audioStorageName) referenced.add(snapshot.audioStorageName);
        else missingReference = true;
      }
      for (const clip of snapshot?.audioClips ?? []) {
        if (typeof clip.storageName === "string" && clip.storageName) referenced.add(clip.storageName);
        else missingReference = true;
      }
    };
    collect(room);
    for (const version of room.versions ?? []) collect(version.snapshot);
    if (missingReference || [...referenced].some((name) => path.basename(name) !== name || !entries.includes(name))) {
      sendJson(res, 409, { error: "A referenced audio file is missing. Backup was not created." });
      return true;
    }
    const backupEntries = [...referenced];
    if (backupEntries.length >= 3000) {
      sendJson(res, 413, { error: "Project has too many audio files for backup import." });
      return true;
    }
    let audioSize = 0;
    const checksums = {};
    const audioSizes = {};
    for (const name of backupEntries) {
      audioSizes[name] = (await stat(path.join(directory, name))).size;
      audioSize += audioSizes[name];
      if (audioSize > maxBackupBytes) {
        sendJson(res, 413, { error: "Project audio exceeds the backup import limit; backup was not created." });
        return true;
      }
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path.join(directory, name))) hash.update(chunk);
      checksums[name] = hash.digest("hex");
    }
    const { invites, revokedInvites, members, ownerId, ...project } = room;
    const manifest = { format: "collabmuse-project", formatVersion: 2, exportedAt: new Date().toISOString(), checksums, project };
    const manifestData = strToU8(JSON.stringify(manifest, null, 2));
    const zipOverhead = 1024 + backupEntries.reduce((total, name) => total + 256 + 2 * Buffer.byteLength(name), 0);
    if (manifestData.length > 5 * 1024 * 1024 || audioSize + manifestData.length + zipOverhead > maxBackupBytes) {
      sendJson(res, 413, { error: "Project exceeds the backup import limit; backup was not created." });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safePathSegment(roomId, "room")}-backup.zip"`,
      "Cache-Control": "no-store",
    });
    const zip = new Zip((error, chunk) => {
      if (error) res.destroy(error);
      else res.write(chunk);
    });
    const manifestFile = new ZipPassThrough("project.json");
    zip.add(manifestFile);
    manifestFile.push(manifestData, true);
    try {
      for (const name of backupEntries) {
        const file = new ZipPassThrough(`audio/${name}`);
        const verifier = createBackupVerifier(checksums[name], audioSizes[name]);
        zip.add(file);
        for await (const chunk of createReadStream(path.join(directory, name))) {
          if (res.destroyed) throw new Error("Backup download interrupted");
          verifier.update(chunk);
          file.push(chunk);
          if (res.writableNeedDrain) {
            await new Promise((resolve, reject) => {
              const cleanup = () => { res.off("drain", drained); res.off("close", closed); res.off("error", failed); };
              const drained = () => { cleanup(); resolve(); };
              const closed = () => { cleanup(); reject(new Error("Backup download interrupted")); };
              const failed = (error) => { cleanup(); reject(error); };
              res.once("drain", drained);
              res.once("close", closed);
              res.once("error", failed);
            });
          }
        }
        verifier.verify();
        file.push(new Uint8Array(), true);
      }
      zip.end();
      res.end();
    } catch (error) {
      zip.terminate();
      res.destroy(error);
    }
    return true;
  }

  const eventMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
  if (eventMatch && req.method === "GET") {
    const room = await ensureRoom(eventMatch[1]);
    sendJson(res, 200, {
      title: room.title,
      events: room.events,
      notes: room.notes,
      uploadedFileName: room.uploadedFileName,
      waveformPeaks: room.waveformPeaks,
      audioAvailable: room.audioAvailable,
      referenceMuted: Boolean(room.referenceMuted),
      timelineRegions: room.timelineRegions,
      tracks: room.tracks ?? initialTracks,
      composition: room.composition ?? null,
      audioClips: publicAudioClips(room.audioClips),
      versions: publicVersions(room.versions),
      bpm: room.bpm ?? 96,
      timeSignature: room.timeSignature ?? "4/4",
    });
    return true;
  }

  const audioMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/audio$/);
  const clipsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/clips$/);
  const clipAudioMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/clips\/([^/]+)\/audio$/);
  const clipMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/clips\/([^/]+)$/);

  if (clipsMatch && req.method === "GET") {
    const room = await ensureRoom(decodeURIComponent(clipsMatch[1]));
    sendJson(res, 200, { audioClips: publicAudioClips(room.audioClips) });
    return true;
  }

  if (clipsMatch && req.method === "POST") {
    const roomId = decodeURIComponent(clipsMatch[1]);
    const initialRoom = await ensureRoom(roomId);
    const uploadEpoch = getUploadEpoch(req.headers["x-arrangement-epoch"], initialRoom.arrangementEpoch ?? 0);
    const uploadUrl = new URL(req.url ?? pathname, `http://${req.headers.host ?? `localhost:${port}`}`);
    const requestedName = uploadUrl.searchParams.get("name") || "audio-clip";
    const trackId = safePathSegment(uploadUrl.searchParams.get("trackId"), "track");
    const duration = Number(uploadUrl.searchParams.get("duration"));
    if (!Number.isFinite(duration) || duration <= 0) {
      sendJson(res, 400, { error: "The audio duration could not be read. Choose a playable audio file and try again." });
      return true;
    }
    const bpm = Math.max(0, Number(req.headers["x-audio-bpm"]) || 0);
    const loudnessDb = Number(req.headers["x-audio-loudness"] ?? 0);
    const energy = ["low", "medium", "high"].includes(req.headers["x-audio-energy"]) ? req.headers["x-audio-energy"] : "medium";
    const dynamics = req.headers["x-audio-dynamics"] === "varied" ? "varied" : "steady";
    let waveformPeaks = [];
    try {
      const parsedPeaks = JSON.parse(String(req.headers["x-waveform-peaks"] ?? "[]"));
      if (Array.isArray(parsedPeaks)) waveformPeaks = parsedPeaks.slice(0, 128).map((value) => Math.max(2, Math.min(100, Number(value) || 2)));
    } catch {
      waveformPeaks = [];
    }
    const clipId = `clip-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const storageName = `${clipId}-${safePathSegment(requestedName, "audio-clip")}`;
    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    const audioBuffer = await readBinaryBody(req);
    if (audioBuffer.length === 0) {
      sendJson(res, 400, { error: "Audio file is empty" });
      return true;
    }
    await mkdir(roomDirectory, { recursive: true });
    await writeFile(path.join(roomDirectory, storageName), audioBuffer);
    const clip = {
      id: clipId,
      name: requestedName.slice(0, 180),
      trackId,
      duration,
      storageName,
      mimeType: req.headers["content-type"] || "audio/mpeg",
      createdAt: new Date().toISOString(),
      analysis: { bpm, loudnessDb, energy, dynamics },
      waveformPeaks,
    };
    let updatedRoom;
    try {
      const user = await getSessionUser(req);
      updatedRoom = await ensureRoom(roomId, (current) => {
        assertRoomEditor(current, user);
        assertArrangementEpoch(current, uploadEpoch);
        return { audioClips: [...(current.audioClips ?? []), clip] };
      });
    } catch (error) {
      await rm(path.join(roomDirectory, storageName), { force: true });
      throw error;
    }
    io.to(roomId).emit("room:clips", { arrangementEpoch: updatedRoom.arrangementEpoch ?? 0, audioClips: publicAudioClips(updatedRoom.audioClips) });
    sendJson(res, 201, { clip: { ...clip, storageName: undefined, mimeType: undefined } });
    return true;
  }

  if (clipAudioMatch && req.method === "GET") {
    const roomId = decodeURIComponent(clipAudioMatch[1]);
    const clipId = decodeURIComponent(clipAudioMatch[2]);
    const room = await ensureRoom(roomId);
    const clip = (room.audioClips ?? []).find((item) => item.id === clipId);
    if (!isSafeAudioName(clip?.storageName)) {
      sendJson(res, 404, { error: "Audio clip not found" });
      return true;
    }
    const audioBuffer = await readFile(path.join(uploadsDir, safePathSegment(roomId, "room"), clip.storageName));
    sendAudio(req, res, audioBuffer, clip.mimeType);
    return true;
  }

  if (clipMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(clipMatch[1]);
    const clipId = decodeURIComponent(clipMatch[2]);
    const rawEpoch = req.headers["x-arrangement-epoch"];
    const arrangementEpoch = rawEpoch === undefined ? 0 : Number(rawEpoch);
    let event;
    let clipTrackId;
    let affectedNotePositions = [];
    const updated = await ensureRoom(roomId, (current) => {
      assertArrangementEpoch(current, arrangementEpoch);
      const clip = (current.audioClips ?? []).find((item) => item.id === clipId);
      if (!clip) throw Object.assign(new Error("Audio clip not found"), { statusCode: 404 });
      clipTrackId = clip.trackId;
      if ((current.versions?.length ?? 0) >= maxRoomVersions) throw Object.assign(new Error("Version limit reached. Cannot save a recovery version before deleting the clip."), { statusCode: 409 });
      const removedRegions = (current.timelineRegions ?? []).filter((region) => region.clipId === clipId);
      const backup = { id: `version-${Date.now()}-${randomBytes(6).toString("hex")}`, name: `Before deleting ${clip.name}`.slice(0, 80), createdAt: new Date().toISOString(), snapshot: versionSnapshot(current) };
      event = { id: `event-${Date.now()}-${randomBytes(6).toString("hex")}`, kind: "upload", title: "Track clip removed", detail: `${clip.name} removed; a recovery version was saved.`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      const notes = (current.notes ?? []).map((note) => {
        const region = removedRegions.find((item) => item.id === note.regionId);
        if (!region) return note;
        const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
        const position = Math.max(0, Math.min(100, region.left + region.width * offset));
        affectedNotePositions.push({ id: note.id, position });
        return { ...note, position };
      });
      return {
        versions: [backup, ...(current.versions ?? [])],
        audioClips: (current.audioClips ?? []).filter((item) => item.id !== clipId),
        timelineRegions: (current.timelineRegions ?? []).filter((region) => region.clipId !== clipId),
        tracks: (current.tracks ?? []).map((track) => track.id === clip.trackId ? { ...track, clips: Math.max(0, (track.clips ?? 0) - 1) } : track),
        notes,
        events: [event, ...(current.events ?? [])].slice(0, 200),
      };
    });
    const state = { deleted: true, clipId, clipTrackId, arrangementEpoch: updated.arrangementEpoch ?? 0, audioClips: publicAudioClips(updated.audioClips), tracks: updated.tracks, timelineRegions: updated.timelineRegions, notes: updated.notes, versions: publicVersions(updated.versions), recoveryVersion: publicVersions(updated.versions)[0], affectedNotePositions, event };
    io.to(roomId).emit("room:clip-deleted", state);
    sendJson(res, 200, state);
    return true;
  }
  if (audioMatch && req.method === "POST") {
    const roomId = decodeURIComponent(audioMatch[1]);
    const initialRoom = await ensureRoom(roomId);
    const uploadEpoch = getUploadEpoch(req.headers["x-arrangement-epoch"], initialRoom.arrangementEpoch ?? 0);
    const uploadUrl = new URL(req.url ?? pathname, `http://${req.headers.host ?? `localhost:${port}`}`);
    const requestedName = uploadUrl.searchParams.get("name") ?? "uploaded-audio";
    const fileName = safePathSegment(requestedName, "uploaded-audio");
    const storageName = `${Date.now()}-${randomBytes(6).toString("hex")}-${fileName}`;
    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    const audioBuffer = await readBinaryBody(req);

    if (audioBuffer.length === 0) {
      sendJson(res, 400, { error: "Audio file is empty" });
      return true;
    }

    await mkdir(roomDirectory, { recursive: true });
    await writeFile(path.join(roomDirectory, storageName), audioBuffer);
    let waveformPeaks = null;
    try {
      const parsed = JSON.parse(String(req.headers["x-waveform-peaks"] ?? "null"));
      if (Array.isArray(parsed)) waveformPeaks = parsed.slice(0, 128).map((value) => Math.max(2, Math.min(100, Number(value) || 2)));
    } catch {
      waveformPeaks = null;
    }
    let room;
    try {
      const user = await getSessionUser(req);
      room = await ensureRoom(roomId, (current) => {
        assertRoomEditor(current, user);
        assertArrangementEpoch(current, uploadEpoch);
        let versions = current.versions ?? [];
        if (current.audioAvailable && !current.audioStorageName) throw Object.assign(new Error("The previous reference audio is missing its file information. Download a backup before replacing it."), { statusCode: 409 });
        if (current.audioAvailable && current.audioStorageName) {
          if (versions.length >= maxRoomVersions) throw Object.assign(new Error("Version limit reached. Download a backup before replacing reference audio."), { statusCode: 409 });
          const backup = { id: `version-${Date.now()}-${randomBytes(6).toString("hex")}`, name: "Before replacing reference audio", createdAt: new Date().toISOString(), snapshot: versionSnapshot(current) };
          versions = [backup, ...versions];
        }
        return {
          versions,
          uploadedFileName: requestedName.slice(0, 180),
          audioAvailable: true,
          audioStorageName: storageName,
          audioMimeType: req.headers["content-type"] || "audio/mpeg",
          waveformPeaks,
        };
      });
    } catch (error) {
      await rm(path.join(roomDirectory, storageName), { force: true });
      throw error;
    }
    io.to(roomId).emit("room:upload", { arrangementEpoch: room.arrangementEpoch ?? 0, fileName: room.uploadedFileName, waveformPeaks: room.waveformPeaks, audioAvailable: true, versions: publicVersions(room.versions) });
    sendJson(res, 201, {
      fileName: room.uploadedFileName,
      audioAvailable: true,
      audioUrl: `/api/rooms/${encodeURIComponent(roomId)}/audio`,
    });
    return true;
  }

  if (audioMatch && req.method === "GET") {
    const roomId = decodeURIComponent(audioMatch[1]);
    const room = await ensureRoom(roomId);
    if (!room.audioAvailable || !isSafeAudioName(room.audioStorageName)) {
      sendJson(res, 404, { error: "No uploaded audio for this room" });
      return true;
    }

    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    const audioBuffer = await readFile(path.join(roomDirectory, room.audioStorageName));
    sendAudio(req, res, audioBuffer, room.audioMimeType);
    return true;
  }

  if (eventMatch && req.method === "POST") {
    const body = await readBody(req);
    if (!body.event) {
      sendJson(res, 400, { error: "Missing event" });
      return true;
    }

    const room = await appendEvent(eventMatch[1], body.event);
    sendJson(res, 200, { event: body.event, events: room.events });
    return true;
  }

  const noteMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/notes$/);
  const noteItemMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/notes\/([^/]+)$/);
  if (noteMatch && req.method === "GET") {
    const room = await ensureRoom(noteMatch[1]);
    sendJson(res, 200, { notes: room.notes });
    return true;
  }

  if (noteMatch && req.method === "POST") {
    const body = await readBody(req);
    if (!body.note) {
      sendJson(res, 400, { error: "Missing note" });
      return true;
    }

    const room = await appendNote(noteMatch[1], body.note, body.event);
    const savedNote = room.notes.find((note) => note.id === body.note.id);
    sendJson(res, 200, { note: savedNote, event: body.event, notes: room.notes });
    return true;
  }

  if (noteItemMatch && req.method === "PATCH") {
    const roomId = decodeURIComponent(noteItemMatch[1]);
    const noteId = decodeURIComponent(noteItemMatch[2]);
    const body = await readBody(req);
    const resolved = Boolean(body.resolved);
    const nextRoom = await ensureRoom(roomId, (room) => {
      if (!(room.notes ?? []).some((note) => note.id === noteId)) throw Object.assign(new Error("Note not found"), { statusCode: 404 });
      return {
        notes: (room.notes ?? []).map((note) => note.id !== noteId ? note : {
          ...note,
          resolved,
          resolvedBy: resolved ? String(body.resolvedBy ?? "A collaborator").slice(0, 60) : undefined,
          resolvedAt: resolved ? new Date().toISOString() : undefined,
        }),
        events: eventsWithEvent(room.events ?? [], body.event),
      };
    });
    sendJson(res, 200, { notes: nextRoom.notes, event: body.event });
    return true;
  }

  if (noteItemMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(noteItemMatch[1]);
    const noteId = decodeURIComponent(noteItemMatch[2]);
    const body = await readBody(req);
    const nextRoom = await ensureRoom(roomId, (room) => {
      if (!(room.notes ?? []).some((note) => note.id === noteId)) throw Object.assign(new Error("Note not found"), { statusCode: 404 });
      return {
        notes: (room.notes ?? []).filter((note) => note.id !== noteId),
        events: eventsWithEvent(room.events ?? [], body.event),
      };
    });
    sendJson(res, 200, { notes: nextRoom.notes, event: body.event });
    return true;
  }

  const timelineMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/timeline$/);
  if (timelineMatch && req.method === "GET") {
    const room = await ensureRoom(timelineMatch[1]);
    sendJson(res, 200, { timelineRegions: room.timelineRegions });
    return true;
  }

  const tracksMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/tracks$/);
  const trackItemMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/tracks\/([^/]+)$/);
  if (tracksMatch && req.method === "GET") {
    const room = await ensureRoom(tracksMatch[1]);
    sendJson(res, 200, { tracks: room.tracks ?? initialTracks });
    return true;
  }

  if (trackItemMatch && trackItemMatch[2] === "from-clip" && req.method === "POST") {
    const roomId = decodeURIComponent(trackItemMatch[1]);
    const body = await readBody(req);
    let event;
    const room = await ensureRoom(roomId, (current) => {
      assertArrangementEpoch(current, body.arrangementEpoch);
      const clip = (current.audioClips ?? []).find((item) => item.id === body.clipId);
      if (!clip?.generation || !clip.trackId || !Number.isFinite(clip.duration) || clip.duration <= 0) throw Object.assign(new Error("Generated audio is no longer available."), { statusCode: 404 });
      const tracks = current.tracks ?? [];
      if (tracks.length >= 12) throw Object.assign(new Error("Track limit reached."), { statusCode: 409 });
      if (tracks.some((track) => track.id === clip.trackId)) throw Object.assign(new Error("This generated track is already in the workstation."), { statusCode: 409 });
      const baseName = clip.name.replace(/\.(mp3|wav)$/i, "").replace(/-/g, " ");
      const duplicates = tracks.filter((track) => track.name === baseName || track.name.startsWith(`${baseName} `)).length;
      const name = duplicates ? `${baseName} ${duplicates + 1}` : baseName;
      const track = { id: clip.trackId, name, color: "#235fba", muted: false, solo: false, volume: 0.8, clips: 1, source: clip.generation.provider === "elevenlabs" ? "ai" : "audio" };
      const region = { id: `region-${clip.id}`, clipId: clip.id, lane: tracks.length, label: name, actionLabel: "Move clip", left: 0, width: Math.max(1, Math.min(100, clip.duration / 120 * 100)), color: track.color, sourceOffset: 0, sourceDuration: clip.duration };
      if ((current.timelineRegions ?? []).some((item) => item.id === region.id)) throw Object.assign(new Error("This generated clip is already on the timeline."), { statusCode: 409 });
      event = { id: `event-${Date.now()}-${randomBytes(6).toString("hex")}`, kind: "remix", title: "Generated music added", detail: `${clip.name} added to the workstation.`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      return { tracks: [...tracks, track], timelineRegions: [...(current.timelineRegions ?? []), region], events: [event, ...(current.events ?? [])].slice(0, 30) };
    });
    io.to(roomId).emit("room:tracks", { arrangementEpoch: room.arrangementEpoch ?? 0, tracks: room.tracks, event });
    io.to(roomId).emit("room:timeline", { arrangementEpoch: room.arrangementEpoch ?? 0, timelineRegions: room.timelineRegions, event });
    sendJson(res, 201, { tracks: room.tracks, timelineRegions: room.timelineRegions, event });
    return true;
  }

  if (trackItemMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(trackItemMatch[1]);
    const trackId = decodeURIComponent(trackItemMatch[2]);
    const body = await readBody(req);
    let event;
    const room = await ensureRoom(roomId, (current) => {
      assertArrangementEpoch(current, body.arrangementEpoch);
      const tracks = current.tracks ?? [];
      const regions = current.timelineRegions ?? [];
      if (!Array.isArray(body.previousTracks) || !Array.isArray(body.previousRegions) || JSON.stringify(tracks) !== JSON.stringify(body.previousTracks) || JSON.stringify(regions) !== JSON.stringify(body.previousRegions)) throw Object.assign(new Error("The room changed. Reload before deleting the track."), { statusCode: 409 });
      const lane = tracks.findIndex((track) => track.id === trackId);
      if (lane < 0) throw Object.assign(new Error("Track not found."), { statusCode: 404 });
      if (tracks.length <= 1) throw Object.assign(new Error("At least one track must remain."), { statusCode: 409 });
      if ((current.versions?.length ?? 0) >= maxRoomVersions) throw Object.assign(new Error("Version limit reached. Cannot save a recovery version before deleting the track."), { statusCode: 409 });
      const removed = regions.filter((region, index) => (region.lane ?? Math.min(index, tracks.length - 1)) === lane);
      const backup = { id: `version-${Date.now()}-${randomBytes(6).toString("hex")}`, name: `Before deleting ${tracks[lane].name}`.slice(0, 80), createdAt: new Date().toISOString(), snapshot: versionSnapshot(current) };
      event = { id: `event-${Date.now()}-${randomBytes(6).toString("hex")}`, kind: "sync", title: "Track removed", detail: `${tracks[lane].name} and ${removed.length} timeline clips removed; a recovery version was saved.`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      const notes = (current.notes ?? []).map((note) => {
        const region = removed.find((item) => item.id === note.regionId);
        if (!region) return note;
        const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
        return { ...note, position: Math.max(0, Math.min(100, region.left + region.width * offset)) };
      });
      return {
        arrangementEpoch: (current.arrangementEpoch ?? 0) + 1,
        versions: [backup, ...(current.versions ?? [])],
        tracks: tracks.filter((track) => track.id !== trackId),
        timelineRegions: regions.flatMap((region, index) => {
          const oldLane = region.lane ?? Math.min(index, tracks.length - 1);
          return oldLane === lane ? [] : [{ ...region, lane: oldLane > lane ? oldLane - 1 : oldLane }];
        }),
        notes,
        events: [event, ...(current.events ?? [])].slice(0, 30),
      };
    });
    const state = { reason: "track-deleted", arrangementEpoch: room.arrangementEpoch, tracks: room.tracks, timelineRegions: room.timelineRegions, notes: room.notes, composition: room.composition, audioClips: publicAudioClips(room.audioClips), uploadedFileName: room.uploadedFileName ?? "", audioAvailable: Boolean(room.audioAvailable), referenceMuted: Boolean(room.referenceMuted), waveformPeaks: room.waveformPeaks ?? null, versions: publicVersions(room.versions), bpm: room.bpm ?? 96, timeSignature: room.timeSignature ?? "4/4", event };
    io.to(roomId).emit("room:restored", state);
    sendJson(res, 200, state);
    return true;
  }

  const generateMusicMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/generate-music$/);
  if (generateMusicMatch && req.method === "POST") {
    const roomId = decodeURIComponent(generateMusicMatch[1]);
    const body = await readBody(req);
    const prompt = String(body.prompt ?? "").trim().slice(0, 3500);
    if (prompt.length < 8) {
      sendJson(res, 400, { error: "Describe the music you want in at least 8 characters." });
      return true;
    }

    const style = String(body.style ?? "R&B").trim().slice(0, 80);
    const mood = String(body.mood ?? "warm").trim().slice(0, 80);
    const musicKey = String(body.key ?? "C major").trim().slice(0, 24);
    const durationSeconds = Math.max(10, Math.min(120, Number(body.durationSeconds) || 30));
    const requestedProvider = body.provider === "elevenlabs" ? "elevenlabs" : "collabmuse";
    const instrumental = requestedProvider === "collabmuse" || body.instrumental !== false;
    const room = await ensureRoom(roomId);
    const generationEpoch = room.arrangementEpoch ?? 0;
    const referenceClip = typeof body.sourceClipId === "string" ? (room.audioClips ?? []).find((clip) => clip.id === body.sourceClipId) : null;
    if (typeof body.sourceClipId === "string" && body.sourceClipId && !referenceClip) {
      sendJson(res, 409, { error: "The selected reference clip is no longer in this room. Clear it or choose another clip before generating." });
      return true;
    }
    const usableReferenceBpm = referenceTempo(referenceClip);
    let audioBuffer;
    let mimeType;
    let fileExtension;
    let provider;
    let model;
    let songId;
    let fallbackReason;
    let generatedBpm = room.bpm ?? 96;

    if (requestedProvider === "elevenlabs" && process.env.ELEVENLABS_API_KEY) {
      const fullPrompt = [
        prompt,
        `${style} style`,
        `${mood} mood`,
        `${musicKey}`,
        `${room.bpm ?? 96} BPM`,
        instrumental ? "instrumental only, no vocals or lyrics" : "vocals are allowed when musically appropriate",
        "original composition, polished production, clear beginning and ending",
      ].join(". ");
      try {
        const response = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
          method: "POST",
          signal: AbortSignal.timeout(180000),
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            music_length_ms: Math.round(durationSeconds * 1000),
            model_id: process.env.ELEVENLABS_MUSIC_MODEL ?? "music_v2_5",
            force_instrumental: instrumental,
          }),
        });
        if (response.ok) {
          audioBuffer = await readMp3Response(response, maxAudioBytes);
          mimeType = "audio/mpeg";
          fileExtension = "mp3";
          provider = "elevenlabs";
          model = process.env.ELEVENLABS_MUSIC_MODEL ?? "music_v2_5";
          songId = response.headers.get("song-id") || undefined;
        } else {
          discardMusicErrorResponse(response);
          console.error(`ElevenLabs Music returned ${response.status}.`);
          fallbackReason = response.status === 402
            ? "ElevenLabs requires a paid plan. Choose the built-in arranger or configure a paid account."
            : "ElevenLabs could not generate this track. Check the service configuration and try again.";
        }
      } catch (error) {
        console.error("ElevenLabs Music request failed:", error);
        fallbackReason = error instanceof Error && error.message.startsWith("Music service")
          ? error.message
          : "ElevenLabs was unavailable or timed out. Check the connection and try again.";
      }
    } else if (requestedProvider === "elevenlabs") {
      fallbackReason = "ElevenLabs is not configured. Choose the built-in arranger or configure the API key.";
    }

    if (!audioBuffer && requestedProvider === "elevenlabs") {
      sendJson(res, 503, { error: fallbackReason });
      return true;
    }

    if (!audioBuffer) {
      const rendered = await renderLocalMusicAsync({
        prompt,
        style,
        mood,
        key: musicKey,
        durationSeconds,
        bpm: usableReferenceBpm ?? room.bpm ?? 96,
      });
      audioBuffer = Buffer.from(rendered.buffer);
      generatedBpm = rendered.bpm;
      mimeType = "audio/wav";
      fileExtension = "wav";
      provider = "collabmuse";
      model = rendered.model;
    }

    if (audioBuffer.length === 0 || audioBuffer.length > maxAudioBytes) {
      sendJson(res, 502, { error: "The music engine returned an invalid audio file." });
      return true;
    }

    const clipId = `clip-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const trackId = `ai-music-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
    const titleBase = `${mood}-${style}-${provider === "elevenlabs" ? "AI-track" : "arrangement"}`;
    const fileName = `${safePathSegment(titleBase, "ai-music")}.${fileExtension}`;
    const storageName = `${clipId}-${fileName}`;
    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    await mkdir(roomDirectory, { recursive: true });
    await writeFile(path.join(roomDirectory, storageName), audioBuffer);

    const clip = {
      id: clipId,
      name: fileName,
      trackId,
      duration: durationSeconds,
      storageName,
      mimeType,
      createdAt: new Date().toISOString(),
      waveformPeaks: [],
      generation: {
        provider,
        model,
        prompt,
        style,
        mood,
        key: musicKey,
        instrumental,
        ...(provider === "collabmuse" ? { bpm: generatedBpm } : {}),
        ...(provider === "collabmuse" && usableReferenceBpm ? { referenceClipId: referenceClip.id, referenceTempoBpm: usableReferenceBpm } : {}),
        songId,
      },
    };
    let updatedRoom;
    try {
      const user = await getSessionUser(req);
      updatedRoom = await ensureRoom(roomId, (current) => {
        assertRoomEditor(current, user);
        assertArrangementEpoch(current, generationEpoch);
        return { audioClips: [...(current.audioClips ?? []), clip] };
      });
    } catch (error) {
      await rm(path.join(roomDirectory, storageName), { force: true });
      throw error;
    }
    io.to(roomId).emit("room:clips", { arrangementEpoch: updatedRoom.arrangementEpoch ?? 0, audioClips: publicAudioClips(updatedRoom.audioClips) });
    sendJson(res, 201, {
      clip: publicAudioClips([clip])[0],
      audioUrl: `/api/rooms/${encodeURIComponent(roomId)}/clips/${encodeURIComponent(clip.id)}/audio`,
      fallbackReason,
    });
    return true;
  }

  const composeMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/compose$/);
  if (composeMatch && req.method === "POST") {
    const body = await readBody(req);
    const roomId = decodeURIComponent(composeMatch[1]);
    const initialRoom = await ensureRoom(roomId);
    const compositionEpoch = initialRoom.arrangementEpoch ?? 0;
    const initialComposition = JSON.stringify(initialRoom.composition ?? null);
    const input = {
      prompt: String(body.prompt ?? "").slice(0, 500),
      key: String(body.key ?? "C").slice(0, 3),
      mood: String(body.mood ?? "warm").slice(0, 40),
      style: String(body.style ?? "R&B").slice(0, 40),
      bars: Math.max(1, Math.min(4, Number(body.bars) || 2)),
      sourceAnalysis: body.sourceAnalysis && typeof body.sourceAnalysis === "object" ? body.sourceAnalysis : null,
    };

    let composition;
    let fallbackReason = null;
    try {
      composition = await generateAiComposition(input);
    } catch (error) {
      console.error("AI composition fallback:", error.message);
      composition = generateLocalComposition(input);
      fallbackReason = "AI service unavailable; generated locally";
    }

    const user = await getSessionUser(req);
    const updatedRoom = await ensureRoom(roomId, (room) => {
      assertRoomEditor(room, user);
      assertArrangementEpoch(room, compositionEpoch);
      if (JSON.stringify(room.composition ?? null) !== initialComposition) {
        throw Object.assign(new Error("The melody changed while generating. Review the latest version and try again."), { statusCode: 409 });
      }
      return { composition };
    });
    io.to(roomId).emit("room:composition", { arrangementEpoch: updatedRoom.arrangementEpoch ?? 0, composition: updatedRoom.composition });
    sendJson(res, 200, { composition, fallbackReason });
    return true;
  }

  if (tracksMatch && req.method === "PATCH") {
    const body = await readBody(req);
    if (!Array.isArray(body.tracks)) {
      sendJson(res, 400, { error: "Missing tracks" });
      return true;
    }

    const room = await ensureRoom(tracksMatch[1], (current) => {
      assertArrangementEpoch(current, body.arrangementEpoch);
      if (!Array.isArray(body.previousTracks)) throw Object.assign(new Error("Reload the room before saving tracks."), { statusCode: 409 });
      const tracks = mergeRoomEdits(current.tracks ?? [], body.previousTracks, body.tracks);
      if (tracks.length > 12) throw Object.assign(new Error("Track limit reached."), { statusCode: 409 });
      return { tracks };
    });
    if (body.event) await appendEvent(tracksMatch[1], body.event);
    io.to(tracksMatch[1]).emit("room:tracks", { arrangementEpoch: room.arrangementEpoch ?? 0, tracks: room.tracks, event: body.event });
    sendJson(res, 200, { tracks: room.tracks, event: body.event });
    return true;
  }

  if (timelineMatch && req.method === "PATCH") {
    const body = await readBody(req);
    if (!Array.isArray(body.timelineRegions)) {
      sendJson(res, 400, { error: "Missing timelineRegions" });
      return true;
    }

    const room = await ensureRoom(timelineMatch[1], (current) => {
      assertArrangementEpoch(current, body.arrangementEpoch);
      if (!Array.isArray(body.previousRegions)) throw Object.assign(new Error("Reload the room before saving timeline changes."), { statusCode: 409 });
      if (body.split || body.merge) throw Object.assign(new Error("Reconnect before splitting or undoing a split."), { statusCode: 409 });
      const timelineRegions = mergeRoomEdits(current.timelineRegions ?? [], body.previousRegions, body.timelineRegions);
      assertKnownRegionClips(current, timelineRegions);
      return { timelineRegions };
    });
    if (body.event) await appendEvent(timelineMatch[1], body.event);
    io.to(timelineMatch[1]).emit("room:timeline", { arrangementEpoch: room.arrangementEpoch ?? 0, timelineRegions: room.timelineRegions, event: body.event });
    sendJson(res, 200, {
      timelineRegions: room.timelineRegions,
      tracks: room.tracks ?? initialTracks,
      composition: room.composition ?? null,
      audioClips: publicAudioClips(room.audioClips),
      event: body.event,
      events: room.events,
    });
    return true;
  }

  const versionPreviewMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/versions\/([^/]+)\/preview(?:\/(audio|clips\/([^/]+)))?$/);
  if (versionPreviewMatch && req.method === "GET") {
    const roomId = decodeURIComponent(versionPreviewMatch[1]);
    const versionId = decodeURIComponent(versionPreviewMatch[2]);
    const room = await ensureRoom(roomId);
    const version = (room.versions ?? []).find((item) => item.id === versionId);
    if (!version) { sendJson(res, 404, { error: "Version not found" }); return true; }
    const snapshot = version.snapshot;
    if (!versionPreviewMatch[3]) {
      sendJson(res, 200, {
        tracks: snapshot.tracks ?? [], timelineRegions: snapshot.timelineRegions ?? [],
        audioClips: publicAudioClips(snapshot.audioClips),
        audioAvailable: Boolean(snapshot.audioAvailable && snapshot.audioStorageName),
        referenceMuted: Boolean(snapshot.referenceMuted),
        legacyReferenceUnknown: !Object.hasOwn(snapshot, "audioStorageName"),
      });
      return true;
    }
    const clipId = versionPreviewMatch[4] ? decodeURIComponent(versionPreviewMatch[4]) : null;
    const clip = clipId ? (snapshot.audioClips ?? []).find((item) => item.id === clipId) : null;
    const storageName = clipId ? clip?.storageName : snapshot.audioStorageName;
    if (!isSafeAudioName(storageName) || (!clipId && !snapshot.audioAvailable)) {
      sendJson(res, 404, { error: "Version audio not found" });
      return true;
    }
    try {
      const data = await readFile(path.join(uploadsDir, safePathSegment(roomId, "room"), storageName));
      sendAudio(req, res, data, clipId ? clip?.mimeType : snapshot.audioMimeType);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      sendJson(res, 404, { error: "Version audio file is missing" });
    }
    return true;
  }

  const versionRestoreMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/versions\/([^/]+)\/restore$/);
  const versionsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/versions$/);

  if (versionsMatch && req.method === "GET") {
    const room = await ensureRoom(decodeURIComponent(versionsMatch[1]));
    sendJson(res, 200, { versions: publicVersions(room.versions) });
    return true;
  }

  if (versionsMatch && req.method === "POST") {
    const roomId = decodeURIComponent(versionsMatch[1]);
    const body = await readBody(req);
    const createdAt = new Date().toISOString();
    let version;
    const nextRoom = await ensureRoom(roomId, (room) => {
      if ((room.versions?.length ?? 0) >= maxRoomVersions) throw Object.assign(new Error("Version limit reached. Download a backup and create a new project to continue."), { statusCode: 409 });
      version = {
        id: `version-${Date.now()}-${randomBytes(6).toString("hex")}`,
        name: String(body.name ?? `Version ${(room.versions?.length ?? 0) + 1}`).trim().slice(0, 80),
        createdAt,
        snapshot: versionSnapshot(room),
      };
      return { versions: [version, ...(room.versions ?? [])] };
    });
    if (body.event) await appendEvent(roomId, body.event);
    sendJson(res, 200, { version: publicVersions([version])[0], versions: publicVersions(nextRoom.versions), event: body.event });
    return true;
  }

  if (versionRestoreMatch && req.method === "POST") {
    const roomId = decodeURIComponent(versionRestoreMatch[1]);
    const versionId = decodeURIComponent(versionRestoreMatch[2]);
    const body = await readBody(req);
    const restoredRoom = await ensureRoom(roomId, async (room) => {
      const version = (room.versions ?? []).find((item) => item.id === versionId);
      if (!version) throw Object.assign(new Error("Version not found"), { statusCode: 404 });
      if ((room.versions?.length ?? 0) >= maxRoomVersions) throw Object.assign(new Error("Version limit reached. Cannot save the current state before restoring."), { statusCode: 409 });
      const snapshot = version.snapshot;
      const references = (snapshot.audioClips ?? []).map((clip) => clip.storageName);
      if (Object.hasOwn(snapshot, "audioStorageName") && snapshot.audioAvailable) references.push(snapshot.audioStorageName);
      for (const name of new Set(references)) {
        if (typeof name !== "string" || !name || path.basename(name) !== name) throw Object.assign(new Error("This version has missing audio metadata. The current project was not changed."), { statusCode: 409 });
        try {
          const info = await stat(path.join(uploadsDir, safePathSegment(roomId, "room"), name));
          if (!info.isFile()) throw new Error("Not a file");
        } catch {
          throw Object.assign(new Error("This version refers to a missing audio file. The current project was not changed."), { statusCode: 409 });
        }
      }
      const backup = {
        id: `version-${Date.now()}-${randomBytes(6).toString("hex")}`,
        name: `Before restoring ${version.name}`.slice(0, 80),
        createdAt: new Date().toISOString(),
        snapshot: versionSnapshot(room),
      };
      return {
      arrangementEpoch: (room.arrangementEpoch ?? 0) + 1,
      versions: [backup, ...(room.versions ?? [])],
      tracks: version.snapshot.tracks ?? initialTracks,
      timelineRegions: version.snapshot.timelineRegions ?? initialTimelineRegions,
      composition: version.snapshot.composition ?? null,
      audioClips: version.snapshot.audioClips ?? [],
      referenceMuted: Boolean(version.snapshot.referenceMuted),
      bpm: version.snapshot.bpm ?? 96,
      timeSignature: version.snapshot.timeSignature ?? "4/4",
      ...(Object.hasOwn(version.snapshot, "audioStorageName") ? {
        uploadedFileName: version.snapshot.uploadedFileName ?? "",
        audioAvailable: version.snapshot.audioAvailable ?? false,
        audioStorageName: version.snapshot.audioStorageName,
        audioMimeType: version.snapshot.audioMimeType ?? null,
        waveformPeaks: version.snapshot.waveformPeaks ?? null,
      } : {}),
      };
    });
    if (body.event) await appendEvent(roomId, body.event);
    const restoredState = {
      tracks: restoredRoom.tracks,
      timelineRegions: restoredRoom.timelineRegions,
      composition: restoredRoom.composition,
      audioClips: publicAudioClips(restoredRoom.audioClips),
      uploadedFileName: restoredRoom.uploadedFileName ?? "",
      audioAvailable: restoredRoom.audioAvailable ?? false,
      referenceMuted: Boolean(restoredRoom.referenceMuted),
      waveformPeaks: restoredRoom.waveformPeaks ?? null,
      bpm: restoredRoom.bpm ?? 96,
      timeSignature: restoredRoom.timeSignature ?? "4/4",
      versions: publicVersions(restoredRoom.versions),
      arrangementEpoch: restoredRoom.arrangementEpoch,
      event: body.event,
    };
    io.to(roomId).emit("room:restored", restoredState);
    sendJson(res, 200, restoredState);
    return true;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && req.method === "GET") {
    const room = await ensureRoom(roomMatch[1]);
    sendJson(res, 200, { room: publicRoom(room) });
    return true;
  }

  if (roomMatch && req.method === "PATCH") {
    const currentRoom = await ensureRoom(roomMatch[1]);
    const user = await getSessionUser(req);
    if (!isRoomOwner(currentRoom, user)) {
      sendJson(res, 403, { error: "Only the room owner can change room settings" });
      return true;
    }
    const body = await readBody(req);
    const allowed = new Set(["title", "bpm", "timeSignature", "composition", "arrangementEpoch"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      sendJson(res, 400, { error: "This room setting cannot be changed here." });
      return true;
    }
    validateTimingPatch(body);
    const room = await ensureRoom(roomMatch[1], (current) => {
      if (["composition", "bpm", "timeSignature"].some((key) => Object.hasOwn(body, key))) assertArrangementEpoch(current, body.arrangementEpoch);
      const { arrangementEpoch: _epoch, ...patch } = body;
      return patch;
    });
    sendJson(res, 200, { room: publicRoom(room) });
    return true;
  }

  if (roomMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(roomMatch[1]);
    if (roomId === "demo") {
      sendJson(res, 400, { error: "The demo room cannot be deleted" });
      return true;
    }

    const existingRoom = await ensureRoom(roomId);
    const user = await getSessionUser(req);
    if (!isRoomOwner(existingRoom, user)) {
      sendJson(res, 403, { error: "Only the room owner can delete this room" });
      return true;
    }

    await ensureRoom(roomId, { deletedAt: new Date().toISOString() });
    io.to(roomId).emit("room:deleted", { roomId });
    io.in(roomId).socketsLeave(roomId);
    sendJson(res, 200, { deleted: true, roomId });
    return true;
  }

  return false;
}

await app.prepare();

const httpServer = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${port}`}`);
  const pathname = requestUrl.pathname;

  try {
    const handled = await handleApi(req, res, pathname);
    if (handled) return;
    await handle(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode ?? 500, { error: error.statusCode ? error.message : "Internal server error" });
  }
});

const io = new Server(httpServer, {
  path: "/api/socket",
  cors: { origin: "*" },
});

const roomEditQueues = new Map();
function queueRoomEdit(roomId, operation) {
  const previous = roomEditQueues.get(roomId) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  roomEditQueues.set(roomId, current);
  void current.finally(() => {
    if (roomEditQueues.get(roomId) === current) roomEditQueues.delete(roomId);
  }).catch(() => {});
  return current;
}

async function broadcastPresence(roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  io.to(roomId).emit("room:presence", { roomId, count: sockets.length });
}

io.on("connection", (socket) => {
  let joinGeneration = 0;
  const mayEdit = async (roomId) => {
    if (socket.data.roomId !== roomId) return false;
    try {
      const room = await ensureRoom(roomId);
      const user = await getSessionUser(socket.request);
      return canAccessRoom(room, user) && canEditRoom(room, user);
    } catch (error) {
      console.error("Unable to verify room edit access", error);
      return false;
    }
  };
  socket.on("room:join", async (roomId = "demo") => {
    const generation = ++joinGeneration;
    const previousRoomId = socket.data.roomId;
    socket.data.roomId = null;
    socket.data.canEdit = false;
    if (previousRoomId) {
      socket.leave(previousRoomId);
      await broadcastPresence(previousRoomId);
    }
    if (generation !== joinGeneration || !socket.connected) return;

    let room;
    let user;
    try {
      user = await getSessionUser(socket.request);
      if (generation !== joinGeneration || !socket.connected) return;
      room = await ensureRoom(roomId);
    } catch (error) {
      if (generation !== joinGeneration || !socket.connected) return;
      if (error.statusCode !== 404) console.error("Unable to load room", error);
      socket.emit("room:access-denied", { roomId });
      return;
    }
    if (generation !== joinGeneration || !socket.connected) return;
    if (!canAccessRoom(room, user)) {
      socket.data.canEdit = false;
      socket.emit("room:access-denied", { roomId });
      return;
    }
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.canEdit = canEditRoom(room, user);
    socket.emit("room:snapshot", {
      roomId,
      title: room.title,
      events: room.events,
      notes: room.notes,
      uploadedFileName: room.uploadedFileName,
      waveformPeaks: room.waveformPeaks,
      audioAvailable: room.audioAvailable,
      referenceMuted: Boolean(room.referenceMuted),
      timelineRegions: room.timelineRegions,
      tracks: room.tracks ?? initialTracks,
      composition: room.composition ?? null,
      audioClips: publicAudioClips(room.audioClips),
      versions: publicVersions(room.versions),
      bpm: room.bpm ?? 96,
      timeSignature: room.timeSignature ?? "4/4",
      arrangementEpoch: room.arrangementEpoch ?? 0,
    });
    await broadcastPresence(roomId);
  });

  socket.on("room:event", async ({ roomId = "demo", event }) => {
    if (!event || !(await mayEdit(roomId))) return;
    await appendEvent(roomId, event);
    socket.to(roomId).emit("room:event", event);
  });

  socket.on("room:reference-mute", ({ roomId = "demo", muted, arrangementEpoch }) => {
    if (typeof muted !== "boolean") return;
    void queueRoomEdit(roomId, async () => {
      try {
        if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
        const room = await ensureRoom(roomId, (current) => { assertArrangementEpoch(current, arrangementEpoch); return { referenceMuted: muted }; });
        io.to(roomId).emit("room:reference-mute", { muted: Boolean(room.referenceMuted), arrangementEpoch: room.arrangementEpoch ?? 0 });
      } catch (error) {
        socket.emit("room:sync-error", { message: error.statusCode === 409 ? error.message : "Could not save reference audio mute state." });
      }
    });
  });

  socket.on("room:upload", async ({ roomId = "demo", event }) => {
    if (!(await mayEdit(roomId))) return;
    if (event) await appendEvent(roomId, event);
    const room = await ensureRoom(roomId);
    socket.to(roomId).emit("room:upload", { arrangementEpoch: room.arrangementEpoch ?? 0, fileName: room.uploadedFileName, waveformPeaks: room.waveformPeaks, audioAvailable: room.audioAvailable, event });
  });

  socket.on("room:note", async ({ roomId = "demo", note, event }, acknowledge) => {
    try {
      if (!note || !(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
      const room = await appendNote(roomId, note, event);
      const savedNote = room.notes.find((item) => item.id === note.id);
      socket.to(roomId).emit("room:note", { note: savedNote, event });
      if (typeof acknowledge === "function") acknowledge({ ok: true, note: savedNote });
    } catch (error) {
      console.error("Could not save note", error);
      if (typeof acknowledge === "function") acknowledge({ ok: false, error: error instanceof Error ? error.message : "Could not save the note." });
      else socket.emit("room:sync-error", { message: "Could not save the note. Check your access and connection." });
    }
  });

  socket.on("room:note-reply", async ({ roomId = "demo", noteId, reply }, acknowledge) => {
    try {
      if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available.");
      if (typeof noteId !== "string" || typeof reply?.id !== "string" || !reply.id || reply.id.length > 160 || typeof reply.message !== "string" || !reply.message.trim() || reply.message.length > 1000) throw new Error("Reply is invalid.");
      const user = await getSessionUser(socket.request);
      let savedReply = { id: reply.id, author: String(user?.name ?? reply.author ?? "Guest creator").slice(0, 60), message: reply.message.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      let found = false;
      await ensureRoom(roomId, (room) => ({ notes: (room.notes ?? []).map((note) => {
        if (note.id !== noteId) return note;
        found = true;
        const replies = note.replies ?? [];
        const existing = replies.find((item) => item.id === savedReply.id);
        if (existing) { savedReply = existing; return note; }
        if (replies.length >= 200) throw new Error("This note has reached the reply limit.");
        return { ...note, replies: [...replies, savedReply] };
      }) }));
      if (!found) throw new Error("This note no longer exists.");
      io.to(roomId).emit("room:note-reply", { noteId, reply: savedReply });
      if (typeof acknowledge === "function") acknowledge({ ok: true });
    } catch (error) {
      if (typeof acknowledge === "function") acknowledge({ ok: false, error: error instanceof Error ? error.message : "Reply could not be saved." });
    }
  });

  socket.on("room:note-state", async ({ roomId = "demo", noteId, event }) => {
    if (typeof noteId !== "string" || !(await mayEdit(roomId))) return;
    const room = await ensureRoom(roomId);
    const note = (room.notes ?? []).find((item) => item.id === noteId);
    const state = note ? { resolved: Boolean(note.resolved), resolvedBy: note.resolvedBy, resolvedAt: note.resolvedAt } : null;
    socket.to(roomId).emit("room:note-state", { noteId, state, event });
  });

  socket.on("room:notes", async ({ roomId = "demo", notes, event }) => {
    if (!Array.isArray(notes) || !(await mayEdit(roomId))) return;
    if (event) await appendEvent(roomId, event);
    const room = await ensureRoom(roomId);
    socket.to(roomId).emit("room:notes", { notes: room.notes, event });
  });

  socket.on("room:timeline", ({ roomId = "demo", timelineRegions, previousRegions, event, arrangementEpoch, split, merge }) => {
    if (!Array.isArray(timelineRegions)) return;
    void queueRoomEdit(roomId, async () => {
      try {
        if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
        let notesChanged = false;
        const room = await ensureRoom(roomId, (current) => {
          assertArrangementEpoch(current, arrangementEpoch);
          const merged = Array.isArray(previousRegions) ? mergeRoomEdits(current.timelineRegions ?? [], previousRegions, timelineRegions) : timelineRegions;
          assertKnownRegionClips(current, merged);
          const withEvent = (patch) => event ? { ...patch, events: eventsWithEvent(current.events ?? [], event) } : patch;
          if (merge) {
            const first = Array.isArray(previousRegions) ? previousRegions.find((item) => item.id === merge.originalId) : null;
            const second = Array.isArray(previousRegions) ? previousRegions.find((item) => item.id === merge.newId) : null;
            const currentFirst = (current.timelineRegions ?? []).find((item) => item.id === merge.originalId);
            const currentSecond = (current.timelineRegions ?? []).find((item) => item.id === merge.newId);
            const combined = merged.find((item) => item.id === merge.originalId);
            const samePart = (a, b) => a && b && ["left", "width", "lane", "clipId", "sourceOffset", "sourceDuration"].every((key) => a[key] === b[key]);
            if (!samePart(first, currentFirst) || !samePart(second, currentSecond) || !combined || merged.some((item) => item.id === merge.newId) ||
                Math.abs(second.left - (first.left + first.width)) > 0.11 || combined.left !== first.left || Math.abs(combined.width - first.width - second.width) > 0.11 ||
                first.clipId !== second.clipId || combined.clipId !== first.clipId) {
              throw Object.assign(new Error("The clips changed before the split could be undone. Reload and try again."), { statusCode: 409 });
            }
            return withEvent({ timelineRegions: merged, notes: remapMergedNotes(current.notes ?? [], first, second, combined) });
          }
          if (!split) {
            const preserved = preserveRemovedRegionNotePositions(current.notes ?? [], current.timelineRegions ?? [], merged);
            notesChanged = preserved.changed;
            return withEvent({ timelineRegions: merged, ...(preserved.changed ? { notes: preserved.notes } : {}) });
          }
          const previous = Array.isArray(previousRegions) ? previousRegions.find((item) => item.id === split.originalId) : null;
          const currentRegion = (current.timelineRegions ?? []).find((item) => item.id === split.originalId);
          const first = merged.find((item) => item.id === split.originalId);
          const second = merged.find((item) => item.id === split.newId);
          if (!previous || !currentRegion || !first || !second ||
              previous.left !== currentRegion.left || previous.width !== currentRegion.width || previous.clipId !== currentRegion.clipId ||
              previous.lane !== currentRegion.lane || previous.sourceOffset !== currentRegion.sourceOffset || previous.sourceDuration !== currentRegion.sourceDuration ||
              first.left !== previous.left || Math.abs(first.width + second.width - previous.width) > 0.11 ||
              Math.abs(second.left - (first.left + first.width)) > 0.11 || first.clipId !== previous.clipId || second.clipId !== previous.clipId) {
            throw Object.assign(new Error("The clip changed before it could be split. Reload and try again."), { statusCode: 409 });
          }
          return withEvent({ timelineRegions: merged, notes: remapSplitNotes(current.notes ?? [], previous, first, second) });
        });
        io.to(roomId).emit("room:timeline", { arrangementEpoch: room.arrangementEpoch ?? 0, timelineRegions: room.timelineRegions, ...(split || merge || notesChanged ? { notes: room.notes } : {}), event });
      } catch (error) {
        console.error("Could not save timeline", error);
        socket.emit("room:sync-error", { message: error.statusCode === 409 ? error.message : "Could not save timeline changes. Reloading the saved room." });
      }
    });
  });

  socket.on("room:tracks", ({ roomId = "demo", tracks, previousTracks, event, arrangementEpoch }) => {
    if (!Array.isArray(tracks)) return;
    void queueRoomEdit(roomId, async () => {
      try {
        if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
        const room = await ensureRoom(roomId, (current) => {
          assertArrangementEpoch(current, arrangementEpoch);
          const merged = Array.isArray(previousTracks) ? mergeRoomEdits(current.tracks ?? [], previousTracks, tracks) : tracks;
          if (merged.length > 12) throw new Error("Track limit reached");
          return { tracks: merged, ...(event ? { events: eventsWithEvent(current.events ?? [], event) } : {}) };
        });
        io.to(roomId).emit("room:tracks", { arrangementEpoch: room.arrangementEpoch ?? 0, tracks: room.tracks, event });
      } catch (error) {
        console.error("Could not save tracks", error);
        socket.emit("room:sync-error", { message: error.statusCode === 409 ? error.message : "Could not save track changes. Check access and the 12-track limit." });
      }
    });
  });

  socket.on("room:composition", ({ roomId = "demo", composition, event, arrangementEpoch }) => {
    if (!composition || !Array.isArray(composition.notes)) return;
    void queueRoomEdit(roomId, async () => {
      try {
        if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
        const room = await ensureRoom(roomId, (current) => { assertArrangementEpoch(current, arrangementEpoch); return { composition, ...(event ? { events: eventsWithEvent(current.events ?? [], event) } : {}) }; });
        io.to(roomId).emit("room:composition", { arrangementEpoch: room.arrangementEpoch ?? 0, composition: room.composition, event });
      } catch (error) {
        socket.emit("room:sync-error", { message: error.statusCode === 409 ? error.message : "Could not save melody changes. Reloading the saved room." });
      }
    });
  });

  socket.on("room:clips", async ({ roomId = "demo", audioClips, event }) => {
    if (!Array.isArray(audioClips) || !(await mayEdit(roomId))) return;
    if (event) await appendEvent(roomId, event);
    const room = await ensureRoom(roomId);
    io.to(roomId).emit("room:clips", { arrangementEpoch: room.arrangementEpoch ?? 0, audioClips: publicAudioClips(room.audioClips), event });
  });

  socket.on("room:transport", async ({ roomId = "demo", command, userName = "A collaborator" }) => {
    if (!command || !(await mayEdit(roomId))) return;
    if (!["play", "pause", "seek"].includes(command.action) || !Number.isFinite(command.position)) return;
    socket.to(roomId).emit("room:transport", {
      id: String(command.id ?? Date.now()),
      action: command.action,
      position: Math.max(0, Number(command.position)),
      userName: String(userName).slice(0, 60),
    });
  });

  socket.on("room:settings", ({ roomId = "demo", bpm, timeSignature, event, arrangementEpoch }) => {
    void queueRoomEdit(roomId, async () => {
      try {
        if (!(await mayEdit(roomId))) throw new Error("Editing access is no longer available");
        validateTimingPatch({ bpm, timeSignature });
        const user = await getSessionUser(socket.request);
        const room = await ensureRoom(roomId, (current) => {
          assertRoomEditor(current, user);
          assertArrangementEpoch(current, arrangementEpoch);
          return { bpm, timeSignature, ...(event ? { events: eventsWithEvent(current.events ?? [], event) } : {}) };
        });
        io.to(roomId).emit("room:settings", { arrangementEpoch: room.arrangementEpoch ?? 0, bpm: room.bpm, timeSignature: room.timeSignature, event });
      } catch (error) {
        socket.emit("room:sync-error", { message: error.statusCode === 409 ? error.message : "Could not save session timing. Reloading the saved room." });
      }
    });
  });

  socket.on("disconnect", async () => {
    const roomId = socket.data.roomId;
    if (roomId) await broadcastPresence(roomId);
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
