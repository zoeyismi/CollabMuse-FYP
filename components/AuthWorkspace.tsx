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
    <main className="auth-page min-h-screen px-5 py-7">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-[#111820]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#111820]/12 bg-white">
            <AudioWaveform className="h-5 w-5" />
          </span>
          <span className="font-semibold">CollabMuse</span>
        </Link>
        <Link href="/room/demo" className="text-sm text-[#111820]/60 transition hover:text-[#111820]">
          Explore demo
        </Link>
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-92px)] max-w-xl items-center px-2 py-16">
        <div className="w-full rounded-xl border border-[#111820]/10 bg-white p-9 shadow-[0_18px_55px_rgba(24,35,44,0.08)] sm:p-12">
          <div className="flex border-b border-[#111820]/12">
            {(["register", "login"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setMode(item); setStatus(""); }}
                className={`flex-1 border-b-2 px-4 py-3 text-sm transition ${mode === item ? "border-[#111820] font-medium text-[#111820]" : "border-transparent text-[#111820]/52 hover:text-[#111820]"}`}
              >
                {item === "register" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>
          <h1 className="mt-10 text-center text-3xl font-medium text-[#111820]">{title}</h1>
          <p className="mt-3 text-center text-sm leading-6 text-[#111820]/55">
            {mode === "login" ? "Continue to your saved rooms and live sessions." : "Start with a private account. Invite collaborators room by room."}
          </p>

          <form className="mx-auto mt-9 max-w-lg space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <label className="auth-field"><span className="auth-label">Name</span>
                <UserRound className="h-4 w-4" />
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" required minLength={2} />
              </label>
            ) : null}
            <label className="auth-field"><span className="auth-label">Email</span>
              <Mail className="h-4 w-4" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" autoComplete="email" required />
            </label>
            <label className="auth-field"><span className="auth-label">Password</span>
              <LockKeyhole className="h-4 w-4" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
            </label>
            {status ? <p className="text-sm text-[#9d403b]" role="alert">{status}</p> : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-submit"
            >
              {isSubmitting ? "Please wait..." : mode === "login" ? "Enter workspace" : "Start creating"}
              {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-[#111820]/42">
            Prototype accounts are stored locally for evaluation. Do not reuse a personal password.
          </p>
        </div>
      </section>
    </main>
  );
}
