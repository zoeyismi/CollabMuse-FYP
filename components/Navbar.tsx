import Link from "next/link";
import { Music2 } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";

export function Navbar() {
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
        <GlassButton href="/dashboard" variant="secondary" className="px-4 py-2">
          Open prototype
        </GlassButton>
      </nav>
    </header>
  );
}
