import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeScore } from '../lib/merge-score.mjs';

const base = { chords: ['C', 'G'], parts: [{ id: 'p', notes: [{ id: 'a', midi: 60 }, { id: 'b', midi: 64 }] }] };
test('independent chord and note edits merge', () => {
  const a = structuredClone(base); a.chords[0] = 'Dm'; a.parts[0].notes[0].midi = 61;
  const b = structuredClone(base); b.chords[1] = 'Em'; b.parts[0].notes[1].midi = 65;
  const result = mergeScore(base, a, b);
  assert.deepEqual(result.chords, ['Dm', 'Em']);
  assert.deepEqual(result.parts[0].notes.map((note) => note.midi), [61, 65]);
});
test('concurrent conflicting edits or deletion are rejected', () => {
  const a = structuredClone(base); a.parts[0].notes[0].midi = 61;
  const b = structuredClone(base); b.parts[0].notes[0].midi = 62;
  assert.throws(() => mergeScore(base, a, b), { statusCode: 409 });
  b.parts[0].notes.shift();
  assert.throws(() => mergeScore(base, a, b), { statusCode: 409 });
});
