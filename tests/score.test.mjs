import assert from "node:assert/strict";
import test from "node:test";
import midiPkg from "@tonejs/midi";
import {
  chordChromas,
  createDefaultScore,
  diatonicChords,
  discardPart,
  draftParts,
  keepPart,
  sanitizeScore,
  scaleChromas,
  scoreToMidi,
  setChord,
} from "../lib/score.mjs";

const { Midi } = midiPkg;

test("default score covers every bar with sections and diatonic chords", () => {
  const score = createDefaultScore({ key: "C minor", bars: 16 });
  assert.equal(score.bars, 16);
  assert.equal(score.chords.length, 16);
  const covered = score.sections.reduce((sum, section) => sum + section.bars, 0);
  assert.equal(covered, 16);
  const diatonic = new Set(diatonicChords("C minor"));
  assert.ok(score.chords.every((chord) => diatonic.has(chord)));
  assert.deepEqual(score.chords.slice(0, 4), ["Cm", "Ab", "Eb", "Bb"]);
});

test("drafted bass starts every bar on the chord root", () => {
  const score = draftParts(createDefaultScore({ key: "C minor" }), { roles: ["bass"], seed: 7 });
  const bass = score.parts.find((part) => part.role === "bass");
  assert.equal(bass.source, "copilot");
  assert.equal(bass.kept, false);
  for (let bar = 0; bar < score.bars; bar += 1) {
    const downbeat = bass.notes.find((note) => note.start === bar * 4);
    assert.ok(downbeat, `bar ${bar + 1} has a downbeat`);
    assert.equal(downbeat.midi % 12, chordChromas(score.chords[bar])[0]);
  }
});

test("melody uses chord tones on beats and stays in the key", () => {
  const score = draftParts(createDefaultScore({ key: "D major" }), { roles: ["melody"], seed: 3 });
  const melody = score.parts.find((part) => part.role === "melody" && part.source === "copilot");
  const scale = new Set(scaleChromas("D major"));
  assert.ok(melody.notes.length > 0);
  for (const note of melody.notes) {
    assert.ok(scale.has(note.midi % 12), `${note.midi} is in D major`);
    if (note.start % 1 === 0) {
      const bar = Math.floor(note.start / 4);
      assert.ok(chordChromas(score.chords[bar]).includes(note.midi % 12), `beat note ${note.midi} is a chord tone`);
    }
  }
});

test("following the chord track: changing a chord changes what is drafted for that bar", () => {
  const base = createDefaultScore({ key: "C minor" });
  const changed = setChord(base, 2, "Fm");
  const before = draftParts(base, { roles: ["bass"], seed: 1 }).parts.find((p) => p.role === "bass");
  const after = draftParts(changed, { roles: ["bass"], seed: 1 }).parts.find((p) => p.role === "bass");
  assert.equal(after.notes.find((n) => n.start === 8).midi % 12, chordChromas("Fm")[0]);
  assert.notEqual(before.notes.find((n) => n.start === 8).midi % 12, after.notes.find((n) => n.start === 8).midi % 12);
});

test("regenerating one section leaves the other sections untouched", () => {
  const drafted = draftParts(createDefaultScore(), { seed: 11 });
  const chorus = drafted.sections[2];
  const redrafted = draftParts(drafted, { sectionId: chorus.id, prompt: "less busy", seed: 99 });
  const from = chorus.startBar * 4;
  const to = from + chorus.bars * 4;
  for (const part of redrafted.parts.filter((p) => p.source === "copilot")) {
    const original = drafted.parts.find((p) => p.id === part.id);
    const outside = (notes) => notes.filter((n) => n.start < from || n.start >= to).map((n) => `${n.midi}@${n.start}`).sort();
    assert.deepEqual(outside(part.notes), outside(original.notes));
    assert.equal(part.kept, false, "a redrafted part goes back to being a suggestion");
  }
});

test("Copilot never rewrites a part someone kept", () => {
  const drafted = draftParts(createDefaultScore(), { seed: 11 });
  const bass = drafted.parts.find((p) => p.role === "bass");
  const kept = keepPart(drafted, bass.id);
  const redrafted = draftParts(kept, { prompt: "busy", seed: 42 });
  assert.deepEqual(redrafted.parts.find((p) => p.id === bass.id), kept.parts.find((p) => p.id === bass.id));
  assert.notDeepEqual(redrafted.parts.find((p) => p.role === "drums").notes, kept.parts.find((p) => p.role === "drums").notes);
});

test("drafting is deterministic for the same seed", () => {
  const strip = (score) => score.parts.map((p) => p.notes.map((n) => [n.midi, n.start, n.duration]));
  assert.deepEqual(strip(draftParts(createDefaultScore(), { seed: 5 })), strip(draftParts(createDefaultScore(), { seed: 5 })));
});

test("keep and discard", () => {
  const drafted = draftParts(createDefaultScore(), { roles: ["keys"], seed: 2 });
  const keys = drafted.parts.find((p) => p.role === "keys");
  assert.equal(keepPart(drafted, keys.id).parts.find((p) => p.id === keys.id).kept, true);
  assert.equal(discardPart(drafted, keys.id).parts.some((p) => p.id === keys.id), false);
});

test("sanitizeScore drops bad data and clamps to the score length", () => {
  assert.equal(sanitizeScore(null), null);
  assert.equal(sanitizeScore({ bars: 0 }), null);
  assert.equal(sanitizeScore({ bars: 999 }), null);
  const clean = sanitizeScore({
    key: "nonsense",
    bars: 2,
    beatsPerBar: 4,
    sections: [{ id: "s", name: "A", startBar: 1, bars: 5 }],
    chords: ["Cm", "<script>"],
    parts: [{ role: "hack", source: "copilot", kept: true, notes: [
      { midi: 60, start: 0, duration: 1 },
      { midi: 200, start: 0, duration: 1 },
      { midi: 62, start: 7.5, duration: 4 },
      { midi: 64, start: 9, duration: 1 },
    ] }],
  });
  assert.equal(clean.key, "C major");
  assert.equal(clean.sections.length, 0, "section past the end is dropped");
  assert.deepEqual(clean.chords, ["Cm", ""]);
  assert.equal(clean.parts[0].role, "melody");
  assert.deepEqual(clean.parts[0].notes.map((n) => n.midi), [60, 62]);
  assert.equal(clean.parts[0].notes[1].duration, 0.5, "note is clipped at the last beat");
});

test("MIDI export has one track per part with every note", () => {
  const score = draftParts(createDefaultScore(), { seed: 4 });
  const parsed = new Midi(scoreToMidi(score, { bpm: 96 }));
  assert.equal(parsed.tracks.length, score.parts.length);
  score.parts.forEach((part, index) => assert.equal(parsed.tracks[index].notes.length, part.notes.length));
  assert.equal(Math.round(parsed.header.tempos[0].bpm), 96);
  assert.equal(parsed.tracks[score.parts.findIndex((p) => p.role === "drums")].channel, 9);
});

test("a proposal changes only its section, and accepting it applies exactly that", async () => {
  const { createProposal, applyProposal, acceptProposal, rejectProposal, voteProposal } = await import("../lib/score.mjs");
  const base = keepPart(draftParts(createDefaultScore(), { seed: 21 }), "part-melody");
  const chorus = base.sections[2];
  const withProposal = createProposal(base, { sectionId: chorus.id, author: "Franky", prompt: "lift", seed: 8, createdAt: "t" });
  const proposal = withProposal.proposals.at(-1);
  assert.equal(proposal.status, "open");
  assert.equal(proposal.chords.length, chorus.bars);
  const from = chorus.startBar * 4;
  const to = from + chorus.bars * 4;
  for (const part of proposal.parts) assert.ok(part.notes.every((n) => n.start >= from && n.start < to));

  const accepted = acceptProposal(withProposal, proposal.id);
  assert.equal(accepted.proposals.at(-1).status, "accepted");
  assert.deepEqual(accepted.chords.slice(0, chorus.startBar), base.chords.slice(0, chorus.startBar));
  assert.deepEqual(accepted.chords.slice(chorus.startBar, chorus.startBar + chorus.bars), proposal.chords);
  for (const part of accepted.parts) {
    const before = base.parts.find((p) => p.id === part.id);
    const outside = (notes) => notes.filter((n) => n.start < from || n.start >= to).map((n) => n.id).sort();
    assert.deepEqual(outside(part.notes), outside(before.notes));
  }
  assert.deepEqual(applyProposal(withProposal, proposal.id).chords, accepted.chords);

  const rejected = rejectProposal(withProposal, proposal.id);
  assert.equal(rejected.proposals.at(-1).status, "kept-a");
  assert.deepEqual(rejected.chords, base.chords);

  let voted = voteProposal(withProposal, proposal.id, "Ziyi", "B");
  voted = voteProposal(voted, proposal.id, "Lina", "B");
  voted = voteProposal(voted, proposal.id, "Ziyi", "A");
  assert.deepEqual(voted.proposals.at(-1).votes, { A: ["Ziyi"], B: ["Lina"] });
  voted = voteProposal(voted, proposal.id, "Ziyi", "A");
  assert.deepEqual(voted.proposals.at(-1).votes.A, [], "voting the same side again withdraws the vote");
});

test("proposals survive sanitizeScore and bad ones are dropped", async () => {
  const { createProposal } = await import("../lib/score.mjs");
  const base = createProposal(draftParts(createDefaultScore(), { seed: 2 }), { sectionId: "section-2", author: "Lina", seed: 1, createdAt: "t" });
  const clean = sanitizeScore({ ...base, proposals: [...base.proposals, { sectionId: "missing" }] });
  assert.equal(clean.proposals.length, 1);
  assert.deepEqual(clean.proposals[0].chords, base.proposals[0].chords);
  assert.equal(clean.proposals[0].parts.length, base.proposals[0].parts.length);
});
