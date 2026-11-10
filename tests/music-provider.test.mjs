import test from "node:test";
import assert from "node:assert/strict";
import { discardMusicErrorResponse, readBoundedJson, readMp3Response } from "../lib/music-provider.mjs";

test("composition responses are size-limited and parsed", async () => {
  assert.deepEqual(await readBoundedJson(new Response('{"notes":[]}'), 32), { notes: [] });
  await assert.rejects(readBoundedJson(new Response("123456", { headers: { "content-length": "6" } }), 5), /too large/);
  await assert.rejects(readBoundedJson(new Response("123456"), 5), /too large/);
  await assert.rejects(readBoundedJson(new Response("not json"), 32), SyntaxError);
});

test("discards error responses without reading or logging their contents", async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  discardMusicErrorResponse(new Response(body, { status: 500 }));
  await Promise.resolve();
  assert.equal(cancelled, true);
  discardMusicErrorResponse(new Response(null, { status: 500 }));
});

test("accepts a bounded MP3 response", async () => {
  const bytes = new Uint8Array(256);
  bytes.set([0x49, 0x44, 0x33]);
  const audio = await readMp3Response(new Response(bytes, { headers: { "content-type": "audio/mpeg" } }), 1024);
  assert.deepEqual(audio, Buffer.from(bytes));
});

test("rejects non-audio, invalid and oversized responses", async () => {
  await assert.rejects(readMp3Response(new Response("error", { headers: { "content-type": "application/json" } }), 1024), /MP3 audio/);
  await assert.rejects(readMp3Response(new Response(new Uint8Array(256), { headers: { "content-type": "audio/mpeg" } }), 1024), /invalid MP3/);
  const bytes = new Uint8Array(2048);
  bytes.set([0x49, 0x44, 0x33]);
  await assert.rejects(readMp3Response(new Response(bytes, { headers: { "content-type": "audio/mpeg" } }), 1024), /too large/);
});
