import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createJsonStore } from "../lib/json-store.mjs";

test("concurrent changes are retained and the previous save is backed up", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  const store = createJsonStore(file, () => ({ rooms: {} }));
  await Promise.all(Array.from({ length: 50 }, (_, index) => store.update((data) => {
    data.rooms[`room-${index}`] = { title: `Room ${index}` };
  })));
  assert.equal(Object.keys((await store.read()).rooms).length, 50);
  assert.equal(Object.keys(JSON.parse(await readFile(`${file}.bak`, "utf8")).rooms).length, 49);
});

test("separate stores for the same file serialize updates within one process", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  const stores = [createJsonStore(file, () => ({ rooms: {} })), createJsonStore(file, () => ({ rooms: {} }))];
  await Promise.all(Array.from({ length: 20 }, (_, index) => stores[index % 2].update(async (data) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    data.rooms[`room-${index}`] = true;
  })));
  assert.equal(Object.keys((await stores[0].read()).rooms).length, 20);
});

test("invalid saved data is never replaced by defaults", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  await writeFile(file, "{broken data");
  const store = createJsonStore(file, () => ({ rooms: {} }));
  await assert.rejects(store.read(), /invalid JSON/);
  await assert.rejects(store.update(() => {}), /invalid JSON/);
  assert.equal(await readFile(file, "utf8"), "{broken data");
});

test("valid JSON with an invalid structure is not read or overwritten", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  const malformed = JSON.stringify({ rooms: [] });
  await writeFile(file, malformed);
  const store = createJsonStore(file, () => ({ rooms: {} }), (value) => value && typeof value.rooms === "object" && value.rooms !== null && !Array.isArray(value.rooms));
  await assert.rejects(store.read(), /invalid data structure/);
  await assert.rejects(store.update(() => {}), /invalid data structure/);
  assert.equal(await readFile(file, "utf8"), malformed);
  const good = JSON.stringify({ rooms: { kept: { title: "My work" } } });
  await writeFile(file, good);
  await assert.rejects(store.update((value) => { value.rooms = []; }), /invalid data structure/);
  assert.equal(await readFile(file, "utf8"), good);
});

test("a missing primary file does not overwrite an existing backup", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  const backup = JSON.stringify({ rooms: { kept: { title: "My work" } } });
  await writeFile(`${file}.bak`, backup);
  const store = createJsonStore(file, () => ({ rooms: {} }));
  await assert.rejects(store.read(), /existing backup/);
  await assert.rejects(store.update(() => {}), /existing backup/);
  assert.equal(await readFile(`${file}.bak`, "utf8"), backup);
  await assert.rejects(readFile(file), { code: "ENOENT" });
});

test("a file removed during an update is not replaced with defaults", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  await writeFile(file, JSON.stringify({ rooms: { kept: true } }));
  const store = createJsonStore(file, () => ({ rooms: {} }));
  await assert.rejects(store.update(async () => { await rm(file); }), { code: "ENOENT" });
  await assert.rejects(readFile(file), { code: "ENOENT" });
});

test("failed backup replacement preserves the original and does not block later saves", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "collabmuse-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "rooms.json");
  const original = JSON.stringify({ rooms: { kept: { title: "My work" } } });
  await writeFile(file, original);
  await mkdir(`${file}.bak`);
  const store = createJsonStore(file, () => ({ rooms: {} }));

  await assert.rejects(store.update((data) => { data.rooms.kept.title = "Unsaved edit"; }));
  assert.equal(await readFile(file, "utf8"), original);
  assert.equal((await store.read()).rooms.kept.title, "My work");

  await rm(`${file}.bak`, { recursive: true });
  await store.update((data) => { data.rooms.kept.title = "Saved after recovery"; });
  assert.equal((await store.read()).rooms.kept.title, "Saved after recovery");
  assert.equal(JSON.parse(await readFile(`${file}.bak`, "utf8")).rooms.kept.title, "My work");
});
