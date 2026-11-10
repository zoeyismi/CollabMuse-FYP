import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { readBinaryRequest } from "../lib/binary-request.mjs";

test("binary uploads retain exact bytes at the size limit", async () => {
  const request = new PassThrough();
  const pending = readBinaryRequest(request, 4);
  request.write(Buffer.from([0, 255]));
  request.end(Buffer.from([2, 3]));
  assert.deepEqual(await pending, Buffer.from([0, 255, 2, 3]));
});

test("oversized and interrupted binary uploads are rejected", async () => {
  const oversized = new PassThrough();
  const pending = readBinaryRequest(oversized, 4);
  oversized.end(Buffer.alloc(5));
  await assert.rejects(pending, { statusCode: 413 });
  const interrupted = new PassThrough();
  const aborted = readBinaryRequest(interrupted, 4);
  interrupted.emit("aborted");
  await assert.rejects(aborted, { statusCode: 400 });
});
