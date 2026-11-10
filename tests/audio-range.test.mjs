import test from "node:test";
import assert from "node:assert/strict";
import { audioRange } from "../lib/audio-range.mjs";

test("audio byte ranges handle normal, suffix, open and invalid requests", () => {
  assert.equal(audioRange(undefined, 100), null);
  assert.deepEqual(audioRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(audioRange("bytes=95-", 100), { start: 95, end: 99 });
  assert.deepEqual(audioRange("bytes=-5", 100), { start: 95, end: 99 });
  assert.deepEqual(audioRange("bytes=-500", 100), { start: 0, end: 99 });
  for (const value of ["bytes=100-", "bytes=5-4", "bytes=-0", "bytes=1-2,4-5", "bytes=-"]) assert.equal(audioRange(value, 100), false);
});
