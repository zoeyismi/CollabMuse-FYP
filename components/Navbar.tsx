"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Music2 } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";

export function Navbar() {
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030507]/70 backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(35,95,186,0.55),rgba(183,25,18,0.22))] shadow-[0_0_36px_rgba(35,95,186,0.22)]">
            <Music2 className="h-5 w-5 text-[#efd84c]" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-white">CollabMuse</span>
            <span className="block text-xs text-white/50">Event-based music rooms</span>
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-white/62 md:flex">
          <Link href="/#features" className="hover:text-white">Features</Link>
          <Link href="/#workflow" className="hover:text-white">Workflow</Link>
          <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="hidden text-sm text-white/62 hover:text-white sm:block">
                {user.name}
              </Link>
              <button
                type="button"
                onClick={logOut}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.055] text-white/65 transition hover:bg-white/[0.1] hover:text-white"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link href="/auth?mode=login" className="hidden text-sm text-white/62 hover:text-white sm:block">
              Log in
            </Link>
          )}
          <GlassButton href={user ? "/dashboard" : "/auth?mode=register"} variant="secondary" className="px-4 py-2">
            {user ? "Open workspace" : "Start creating"}
          </GlassButton>
        </div>
      </nav>
    </header>
  );
}
