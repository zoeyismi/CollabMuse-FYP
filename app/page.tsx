import { ArrowRight, LayoutDashboard, RadioTower, Sparkles } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { Navbar } from "@/components/Navbar";
import { SphericalCarousel } from "@/components/SphericalCarousel";
import { howItWorks } from "@/lib/mock-data";

const floatingObjects = [
  { className: "home-float-card home-album-blue left-[6%] top-[13%] h-24 w-24 rotate-[-14deg] lg:h-32 lg:w-32" },
  { className: "home-float-card home-album-red right-[7%] top-[12%] h-24 w-24 rotate-[13deg] lg:h-32 lg:w-32" },
  { className: "home-float-card home-album-yellow left-[5%] bottom-[20%] h-24 w-24 rotate-[9deg] lg:h-32 lg:w-32" },
  { className: "home-float-card home-album-green right-[5%] bottom-[18%] h-24 w-24 rotate-[-12deg] lg:h-32 lg:w-32" },
  { className: "home-float-card home-album-yellow left-[23%] top-[8%] h-16 w-16 rotate-[18deg] opacity-30 lg:h-20 lg:w-20" },
  { className: "home-float-card home-album-blue right-[24%] bottom-[9%] h-16 w-16 rotate-[-18deg] opacity-24 lg:h-20 lg:w-20" },
  { className: "home-float-card home-album-green left-[15%] bottom-[6%] h-14 w-14 rotate-[-22deg] opacity-12 lg:h-16 lg:w-16" },
  { className: "home-float-card home-album-red right-[16%] bottom-[6%] h-14 w-14 rotate-[20deg] opacity-12 lg:h-16 lg:w-16" },
  { className: "home-float-card home-album-yellow left-[48%] top-[12%] h-12 w-12 rotate-[-10deg] opacity-10 lg:h-16 lg:w-16" },
];
const cardWaveformBars = [34, 62, 48, 78, 42, 58, 86, 46, 70, 38, 64, 52];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <Navbar />
      <section className="home-hero relative flex min-h-[calc(100vh-72px)] items-center overflow-hidden px-5 py-16 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          {floatingObjects.map((object, index) => (
            <div
              key={object.className}
              className={`${object.className} absolute home-float-${(index % 3) + 1}`}
            >
              <span className="home-card-lines">
                {cardWaveformBars.map((height, barIndex) => (
                  <i
                    key={`${object.className}-${barIndex}`}
                    style={{
                      height: `${Math.max(28, Math.min(88, height + ((index + barIndex) % 5) * 4 - 8))}%`,
                    }}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center">
          <div className="fade-up inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/58 backdrop-blur-2xl sm:text-sm">
            <Sparkles className="h-4 w-4 text-[#efd84c]" />
            Event-based music rooms
          </div>
          <h1 className="fade-up mt-7 whitespace-nowrap text-[52px] font-light leading-none tracking-normal text-white sm:text-[82px] lg:text-[112px]">
            make your music
          </h1>
          <p className="fade-up mx-auto mt-8 max-w-2xl text-base leading-8 text-white/60 sm:text-xl">
            Create shared rooms, arrange clips, and keep every creative action synchronized without raw live audio
            streaming.
          </p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <GlassButton href="/dashboard" icon={LayoutDashboard}>
              Open dashboard
            </GlassButton>
            <GlassButton href="/room/demo" icon={RadioTower} variant="secondary">
              Enter demo room
            </GlassButton>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-[-96px] left-1/2 hidden h-44 w-[min(760px,58vw)] -translate-x-1/2 rounded-t-[34px] border border-white/12 bg-[linear-gradient(90deg,rgba(183,25,18,0.30),transparent_24%),linear-gradient(90deg,transparent_32%,rgba(35,95,186,0.32)_56%,transparent_72%),linear-gradient(90deg,transparent_72%,rgba(88,224,129,0.28)),rgba(255,255,255,0.045)] shadow-[0_-24px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl md:block" />
      </section>

      <SphericalCarousel />

      <section id="workflow" className="mx-auto max-w-7xl px-5 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-white/42">Workflow</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              A realistic collaboration loop for your FYP demo.
            </h2>
          </div>
          <p className="text-sm leading-7 text-white/54">
            The prototype is intentionally scoped around synchronized room events: upload clips, move clips,
            rename tracks, send notes, and keep project state aligned across collaborators.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {howItWorks.map((item, index) => (
            <GlassCard key={item.step} className="node-panel p-6">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{
                  background: ["#b71912", "#235fba", "#efd84c"][index],
                  color: index === 2 ? "#11120b" : "#fff",
                }}
              >
                {item.step}
              </span>
              <h3 className="mt-6 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/55">{item.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="node-panel overflow-hidden rounded-[36px] border border-white/14 bg-white/[0.06] p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:p-12">
          <p className="text-sm uppercase tracking-[0.28em] text-white/42">First-stage demo</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
            Expressive entry, clean editor, clear FYP scope.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56">
            The UI now uses one accent system across the site while keeping the actual editor focused and readable.
          </p>
          <div className="mt-8 flex justify-center">
            <GlassButton href="/dashboard" icon={ArrowRight}>
              Launch prototype
            </GlassButton>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-white/42 md:flex-row md:items-center md:justify-between">
        <p>CollabMuse · COMP4299 Final Year Project prototype</p>
        <p>Red / blue / yellow accents · event synchronization focus</p>
      </footer>
    </main>
  );
}
