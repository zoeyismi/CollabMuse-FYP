import { Plus, RadioTower, Search } from "@/components/Icons";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { DashboardProjectCarousel } from "@/components/DashboardProjectCarousel";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { Navbar } from "@/components/Navbar";

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-white/42">Workspace</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Choose a music room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/56">
              Recent rooms are presented like project albums, while the workflow actions stay simple and readable.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GlassButton icon={Plus}>Create new room</GlassButton>
            <GlassButton href="/room/demo" icon={RadioTower} variant="secondary">
              Enter demo room
            </GlassButton>
          </div>
        </div>

        <div className="mt-9">
          <DashboardProjectCarousel />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.42fr]">
          <GlassCard className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/38">Room overview</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Current prototype scope</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-4 py-3 text-sm text-white/44">
                <Search className="h-4 w-4" />
                Search projects
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Rooms", "Album-style project entry", "#235fba"],
                ["Clips", "Mock audio objects", "#b71912"],
                ["Events", "Sync actions only", "#efd84c"],
                ["Chat", "Room-scoped notes", "#58e081"],
              ].map(([label, detail, color]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
                  <span className="block h-2.5 w-10 rounded-full" style={{ background: color }} />
                  <h3 className="mt-5 text-sm font-semibold text-white">{label}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/46">{detail}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-white/38">Live presence</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Collaborators online</h2>
            <CollaboratorAvatars names={["ZZ", "FC", "LM"]} className="mt-5" />
            <p className="mt-5 text-sm leading-7 text-white/52">
              Presence is mocked for the first prototype. It is placed where a later event layer can connect room
              membership data.
            </p>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-sm font-semibold text-white">First-version status</p>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Room routing", "Ready"],
                  ["Mock timeline", "Ready"],
                  ["Socket backend", "Next"],
                ].map(([label, status]) => (
                  <div key={label} className="flex items-center justify-between text-white/56">
                    <span>{label}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
