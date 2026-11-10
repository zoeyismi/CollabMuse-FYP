import assert from "node:assert/strict";
import { test } from "node:test";
import { audioFileSizeError, displayRecordingSizeWarning, recordingMustStop, recordingSizeWarning, MAX_AUDIO_BYTES } from "../lib/audio-limits.mjs";

test("audio upload size validation accepts the limit and rejects empty or oversized files", () => {
  assert.equal(audioFileSizeError(1), null);
  assert.equal(audioFileSizeError(MAX_AUDIO_BYTES), null);
  assert.match(audioFileSizeError(MAX_AUDIO_BYTES + 1), /25 MiB/);
  for (const invalid of [0, -1, NaN, Infinity]) assert.ok(audioFileSizeError(invalid));
});

test("recording size warning distinguishes approaching and exceeding the limit", () => {
  assert.equal(recordingSizeWarning(0), "");
  assert.match(recordingSizeWarning(Math.ceil(MAX_AUDIO_BYTES * 0.9)), /approaching/);
  assert.match(recordingSizeWarning(MAX_AUDIO_BYTES + 1), /exceeds/);
  assert.equal(recordingMustStop(MAX_AUDIO_BYTES), false);
  assert.equal(recordingMustStop(MAX_AUDIO_BYTES + 1), true);
  assert.match(displayRecordingSizeWarning(recordingSizeWarning(MAX_AUDIO_BYTES + 1), "zh"), /已自动停止.*下载/);
  assert.match(displayRecordingSizeWarning(recordingSizeWarning(MAX_AUDIO_BYTES), "zh"), /即将达到/);
});
