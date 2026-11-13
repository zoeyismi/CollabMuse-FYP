"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { GlassButton, buttonClasses } from "@/components/GlassButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Small vinyl mark: an orange label inside black grooves. */
export function VinylMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-[22px] w-[22px] shrink-0 rounded-full", className)}
      style={{ background: "radial-gradient(circle closest-side, #ff4704 0 26%, #000 29% 52%, #44403b 54% 59%, #000 61% 76%, #2a2826 78% 81%, #000 83% 100%, transparent 100%)" }}
    />
  );
}

export function Navbar() {
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
    <header>
      <nav aria-label={t("home.nav.label")} className="mx-auto grid max-w-[1280px] grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-[-0.01em]">
          <VinylMark />
          CollabMuse
        </Link>
        <div className="hidden h-9 items-center gap-1 rounded-full bg-cream pl-3 pr-1 text-[13px] lg:flex">
          <span className="h-2 w-2 rounded-full bg-copilot" aria-hidden="true" />
          <span className="ml-1 mr-2 text-ink-700">{t("home.live")}</span>
          <Link href="/room/demo" className="flex h-7 items-center rounded-full bg-white px-3 shadow-ring transition-colors duration-150 ease-studio hover:bg-cream">
            {t("home.listen")}
          </Link>
        </div>
        <div className="flex items-center justify-end gap-2">
          <LanguageSwitcher compact tone="light" />
          {user ? (
            <>
              <Link href="/dashboard" className={cn(buttonClasses("quiet"), "hidden sm:inline-flex")}>
                {user.name}
              </Link>
              <button type="button" onClick={logOut} aria-label={t("nav.logout")} title={t("nav.logout")} className={cn(buttonClasses("secondary"), "w-9 px-0")}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <GlassButton href="/dashboard">{t("home.yourRooms")}</GlassButton>
            </>
          ) : (
            <>
              <GlassButton href="/auth?mode=login" variant="secondary" className="hidden sm:inline-flex">{t("nav.login")}</GlassButton>
              <GlassButton href="/auth?mode=register">{t("home.start")}</GlassButton>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
