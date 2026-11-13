import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreNoteRange } from '../lib/score-playback-range.mjs';

test('a sustained note is resumed at the seek position and clipped to the range', () => {
  assert.deepEqual(scoreNoteRange({ start: 2, duration: 6 }, 5, 7), { offset: 0, duration: 2 });
  assert.deepEqual(scoreNoteRange({ start: 6, duration: 2 }, 5, 7), { offset: 1, duration: 1 });
  assert.equal(scoreNoteRange({ start: 2, duration: 3 }, 5, 7), null);
});
