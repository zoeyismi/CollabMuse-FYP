// Plays a note score in the browser with Tone.js synths (no samples to download).
import type { PartRole, Score } from "@/lib/score.mjs";

type ToneModule = typeof import("tone");
type Voice = { trigger: (midi: number, duration: number, time: number, velocity: number) => void; volume: { value: number }; dispose: () => void };

let tone: ToneModule | null = null;
const voices = new Map<string, Voice>();

async function loadTone() {
  if (!tone) tone = await import("tone");
  await tone.start();
  return tone;
}

function createVoice(Tone: ToneModule, role: PartRole): Voice {
  if (role === "drums") {
    const out = new Tone.Volume(-6).toDestination();
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(out);
    const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(out);
    const hat = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).connect(new Tone.Filter(7000, "highpass").connect(out));
    return {
      volume: out.volume,
      trigger: (midi, _duration, time, velocity) => {
        if (midi <= 36) kick.triggerAttackRelease("C1", 0.25, time, velocity);
        else if (midi <= 40) snare.triggerAttackRelease(0.16, time, velocity * 0.8);
        else hat.triggerAttackRelease(0.04, time, velocity * 0.5);
      },
      dispose: () => { kick.dispose(); snare.dispose(); hat.dispose(); out.dispose(); },
    };
  }
  const out = new Tone.Volume(role === "pad" ? -14 : -9).toDestination();
  const synth = role === "bass"
    ? new Tone.PolySynth(Tone.MonoSynth, { oscillator: { type: "sawtooth" }, filter: { Q: 1, type: "lowpass" }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, baseFrequency: 120, octaves: 2.5 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2 } })
    : role === "melody"
      ? new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle8" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.4 } })
      : role === "pad"
        ? new Tone.PolySynth(Tone.AMSynth, { envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.2 } })
        : new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 1.5, envelope: { attack: 0.005, decay: 0.4, sustain: 0.35, release: 0.8 } });
  synth.connect(out);
  return {
    volume: out.volume,
    trigger: (midi, duration, time, velocity) => synth.triggerAttackRelease(Tone.Frequency(midi, "midi").toFrequency(), duration, time, velocity),
    dispose: () => { synth.dispose(); out.dispose(); },
  };
}

function voiceFor(Tone: ToneModule, partId: string, role: PartRole) {
  const key = `${partId}:${role}`;
  let voice = voices.get(key);
  if (!voice) {
    voice = createVoice(Tone, role);
    voices.set(key, voice);
  }
  return voice;
}

let startedAt = 0;
let fromBeatPlaying = 0;
let lengthBeats = 0;
let secondsPerBeat = 0.625;
let loopingNow = false;

/** Plays beats [fromBeat, toBeat) of the score. Returns false if nothing could start. */
export async function playScore(score: Score, bpm: number, fromBeat: number, toBeat: number, loop: boolean) {
  const Tone = await loadTone();
  stopScore();
  const transport = Tone.getTransport();
  secondsPerBeat = 60 / Math.max(20, bpm);
  fromBeatPlaying = fromBeat;
  lengthBeats = Math.max(0.25, toBeat - fromBeat);
  loopingNow = loop;
  transport.bpm.value = bpm;
  for (const part of score.parts) {
    if (part.muted) continue;
    const voice = voiceFor(Tone, part.id, part.role);
    voice.volume.value = (part.role === "pad" ? -14 : part.role === "drums" ? -6 : -9) + 20 * Math.log10(Math.max(0.01, part.volume));
    for (const note of part.notes) {
      if (note.start < fromBeat || note.start >= toBeat) continue;
      const offset = (note.start - fromBeat) * secondsPerBeat;
      const duration = Math.max(0.05, note.duration * secondsPerBeat);
      transport.schedule((time) => voice.trigger(note.midi, duration, time, note.velocity), offset);
    }
  }
  transport.loop = loop;
  transport.loopStart = 0;
  transport.loopEnd = lengthBeats * secondsPerBeat;
  if (!loop) transport.scheduleOnce(() => stopScore(), lengthBeats * secondsPerBeat + 0.1);
  transport.start("+0.05", 0);
  startedAt = Tone.now() + 0.05;
  return true;
}

export function stopScore() {
  if (!tone) return;
  const transport = tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.loop = false;
  startedAt = 0;
}

/** Current beat position while playing, or null when stopped. */
export function scorePosition() {
  if (!tone || !startedAt || tone.getTransport().state !== "started") return null;
  const elapsed = Math.max(0, tone.now() - startedAt) / secondsPerBeat;
  return fromBeatPlaying + (loopingNow ? elapsed % lengthBeats : Math.min(elapsed, lengthBeats));
}

/** Short audition of one note when it is placed in the piano roll. */
export async function previewNote(partId: string, role: PartRole, midi: number) {
  const Tone = await loadTone();
  voiceFor(Tone, partId, role).trigger(midi, 0.3, Tone.now() + 0.01, 0.7);
}
