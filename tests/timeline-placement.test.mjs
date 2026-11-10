import assert from "node:assert/strict";
import { test } from "node:test";
import { findFreeTimelineStart } from "../lib/timeline-placement.ts";

test("duplication prefers space after the original and falls back to an earlier gap", () => {
  assert.equal(findFreeTimelineStart([{ left: 10, width: 20 }], 20, 30), 30);
  assert.equal(findFreeTimelineStart([{ left: 60, width: 40 }], 40, 100), 0);
  assert.equal(findFreeTimelineStart([{ left: 0, width: 60 }, { left: 70, width: 30 }], 30, 100), null);
});

test("finds a gap without overlapping existing clips", () => {
  assert.equal(findFreeTimelineStart([{ left: 50, width: 25 }, { left: 0, width: 20 }], 20), 20);
  assert.equal(findFreeTimelineStart([{ left: 0, width: 30 }, { left: 20, width: 30 }], 20), 50);
  assert.equal(findFreeTimelineStart([], 100), 0);
});

test("reports when a clip cannot fit instead of placing it over existing audio", () => {
  assert.equal(findFreeTimelineStart([{ left: 0, width: 60 }, { left: 80, width: 20 }], 30), null);
  assert.equal(findFreeTimelineStart([{ left: 0, width: 100 }], 1), null);
  assert.equal(findFreeTimelineStart([], 0), null);
});
