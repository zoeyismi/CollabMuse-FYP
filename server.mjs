import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import next from "next";
import { Server } from "socket.io";
import { renderLocalMusic } from "./lib/local-music-engine.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "rooms.json");
const authStorePath = path.join(dataDir, "auth.json");
const uploadsDir = path.join(dataDir, "uploads");
const maxAudioBytes = 25 * 1024 * 1024;
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

async function readStore() {
  try {
    const file = await readFile(storePath, "utf8");
    return JSON.parse(file);
  } catch {
    const initialStore = { rooms: { demo: defaultRoom } };
    await writeStore(initialStore);
    return initialStore;
  }
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

async function readAuthStore() {
  try {
    return JSON.parse(await readFile(authStorePath, "utf8"));
  } catch {
    const initialStore = { users: [], sessions: {} };
    await writeAuthStore(initialStore);
    return initialStore;
  }
}

async function writeAuthStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(authStorePath, JSON.stringify(store, null, 2));
}

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

async function createSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  const store = await readAuthStore();
  store.sessions[token] = {
    userId,
    expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString(),
  };
  await writeAuthStore(store);
  res.setHeader(
    "Set-Cookie",
    `collabmuse_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`,
  );
}

async function clearSession(req, res) {
  const token = parseCookies(req).collabmuse_session;
  if (token) {
    const store = await readAuthStore();
    delete store.sessions[token];
    await writeAuthStore(store);
  }
  res.setHeader("Set-Cookie", "collabmuse_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

async function ensureRoom(roomId, roomPatch = {}) {
  const store = await readStore();
  const existing = store.rooms[roomId];
  const hasPatch = Object.keys(roomPatch).length > 0;

  if (existing && !hasPatch) return existing;

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
        uploadedFileName: roomPatch.uploadedFileName ?? "always-reference.wav",
        waveformPeaks: roomPatch.waveformPeaks ?? null,
        audioAvailable: roomPatch.audioAvailable ?? false,
        audioStorageName: roomPatch.audioStorageName ?? null,
        audioMimeType: roomPatch.audioMimeType ?? null,
        events: roomPatch.events ?? [],
        notes: roomPatch.notes ?? [],
        timelineRegions: roomPatch.timelineRegions ?? initialTimelineRegions,
        tracks: roomPatch.tracks ?? initialTracks,
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

  await writeStore(store);
  return store.rooms[roomId];
}

async function appendEvent(roomId, event) {
  const room = await ensureRoom(roomId);
  const exists = room.events.some((item) => item.id === event.id);
  const events = exists ? room.events : [event, ...room.events].slice(0, 30);
  return ensureRoom(roomId, { events });
}

async function appendNote(roomId, note) {
  const room = await ensureRoom(roomId);
  const exists = room.notes.some((item) => item.id === note.id);
  const notes = exists ? room.notes : [note, ...room.notes].slice(0, 30);
  return ensureRoom(roomId, { notes });
}

async function updateNotes(roomId, notes) {
  return ensureRoom(roomId, { notes: notes.slice(0, 30) });
}

async function updateUpload(roomId, fileName, waveformPeaks = null, audioAvailable) {
  const patch = { uploadedFileName: fileName, waveformPeaks };
  if (typeof audioAvailable === "boolean") patch.audioAvailable = audioAvailable;
  return ensureRoom(roomId, patch);
}

async function updateTimelineRegions(roomId, timelineRegions) {
  return ensureRoom(roomId, { timelineRegions });
}

async function updateTracks(roomId, tracks) {
  return ensureRoom(roomId, { tracks });
}

async function updateComposition(roomId, composition) {
  return ensureRoom(roomId, { composition });
}

async function updateAudioClips(roomId, audioClips) {
  return ensureRoom(roomId, { audioClips });
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

  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const responseData = await response.json();
  const outputText = extractResponseText(responseData);
  if (!outputText) throw new Error("OpenAI response did not contain composition data");
  const composition = JSON.parse(outputText);
  return {
    ...composition,
    id: `composition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    provider: "openai",
  };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function readBinaryBody(req, byteLimit = maxAudioBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > byteLimit) {
        reject(new Error("Audio file is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safePathSegment(value, fallback) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
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
    const store = await readAuthStore();
    if (store.users.some((user) => user.email === email)) {
      sendJson(res, 409, { error: "An account already exists for this email" });
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
    store.users.push(user);
    await writeAuthStore(store);
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

  if (pathname === "/api/rooms" && req.method === "GET") {
    const store = await readStore();
    const user = await getSessionUser(req);
    sendJson(res, 200, {
      rooms: Object.values(store.rooms)
        .filter((room) => canAccessRoom(room, user))
        .map((room) => ({ ...room, currentRole: roomAccessRole(room, user) })),
    });
    return true;
  }

  if (pathname === "/api/rooms" && req.method === "POST") {
    const body = await readBody(req);
    const roomId = body.id ?? "demo";
    const user = await getSessionUser(req);
    if (body.sourceRoomId) {
      const sourceRoomId = safePathSegment(body.sourceRoomId, "demo");
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
      const room = await ensureRoom(roomId, {
        ...sourceRoom,
        id: roomId,
        title: body.title ?? `${sourceRoom.title} copy`,
        ownerId: user?.id ?? null,
        ownerName: user?.name ?? "Guest creator",
        createdAt: undefined,
        updatedAt: undefined,
        events: [{
          id: `event-copy-${Date.now()}`,
          kind: "sync",
          title: "Room duplicated",
          detail: `Created from ${sourceRoom.title}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }, ...(sourceRoom.events ?? [])].slice(0, 40),
      });
      const sourceDirectory = path.join(uploadsDir, sourceRoomId);
      const targetDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
      await cp(sourceDirectory, targetDirectory, { recursive: true, force: true }).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
      sendJson(res, 201, { room });
      return true;
    }
    const room = await ensureRoom(roomId, {
      ...body,
      ownerId: user?.id ?? body.ownerId ?? null,
      ownerName: user?.name ?? body.ownerName ?? "Guest creator",
    });
    sendJson(res, 200, { room });
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
    const room = await ensureRoom(roomId);
    const body = await readBody(req);
    const invite = (room.invites ?? []).find((item) => item.token === body.token && Date.parse(item.expiresAt) > Date.now());
    if (!invite) {
      sendJson(res, 403, { error: "This invitation is invalid or expired" });
      return true;
    }
    const existingMember = (room.members ?? []).find((item) => item.userId === user.id);
    const invitedRole = invite.role === "viewer" ? "viewer" : "editor";
    const role = existingMember?.role === "editor" ? "editor" : invitedRole;
    const member = { userId: user.id, name: user.name, email: user.email, role, joinedAt: existingMember?.joinedAt ?? new Date().toISOString() };
    const members = [...(room.members ?? []).filter((item) => item.userId !== user.id), member];
    const joinedRoom = await ensureRoom(roomId, { members });
    sendJson(res, 200, { room: joinedRoom, member });
    return true;
  }

  if (inviteMatch && req.method === "POST") {
    const user = await getSessionUser(req);
    const roomId = decodeURIComponent(inviteMatch[1]);
    const room = await ensureRoom(roomId);
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
    await ensureRoom(roomId, { invites: [invite, ...(room.invites ?? [])].slice(0, 10) });
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
    const user = await getSessionUser(req);
    if (!isRoomOwner(room, user)) {
      sendJson(res, 403, { error: "Only the room owner can manage members" });
      return true;
    }
    let members = room.members ?? [];
    if (req.method === "PATCH") {
      const body = await readBody(req);
      const role = body.role === "viewer" ? "viewer" : "editor";
      members = members.map((member) => member.userId === memberId ? { ...member, role } : member);
    } else {
      members = members.filter((member) => member.userId !== memberId);
    }
    await ensureRoom(roomId, { members });
    sendJson(res, 200, { members });
    return true;
  }

  const protectedRoomMatch = pathname.match(/^\/api\/rooms\/([^/]+)/);
  if (protectedRoomMatch) {
    const room = await ensureRoom(decodeURIComponent(protectedRoomMatch[1]));
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
    const uploadUrl = new URL(req.url ?? pathname, `http://${req.headers.host ?? `localhost:${port}`}`);
    const requestedName = uploadUrl.searchParams.get("name") || "audio-clip";
    const trackId = safePathSegment(uploadUrl.searchParams.get("trackId"), "track");
    const duration = Math.max(0, Number(uploadUrl.searchParams.get("duration")) || 0);
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
    const room = await ensureRoom(roomId);
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
    await updateAudioClips(roomId, [...(room.audioClips ?? []), clip].slice(-24));
    sendJson(res, 201, { clip: { ...clip, storageName: undefined, mimeType: undefined } });
    return true;
  }

  if (clipAudioMatch && req.method === "GET") {
    const roomId = decodeURIComponent(clipAudioMatch[1]);
    const clipId = decodeURIComponent(clipAudioMatch[2]);
    const room = await ensureRoom(roomId);
    const clip = (room.audioClips ?? []).find((item) => item.id === clipId);
    if (!clip?.storageName) {
      sendJson(res, 404, { error: "Audio clip not found" });
      return true;
    }
    const audioBuffer = await readFile(path.join(uploadsDir, safePathSegment(roomId, "room"), clip.storageName));
    res.writeHead(200, {
      "Content-Type": clip.mimeType || "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store",
    });
    res.end(audioBuffer);
    return true;
  }

  if (clipMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(clipMatch[1]);
    const clipId = decodeURIComponent(clipMatch[2]);
    const room = await ensureRoom(roomId);
    const clip = (room.audioClips ?? []).find((item) => item.id === clipId);
    if (!clip) {
      sendJson(res, 404, { error: "Audio clip not found" });
      return true;
    }
    if (clip.storageName) {
      await rm(path.join(uploadsDir, safePathSegment(roomId, "room"), clip.storageName), { force: true });
    }
    const nextClips = (room.audioClips ?? []).filter((item) => item.id !== clipId);
    await updateAudioClips(roomId, nextClips);
    sendJson(res, 200, {
      deleted: true,
      audioClips: publicAudioClips(nextClips),
    });
    return true;
  }
  if (audioMatch && req.method === "POST") {
    const roomId = decodeURIComponent(audioMatch[1]);
    const uploadUrl = new URL(req.url ?? pathname, `http://${req.headers.host ?? `localhost:${port}`}`);
    const requestedName = uploadUrl.searchParams.get("name") ?? "uploaded-audio";
    const fileName = safePathSegment(requestedName, "uploaded-audio");
    const storageName = `${Date.now()}-${fileName}`;
    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    const audioBuffer = await readBinaryBody(req);

    if (audioBuffer.length === 0) {
      sendJson(res, 400, { error: "Audio file is empty" });
      return true;
    }

    await mkdir(roomDirectory, { recursive: true });
    await writeFile(path.join(roomDirectory, storageName), audioBuffer);
    const room = await ensureRoom(roomId, {
      uploadedFileName: requestedName.slice(0, 180),
      audioAvailable: true,
      audioStorageName: storageName,
      audioMimeType: req.headers["content-type"] || "audio/mpeg",
    });
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
    if (!room.audioAvailable || !room.audioStorageName) {
      sendJson(res, 404, { error: "No uploaded audio for this room" });
      return true;
    }

    const roomDirectory = path.join(uploadsDir, safePathSegment(roomId, "room"));
    const audioBuffer = await readFile(path.join(roomDirectory, room.audioStorageName));
    res.writeHead(200, {
      "Content-Type": room.audioMimeType || "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store",
      "Accept-Ranges": "none",
    });
    res.end(audioBuffer);
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

    const room = await appendNote(noteMatch[1], body.note);
    if (body.event) await appendEvent(noteMatch[1], body.event);
    sendJson(res, 200, { note: body.note, event: body.event, notes: room.notes });
    return true;
  }

  if (noteItemMatch && req.method === "PATCH") {
    const roomId = decodeURIComponent(noteItemMatch[1]);
    const noteId = decodeURIComponent(noteItemMatch[2]);
    const room = await ensureRoom(roomId);
    const body = await readBody(req);
    const resolved = Boolean(body.resolved);
    let found = false;
    const notes = (room.notes ?? []).map((note) => {
      if (note.id !== noteId) return note;
      found = true;
      return {
        ...note,
        resolved,
        resolvedBy: resolved ? String(body.resolvedBy ?? "A collaborator").slice(0, 60) : undefined,
        resolvedAt: resolved ? new Date().toISOString() : undefined,
      };
    });
    if (!found) {
      sendJson(res, 404, { error: "Note not found" });
      return true;
    }
    const nextRoom = await updateNotes(roomId, notes);
    if (body.event) await appendEvent(roomId, body.event);
    sendJson(res, 200, { notes: nextRoom.notes, event: body.event });
    return true;
  }

  if (noteItemMatch && req.method === "DELETE") {
    const roomId = decodeURIComponent(noteItemMatch[1]);
    const noteId = decodeURIComponent(noteItemMatch[2]);
    const room = await ensureRoom(roomId);
    if (!(room.notes ?? []).some((note) => note.id === noteId)) {
      sendJson(res, 404, { error: "Note not found" });
      return true;
    }
    const body = await readBody(req);
    const nextRoom = await updateNotes(roomId, (room.notes ?? []).filter((note) => note.id !== noteId));
    if (body.event) await appendEvent(roomId, body.event);
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
  if (tracksMatch && req.method === "GET") {
    const room = await ensureRoom(tracksMatch[1]);
    sendJson(res, 200, { tracks: room.tracks ?? initialTracks });
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
    const instrumental = body.instrumental !== false;
    const requestedProvider = body.provider === "elevenlabs" ? "elevenlabs" : "collabmuse";
    const room = await ensureRoom(roomId);
    let audioBuffer;
    let mimeType;
    let fileExtension;
    let provider;
    let model;
    let songId;
    let fallbackReason;

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
          audioBuffer = Buffer.from(await response.arrayBuffer());
          mimeType = response.headers.get("content-type") || "audio/mpeg";
          fileExtension = "mp3";
          provider = "elevenlabs";
          model = process.env.ELEVENLABS_MUSIC_MODEL ?? "music_v2_5";
          songId = response.headers.get("song-id") || undefined;
        } else {
          const detail = (await response.text()).slice(0, 1200);
          console.error(`ElevenLabs Music returned ${response.status}:`, detail);
          fallbackReason = response.status === 402
            ? "ElevenLabs requires a paid plan; generated with the CollabMuse engine instead."
            : "ElevenLabs was unavailable; generated with the CollabMuse engine instead.";
        }
      } catch (error) {
        console.error("ElevenLabs Music request failed:", error);
        fallbackReason = "ElevenLabs was unavailable; generated with the CollabMuse engine instead.";
      }
    } else if (requestedProvider === "elevenlabs") {
      fallbackReason = "ElevenLabs is not configured; generated with the CollabMuse engine instead.";
    }

    if (!audioBuffer) {
      const rendered = renderLocalMusic({
        prompt,
        style,
        mood,
        key: musicKey,
        durationSeconds,
        bpm: room.bpm ?? 96,
      });
      audioBuffer = rendered.buffer;
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
    const trackId = `ai-music-${Date.now().toString(36)}`;
    const titleBase = `${mood}-${style}-AI-track`;
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
      analysis: {
        bpm: room.bpm ?? 96,
        loudnessDb: 0,
        energy: /energetic|bright|intense/i.test(mood) ? "high" : /calm|soft|ambient/i.test(`${mood} ${style}`) ? "low" : "medium",
        dynamics: "varied",
      },
      waveformPeaks: [],
      generation: {
        provider,
        model,
        prompt,
        style,
        mood,
        key: musicKey,
        instrumental,
        songId,
      },
    };
    await updateAudioClips(roomId, [...(room.audioClips ?? []), clip].slice(-24));
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

    await updateComposition(composeMatch[1], composition);
    sendJson(res, 200, { composition, fallbackReason });
    return true;
  }

  if (tracksMatch && req.method === "PATCH") {
    const body = await readBody(req);
    if (!Array.isArray(body.tracks)) {
      sendJson(res, 400, { error: "Missing tracks" });
      return true;
    }

    const tracks = body.tracks.slice(0, 12);
    const room = await updateTracks(tracksMatch[1], tracks);
    if (body.event) await appendEvent(tracksMatch[1], body.event);
    sendJson(res, 200, { tracks: room.tracks, event: body.event });
    return true;
  }

  if (timelineMatch && req.method === "PATCH") {
    const body = await readBody(req);
    if (!Array.isArray(body.timelineRegions)) {
      sendJson(res, 400, { error: "Missing timelineRegions" });
      return true;
    }

    const room = await updateTimelineRegions(timelineMatch[1], body.timelineRegions);
    if (body.event) await appendEvent(timelineMatch[1], body.event);
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

  const versionRestoreMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/versions\/([^/]+)\/restore$/);
  const versionsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/versions$/);

  if (versionsMatch && req.method === "GET") {
    const room = await ensureRoom(decodeURIComponent(versionsMatch[1]));
    sendJson(res, 200, { versions: publicVersions(room.versions) });
    return true;
  }

  if (versionsMatch && req.method === "POST") {
    const roomId = decodeURIComponent(versionsMatch[1]);
    const room = await ensureRoom(roomId);
    const body = await readBody(req);
    const createdAt = new Date().toISOString();
    const version = {
      id: `version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(body.name ?? `Version ${(room.versions?.length ?? 0) + 1}`).trim().slice(0, 80),
      createdAt,
      snapshot: {
        tracks: room.tracks ?? initialTracks,
        timelineRegions: room.timelineRegions ?? initialTimelineRegions,
        composition: room.composition ?? null,
        audioClips: room.audioClips ?? [],
        bpm: room.bpm ?? 96,
        timeSignature: room.timeSignature ?? "4/4",
      },
    };
    const versions = [version, ...(room.versions ?? [])].slice(0, 20);
    const nextRoom = await ensureRoom(roomId, { versions });
    if (body.event) await appendEvent(roomId, body.event);
    sendJson(res, 200, { version: publicVersions([version])[0], versions: publicVersions(nextRoom.versions), event: body.event });
    return true;
  }

  if (versionRestoreMatch && req.method === "POST") {
    const roomId = decodeURIComponent(versionRestoreMatch[1]);
    const versionId = decodeURIComponent(versionRestoreMatch[2]);
    const room = await ensureRoom(roomId);
    const version = (room.versions ?? []).find((item) => item.id === versionId);
    if (!version) {
      sendJson(res, 404, { error: "Version not found" });
      return true;
    }
    const body = await readBody(req);
    const restoredRoom = await ensureRoom(roomId, {
      tracks: version.snapshot.tracks ?? initialTracks,
      timelineRegions: version.snapshot.timelineRegions ?? initialTimelineRegions,
      composition: version.snapshot.composition ?? null,
      audioClips: version.snapshot.audioClips ?? [],
      bpm: version.snapshot.bpm ?? 96,
      timeSignature: version.snapshot.timeSignature ?? "4/4",
    });
    if (body.event) await appendEvent(roomId, body.event);
    sendJson(res, 200, {
      tracks: restoredRoom.tracks,
      timelineRegions: restoredRoom.timelineRegions,
      composition: restoredRoom.composition,
      audioClips: publicAudioClips(restoredRoom.audioClips),
      bpm: restoredRoom.bpm ?? 96,
      timeSignature: restoredRoom.timeSignature ?? "4/4",
      versions: publicVersions(restoredRoom.versions),
      event: body.event,
    });
    return true;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && req.method === "GET") {
    const room = await ensureRoom(roomMatch[1]);
    sendJson(res, 200, { room });
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
    const room = await ensureRoom(roomMatch[1], body);
    sendJson(res, 200, { room });
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

    const store = await readStore();
    if (!store.rooms[roomId]) {
      sendJson(res, 404, { error: "Room not found" });
      return true;
    }

    delete store.rooms[roomId];
    await writeStore(store);
    await rm(path.join(uploadsDir, safePathSegment(roomId, "room")), { recursive: true, force: true });
    io.to(roomId).emit("room:deleted", { roomId });
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
    sendJson(res, 500, { error: "Internal server error" });
  }
});

const io = new Server(httpServer, {
  path: "/api/socket",
  cors: { origin: "*" },
});

async function broadcastPresence(roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  io.to(roomId).emit("room:presence", { roomId, count: sockets.length });
}

io.on("connection", (socket) => {
  socket.on("room:join", async (roomId = "demo") => {
    const previousRoomId = socket.data.roomId;
    if (previousRoomId && previousRoomId !== roomId) {
      socket.leave(previousRoomId);
      await broadcastPresence(previousRoomId);
    }

    const room = await ensureRoom(roomId);
    const user = await getSessionUser(socket.request);
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
      timelineRegions: room.timelineRegions,
      tracks: room.tracks ?? initialTracks,
      composition: room.composition ?? null,
      audioClips: publicAudioClips(room.audioClips),
      versions: publicVersions(room.versions),
      bpm: room.bpm ?? 96,
      timeSignature: room.timeSignature ?? "4/4",
    });
    await broadcastPresence(roomId);
  });

  socket.on("room:event", async ({ roomId = "demo", event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !event) return;
    await appendEvent(roomId, event);
    socket.to(roomId).emit("room:event", event);
  });

  socket.on("room:upload", async ({ roomId = "demo", fileName, waveformPeaks = null, audioAvailable, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !fileName) return;
    await updateUpload(roomId, fileName, waveformPeaks, audioAvailable);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:upload", { fileName, waveformPeaks, audioAvailable, event });
  });

  socket.on("room:note", async ({ roomId = "demo", note, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !note) return;
    await appendNote(roomId, note);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:note", { note, event });
  });

  socket.on("room:notes", async ({ roomId = "demo", notes, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !Array.isArray(notes)) return;
    await updateNotes(roomId, notes);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:notes", { notes, event });
  });

  socket.on("room:timeline", async ({ roomId = "demo", timelineRegions, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !Array.isArray(timelineRegions)) return;
    await updateTimelineRegions(roomId, timelineRegions);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:timeline", { timelineRegions, event });
  });

  socket.on("room:tracks", async ({ roomId = "demo", tracks, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !Array.isArray(tracks)) return;
    const nextTracks = tracks.slice(0, 12);
    await updateTracks(roomId, nextTracks);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:tracks", { tracks: nextTracks, event });
  });

  socket.on("room:composition", async ({ roomId = "demo", composition, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !composition || !Array.isArray(composition.notes)) return;
    await updateComposition(roomId, composition);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:composition", { composition, event });
  });

  socket.on("room:clips", async ({ roomId = "demo", audioClips, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !Array.isArray(audioClips)) return;
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:clips", { audioClips, event });
  });

  socket.on("room:transport", ({ roomId = "demo", command, userName = "A collaborator" }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId || !command) return;
    if (!["play", "pause", "seek"].includes(command.action) || !Number.isFinite(command.position)) return;
    socket.to(roomId).emit("room:transport", {
      id: String(command.id ?? Date.now()),
      action: command.action,
      position: Math.max(0, Number(command.position)),
      userName: String(userName).slice(0, 60),
    });
  });

  socket.on("room:settings", async ({ roomId = "demo", bpm, timeSignature, event }) => {
    if (!socket.data.canEdit || socket.data.roomId !== roomId) return;
    const normalizedBpm = Math.max(40, Math.min(220, Number(bpm) || 96));
    const normalizedSignature = ["4/4", "3/4", "6/8"].includes(timeSignature) ? timeSignature : "4/4";
    await ensureRoom(roomId, { bpm: normalizedBpm, timeSignature: normalizedSignature });
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:settings", { bpm: normalizedBpm, timeSignature: normalizedSignature, event });
  });

  socket.on("disconnect", async () => {
    const roomId = socket.data.roomId;
    if (roomId) await broadcastPresence(roomId);
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
