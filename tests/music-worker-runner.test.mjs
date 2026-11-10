import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";
import test from "node:test";
import { createMusicWorkerRunner } from "../lib/music-worker-runner.mjs";

class FakeWorker extends EventEmitter {
  terminated = false;
  terminate() { this.terminated = true; return Promise.resolve(0); }
}

test("timed out workers are terminated and release the generation slot", async () => {
  const workers = [];
  const run = createMusicWorkerRunner({ maxJobs: 1, timeoutMs: 10, createWorker: () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  } });
  const first = run({});
  assert.throws(() => run({}), { statusCode: 429 });
  await assert.rejects(first, { statusCode: 504 });
  await Promise.resolve();
  assert.equal(workers[0].terminated, true);
  const second = run({});
  workers[1].emit("message", { bpm: 120 });
  assert.deepEqual(await second, { bpm: 120 });
  workers[0].emit("exit", 1);
  const third = run({});
  workers[2].emit("exit", 1);
  await assert.rejects(third, /exited before returning audio/);
});

test("real music worker returns non-silent WAV data", async () => {
  const run = createMusicWorkerRunner({
    createWorker: (input) => new Worker(new URL("../lib/local-music-worker.mjs", import.meta.url), { workerData: input }),
  });
  const result = await run({ prompt: "warm instrumental 96 bpm", mood: "warm", key: "C major", style: "Ambient", durationSeconds: 10 });
  const wav = Buffer.from(result.buffer);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(40), 44100 * 10 * 4);
  assert.ok(wav.subarray(44).some((sample) => sample !== 0));
  assert.equal(result.bpm, 96);
});

test("a synchronous termination failure does not crash after timeout", async () => {
  const run = createMusicWorkerRunner({ timeoutMs: 5, createWorker: () => {
    const worker = new FakeWorker();
    worker.terminate = () => { throw new Error("termination failed"); };
    return worker;
  } });
  await assert.rejects(run({}), { statusCode: 504 });
  await new Promise((resolve) => setImmediate(resolve));
});

test("worker creation and rendering failures release the generation slot", async () => {
  let worker;
  let failCreation = true;
  const run = createMusicWorkerRunner({ maxJobs: 1, createWorker: () => {
    if (failCreation) { failCreation = false; throw new Error("creation failed"); }
    worker = new FakeWorker();
    return worker;
  } });
  await assert.rejects(run({}), /creation failed/);
  const pending = run({});
  worker.emit("error", new Error("render failed"));
  await assert.rejects(pending, /render failed/);
  const retry = run({});
  worker.emit("message", { error: "invalid input" });
  await assert.rejects(retry, /invalid input/);
});
