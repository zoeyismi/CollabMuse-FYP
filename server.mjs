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

const defaultRoom = {
  id: "demo",
  title: "Always session",
  uploadedFileName: "always-reference.wav",
  waveformPeaks: null,
  events: initialEvents,
  notes: initialNotes,
  timelineRegions: initialTimelineRegions,
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
        notes: existing.notes ?? initialNotes,
        timelineRegions: existing.timelineRegions ?? initialTimelineRegions,
        ...roomPatch,
        id: roomId,
        updatedAt: now,
      }
    : {
        id: roomId,
        title: roomPatch.title ?? `${roomId} room`,
        uploadedFileName: roomPatch.uploadedFileName ?? "always-reference.wav",
        waveformPeaks: roomPatch.waveformPeaks ?? null,
        events: roomPatch.events ?? [],
        notes: roomPatch.notes ?? [],
        timelineRegions: roomPatch.timelineRegions ?? initialTimelineRegions,
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

async function updateUpload(roomId, fileName, waveformPeaks = null) {
  return ensureRoom(roomId, { uploadedFileName: fileName, waveformPeaks });
}

async function updateTimelineRegions(roomId, timelineRegions) {
  return ensureRoom(roomId, { timelineRegions });
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
      timelineRegions: room.timelineRegions,
    });
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

io.on("connection", (socket) => {
  socket.on("room:join", async (roomId = "demo") => {
    socket.join(roomId);
    const room = await ensureRoom(roomId);
    socket.emit("room:snapshot", {
      roomId,
      title: room.title,
      events: room.events,
      notes: room.notes,
      uploadedFileName: room.uploadedFileName,
      waveformPeaks: room.waveformPeaks,
      timelineRegions: room.timelineRegions,
    });
  });

  socket.on("room:event", async ({ roomId = "demo", event }) => {
    if (!event) return;
    await appendEvent(roomId, event);
    socket.to(roomId).emit("room:event", event);
  });

  socket.on("room:upload", async ({ roomId = "demo", fileName, waveformPeaks = null, event }) => {
    if (!fileName) return;
    await updateUpload(roomId, fileName, waveformPeaks);
    if (event) await appendEvent(roomId, event);
    socket.to(roomId).emit("room:upload", { fileName, waveformPeaks, event });
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
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
