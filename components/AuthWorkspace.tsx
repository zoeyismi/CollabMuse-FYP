"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { VinylMark } from "@/components/Navbar";
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

  const title = useMemo(() => mode === "login" ? "Welcome back" : "Create your studio", [mode]);

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

  const field = "h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3.5 text-[15px] text-black outline-none transition-colors duration-150 ease-studio placeholder:text-ink-400 hover:border-ink-400 focus:border-human focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-offset-2 focus-visible:outline-[#2b7fff]";

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-black">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-[-0.01em]">
          <VinylMark />
          CollabMuse
        </Link>
        <Link href="/room/demo" className="text-sm text-ink-600 transition-colors duration-150 ease-studio hover:text-black">
          Open the demo room
        </Link>
      </header>

      <section className="flex flex-1 justify-center px-5 pb-20 pt-10 sm:pt-16">
        <div className="flex w-full max-w-[380px] flex-col gap-6">
          {isInvitation ? (
            <div className="flex items-center gap-3 rounded-2xl bg-cream p-3.5">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-stone" aria-hidden="true">
                <Image src="/features/room-vinyl.jpg" alt="" fill sizes="48px" className="object-cover" />
              </span>
              <p className="text-sm text-ink-700">You were invited to a room. Continue and you will land back in it.</p>
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="font-display text-[32px] font-light leading-[1.13] tracking-[-0.02em]">{title}</h1>
            <p className="text-[15px] text-ink-600">
              {mode === "login" ? "Continue to your rooms and live sessions." : "Rooms, versions and Copilot drafts in one place."}
            </p>
          </div>

          <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-full bg-cream p-1">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => { setMode(item); setStatus(""); setShowPassword(false); }}
                className={`h-9 rounded-full text-sm transition-[background-color,box-shadow,color] duration-150 ease-studio ${mode === item ? "bg-white text-black shadow-ring" : "text-ink-700 hover:text-black"}`}
              >
                {item === "register" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>

          <form className="flex flex-col gap-4" onSubmit={submit}>
            {mode === "register" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-name" className="text-sm">Name</label>
                <input id="auth-name" className={field} value={name} onChange={(event) => setName(event.target.value)} placeholder="How collaborators will see you" autoComplete="name" required minLength={2} />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-email" className="text-sm">Email</label>
              <input id="auth-email" className={field} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="auth-password" className="text-sm">Password</label>
                {mode === "register" ? <span className="text-[13px] text-ink-600">8 or more characters</span> : null}
              </div>
              <div className="relative">
                <input id="auth-password" className={`${field} pr-11`} value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-ink-600 transition-colors duration-150 ease-studio hover:bg-cream hover:text-black">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {status ? <p className="text-sm text-[#9d403b]" role="alert">{status}</p> : null}
            <button type="submit" disabled={isSubmitting} className="mt-1 h-11 rounded-full bg-black text-sm text-white transition-colors duration-150 ease-studio hover:bg-ink-700 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? "One moment…" : mode === "login" ? (isInvitation ? "Log in and join" : "Log in") : (isInvitation ? "Create account and join" : "Create account")}
            </button>
          </form>

          <p className="text-center text-[13px] text-ink-600">
            Prototype accounts are stored locally for evaluation. Do not reuse a personal password.
          </p>
        </div>
      </section>
    </main>
  );
}
