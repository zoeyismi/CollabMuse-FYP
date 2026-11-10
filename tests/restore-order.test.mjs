import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldApplyRestore } from "../lib/restore-order.ts";

test("restores only advance an already loaded room", () => {
  assert.equal(shouldApplyRestore(2, 3, true), true);
  assert.equal(shouldApplyRestore(2, 2, true), false);
  assert.equal(shouldApplyRestore(2, 1, true), false);
});

test("initial restores accept valid versions and reject invalid epochs", () => {
  assert.equal(shouldApplyRestore(0, 1, false), true);
  for (const epoch of [-1, 1.5, NaN, Infinity]) assert.equal(shouldApplyRestore(0, epoch, false), false);
});
