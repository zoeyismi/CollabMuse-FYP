"use client";

import { FormEvent, useState } from "react";
import { AudioWaveform, BotMessageSquare, CloudUpload, Sparkles } from "@/components/Icons";
import type { AudioClip } from "@/lib/mock-data";

type MusicAgentPanelProps = {
  readOnly?: boolean;
  roomId: string;
  sourceClip?: AudioClip | null;
  compact?: boolean;
  onGeneratedAudioReady: (clip: AudioClip) => void;
  onAddGeneratedAudioToRoom: (clip: AudioClip) => void;
};

export function MusicAgentPanel({
  readOnly = false,
  roomId,
  sourceClip = null,
  compact = false,
  onGeneratedAudioReady,
  onAddGeneratedAudioToRoom,
}: MusicAgentPanelProps) {
  const [prompt, setPrompt] = useState(
    "A warm late-night R&B instrumental with soft electric piano, restrained drums, rounded bass, and a memorable original hook",
  );
  const [musicKey, setMusicKey] = useState("C major");
  const [mood, setMood] = useState("warm");
  const [style, setStyle] = useState("R&B");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [provider, setProvider] = useState<"collabmuse" | "elevenlabs">("collabmuse");
  const [instrumental, setInstrumental] = useState(true);
  const [status, setStatus] = useState("Describe a track, then generate real audio");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedClip, setGeneratedClip] = useState<AudioClip | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [addedToRoom, setAddedToRoom] = useState(false);

  const generateMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || isGenerating || prompt.trim().length < 8) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedClip(null);
    setAudioUrl(null);
    setAddedToRoom(false);
    setStatus(`Generating a ${durationSeconds}-second track. This can take a minute...`);

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/generate-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          key: musicKey,
          mood,
          style,
          provider,
          durationSeconds,
          instrumental,
          sourceAnalysis: sourceClip?.analysis ?? null,
        }),
      });
      const data = (await response.json()) as { clip?: AudioClip; audioUrl?: string; error?: string; fallbackReason?: string };
      if (!response.ok || !data.clip || !data.audioUrl) {
        throw new Error(data.error ?? "The AI music service did not return audio.");
      }
      setGeneratedClip(data.clip);
      setAudioUrl(data.audioUrl);
      onGeneratedAudioReady(data.clip);
      setStatus(data.fallbackReason ?? "A complete generated track is ready to audition");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Music generation failed.";
      setError(message);
      setStatus("No audio was generated");
    } finally {
      setIsGenerating(false);
    }
  };

  const addGeneratedAudio = () => {
    if (!generatedClip || addedToRoom || readOnly) return;
    onAddGeneratedAudioToRoom(generatedClip);
    setAddedToRoom(true);
    setStatus("Generated music added to the workstation");
  };

  const fieldClass = compact
    ? "rounded-[8px] border border-[#18202a]/12 bg-white/58 px-3 py-2 text-xs text-[#172033] outline-none focus:border-[#184eb6]/45"
    : "rounded-[8px] border border-white/12 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-[#efd84c]/45";

  return (
    <section className={compact ? "text-[#172033]" : "rounded-[12px] border border-white/12 bg-white/[0.055] p-5 text-white backdrop-blur-2xl"}>
      <form onSubmit={generateMusic}>
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${compact ? "bg-[#184eb6]/10 text-[#184eb6]" : "bg-[#efd84c]/10 text-[#efd84c]"}`}>
            <BotMessageSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={compact ? "text-[11px] text-[#172033]/42" : "text-xs uppercase tracking-[0.2em] text-white/38"}>AI Music Generator</p>
            <h2 className={`mt-1 text-base font-semibold ${compact ? "text-[#172033]" : "text-white"}`}>Generate a complete music track</h2>
            <p className={`mt-1 text-xs leading-5 ${compact ? "text-[#172033]/48" : "text-white/48"}`}>
              Turn a prompt into a complete arranged audio track with drums, bass, harmony, melody, and a finished ending.
            </p>
          </div>
        </div>

        <label className={`mt-4 block text-[10px] font-semibold uppercase tracking-[0.12em] ${compact ? "text-[#172033]/45" : "text-white/45"}`}>
          Describe the music
          <textarea
            className={`mt-1.5 min-h-28 w-full resize-none px-4 py-3 text-sm font-normal normal-case leading-6 tracking-normal ${fieldClass}`}
            value={prompt}
            maxLength={3500}
            disabled={readOnly || isGenerating}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Genre, instruments, tempo, structure, atmosphere..."
          />
        </label>

        {sourceClip ? (
          <div className="mt-2 rounded-[8px] border border-[#235fba]/20 bg-[#235fba]/8 px-3 py-2 text-xs text-[#172033]/62">
            Reference context: <strong>{sourceClip.name}</strong>
            {sourceClip.analysis?.bpm ? ` · ${sourceClip.analysis.bpm} BPM · ${sourceClip.analysis.energy} energy` : ""}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[10px] text-[#172033]/42">Engine
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={provider} onChange={(event) => setProvider(event.target.value as "collabmuse" | "elevenlabs")}>
              <option value="collabmuse">CollabMuse built-in - included</option>
              <option value="elevenlabs">ElevenLabs Studio - paid API</option>
            </select>
          </label>
          <label className="text-[10px] text-[#172033]/42">Style
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={style} onChange={(event) => setStyle(event.target.value)}>
              {["R&B", "Pop", "Lo-fi", "Electronic", "Ambient", "Cinematic", "Jazz", "Hip-hop"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-[#172033]/42">Mood
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={mood} onChange={(event) => setMood(event.target.value)}>
              {["warm", "dreamy", "bright", "moody", "energetic", "cinematic", "intimate"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-[#172033]/42">Key
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={musicKey} onChange={(event) => setMusicKey(event.target.value)}>
              {["C major", "D major", "E major", "F major", "G major", "A major", "A minor", "C minor", "D minor", "E minor"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-[#172033]/42">Length
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}>
              {[15, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
            </select>
          </label>
        </div>

        <label className={`mt-3 flex items-center gap-2 text-xs ${compact ? "text-[#172033]/62" : "text-white/62"}`}>
          <input type="checkbox" checked={instrumental} disabled={readOnly || isGenerating} onChange={(event) => setInstrumental(event.target.checked)} className="h-4 w-4 accent-[#184eb6]" />
          Instrumental only
        </label>

        <button
          type="submit"
          disabled={readOnly || isGenerating || prompt.trim().length < 8}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#184eb6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123f91] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Arranging and rendering audio..." : "Generate music"}
        </button>

        <p className={`mt-2 text-xs ${error ? "text-[#a92f2a]" : compact ? "text-[#172033]/42" : "text-white/42"}`}>{error ?? status}</p>
      </form>

      {generatedClip && audioUrl ? (
        <div className="mt-4 border-t border-[#18202a]/10 pt-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#184eb6]/10 text-[#184eb6]"><AudioWaveform className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#172033]">{generatedClip.name.replace(/\.(mp3|wav)$/i, "")}</p>
              <p className="text-[10px] text-[#172033]/42">{generatedClip.generation?.provider === "elevenlabs" ? "ElevenLabs Music" : "CollabMuse Composer"} · {generatedClip.duration}s · {generatedClip.generation?.model}</p>
            </div>
          </div>
          <audio className="mt-3 h-10 w-full" controls preload="metadata" src={audioUrl} />
          <button
            type="button"
            disabled={readOnly || addedToRoom}
            onClick={addGeneratedAudio}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-[#184eb6]/20 bg-[#184eb6]/8 px-3 py-2.5 text-xs font-semibold text-[#184eb6] transition hover:bg-[#184eb6]/14 disabled:cursor-default disabled:opacity-45"
          >
            <CloudUpload className="h-4 w-4" />
            {addedToRoom ? "Added to workstation" : "Add generated music to workstation"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
