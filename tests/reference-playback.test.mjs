import test from "node:test";
import assert from "node:assert/strict";
import { referenceHasEnded } from "../lib/reference-playback.mjs";

test("reference audio stops at its end without restarting after a seek", () => {
  assert.equal(referenceHasEnded(9.99, 10), false);
  assert.equal(referenceHasEnded(10, 10), true);
  assert.equal(referenceHasEnded(20, 10), true);
  assert.equal(referenceHasEnded(20, NaN), false);
  assert.equal(referenceHasEnded(20, 0), false);
});
