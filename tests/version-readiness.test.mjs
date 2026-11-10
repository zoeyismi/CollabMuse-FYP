import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPendingVersionChanges } from "../lib/version-readiness.ts";

test("version actions wait for local edits, notes, and uploads", () => {
  assert.equal(hasPendingVersionChanges(1, false, false), true);
  assert.equal(hasPendingVersionChanges(0, true, false), true);
  assert.equal(hasPendingVersionChanges(0, false, true), true);
  assert.equal(hasPendingVersionChanges(0, false, false), false);
});
