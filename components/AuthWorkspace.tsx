"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { ArrowRight, AudioWaveform } from "@/components/Icons";

export function AuthWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(() => mode === "login" ? "Welcome back" : "Create your workspace", [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to continue");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to continue");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page min-h-screen px-5 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-[#14202a]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#14202a]/12 bg-white/40 backdrop-blur-xl">
            <AudioWaveform className="h-5 w-5" />
          </span>
          <span className="font-semibold">CollabMuse</span>
        </Link>
        <Link href="/room/demo" className="text-sm text-[#14202a]/58 transition hover:text-[#14202a]">
          Explore the demo
        </Link>
      </div>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-6xl items-center gap-12 py-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="max-w-xl text-[#14202a]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#14202a]/46">A shared place for unfinished music</p>
          <h1 className="mt-5 text-5xl font-light leading-[1.04] tracking-normal sm:text-7xl">
            Ideas move.<br />Everyone stays in sync.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-[#14202a]/60">
            Build a room, upload an audio idea, shape the arrangement and keep every collaborative action beside the music.
          </p>
          <div className="mt-10 flex items-end gap-1.5" aria-hidden="true">
            {[28, 46, 34, 62, 42, 72, 38, 56, 30, 68, 44, 76, 36, 52, 32, 64].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="w-1.5 rounded-full"
                style={{ height, background: ["#a85e59", "#d1b85a", "#718fa8", "#6d9a82"][index % 4] }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/55 bg-white/28 p-5 shadow-[0_28px_90px_rgba(54,75,91,0.16)] backdrop-blur-3xl sm:p-8">
          <div className="flex rounded-full border border-[#14202a]/10 bg-white/30 p-1">
            {(["register", "login"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setMode(item); setStatus(""); }}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm transition ${mode === item ? "bg-[#14202a] text-white shadow-sm" : "text-[#14202a]/55 hover:text-[#14202a]"}`}
              >
                {item === "register" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>
          <h2 className="mt-8 text-3xl font-medium text-[#14202a]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#14202a]/52">
            {mode === "login" ? "Continue to your saved rooms and live sessions." : "Start with a private account. Invite collaborators room by room."}
          </p>

          <form className="mt-7 space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <label className="auth-field">
                <UserRound className="h-4 w-4" />
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" required minLength={2} />
              </label>
            ) : null}
            <label className="auth-field">
              <Mail className="h-4 w-4" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" autoComplete="email" required />
            </label>
            <label className="auth-field">
              <LockKeyhole className="h-4 w-4" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
            </label>
            {status ? <p className="text-sm text-[#9d403b]" role="alert">{status}</p> : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#14202a] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#213443] disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? "Please wait..." : mode === "login" ? "Enter workspace" : "Start creating"}
              {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-[#14202a]/42">
            Prototype accounts are stored locally for evaluation. Do not reuse a personal password.
          </p>
        </div>
      </section>
    </main>
  );
}
