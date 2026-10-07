const NOTE_INDEX = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function hashText(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function softTriangle(phase) {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function envelopeAt(time, duration, attack, release) {
  const attackGain = Math.min(1, time / Math.max(attack, 0.001));
  const releaseGain = Math.min(1, (duration - time) / Math.max(release, 0.001));
  return Math.max(0, Math.min(attackGain, releaseGain));
}

function addTone(left, right, sampleRate, start, duration, frequency, amplitude, options = {}) {
  const startSample = Math.max(0, Math.floor(start * sampleRate));
  const endSample = Math.min(left.length, Math.ceil((start + duration) * sampleRate));
  const pan = Math.max(-1, Math.min(1, options.pan ?? 0));
  const leftGain = Math.sqrt((1 - pan) / 2);
  const rightGain = Math.sqrt((1 + pan) / 2);
  const attack = options.attack ?? 0.02;
  const release = options.release ?? 0.14;
  const timbre = options.timbre ?? "electric";
  const phaseOffset = options.phase ?? 0;

  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const envelope = envelopeAt(time, duration, attack, release);
    const vibrato = timbre === "lead" ? 1 + 0.003 * Math.sin(Math.PI * 2 * 5.2 * time) : 1;
    const phase = Math.PI * 2 * frequency * vibrato * time + phaseOffset;
    let sample;
    if (timbre === "bass") {
      sample = 0.78 * Math.sin(phase) + 0.22 * softTriangle(phase);
    } else if (timbre === "pad") {
      sample = 0.64 * Math.sin(phase) + 0.23 * Math.sin(phase * 2.002) + 0.13 * Math.sin(phase * 0.501);
    } else if (timbre === "pluck") {
      const decay = Math.exp(-3.8 * time / Math.max(duration, 0.01));
      sample = decay * (0.62 * Math.sin(phase) + 0.28 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3));
    } else if (timbre === "lead") {
      sample = 0.74 * Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.08 * softTriangle(phase);
    } else {
      const decay = 0.58 + 0.42 * Math.exp(-4 * time);
      sample = decay * (0.74 * Math.sin(phase) + 0.19 * Math.sin(phase * 2) + 0.07 * Math.sin(phase * 3));
    }
    const value = sample * envelope * amplitude;
    left[index] += value * leftGain;
    right[index] += value * rightGain;
  }
}

function addKick(left, right, sampleRate, start, amplitude) {
  const duration = 0.48;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(left.length, Math.ceil((start + duration) * sampleRate));
  let phase = 0;
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const frequency = 44 + 105 * Math.exp(-20 * time);
    phase += Math.PI * 2 * frequency / sampleRate;
    const value = Math.sin(phase) * Math.exp(-8.5 * time) * amplitude;
    left[index] += value * 0.72;
    right[index] += value * 0.72;
  }
}

function addSnare(left, right, sampleRate, start, amplitude, random) {
  const duration = 0.3;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(left.length, Math.ceil((start + duration) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const noise = random() * 2 - 1;
    const body = Math.sin(Math.PI * 2 * 185 * time);
    const value = (noise * 0.72 + body * 0.28) * Math.exp(-14 * time) * amplitude;
    left[index] += value * 0.66;
    right[index] += value * 0.74;
  }
}

function addHat(left, right, sampleRate, start, amplitude, random, pan = 0.25) {
  const duration = 0.09;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(left.length, Math.ceil((start + duration) * sampleRate));
  const leftGain = Math.sqrt((1 - pan) / 2);
  const rightGain = Math.sqrt((1 + pan) / 2);
  let previous = 0;
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const noise = random() * 2 - 1;
    const highPassed = noise - previous * 0.82;
    previous = noise;
    const value = highPassed * Math.exp(-42 * time) * amplitude;
    left[index] += value * leftGain;
    right[index] += value * rightGain;
  }
}

function addDelay(channel, sampleRate, delaySeconds, feedback) {
  const delay = Math.floor(sampleRate * delaySeconds);
  for (let index = delay; index < channel.length; index += 1) {
    channel[index] += channel[index - delay] * feedback;
  }
}

function encodeWav(left, right, sampleRate) {
  const dataLength = left.length * 4;
  const buffer = Buffer.allocUnsafe(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  let offset = 44;
  for (let index = 0; index < left.length; index += 1) {
    const leftSample = Math.max(-1, Math.min(1, Math.tanh(left[index] * 0.92)));
    const rightSample = Math.max(-1, Math.min(1, Math.tanh(right[index] * 0.92)));
    buffer.writeInt16LE(Math.round(leftSample * 32767), offset);
    buffer.writeInt16LE(Math.round(rightSample * 32767), offset + 2);
    offset += 4;
  }
  return buffer;
}

function parseKey(key) {
  const match = String(key).match(/^([A-G](?:#|b)?)\s*(major|minor)?/i);
  const rootName = match ? `${match[1][0].toUpperCase()}${match[1].slice(1)}` : "C";
  const minor = String(match?.[2] ?? key).toLowerCase().includes("minor");
  return { root: NOTE_INDEX[rootName] ?? 0, minor };
}

function styleProfile(style, mood) {
  const value = `${style} ${mood}`.toLowerCase();
  if (/ambient|cinematic/.test(value)) return { drums: 0.38, pad: 0.19, bass: 0.12, lead: 0.11, arp: 0.12, swing: 0 };
  if (/hip.?hop|r&b|lo.?fi/.test(value)) return { drums: 0.68, pad: 0.14, bass: 0.2, lead: 0.12, arp: 0.075, swing: 0.055 };
  if (/electronic|energetic|bright/.test(value)) return { drums: 0.72, pad: 0.13, bass: 0.19, lead: 0.14, arp: 0.11, swing: 0 };
  if (/jazz/.test(value)) return { drums: 0.5, pad: 0.16, bass: 0.17, lead: 0.13, arp: 0.065, swing: 0.075 };
  return { drums: 0.58, pad: 0.15, bass: 0.17, lead: 0.13, arp: 0.08, swing: 0.025 };
}

export function renderLocalMusic({ prompt, style, mood, key, durationSeconds, bpm }) {
  const sampleRate = 44100;
  const duration = Math.max(10, Math.min(120, Number(durationSeconds) || 30));
  const promptBpm = Number(String(prompt).match(/\b(\d{2,3})\s*bpm\b/i)?.[1]);
  const tempo = Math.max(64, Math.min(156, promptBpm || Number(bpm) || 96));
  const beat = 60 / tempo;
  const barDuration = beat * 4;
  const sampleCount = Math.ceil(duration * sampleRate);
  const left = new Float32Array(sampleCount);
  const right = new Float32Array(sampleCount);
  const seed = hashText(`${prompt}|${style}|${mood}|${key}|${duration}|${tempo}`);
  const random = createRandom(seed);
  const { root, minor } = parseKey(key);
  const scale = minor ? MINOR_SCALE : MAJOR_SCALE;
  const progression = minor ? [0, 5, 2, 6] : [0, 4, 5, 3];
  const profile = styleProfile(style, mood);
  const bars = Math.ceil(duration / barDuration);
  const motif = Array.from({ length: 8 }, (_, index) => (Math.floor(random() * 5) + (index % 3)) % 7);

  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * barDuration;
    const progress = bar / Math.max(1, bars - 1);
    const intro = bar === 0 ? 0.48 : bar === 1 ? 0.76 : 1;
    const breakdown = progress > 0.58 && progress < 0.7 ? 0.62 : 1;
    const outro = progress > 0.88 ? Math.max(0.35, (1 - progress) / 0.12) : 1;
    const energy = intro * breakdown * outro;
    const degree = progression[bar % progression.length];
    const chordRoot = 48 + root + scale[degree];
    const third = minor && [0, 3, 4].includes(degree) ? 3 : 4;
    const chord = [chordRoot, chordRoot + third, chordRoot + 7, chordRoot + 12];

    chord.forEach((note, voice) => {
      addTone(left, right, sampleRate, barStart, Math.min(barDuration * 1.08, duration - barStart), midiFrequency(note + 12), profile.pad * energy, {
        timbre: "pad",
        pan: (voice - 1.5) * 0.28,
        attack: 0.24,
        release: 0.7,
        phase: voice * 0.73,
      });
    });

    for (let step = 0; step < 8; step += 1) {
      const swing = step % 2 ? beat * profile.swing : 0;
      const stepStart = barStart + step * beat / 2 + swing;
      if (stepStart >= duration) break;
      const arpNote = chord[(step + bar) % chord.length] + 12;
      addTone(left, right, sampleRate, stepStart, beat * 0.44, midiFrequency(arpNote), profile.arp * energy, {
        timbre: "pluck",
        pan: step % 2 ? 0.36 : -0.36,
        attack: 0.006,
        release: 0.18,
      });
    }

    const bassPattern = [0, 0, 2, 0, 0, 4, 2, 0];
    bassPattern.forEach((offset, step) => {
      if (step % 2 === 1 && random() < 0.28) return;
      const stepStart = barStart + step * beat / 2 + (step % 2 ? beat * profile.swing : 0);
      if (stepStart >= duration) return;
      const bassNote = chordRoot - 12 + (offset === 4 ? 7 : offset === 2 ? scale[2] : 0);
      addTone(left, right, sampleRate, stepStart, beat * 0.48, midiFrequency(bassNote), profile.bass * energy, {
        timbre: "bass",
        pan: 0,
        attack: 0.012,
        release: 0.12,
      });
    });

    if (bar > 0 && progress < 0.9) {
      motif.forEach((motifDegree, step) => {
        if ((step + bar) % 5 === 0 || random() < 0.18) return;
        const stepStart = barStart + step * beat / 2 + (step % 2 ? beat * profile.swing : 0);
        if (stepStart >= duration) return;
        const variation = bar % 4 === 3 && step > 4 ? 1 : 0;
        const note = 60 + root + scale[(motifDegree + degree + variation) % 7];
        addTone(left, right, sampleRate, stepStart, beat * (step % 3 === 0 ? 0.78 : 0.42), midiFrequency(note), profile.lead * energy, {
          timbre: "lead",
          pan: -0.12 + random() * 0.24,
          attack: 0.025,
          release: 0.16,
        });
      });
    }

    if (bar > 0 && profile.drums > 0.4 && breakdown === 1) {
      for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
        const beatStart = barStart + beatIndex * beat;
        if (beatStart >= duration) break;
        if (beatIndex === 0 || beatIndex === 2 || (beatIndex === 3 && random() > 0.55)) {
          addKick(left, right, sampleRate, beatStart, profile.drums * energy);
        }
        if (beatIndex === 1 || beatIndex === 3) {
          addSnare(left, right, sampleRate, beatStart, profile.drums * 0.52 * energy, random);
        }
        addHat(left, right, sampleRate, beatStart, profile.drums * 0.14 * energy, random, 0.28);
        addHat(left, right, sampleRate, beatStart + beat / 2 + beat * profile.swing, profile.drums * 0.1 * energy, random, -0.18);
      }
    }
  }

  addDelay(left, sampleRate, beat * 0.75, 0.13);
  addDelay(right, sampleRate, beat, 0.11);
  const fadeInSamples = Math.floor(sampleRate * 0.35);
  const fadeOutSamples = Math.floor(sampleRate * Math.min(2.4, duration * 0.12));
  for (let index = 0; index < sampleCount; index += 1) {
    const fadeIn = Math.min(1, index / Math.max(1, fadeInSamples));
    const fadeOut = Math.min(1, (sampleCount - index) / Math.max(1, fadeOutSamples));
    const master = fadeIn * fadeOut * 0.88;
    left[index] *= master;
    right[index] *= master;
  }

  return {
    buffer: encodeWav(left, right, sampleRate),
    bpm: tempo,
    model: "collabmuse-arranger-v1",
  };
}
