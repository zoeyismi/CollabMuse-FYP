import test from "node:test";
import assert from "node:assert/strict";
import { referenceTempo, referenceTempoDetails } from "../lib/reference-tempo.mjs";

test("accepts generated tempo throughout the supported room range", () => {
  for (const bpm of [40, 60, 180, 220]) {
    assert.equal(referenceTempo({ generation: { provider: "collabmuse", bpm } }), bpm);
  }
  assert.equal(referenceTempo({ generation: { provider: "collabmuse", bpm: 221 } }), null);
  assert.equal(referenceTempo({ generation: { provider: "elevenlabs", bpm: 220 } }), null);
  assert.equal(referenceTempo({ generation: { provider: "elevenlabs", bpm: 120 } }), 120);
});

test("keeps analysis bounds and falls back to known generated tempo", () => {
  assert.equal(referenceTempo({ analysis: { bpm: 120 }, generation: { provider: "collabmuse", bpm: 220 } }), 220);
  assert.equal(referenceTempo({ analysis: { bpm: 220 }, generation: { provider: "collabmuse", bpm: 220 } }), 220);
  assert.equal(referenceTempo({ analysis: { bpm: 220 } }), null);
  assert.equal(referenceTempo(null), null);
});

test("marks analyzed tempos as estimates and built-in generated tempos as known", () => {
  assert.deepEqual(referenceTempoDetails({ analysis: { bpm: 120 } }), { bpm: 120, estimated: true });
  assert.deepEqual(referenceTempoDetails({ analysis: { bpm: 120 }, generation: { provider: "collabmuse", bpm: 120 } }), { bpm: 120, estimated: false });
  assert.deepEqual(referenceTempoDetails({ analysis: { bpm: 120 }, generation: { provider: "elevenlabs", bpm: 110 } }), { bpm: 120, estimated: true });
});
