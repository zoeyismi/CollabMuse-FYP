import assert from "node:assert/strict";
import { test } from "node:test";
import { availableRegionDuration, canEditRegionTiming } from "../lib/clip-source.ts";

test("legacy clips with an offset use only the remaining source", () => {
  assert.equal(availableRegionDuration({ sourceOffset: 7 }, { duration: 10 }), 3);
  assert.equal(availableRegionDuration({ sourceOffset: 12 }, { duration: 10 }), 0);
});

test("explicit source duration is limited to the available audio", () => {
  assert.equal(availableRegionDuration({ sourceOffset: 7, sourceDuration: 6 }, { duration: 10 }), 3);
  assert.equal(availableRegionDuration({ sourceOffset: 7, sourceDuration: 2 }, { duration: 10 }), 2);
  assert.equal(availableRegionDuration({ sourceDuration: 2 }), 2);
  assert.equal(availableRegionDuration({}), undefined);
});

test("invalid source timing cannot propagate into timeline editing", () => {
  assert.equal(availableRegionDuration({ sourceOffset: NaN }, { duration: 10 }), 0);
  assert.equal(availableRegionDuration({ sourceOffset: Infinity }, { duration: 10 }), 0);
  assert.equal(availableRegionDuration({ sourceDuration: NaN }, { duration: 10 }), 0);
  assert.equal(availableRegionDuration({ sourceDuration: Infinity }), 0);
  assert.equal(availableRegionDuration({}, { duration: NaN }), 0);
  assert.equal(availableRegionDuration({ sourceDuration: 2 }, { duration: Infinity }), 0);
  assert.equal(availableRegionDuration({}, { duration: 0 }), 0);
});

test("empty or invalid source timing is not editable, while placeholders remain editable", () => {
  assert.equal(canEditRegionTiming(0), false);
  assert.equal(canEditRegionTiming(NaN), false);
  assert.equal(canEditRegionTiming(Infinity), false);
  assert.equal(canEditRegionTiming(undefined), true);
  assert.equal(canEditRegionTiming(0.1), true);
});

test("a missing referenced clip is not mistaken for an editable placeholder", () => {
  assert.equal(availableRegionDuration({ clipId: "missing" }), 0);
  assert.equal(canEditRegionTiming(availableRegionDuration({ clipId: "missing" })), false);
  assert.equal(availableRegionDuration({}), undefined);
});
