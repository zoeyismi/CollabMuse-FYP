import test from "node:test";
import assert from "node:assert/strict";
import { mergeRoomEdits } from "../lib/merge-room-edits.mjs";

test("simultaneous edits to different fields are retained", () => {
  const previous = [{ id: "a", name: "Piano", volume: 0.8 }];
  const current = [{ id: "a", name: "Keys", volume: 0.8 }, { id: "b", name: "Drums" }];
  const next = [{ id: "a", name: "Piano", volume: 0.5 }, { id: "c", name: "Bass" }];
  assert.deepEqual(mergeRoomEdits(current, previous, next), [
    { id: "a", name: "Keys", volume: 0.5 }, { id: "b", name: "Drums" }, { id: "c", name: "Bass" },
  ]);
});

test("deletions do not remove items created by another collaborator", () => {
  const previous = [{ id: "a" }];
  assert.deepEqual(mergeRoomEdits([{ id: "a" }, { id: "b" }], previous, []), [{ id: "b" }]);
});

test("conflicting edits and deletion of a changed item are rejected", () => {
  const previous = [{ id: "a", left: 10, width: 5 }];
  const current = [{ id: "a", left: 20, width: 5 }];
  assert.throws(() => mergeRoomEdits(current, previous, [{ id: "a", left: 30, width: 5 }]), /another collaborator/i);
  assert.throws(() => mergeRoomEdits(current, previous, []), /another collaborator/i);
  assert.throws(() => mergeRoomEdits([], previous, [{ id: "a", left: 30, width: 5 }]), /another collaborator/i);
  assert.deepEqual(mergeRoomEdits(current, previous, [{ id: "a", left: 20, width: 5 }]), current);
});
