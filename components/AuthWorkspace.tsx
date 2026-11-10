"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { ArrowRight, AudioWaveform } from "@/components/Icons";
import { safeReturnPath } from "@/lib/safe-return-path";

export function AuthWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const isInvitation = returnTo.includes("invite=");
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      router.push(returnTo);
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

      <section className="auth-layout">
        <div className="auth-card">
          <div className="auth-tabs">
            {(["register", "login"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setMode(item); setStatus(""); setShowPassword(false); }}
                className={`auth-tab ${mode === item ? "auth-tab-active" : ""}`}
              >
                {item === "register" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-description">
            {isInvitation
              ? "Sign in to accept the room invitation. You will return to the shared workspace automatically."
              : mode === "login" ? "Continue to your saved rooms and live sessions." : "Start with a private account. Invite collaborators room by room."}
          </p>

          <form className="auth-form" onSubmit={submit}>
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
            <div className="auth-field auth-password-field"><label className="auth-label" htmlFor="auth-password">Password</label>
              <LockKeyhole className="h-4 w-4" />
              <input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} className="grid h-8 w-8 place-items-center rounded text-[#66727b] hover:bg-[#eef1f3] hover:text-[#111820] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315f86]">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
          <p className="auth-notice">
            Prototype accounts are stored locally for evaluation. Do not reuse a personal password.
          </p>
        </div>
      </section>
    </main>
  );
}
