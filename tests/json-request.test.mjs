import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { readJsonRequest } from "../lib/json-request.mjs";

test("JSON input handles UTF-8 characters split across chunks", async () => {
  const request = new PassThrough();
  const pending = readJsonRequest(request, 100);
  const bytes = Buffer.from('{"name":"音乐"}');
  request.write(bytes.subarray(0, 10));
  request.end(bytes.subarray(10));
  assert.deepEqual(await pending, { name: "音乐" });
});

test("JSON input rejects oversized and malformed requests", async () => {
  const large = new PassThrough();
  const tooLarge = readJsonRequest(large, 4);
  large.end("12345");
  await assert.rejects(tooLarge, { statusCode: 413 });
  const malformed = new PassThrough();
  const invalid = readJsonRequest(malformed, 20);
  malformed.end("{");
  await assert.rejects(invalid, { statusCode: 400 });
});
