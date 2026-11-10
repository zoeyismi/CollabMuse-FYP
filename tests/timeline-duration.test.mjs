import assert from "node:assert/strict";
import { test } from "node:test";
import { getTimelineDuration, hasTimelineDurationMismatch } from "../lib/timeline-duration.ts";

test("timeline includes a clip near the end using the final time scale", () => {
  const clip = { id: "clip", duration: 30 };
  const region = { clipId: "clip", left: 80 };
  const duration = getTimelineDuration(0, [clip], [region]);
  assert.ok(Math.abs(duration - 150) < 0.001);
  assert.ok(duration * 0.8 + clip.duration <= duration + 0.000001);
});

test("timeline accounts for trimmed source and keeps the reference duration", () => {
  const clip = { id: "clip", duration: 30 };
  assert.equal(getTimelineDuration(200, [clip], [{ clipId: "clip", left: 80, sourceOffset: 25, sourceDuration: 10 }]), 200);
  assert.equal(getTimelineDuration(0, [], []), 0);
});

test("documents current visual duration mismatch when a long reference extends the timeline", () => {
  const clip = { id: "clip", duration: 30 };
  const region = { clipId: "clip", left: 0, width: 25, sourceDuration: 30 };
  const duration = getTimelineDuration(240, [clip], [region]);
  assert.equal(duration, 240);
  assert.equal(region.width / 100 * duration, 60);
  assert.equal(region.sourceDuration, 30);
  assert.equal(hasTimelineDurationMismatch(duration, [clip], [region]), true);
});

test("duration mismatch ignores visual rounding and placeholder regions", () => {
  const clip = { id: "clip", duration: 30 };
  assert.equal(hasTimelineDurationMismatch(120, [clip], [{ clipId: "clip", width: 25.1 }]), false);
  assert.equal(hasTimelineDurationMismatch(120, [clip], [{ width: 50 }]), false);
  assert.equal(hasTimelineDurationMismatch(0, [clip], [{ clipId: "clip", width: 25 }]), false);
});
