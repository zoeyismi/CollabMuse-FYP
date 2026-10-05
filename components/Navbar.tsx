"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Music2 } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";

export function Navbar({ overlay = false }: { overlay?: boolean }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: { name: string } | null }) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const logOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className={`sticky top-0 z-40 text-[#17324b] ${overlay ? "bg-transparent" : "bg-[#f7f7f5]"}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(35,95,186,0.55),rgba(183,25,18,0.22))] shadow-[0_0_36px_rgba(35,95,186,0.22)]">
            <Music2 className="h-5 w-5 text-[#efd84c]" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-[#17324b]">CollabMuse</span>
            <span className="block text-xs text-[#17324b]/52">{t("brand.subtitle")}</span>
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-[#17324b]/68 md:flex">
          <Link href="/#features" className="hover:text-[#17324b]">{t("nav.features")}</Link>
          <Link href="/#workflow" className="hover:text-[#17324b]">{t("nav.workflow")}</Link>
          <Link href="/dashboard" className="hover:text-[#17324b]">{t("nav.dashboard")}</Link>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="hidden text-sm text-[#17324b]/68 hover:text-[#17324b] sm:block">
                {user.name}
              </Link>
              <button
                type="button"
                onClick={logOut}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#17324b]/14 bg-[#17324b]/[0.045] text-[#17324b]/65 transition hover:bg-[#17324b]/[0.1] hover:text-[#17324b]"
                title={t("nav.logout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link href="/auth?mode=login" className="hidden text-sm text-[#17324b]/68 hover:text-[#17324b] sm:block">
              {t("nav.login")}
            </Link>
          )}
          <LanguageSwitcher compact tone="light" />
          <GlassButton href={user ? "/dashboard" : "/auth?mode=register"} variant="secondary" className="border-[#17324b]/24 bg-[#17324b] px-4 py-2 text-[#f7f4ec] hover:bg-[#234968]">
            {user ? t("nav.workspace") : t("nav.start")}
          </GlassButton>
        </div>
      </nav>
    </header>
  );
}
