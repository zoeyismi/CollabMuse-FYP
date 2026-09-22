"use client";

import { FormEvent, useRef, useState } from "react";
import { AudioWaveform, BotMessageSquare, Pause, Play, Sparkles } from "@/components/Icons";
import type { MusicComposition } from "@/lib/mock-data";

type MusicAgentPanelProps = {
  roomId: string;
  composition: MusicComposition | null;
  onCompositionGenerated: (composition: MusicComposition) => void;
  onAddToRoom: (composition: MusicComposition) => void;
  isAddedToRoom?: boolean;
};

const keyboardNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
const noteOffsets: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

function noteFrequency(pitch: string) {
  const match = pitch.match(/^([A-G]#?)(\d)$/);
  if (!match) return 440;
  const midi = (Number(match[2]) + 1) * 12 + noteOffsets[match[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

export function MusicAgentPanel({
  roomId,
  composition,
  onCompositionGenerated,
  onAddToRoom,
  isAddedToRoom = false,
}: MusicAgentPanelProps) {
  const [prompt, setPrompt] = useState("A warm late-night melody with a gentle lift at the end");
  const [musicKey, setMusicKey] = useState("C");
  const [mood, setMood] = useState("warm");
  const [style, setStyle] = useState("R&B");
  const [bars, setBars] = useState(2);
  const [status, setStatus] = useState("Ready to compose");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeOscillatorsRef = useRef<OscillatorNode[]>([]);
  const playbackTimerRef = useRef<number | null>(null);

  const getAudioContext = async () => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio is unavailable");
    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor();
    if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const scheduleTone = (
    context: AudioContext,
    pitch: string,
    startTime: number,
    durationSeconds: number,
    velocity = 0.72,
  ) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(noteFrequency(pitch), startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.03, velocity * 0.22), startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds + 0.03);
    activeOscillatorsRef.current.push(oscillator);
    oscillator.addEventListener("ended", () => {
      activeOscillatorsRef.current = activeOscillatorsRef.current.filter((item) => item !== oscillator);
    });
  };

  const playSingleNote = async (pitch: string) => {
    const context = await getAudioContext();
    scheduleTone(context, pitch, context.currentTime, 0.42, 0.78);
    setStatus(`Played ${pitch}`);
  };

  const stopPlayback = () => {
    activeOscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have ended.
      }
    });
    activeOscillatorsRef.current = [];
    if (playbackTimerRef.current) window.clearTimeout(playbackTimerRef.current);
    playbackTimerRef.current = null;
    setIsPlaying(false);
    setStatus("Playback stopped");
  };

  const playComposition = async () => {
    if (!composition?.notes.length) return;
    stopPlayback();
    const context = await getAudioContext();
    const secondsPerBeat = 60 / composition.tempo;
    let cursor = context.currentTime + 0.06;

    composition.notes.forEach((note) => {
      const duration = note.beats * secondsPerBeat;
      scheduleTone(context, note.pitch, cursor, Math.max(0.1, duration * 0.88), note.velocity);
      cursor += duration;
    });

    const playbackDuration = Math.max(0, cursor - context.currentTime) * 1000;
    setIsPlaying(true);
    setStatus(`Playing ${composition.title}`);
    playbackTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      setStatus("Melody playback complete");
    }, playbackDuration + 80);
  };

  const generateComposition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) return;
    setIsGenerating(true);
    setStatus("Music Copilot is composing...");

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, key: musicKey, mood, style, bars }),
      });
      if (!response.ok) throw new Error("Composition request failed");
      const data = (await response.json()) as {
        composition: MusicComposition;
        fallbackReason?: string | null;
      };
      onCompositionGenerated(data.composition);
      setStatus(
        data.composition.provider === "openai"
          ? "OpenAI composition ready"
          : data.fallbackReason ?? "Local composition ready",
      );
    } catch {
      setStatus("Could not generate a melody. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-white/12 bg-white/[0.055] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <form className="min-w-0 flex-1" onSubmit={generateComposition}>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#efd84c]/24 bg-[#efd84c]/10 text-[#efd84c]">
              <BotMessageSquare className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-white/38">Music Copilot</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Compose a playable melody</h2>
              <p className="mt-1 text-xs leading-5 text-white/42">AI-guided composition with an offline-safe local fallback.</p>
            </div>
          </div>

          <textarea
            className="mt-4 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-[#efd84c]/38"
            value={prompt}
            maxLength={500}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the melody you want..."
          />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select className="rounded-xl border border-white/10 bg-[#0d1418] px-3 py-2 text-xs text-white/72" value={musicKey} onChange={(event) => setMusicKey(event.target.value)}>
              {["C", "D", "E", "F", "G", "A"].map((key) => <option key={key}>{key}</option>)}
            </select>
            <select className="rounded-xl border border-white/10 bg-[#0d1418] px-3 py-2 text-xs text-white/72" value={mood} onChange={(event) => setMood(event.target.value)}>
              {["warm", "dreamy", "bright", "moody", "energetic"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="rounded-xl border border-white/10 bg-[#0d1418] px-3 py-2 text-xs text-white/72" value={style} onChange={(event) => setStyle(event.target.value)}>
              {["R&B", "Pop", "Lo-fi", "Electronic", "Ambient"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="rounded-xl border border-white/10 bg-[#0d1418] px-3 py-2 text-xs text-white/72" value={bars} onChange={(event) => setBars(Number(event.target.value))}>
              {[1, 2, 4].map((item) => <option key={item} value={item}>{item} bars</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-[#efd84c] px-5 py-2.5 text-sm font-semibold text-[#11120b] transition hover:bg-[#f6e77d] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Composing..." : "Generate melody"}
            </button>
            <span className="text-xs text-white/38">{status}</span>
          </div>
        </form>

        <div className="w-full xl:w-[430px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/34">Playable scale</p>
              <p className="mt-1 text-sm text-white/58">Tap a key to hear a real note.</p>
            </div>
            {composition ? (
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.07] text-white transition hover:bg-white/12"
                onClick={isPlaying ? stopPlayback : playComposition}
                title={isPlaying ? "Stop melody" : "Play generated melody"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1.5">
            {keyboardNotes.map((pitch, index) => (
              <button
                key={pitch}
                type="button"
                className="flex h-20 items-end justify-center rounded-lg border border-white/14 bg-white/[0.08] pb-2 text-[10px] text-white/48 transition hover:-translate-y-0.5 hover:bg-white/14 active:translate-y-0"
                style={{ borderBottomColor: ["#b71912", "#235fba", "#efd84c", "#58e081"][index % 4] }}
                onClick={() => playSingleNote(pitch)}
              >
                {pitch}
              </button>
            ))}
          </div>
          <div className="mt-3 min-h-[68px] rounded-2xl border border-white/8 bg-black/15 p-3">
            {composition ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{composition.title}</p>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/30">{composition.provider}</span>
                </div>
                <p className="mt-1 text-xs text-white/42">{composition.key} · {composition.tempo} BPM · {composition.notes.length} notes</p>
                <div className="mt-2 flex gap-1 overflow-hidden">
                  {composition.notes.slice(0, 14).map((note, index) => (
                    <span key={`${note.pitch}-${index}`} className="rounded-md bg-white/[0.07] px-1.5 py-1 text-[9px] text-white/45">{note.pitch}</span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={isAddedToRoom}
                  onClick={() => onAddToRoom(composition)}
                  className="mt-3 w-full rounded-full border border-[#58e081]/28 bg-[#58e081]/12 px-4 py-2 text-xs font-semibold text-[#79ef9b] transition hover:bg-[#58e081]/18 disabled:cursor-default disabled:border-white/8 disabled:bg-white/[0.04] disabled:text-white/28"
                >
                  {isAddedToRoom ? "Added to room" : "Add melody to room"}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-white/30">
                <AudioWaveform className="h-4 w-4" />
                Generated notes will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
