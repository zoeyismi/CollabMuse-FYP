import assert from "node:assert/strict";
import { test } from "node:test";
import { exportSegmentRange } from "../lib/export-segment.ts";

test("export range preserves valid trims and clamps to actual audio", () => {
  assert.deepEqual(exportSegmentRange(10, 2, 3), { offset: 2, duration: 3 });
  assert.deepEqual(exportSegmentRange(10, 8, 4), { offset: 8, duration: 2 });
  assert.deepEqual(exportSegmentRange(10, -1, 2), { offset: 0, duration: 2 });
});

test("export rejects empty, out-of-range and non-finite segments", () => {
  for (const args of [[10, 10, 2], [10, 11, 2], [10, 0, 0], [10, 0, -1], [NaN, 0, 2], [10, Infinity, 2], [10, 0, NaN]]) {
    assert.equal(exportSegmentRange(...args), null);
  }
});
