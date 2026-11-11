"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AudioWaveform, BotMessageSquare, CloudUpload, Sparkles } from "@/components/Icons";
import type { AudioClip } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n";
import { referenceTempoDetails } from "@/lib/reference-tempo.mjs";
import { isUnconfiguredMusicService, musicErrorMessage } from "@/lib/music-error";

type MusicAgentPanelProps = {
  readOnly?: boolean;
  roomId: string;
  sourceClip?: AudioClip | null;
  onClearSourceClip: () => void;
  compact?: boolean;
  onGeneratedAudioReady: (clip: AudioClip) => void;
  onAddGeneratedAudioToRoom: (clip: AudioClip) => Promise<boolean>;
};

export function MusicAgentPanel({
  readOnly = false,
  roomId,
  sourceClip = null,
  onClearSourceClip,
  compact = false,
  onGeneratedAudioReady,
  onAddGeneratedAudioToRoom,
}: MusicAgentPanelProps) {
  const { t, language } = useLanguage();
  const isChinese = language === "zh";
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
  const [isAddingToRoom, setIsAddingToRoom] = useState(false);
  const referenceTempoInfo = referenceTempoDetails(sourceClip);
  const referenceBpm = referenceTempoInfo?.bpm;
  const referenceBpmIsEstimated = referenceTempoInfo?.estimated ?? false;
  const resultRef = useRef<HTMLDivElement>(null);
  const generationRequestRef = useRef<AbortController | null>(null);
  const addingToRoomRef = useRef(false);
  const chineseStatuses: Record<string, string> = {
    "Describe a track, then generate real audio": "描述音乐后即可生成音频。",
    "A complete generated track is ready to audition": "音乐已生成，可以试听。",
    "Could not add the track. Check your access and track limit.": "无法添加音轨，请检查权限和音轨数量限制。",
    "Generated music added to the workstation": "生成的音乐已加入工作台。",
    "The preview is still available. Check your connection and try again.": "试听仍可使用，请检查网络连接后重试。",
    "No music was generated.": "没有生成音乐。",
    "No music was generated. The previous preview is still available.": "没有生成音乐，之前的试听仍可使用。",
  };
  const generatingStatus = status.match(/^Generating a (\d+)-second track\. This can take a minute\.\.\.$/);
  const displayedStatus = !isChinese ? status : generatingStatus
    ? `正在生成 ${generatingStatus[1]} 秒音乐，可能需要一点时间……`
    : chineseStatuses[status] ?? (status.startsWith("Generation could not be confirmed.")
      ? `无法确认生成结果，请重试前检查素材库。${status.includes("previous preview") ? "之前的试听仍可使用。" : ""}`
      : status);

  useEffect(() => () => {
    generationRequestRef.current?.abort();
    generationRequestRef.current = null;
  }, []);

  useEffect(() => {
    if (!generatedClip) return;
    const frame = window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [generatedClip]);

  const generateMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || isGenerating || generationRequestRef.current || isAddingToRoom || addingToRoomRef.current || prompt.trim().length < 8) return;
    setIsGenerating(true);
    setError(null);
    setStatus(`Generating a ${durationSeconds}-second track. This can take a minute...`);
    const controller = new AbortController();
    generationRequestRef.current = controller;
    let serviceNotConfigured = false;

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/generate-music`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          key: musicKey,
          mood,
          style,
          provider,
          durationSeconds,
          instrumental,
          sourceClipId: sourceClip?.id ?? null,
        }),
      });
      const data = (await response.json()) as { clip?: AudioClip; audioUrl?: string; error?: string; fallbackReason?: string };
      if (controller.signal.aborted) return;
      serviceNotConfigured = isUnconfiguredMusicService(response.status, data.error);
      if (!response.ok || !data.clip || !data.audioUrl) {
        throw new Error(data.error ?? "The AI music service did not return audio.");
      }
      setGeneratedClip(data.clip);
      setAudioUrl(data.audioUrl);
      setAddedToRoom(false);
      onGeneratedAudioReady(data.clip);
      setStatus(data.fallbackReason ?? "A complete generated track is ready to audition");
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = requestError instanceof Error ? requestError.message : "Music generation failed.";
      setError(message);
      setStatus(serviceNotConfigured
        ? `No music was generated.${generatedClip ? " The previous preview is still available." : ""}`
        : `Generation could not be confirmed. Check the clip library before retrying.${generatedClip ? " The previous preview is still available." : ""}`);
    } finally {
      if (generationRequestRef.current === controller) {
        generationRequestRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const addGeneratedAudio = async () => {
    if (!generatedClip || addedToRoom || readOnly || isAddingToRoom || addingToRoomRef.current || generationRequestRef.current) return;
    addingToRoomRef.current = true;
    setIsAddingToRoom(true);
    setError(null);
    try {
      if (!await onAddGeneratedAudioToRoom(generatedClip)) {
        setStatus("Could not add the track. Check your access and track limit.");
        return;
      }
      setAddedToRoom(true);
      setStatus("Generated music added to the workstation");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add generated music.");
      setStatus("The preview is still available. Check your connection and try again.");
    } finally {
      addingToRoomRef.current = false;
      setIsAddingToRoom(false);
    }
  };

  const fieldClass = compact
    ? "rounded-[8px] border border-stone bg-white/58 px-3 py-2 text-xs text-black outline-none focus:border-human/45"
    : "rounded-[8px] border border-white/12 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-[#efd84c]/45";

  return (
    <section className={compact ? "text-black" : "rounded-[12px] border border-white/12 bg-white/[0.055] p-5 text-white backdrop-blur-2xl"}>
      <form onSubmit={generateMusic}>
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${compact ? "bg-human/10 text-human" : "bg-[#efd84c]/10 text-[#efd84c]"}`}>
            <BotMessageSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={compact ? "text-[11px] text-ink-600" : "text-xs text-white/38"}>{t("music.title")}</p>
            <h2 className={`mt-1 text-base font-medium ${compact ? "text-black" : "text-white"}`}>{t("music.heading")}</h2>
            <p className={`mt-1 text-xs leading-5 ${compact ? "text-ink-600" : "text-white/48"}`}>
              {t(provider === "collabmuse" ? "music.builtinDescription" : "music.externalDescription")}
            </p>
            {provider === "collabmuse" ? <p className={`mt-1 text-xs leading-5 ${compact ? "text-ink-600" : "text-white/48"}`}>{t("music.promptHelp")}</p> : null}
          </div>
        </div>

        <label className={`mt-4 block text-[10px] font-medium ${compact ? "text-ink-600" : "text-white/45"}`}>
          {t("music.describe")}
          <textarea
            className={`mt-1.5 min-h-28 w-full resize-none px-4 py-3 text-sm font-normal normal-case leading-6 tracking-normal ${fieldClass}`}
            value={prompt}
            maxLength={3500}
            disabled={readOnly || isGenerating}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t("music.placeholder")}
          />
        </label>

        {sourceClip ? (
          <div className="mt-2 rounded-[8px] border border-human/20 bg-human/8 px-3 py-2 text-xs text-ink-700">
            <div className="flex items-start justify-between gap-3">
              <span>{isChinese ? "参考素材：" : "Reference context: "}<strong>{sourceClip.name}</strong></span>
              <button type="button" onClick={onClearSourceClip} disabled={isGenerating} className="shrink-0 font-medium text-human hover:underline disabled:opacity-45" aria-label={isChinese ? "清除参考素材" : "Clear reference"}>{isChinese ? "清除" : "Clear"}</button>
            </div>
            {referenceBpm ? ` · ${referenceBpmIsEstimated ? (isChinese ? "估计 " : "estimated ") : ""}${referenceBpm} BPM${sourceClip.analysis?.energy ? ` · ${sourceClip.analysis.energy}${isChinese ? "能量" : " energy"}` : ""}` : (isChinese ? " · 未能获取节奏" : " · tempo unavailable")}
            <span className="mt-1 block">{provider === "collabmuse" ? (isChinese ? "内置编曲器在可用时采用参考素材的 BPM，提示词中的 BPM 优先；不会使用音频本身。" : "The built-in arranger uses the reference BPM when available; a BPM in your prompt takes priority. The audio itself is not used.") : (isChinese ? "目前不会将参考音频及其分析结果发送给 ElevenLabs。" : "Reference audio and its analysis are not currently sent to ElevenLabs.")}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={readOnly || isGenerating || isAddingToRoom || prompt.trim().length < 8}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-human px-5 py-3 text-sm font-medium text-white transition hover:bg-human-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Sparkles className="h-4 w-4" />
          {t(isGenerating ? "music.generating" : "music.generate")}
        </button>

        <p role="status" className={`mt-2 text-xs ${error ? "text-[#a92f2a]" : compact ? "text-ink-600" : "text-white/42"}`}>{error ? `${musicErrorMessage(error, language)} ${displayedStatus}` : displayedStatus}</p>

        <details className={`mt-3 rounded-[8px] border ${compact ? "border-stone bg-white/38" : "border-white/10 bg-black/10"}`}>
          <summary className={`cursor-pointer list-none px-3 py-2.5 text-xs font-medium ${compact ? "text-ink-700" : "text-white/62"}`}>
            {t("music.settings")}
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-stone p-3">
          <label className="col-span-2 text-[10px] text-ink-600">{t("music.engine")}
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={provider} onChange={(event) => setProvider(event.target.value as "collabmuse" | "elevenlabs")}>
              <option value="collabmuse">{t("music.builtin")}</option>
              <option value="elevenlabs">{t("music.paid")}</option>
            </select>
          </label>
          <label className="text-[10px] text-ink-600">{t("music.style")}
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={style} onChange={(event) => setStyle(event.target.value)}>
              {([['R&B', 'R&B'], ['Pop', '流行'], ['Lo-fi', 'Lo-fi'], ['Electronic', '电子'], ['Ambient', '氛围'], ['Cinematic', '电影配乐'], ['Jazz', '爵士'], ['Hip-hop', '嘻哈']] as const).map(([value, zh]) => <option key={value} value={value}>{isChinese ? zh : value}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-ink-600">{t("music.mood")}
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={mood} onChange={(event) => setMood(event.target.value)}>
              {([['warm', '温暖'], ['dreamy', '梦幻'], ['bright', '明亮'], ['moody', '忧郁'], ['energetic', '充满活力'], ['cinematic', '电影感'], ['intimate', '亲密']] as const).map(([value, zh]) => <option key={value} value={value}>{isChinese ? zh : value}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-ink-600">{t("music.key")}
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={musicKey} onChange={(event) => setMusicKey(event.target.value)}>
              {["C major", "D major", "E major", "F major", "G major", "A major", "A minor", "C minor", "D minor", "E minor"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-ink-600">{t("music.length")}
            <select disabled={readOnly || isGenerating} className={`mt-1 w-full ${fieldClass}`} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}>
              {[15, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds} {isChinese ? "秒" : "seconds"}</option>)}
            </select>
          </label>
            <label className={`col-span-2 mt-1 flex items-center gap-2 text-xs ${compact ? "text-ink-700" : "text-white/62"}`}>
              <input type="checkbox" checked={provider === "collabmuse" || instrumental} disabled={readOnly || isGenerating || provider === "collabmuse"} onChange={(event) => setInstrumental(event.target.checked)} className="h-4 w-4 accent-human" />
              {t(provider === "collabmuse" ? "music.instrumentalBuiltin" : "music.instrumental")}
            </label>
          </div>
        </details>
      </form>

      {generatedClip && audioUrl ? (
        <div ref={resultRef} className="mt-4 scroll-mt-3 border-t border-stone pt-4" role="status">
          <p className="mb-2 text-[10px] font-medium text-ink-600">{t("music.preview")}</p>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-human/10 text-human"><AudioWaveform className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-black">{generatedClip.name.replace(/\.(mp3|wav)$/i, "")}</p>
              <p className="text-[10px] text-ink-600">{generatedClip.generation?.provider === "elevenlabs" ? "ElevenLabs Music" : t("music.builtin")} · {generatedClip.duration}{isChinese ? "秒" : "s"}{generatedClip.generation?.bpm ? ` · ${generatedClip.generation.bpm} BPM` : ""} · {generatedClip.generation?.model}</p>
            </div>
          </div>
          <audio aria-label={`Preview ${generatedClip.name}`} className="mt-3 h-10 w-full" controls preload="metadata" src={audioUrl} />
          <button
            type="button"
            disabled={readOnly || addedToRoom || isAddingToRoom || isGenerating}
            onClick={addGeneratedAudio}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-human/20 bg-human/8 px-3 py-2.5 text-xs font-medium text-human transition hover:bg-human/14 disabled:cursor-default disabled:opacity-45"
          >
            <CloudUpload className="h-4 w-4" />
            {t(addedToRoom ? "music.added" : isAddingToRoom ? "music.adding" : "music.add")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
