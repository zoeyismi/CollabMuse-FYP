"use client";

import { ChevronDown, Globe2 } from "lucide-react";
import { Language, languages, useLanguage } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false, tone = "dark" }: { compact?: boolean; tone?: "dark" | "light" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className={`relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-150 ease-studio focus-within:outline focus-within:outline-[1.5px] focus-within:outline-offset-2 focus-within:outline-[#2b7fff] ${tone === "light" ? "bg-cream text-ink-700 hover:bg-stone hover:text-black" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"}`}>
      <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label={t("language.label")}
        className={`${compact ? "w-6" : "w-[76px]"} cursor-pointer appearance-none bg-transparent text-[13px] uppercase outline-none`}
      >
        {languages.map(([code, label]) => <option key={code} value={code} className={tone === "light" ? "bg-white text-black" : "bg-black text-white"}>{compact ? code : label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none h-3 w-3 shrink-0" aria-hidden="true" />
    </label>
  );
}
