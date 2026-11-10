import assert from "node:assert/strict";
import { test } from "node:test";
import { getLoopRestartTime } from "../lib/playback-loop.ts";

test("loop changes take effect at the configured end", () => {
  assert.equal(getLoopRestartTime(8, 20, false, 2, 8), null);
  assert.equal(getLoopRestartTime(7.9, 20, true, 2, 8), null);
  assert.equal(getLoopRestartTime(8, 20, true, 2, 8), 2);
});

test("loop boundaries stay within the timeline", () => {
  assert.equal(getLoopRestartTime(10, 10, true, -2, 0), 0);
  assert.equal(getLoopRestartTime(10, 10, true, 3, 30), 3);
  assert.equal(getLoopRestartTime(10, 10, true, 10, 10), 0);
  assert.equal(getLoopRestartTime(0, 0, true, 0, 0), null);
});
