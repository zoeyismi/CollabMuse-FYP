import test from "node:test";
import assert from "node:assert/strict";
import { diatonicChord, renderLocalMusic, resolvePromptOptions, tempoFromPrompt } from "../lib/local-music-engine.mjs";

test("parses decimal tempo without mistaking its fractional part for BPM", () => {
  assert.equal(tempoFromPrompt("钢琴 120.50 BPM"), 120.5);
  assert.equal(tempoFromPrompt("piano at 96 bpm"), 96);
  assert.equal(tempoFromPrompt("no tempo specified"), null);
  assert.equal(tempoFromPrompt("1000 BPM"), null);
  assert.equal(tempoFromPrompt("track96 bpm"), null);
});

test("recognizes supported prompt instructions", () => {
  assert.deepEqual(resolvePromptOptions("Soft piano without drums"), { piano: true, noDrums: true });
  assert.deepEqual(resolvePromptOptions("钢琴，不要鼓"), { piano: true, noDrums: true });
  assert.deepEqual(resolvePromptOptions("warm synthesizer"), { piano: false, noDrums: false });
});

test("chords stay in the selected major or minor scale", () => {
  const major = [0, 2, 4, 5, 7, 9, 11];
  const minor = [0, 2, 3, 5, 7, 8, 10];
  assert.deepEqual(diatonicChord(0, major, 5), [57, 60, 64]);
  assert.deepEqual(diatonicChord(0, minor, 5), [56, 60, 63]);
  for (const scale of [major, minor]) {
    for (let degree = 0; degree < 7; degree++) {
      assert.ok(diatonicChord(0, scale, degree).every((note) => scale.includes((note - 48) % 12)));
    }
  }
});

test("different styles produce full-length, non-silent WAV audio", () => {
  const common = { prompt: "warm instrumental 96 bpm", mood: "warm", key: "C major", durationSeconds: 10 };
  const ambient = renderLocalMusic({ ...common, style: "Ambient" });
  const electronic = renderLocalMusic({ ...common, style: "Electronic" });
  assert.equal(ambient.bpm, 96);
  for (const { buffer } of [ambient, electronic]) {
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
    assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
    assert.equal(buffer.readUInt32LE(40), 44100 * 10 * 4);
    for (let second = 1; second < 9; second++) {
      const start = 44 + second * 44100 * 4;
      assert.ok(buffer.subarray(start, start + 44100 * 4).some((value) => value !== 0));
    }
  }
  assert.notDeepEqual(ambient.buffer, electronic.buffer);
});

test("local arrangements preserve slow and fast session tempos", () => {
  const settings = { style: "Ambient", mood: "warm", key: "C major", durationSeconds: 10 };
  for (const bpm of [40, 60, 180, 220]) {
    const result = renderLocalMusic({ ...settings, prompt: "instrumental", bpm });
    assert.equal(result.bpm, bpm);
    assert.ok(result.buffer.subarray(44).some((value) => value !== 0));
  }
  assert.equal(renderLocalMusic({ ...settings, prompt: "180 bpm", bpm: 96 }).bpm, 180);
  assert.equal(renderLocalMusic({ ...settings, prompt: "120.50 bpm", bpm: 96 }).bpm, 120.5);
  assert.equal(renderLocalMusic({ ...settings, prompt: "300 bpm", bpm: 96 }).bpm, 220);
});
