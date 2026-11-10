import test from "node:test";
import assert from "node:assert/strict";
import { preserveRemovedRegionNotePositions, remapMergedNotes, remapSplitNotes } from "../lib/split-note-remap.mjs";

test("deleting a moved region preserves the note's latest position", () => {
  const notes = [{ id: "a", regionId: "clip", regionOffset: 0.25, position: 10 }, { id: "b", position: 7 }];
  const previous = [{ id: "clip", left: 40, width: 20 }];
  const removed = preserveRemovedRegionNotePositions(notes, previous, []);
  assert.equal(removed.changed, true);
  assert.deepEqual(removed.notes[0], { ...notes[0], position: 45 });
  assert.equal(removed.notes[1], notes[1]);
  assert.equal(preserveRemovedRegionNotePositions(notes, previous, previous).changed, false);
});

test("split preserves the absolute position of comments on both halves", () => {
  const original = { id: "old", left: 20, width: 40 };
  const first = { id: "old", left: 20, width: 10 };
  const second = { id: "new", left: 30, width: 30 };
  const notes = [{ id: "a", regionId: "old", regionOffset: 0.125 }, { id: "b", regionId: "old", regionOffset: 0.625 }, { id: "c", regionId: "other", position: 8 }];
  const result = remapSplitNotes(notes, original, first, second);
  assert.deepEqual([result[0].regionId, result[0].regionOffset, result[0].position], ["old", 0.5, 25]);
  assert.deepEqual([result[1].regionId, result[1].regionOffset, result[1].position], ["new", 0.5, 45]);
  assert.deepEqual(result[2], notes[2]);
  const restored = remapMergedNotes(result, first, second, original);
  assert.deepEqual([restored[0].regionId, restored[0].regionOffset, restored[0].position], ["old", 0.125, 25]);
  assert.deepEqual([restored[1].regionId, restored[1].regionOffset, restored[1].position], ["old", 0.625, 45]);
});
