import assert from "node:assert/strict";
import { test } from "node:test";
import { recordingAtRisk, recordingButtonDisabled, recordingRequestCanStart } from "../lib/recording-controls.ts";

test("leaving warns for recordings being requested, captured, uploaded or not saved", () => {
  for (const status of ["requesting", "recording", "uploading"]) assert.equal(recordingAtRisk(status, false), true);
  assert.equal(recordingAtRisk("idle", true), true);
  assert.equal(recordingAtRisk("idle", false), false);
  assert.equal(recordingAtRisk("error", false), false);
});

test("recording can be stopped after disconnection or track removal", () => {
  assert.equal(recordingButtonDisabled("recording", true, false, false), false);
  assert.equal(recordingButtonDisabled("recording", false, true, false), false);
});

test("a pending microphone request cannot start after access or its target track disappears", () => {
  assert.equal(recordingRequestCanStart(false, ["track-a"], "track-a"), true);
  assert.equal(recordingRequestCanStart(true, ["track-a"], "track-a"), false);
  assert.equal(recordingRequestCanStart(false, ["track-b"], "track-a"), false);
});

test("starting is blocked while offline, saving, or holding an unsaved recording", () => {
  assert.equal(recordingButtonDisabled("idle", true, true, false), true);
  assert.equal(recordingButtonDisabled("idle", false, false, false), true);
  assert.equal(recordingButtonDisabled("uploading", false, true, false), true);
  assert.equal(recordingButtonDisabled("error", false, true, false), true);
  assert.equal(recordingButtonDisabled("idle", false, true, true), true);
  assert.equal(recordingButtonDisabled("idle", false, true, false), false);
});
