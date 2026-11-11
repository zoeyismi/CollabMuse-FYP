// Score model for composing with notes: sections, a chord per bar and editable note parts.
// Pure functions only, shared by the browser and server.mjs. Music theory comes from Tonal.
import { Chord, Key, Note } from "tonal";
import midiPkg from "@tonejs/midi";

const { Midi } = midiPkg;

export const SCORE_LIMITS = Object.freeze({ maxBars: 64, maxParts: 8, maxNotesPerPart: 1024, minMidi: 24, maxMidi: 108 });
export const PART_ROLES = Object.freeze(["drums", "bass", "keys", "melody", "pad"]);
export const DRUM_NOTES = Object.freeze({ kick: 36, snare: 38, hat: 42 });

const ROLE_NAMES = { drums: "Drums", bass: "Bass", keys: "Keys", melody: "Melody", pad: "Pad" };
const ROLE_RANGES = { drums: [36, 42], bass: [33, 52], keys: [52, 76], melody: [64, 86], pad: [48, 72] };

function seeded(seed) {
  let x = (Number(seed) >>> 0) || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export function hashSeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

let idCounter = 0;
export function makeId(prefix) {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** "C minor" -> { tonic: "C", mode: "minor" }. Unknown input falls back to C major. */
export function parseKey(key) {
  const match = /^([A-G][#b]?)\s*(major|minor)?$/i.exec(String(key ?? "").trim());
  if (!match) return { tonic: "C", mode: "major" };
  return { tonic: match[1][0].toUpperCase() + match[1].slice(1), mode: (match[2] ?? "major").toLowerCase() };
}

/** The seven diatonic triads of a key, e.g. C minor -> Cm, Ddim, Eb, Fm, Gm, Ab, Bb. */
export function diatonicChords(key) {
  const { tonic, mode } = parseKey(key);
  return mode === "minor" ? [...Key.minorKey(tonic).natural.triads] : [...Key.majorKey(tonic).triads];
}

export function scaleChromas(key) {
  const { tonic, mode } = parseKey(key);
  const scale = mode === "minor" ? Key.minorKey(tonic).natural.scale : Key.majorKey(tonic).scale;
  return scale.map((name) => Note.chroma(name));
}

/** Pitch classes (0-11) of a chord symbol, root first. Empty for unknown symbols. */
export function chordChromas(symbol) {
  if (!symbol) return [];
  const chord = Chord.get(symbol);
  if (chord.empty) return [];
  return chord.notes.map((name) => Note.chroma(name));
}

export function midiToName(midi) {
  return Note.fromMidi(midi);
}

const DEFAULT_PROGRESSIONS = { minor: [0, 5, 2, 6], major: [0, 4, 5, 3] };

export function createDefaultScore({ key = "C minor", bars = 16 } = {}) {
  const parsed = parseKey(key);
  const triads = diatonicChords(`${parsed.tonic} ${parsed.mode}`);
  const progression = DEFAULT_PROGRESSIONS[parsed.mode].map((degree) => triads[degree]);
  const total = Math.max(4, Math.min(SCORE_LIMITS.maxBars, Math.round(bars / 4) * 4));
  const sectionNames = ["Intro", "Verse", "Chorus", "Bridge", "Chorus", "Outro"];
  const sections = [];
  for (let start = 0, index = 0; start < total; start += 4, index += 1) {
    sections.push({ id: `section-${index + 1}`, name: sectionNames[index % sectionNames.length], startBar: start, bars: 4 });
  }
  return {
    version: 1,
    key: `${parsed.tonic} ${parsed.mode}`,
    bars: total,
    beatsPerBar: 4,
    sections,
    chords: Array.from({ length: total }, (_, bar) => progression[bar % progression.length]),
    parts: [{ id: "part-melody", name: "Melody", role: "melody", source: "human", kept: true, volume: 0.8, notes: [] }],
  };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Validates untrusted score data (from a socket or HTTP body). Returns a clean copy, or null if unusable. */
export function sanitizeScore(input) {
  if (!input || typeof input !== "object") return null;
  const bars = Math.round(finite(input.bars, 0));
  if (bars < 1 || bars > SCORE_LIMITS.maxBars) return null;
  const beatsPerBar = Math.round(finite(input.beatsPerBar, 4));
  if (beatsPerBar < 2 || beatsPerBar > 7) return null;
  const totalBeats = bars * beatsPerBar;
  const { tonic, mode } = parseKey(input.key);
  const sections = (Array.isArray(input.sections) ? input.sections : []).slice(0, 16).flatMap((section) => {
    const startBar = Math.round(finite(section?.startBar, -1));
    const length = Math.round(finite(section?.bars, 0));
    if (startBar < 0 || length < 1 || startBar + length > bars) return [];
    return [{ id: String(section.id ?? makeId("section")).slice(0, 64), name: String(section.name ?? "Section").slice(0, 32), startBar, bars: length }];
  });
  const chords = Array.from({ length: bars }, (_, bar) => {
    const symbol = typeof input.chords?.[bar] === "string" ? input.chords[bar].slice(0, 12) : "";
    return symbol && !Chord.get(symbol).empty ? symbol : "";
  });
  const parts = (Array.isArray(input.parts) ? input.parts : []).slice(0, SCORE_LIMITS.maxParts).map((part) => {
    const role = PART_ROLES.includes(part?.role) ? part.role : "melody";
    const notes = (Array.isArray(part?.notes) ? part.notes : []).slice(0, SCORE_LIMITS.maxNotesPerPart).flatMap((note) => {
      const midi = Math.round(finite(note?.midi, -1));
      const start = finite(note?.start, -1);
      const duration = finite(note?.duration, 0);
      if (midi < SCORE_LIMITS.minMidi || midi > SCORE_LIMITS.maxMidi || start < 0 || start >= totalBeats || duration <= 0) return [];
      return [{
        id: String(note.id ?? makeId("n")).slice(0, 64),
        midi,
        start: Math.round(start * 1000) / 1000,
        duration: Math.round(Math.min(duration, totalBeats - start) * 1000) / 1000,
        velocity: Math.min(1, Math.max(0.05, finite(note.velocity, 0.8))),
      }];
    });
    return {
      id: String(part?.id ?? makeId("part")).slice(0, 64),
      name: String(part?.name ?? ROLE_NAMES[role]).slice(0, 36),
      role,
      source: part?.source === "copilot" ? "copilot" : "human",
      kept: part?.source === "copilot" ? Boolean(part.kept) : true,
      muted: Boolean(part?.muted),
      volume: Math.min(1, Math.max(0, finite(part?.volume, 0.8))),
      notes,
    };
  });
  return { version: 1, key: `${tonic} ${mode}`, bars, beatsPerBar, sections, chords, parts };
}

/** Words in a prompt that change how the rule-based Copilot writes. */
export function readPromptOptions(prompt = "") {
  const text = String(prompt).toLowerCase();
  const sparse = /sparse|less busy|calm|breathe|minimal|soft|稀|少一点|安静|轻/.test(text);
  const busy = /busy|energetic|driving|dense|faster|热闹|密|激烈|动感/.test(text);
  return {
    density: sparse ? 0.35 : busy ? 0.85 : 0.6,
    halfTime: /half[- ]?time|半拍/.test(text),
    lift: /lift|higher|soar|抬|高/.test(text),
  };
}

function nearestInRange(chroma, low, high, target) {
  let best = null;
  for (let midi = low; midi <= high; midi += 1) {
    if (midi % 12 !== chroma) continue;
    if (best === null || Math.abs(midi - target) < Math.abs(best - target)) best = midi;
  }
  return best ?? low;
}

function chordAt(score, bar) {
  for (let index = bar; index >= 0; index -= 1) if (score.chords[index]) return score.chords[index];
  return diatonicChords(score.key)[0];
}

function writeBar(role, score, bar, random, options, state) {
  const beats = score.beatsPerBar;
  const base = bar * beats;
  const tones = chordChromas(chordAt(score, bar));
  const [low, high] = ROLE_RANGES[role];
  const notes = [];
  const add = (midi, start, duration, velocity) => notes.push({ id: makeId("n"), midi, start: base + start, duration, velocity });

  if (role === "drums") {
    const step = options.density > 0.7 ? 0.25 : 0.5;
    for (let beat = 0; beat < beats; beat += step) add(DRUM_NOTES.hat, beat, step / 2, beat % 1 === 0 ? 0.55 : 0.35);
    add(DRUM_NOTES.kick, 0, 0.25, 0.95);
    if (!options.halfTime && beats >= 4) add(DRUM_NOTES.kick, 2, 0.25, 0.85);
    if (options.density > 0.5 && random() > 0.5) add(DRUM_NOTES.kick, beats - 0.5, 0.25, 0.7);
    if (options.halfTime) add(DRUM_NOTES.snare, Math.floor(beats / 2), 0.25, 0.9);
    else for (let beat = 1; beat < beats; beat += 2) add(DRUM_NOTES.snare, beat, 0.25, 0.9);
    return notes;
  }
  if (role === "bass") {
    const root = nearestInRange(tones[0], low, high, 40);
    const fifth = nearestInRange(tones[2] ?? tones[0], low, high, root + 7);
    add(root, 0, options.density < 0.5 ? beats : 1.5, 0.9);
    if (options.density >= 0.5) {
      add(root, 2, 1, 0.8);
      add(random() > 0.5 ? fifth : root, beats - 0.5, 0.5, 0.7);
    }
    return notes;
  }
  if (role === "keys" || role === "pad") {
    const center = role === "pad" ? 60 : 64;
    const voicing = tones.slice(0, 3).map((chroma) => nearestInRange(chroma, low, high, center)).sort((a, b) => a - b);
    const hits = role === "pad" || options.density < 0.5 ? [[0, beats]] : [[0, 1.5], [2, 1.5]];
    for (const [start, duration] of hits) for (const midi of voicing) add(midi, start, duration, role === "pad" ? 0.5 : 0.65);
    return notes;
  }
  // Melody: chord tones on strong beats, scale steps between them, moving smoothly.
  const scale = scaleChromas(score.key);
  const center = options.lift ? 79 : 74;
  const rhythm = options.density < 0.5 ? [[0, 2], [2, 2]] : options.density > 0.7 ? [[0, 0.5], [0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]] : [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]];
  for (const [start, duration] of rhythm) {
    if (start >= beats) continue;
    const strong = start % 1 === 0;
    const pool = strong ? tones : scale;
    const target = state.last ?? center;
    const candidates = pool.map((chroma) => nearestInRange(chroma, low, high, target + Math.round((random() - 0.5) * 6)));
    const midi = candidates[Math.floor(random() * candidates.length)];
    state.last = midi;
    add(midi, start, Math.min(duration, beats - start), strong ? 0.85 : 0.7);
  }
  return notes;
}

/**
 * Rule-based Copilot: writes note parts that follow the chord track.
 * With sectionId only that section's bars are rewritten and the other bars keep their notes.
 * Returns a new score; drafted parts are marked source "copilot" and kept false until someone keeps them.
 * Parts that were already kept are never rewritten.
 */
export function draftParts(score, { roles = ["drums", "bass", "keys", "melody"], sectionId, prompt = "", seed } = {}) {
  const options = readPromptOptions(prompt);
  const random = seeded(seed ?? hashSeed(`${prompt}|${score.key}|${score.chords.join(",")}|${sectionId ?? "all"}`));
  const section = sectionId ? score.sections.find((item) => item.id === sectionId) : null;
  const fromBar = section ? section.startBar : 0;
  const toBar = section ? section.startBar + section.bars : score.bars;
  const fromBeat = fromBar * score.beatsPerBar;
  const toBeat = toBar * score.beatsPerBar;
  const parts = score.parts.map((part) => ({ ...part, notes: [...part.notes] }));

  for (const role of roles) {
    if (!PART_ROLES.includes(role)) continue;
    const written = [];
    const state = {};
    for (let bar = fromBar; bar < toBar; bar += 1) written.push(...writeBar(role, score, bar, random, options, state));
    const existing = parts.find((part) => part.role === role && part.source === "copilot");
    // A part someone has kept belongs to the room now; Copilot leaves it alone.
    if (existing?.kept) continue;
    if (existing) {
      existing.notes = [...existing.notes.filter((note) => note.start < fromBeat || note.start >= toBeat), ...written].sort((a, b) => a.start - b.start);
      existing.kept = false;
    } else if (parts.length < SCORE_LIMITS.maxParts) {
      parts.push({ id: makeId(`part-${role}`), name: ROLE_NAMES[role], role, source: "copilot", kept: false, muted: false, volume: 0.75, notes: written });
    }
  }
  return { ...score, parts };
}

export function keepPart(score, partId) {
  return { ...score, parts: score.parts.map((part) => (part.id === partId ? { ...part, kept: true } : part)) };
}

export function discardPart(score, partId) {
  return { ...score, parts: score.parts.filter((part) => part.id !== partId) };
}

export function updatePart(score, partId, patch) {
  return { ...score, parts: score.parts.map((part) => (part.id === partId ? { ...part, ...patch } : part)) };
}

export function setChord(score, bar, symbol) {
  if (bar < 0 || bar >= score.bars) return score;
  const chords = [...score.chords];
  chords[bar] = symbol && !Chord.get(symbol).empty ? symbol : "";
  return { ...score, chords };
}

export function setKey(score, key) {
  const { tonic, mode } = parseKey(key);
  return { ...score, key: `${tonic} ${mode}` };
}

/** Standard MIDI file bytes, one track per part. Drums go on channel 10. */
export function scoreToMidi(score, { bpm = 96, title = "CollabMuse" } = {}) {
  const midi = new Midi();
  midi.name = title;
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [score.beatsPerBar, 4] });
  const secondsPerBeat = 60 / bpm;
  for (const part of score.parts) {
    const track = midi.addTrack();
    track.name = part.name;
    track.channel = part.role === "drums" ? 9 : Math.min(8, score.parts.indexOf(part));
    for (const note of part.notes) {
      track.addNote({ midi: note.midi, time: note.start * secondsPerBeat, duration: note.duration * secondsPerBeat, velocity: note.velocity });
    }
  }
  return midi.toArray();
}

/** Seconds from the start of the score for a beat position. */
export function beatsToSeconds(beats, bpm) {
  return (beats * 60) / Math.max(20, bpm);
}
