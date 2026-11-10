"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RoomVersion } from "@/lib/mock-data";
import { renderVersionPreview } from "@/lib/version-preview";
import { pauseAudioPlayers } from "@/lib/audio-players";
import { useLanguage } from "@/lib/i18n";

type Preview = { id: string; name: string; url: string; legacy: boolean };

export function VersionCompare({ roomId, versions }: { roomId: string; versions: RoomVersion[] }) {
  const { language } = useLanguage();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const urls = useRef<string[]>([]);
  const players = useRef<Array<HTMLAudioElement | null>>([]);
  const mounted = useRef(true);
  const requestGeneration = useRef(0);
  const hasEnoughVersions = versions.length >= 2;

  useLayoutEffect(() => () => {
    pauseAudioPlayers(players.current);
  }, [roomId, hasEnoughVersions]);

  useEffect(() => {
    mounted.current = true;
    setFirst("");
    setSecond("");
    setPreviews([]);
    setLoading(false);
    setError("");
    return () => { mounted.current = false; requestGeneration.current += 1; urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current = []; };
  }, [roomId]);

  const clearPreviews = () => {
    pauseAudioPlayers(players.current);
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
    setPreviews([]);
    setError("");
  };

  const compare = async () => {
    const selected = [first, second].map((id) => versions.find((version) => version.id === id));
    if (!selected[0] || !selected[1] || first === second || loading) return;
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(selected.map((version) => renderVersionPreview(roomId, version!.id)));
      if (!mounted.current || generation !== requestGeneration.current) return;
      const next = results.map((result, index) => ({ id: selected[index]!.id, name: selected[index]!.name, url: URL.createObjectURL(result.blob), legacy: result.legacyReferenceUnknown }));
      pauseAudioPlayers(players.current);
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = next.map((item) => item.url);
      setPreviews(next);
    } catch (cause) {
      if (mounted.current && generation === requestGeneration.current) setError(cause instanceof Error ? cause.message : "Could not prepare the comparison.");
    } finally {
      if (mounted.current && generation === requestGeneration.current) setLoading(false);
    }
  };

  if (!hasEnoughVersions) return null;
  const options = versions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>);
  return (
    <section className="mt-4 border-b border-[#18202a]/10 pb-4" aria-label={language === "zh" ? "对比版本" : "Compare versions"}>
      <p className="text-xs font-semibold text-[#172033]">{language === "zh" ? "对比版本" : "Compare versions"}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[#172033]/60">{language === "zh" ? "版本 A" : "Version A"}<select aria-label={language === "zh" ? "版本 A" : "Version A"} value={first} disabled={loading} onChange={(event) => { clearPreviews(); setFirst(event.target.value); }} className="mt-1 w-full rounded-[6px] border border-[#18202a]/15 bg-white px-2 py-2 text-xs"><option value="">{language === "zh" ? "选择版本" : "Choose version"}</option>{options}</select></label>
        <label className="text-[10px] text-[#172033]/60">{language === "zh" ? "版本 B" : "Version B"}<select aria-label={language === "zh" ? "版本 B" : "Version B"} value={second} disabled={loading} onChange={(event) => { clearPreviews(); setSecond(event.target.value); }} className="mt-1 w-full rounded-[6px] border border-[#18202a]/15 bg-white px-2 py-2 text-xs"><option value="">{language === "zh" ? "选择版本" : "Choose version"}</option>{options}</select></label>
      </div>
      <button type="button" onClick={() => void compare()} disabled={!first || !second || first === second || loading} className="mt-2 rounded-[6px] bg-[#184eb6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{loading ? (language === "zh" ? "正在准备音频..." : "Preparing audio...") : (language === "zh" ? "准备对比" : "Prepare comparison")}</button>
      {error ? <p role="alert" className="mt-2 text-xs text-[#9d403b]">{error}</p> : null}
      {previews.map((preview, index) => <div key={preview.id} className="mt-3"><p className="truncate text-xs font-medium">{index === 0 ? "A" : "B"} · {preview.name}</p><audio ref={(node) => { players.current[index] = node; }} controls preload="metadata" aria-label={`${language === "zh" ? "对比" : "Compare"} ${index === 0 ? "A" : "B"}: ${preview.name}`} src={preview.url} className="mt-1 h-9 w-full" onPlay={() => players.current.forEach((player, other) => { if (other !== index) player?.pause(); })} />{preview.legacy ? <p className="mt-1 text-xs text-[#8b5b10]">{language === "zh" ? "此旧版本未记录参考音频。" : "Reference audio was not captured in this older version."}</p> : null}</div>)}
    </section>
  );
}
