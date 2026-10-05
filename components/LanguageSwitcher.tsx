"use client";

import { Globe2 } from "lucide-react";
import { Language, languages, useLanguage } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false, tone = "dark" }: { compact?: boolean; tone?: "dark" | "light" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className={`relative inline-flex h-10 items-center gap-2 rounded-[8px] px-2.5 transition ${tone === "light" ? "border border-[#17324b]/14 bg-[#17324b]/[0.045] text-[#17324b]/72 hover:bg-[#17324b]/[0.08] hover:text-[#17324b]" : "border border-white/12 bg-white/[0.055] text-white/68 hover:bg-white/[0.09] hover:text-white"}`}>
      <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label={t("language.label")}
        className={`${compact ? "w-10" : "w-[76px]"} cursor-pointer appearance-none bg-transparent pr-2 text-xs font-medium uppercase outline-none`}
      >
        {languages.map(([code, label]) => <option key={code} value={code} className={tone === "light" ? "bg-[#f3f0e8] text-[#17324b]" : "bg-[#174a78] text-white"}>{compact ? code : label}</option>)}
      </select>
    </label>
  );
}
