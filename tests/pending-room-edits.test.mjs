import test from "node:test";
import assert from "node:assert/strict";
import { hasPendingEdit, settlePendingEdit } from "../lib/pending-room-edits.mjs";

test("earlier acknowledgements cannot clear newer edits", () => {
  const pending = new Set(["timeline:first", "timeline:second", "track:third"]);
  assert.deepEqual(settlePendingEdit(pending, "timeline", "remote"), { own: false, stillSaving: true });
  assert.deepEqual(settlePendingEdit(pending, "timeline", "first"), { own: true, stillSaving: true });
  assert.deepEqual(settlePendingEdit(pending, "timeline", "second"), { own: true, stillSaving: false });
  assert.equal(hasPendingEdit(pending, "track"), true);
  assert.deepEqual(settlePendingEdit(pending, "track", "third"), { own: true, stillSaving: false });
  assert.equal(pending.size, 0);
});

test("melody updates stay pending until the latest local edit is acknowledged", () => {
  const pending = new Set(["composition:first", "composition:second"]);
  assert.equal(settlePendingEdit(pending, "composition", undefined).stillSaving, true);
  assert.deepEqual(settlePendingEdit(pending, "composition", "first"), { own: true, stillSaving: true });
  assert.deepEqual(settlePendingEdit(pending, "composition", "second"), { own: true, stillSaving: false });
});

test("room snapshots can identify timing edits awaiting confirmation", () => {
  const pending = new Set(["settings:first", "settings:second"]);
  assert.equal(hasPendingEdit(pending, "settings"), true);
  settlePendingEdit(pending, "settings", "first");
  assert.equal(hasPendingEdit(pending, "settings"), true);
  settlePendingEdit(pending, "settings", "second");
  assert.equal(hasPendingEdit(pending, "settings"), false);
});
