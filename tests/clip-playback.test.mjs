import assert from "node:assert/strict";
import { test } from "node:test";
import { playClipSegment, startTrackedAudio } from "../lib/clip-playback.ts";

test("cancelled reference playback stops when a delayed play request resolves", async () => {
  let resolve;
  let paused = 0;
  const audio = { play: () => new Promise((done) => { resolve = done; }), pause: () => { paused += 1; } };
  const pending = startTrackedAudio(audio, () => false);
  resolve();
  assert.equal(await pending, null);
  assert.equal(paused, 1);
});

test("a clip's stop timer starts after playback has actually begun", async () => {
  let start;
  let paused = false;
  const audio = { play: () => new Promise((resolve) => { start = resolve; }), pause: () => { paused = true; } };
  let stop;
  const pending = playClipSegment(audio, 2, () => true, (callback, delay) => { assert.equal(delay, 2000); stop = callback; });
  assert.equal(stop, undefined);
  start();
  await pending;
  assert.equal(paused, false);
  stop();
  assert.equal(paused, true);
});

test("a cancelled playback cannot schedule or stop a newer playback", async () => {
  let start;
  let current = true;
  let stop;
  let pauses = 0;
  const audio = { play: () => new Promise((resolve) => { start = resolve; }), pause: () => { pauses += 1; } };
  const pending = playClipSegment(audio, 1, () => current, (callback) => { stop = callback; });
  current = false;
  start();
  await pending;
  assert.equal(stop, undefined);
  current = true;
  const second = playClipSegment({ ...audio, play: () => Promise.resolve() }, 1, () => current, (callback) => { stop = callback; });
  await second;
  current = false;
  stop();
  assert.equal(pauses, 1);
});

test("a late old playback does not pause a newer request on the same audio", async () => {
  const resolvers = [];
  let pauses = 0;
  const audio = { play: () => new Promise((resolve) => resolvers.push(resolve)), pause: () => { pauses += 1; } };
  const first = playClipSegment(audio, 1, () => false, () => assert.fail("old request scheduled a timer"));
  const second = playClipSegment(audio, 1, () => true, () => {});
  resolvers[0]();
  await first;
  assert.equal(pauses, 0);
  resolvers[1]();
  await second;
  assert.equal(pauses, 0);
});

test("a clip resolving after its timeline generation ends is stopped", async () => {
  let resolve;
  let pauses = 0;
  let generation = 1;
  const audio = { play: () => new Promise((done) => { resolve = done; }), pause: () => { pauses += 1; } };
  const pending = playClipSegment(audio, 5, () => generation === 1, () => assert.fail("ended playback scheduled a timer"));
  generation += 1;
  resolve();
  await pending;
  assert.equal(pauses, 1);
});
