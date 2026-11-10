import assert from "node:assert/strict";
import { test } from "node:test";
import { waveformPeaksFromSamples } from "../lib/waveform-peaks.ts";

test("waveform buckets normalize RMS without losing silence", () => {
  assert.deepEqual(waveformPeaksFromSamples(new Float32Array([0, 0, 1, -1]), 2), [18, 62]);
  assert.deepEqual(waveformPeaksFromSamples(new Float32Array([0, 0]), 2), [18, 18]);
  assert.equal(waveformPeaksFromSamples(new Float32Array([0.5])).length, 96);
});
