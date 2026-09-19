import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "rooms.json");
const uploadsDir = path.join(dataDir, "uploads");
const maxAudioBytes = 25 * 1024 * 1024;
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

const initialTimelineRegions = [
  { id: "region-move", label: "Move clip", actionLabel: "Move clip", left: 12, width: 16, color: "#b71912" },
  { id: "region-mark", label: "Mark section", actionLabel: "Mark section", left: 31, width: 9, color: "#efd84c" },
  { id: "region-sync", label: "Sync edit", actionLabel: "Sync edit", left: 44, width: 25, color: "#235fba" },
  { id: "region-extend", label: "Extend clip", actionLabel: "Extend clip", left: 78, width: 16, color: "#58e081" },
];

const initialTracks = [
  { id: "drums", name: "Percussion bed", color: "#b71912", muted: false, clips: 3 },
  { id: "bass", name: "Warm bass", color: "#235fba", muted: false, clips: 2 },
  { id: "keys", name: "Soft keys", color: "#efd84c", muted: false, clips: 4 },
  { id: "vox", name: "Vocal layer", color: "#58e081", muted: true, clips: 2 },
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

function stringSeed(value) {
  return Array.from(value).reduce((seed, character) => ((seed * 31) + character.charCodeAt(0)) >>> 0, 17);
}

function generateLocalComposition({ prompt = "", key = "C", mood = "warm", style = "R&B", bars = 2 }) {
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
    tempo: /slow|calm|dream/i.test(mood) ? 72 : /energetic|bright|dance/i.test(mood) ? 112 : 88,
    style,
    explanation: `A ${count}-note ${style} motif shaped around a ${mood} ${key} ${isMinor ? "minor" : "major"} scale.`,
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
      input: `Create ${input.bars ?? 2} bars in ${input.key ?? "C"}, style ${input.style ?? "R&B"}, mood ${input.mood ?? "warm"}. Creative direction: ${input.prompt ?? "original melodic idea"}`,
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

async function handleApi(req, res, pathname) {
  if (pathname === "/api/rooms" && req.method === "GET") {
    const store = await readStore();
    sendJson(res, 200, { rooms: Object.values(store.rooms) });
    return true;
  }

  if (pathname === "/api/rooms" && req.method === "POST") {
    const body = await readBody(req);
    const roomId = body.id ?? "demo";
    const room = await ensureRoom(roomId, body);
    sendJson(res, 200, { room });
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
      timelineRegions: room.timelineRegions,
      tracks: room.tracks ?? initialTracks,
      composition: room.composition ?? null,
    });
    return true;
  }

  const audioMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/audio$/);
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

  const composeMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/compose$/);
  if (composeMatch && req.method === "POST") {
    const body = await readBody(req);
    const input = {
      prompt: String(body.prompt ?? "").slice(0, 500),
      key: String(body.key ?? "C").slice(0, 3),
      mood: String(body.mood ?? "warm").slice(0, 40),
      style: String(body.style ?? "R&B").slice(0, 40),
      bars: Math.max(1, Math.min(4, Number(body.bars) || 2)),
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
      event: body.event,
      events: room.events,
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
    const body = await readBody(req);
    const room = await ensureRoom(roomMatch[1], body);
    sendJson(res, 200, { room });
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

    socket.join(roomId);
    socket.data.roomId = roomId;
    const room = await ensureRoom(roomId);
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
    });
    await broadcastPresence(roomId);
  });

  socket.on("room:event", async ({ roomId = "demo", event }) => {
    if (!event) return;
    await appendEvent(roomId, event);
    socket.to(roomId).emit("room:event", event);
  });

  socket.on("room:upload", async ({ roomId = "demo", fileName, waveformPeaks = null, audioAvailable, event }) => {
    if (!fileName) return;
    await updateUpload(roomId, fileName, waveformPeaks, audioAvailable);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:upload", { fileName, waveformPeaks, audioAvailable, event });
  });

  socket.on("room:note", async ({ roomId = "demo", note, event }) => {
    if (!note) return;
    await appendNote(roomId, note);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:note", { note, event });
  });

  socket.on("room:timeline", async ({ roomId = "demo", timelineRegions, event }) => {
    if (!Array.isArray(timelineRegions)) return;
    await updateTimelineRegions(roomId, timelineRegions);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:timeline", { timelineRegions, event });
  });

  socket.on("room:tracks", async ({ roomId = "demo", tracks, event }) => {
    if (!Array.isArray(tracks)) return;
    const nextTracks = tracks.slice(0, 12);
    await updateTracks(roomId, nextTracks);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:tracks", { tracks: nextTracks, event });
  });

  socket.on("room:composition", async ({ roomId = "demo", composition, event }) => {
    if (!composition || !Array.isArray(composition.notes)) return;
    await updateComposition(roomId, composition);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:composition", { composition, event });
  });

  socket.on("disconnect", async () => {
    const roomId = socket.data.roomId;
    if (roomId) await broadcastPresence(roomId);
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
