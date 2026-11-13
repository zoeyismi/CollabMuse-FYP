"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Play } from "lucide-react";
import { GlassButton } from "@/components/GlassButton";
import { Navbar, VinylMark } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Key = Parameters<ReturnType<typeof useLanguage>["t"]>[0];

/* The page is laid out like a song: each section owns a span of bars on the ruler. */
const SECTIONS = [
  { id: "intro", label: "home.section.intro", bars: "01–04", span: 4 },
  { id: "verse", label: "home.section.verse", bars: "05–12", span: 8 },
  { id: "chorus", label: "home.section.chorus", bars: "13–20", span: 8 },
  { id: "bridge", label: "home.section.bridge", bars: "21–24", span: 4 },
  { id: "outro", label: "home.section.outro", bars: "25–28", span: 4 },
] as const satisfies ReadonlyArray<{ id: string; label: Key; bars: string; span: number }>;

type SectionId = (typeof SECTIONS)[number]["id"];

const RINGS: Array<[Key, string]> = [
  ["home.ring.room", "border-human"],
  ["home.ring.clip", "border-human"],
  ["home.ring.note", "border-human"],
  ["home.ring.sync", "border-ink-400"],
  ["home.ring.mix", "border-ink-400"],
  ["home.ring.version", "border-copilot"],
];

const WAVE = [22, 38, 30, 54, 42, 68, 36, 48, 28, 62, 44, 72, 34, 56, 40, 64, 30, 48, 24];

type ClipKind = "human" | "copilot" | "audio" | "base";
type Clip = { start: number; length: number; label: string; kind: ClipKind; who?: string };
type Stage = "draft" | "shape" | "decide";

const CLIP_STYLE: Record<ClipKind, string> = {
  human: "border-solid border-human bg-human-wash text-human-ink",
  copilot: "border-dashed border-copilot bg-copilot-wash text-copilot-ink",
  audio: "border-solid border-ink-400 bg-stone text-ink-700",
  base: "border-solid border-ink-400 bg-white text-ink-700",
};
const TAG_STYLE: Record<ClipKind, string> = { human: "bg-human", copilot: "bg-copilot", audio: "bg-ink-600", base: "bg-ink-600" };

const LANES: Key[] = ["home.lane.drums", "home.lane.bass", "home.lane.keys", "home.lane.melody", "home.lane.vocal"];

const ARRANGEMENT: Record<Stage, Clip[][]> = {
  draft: [
    [{ start: 1, length: 16, label: "Half-time groove", kind: "copilot" }],
    [{ start: 5, length: 12, label: "Round bass · follows chords", kind: "copilot" }],
    [{ start: 1, length: 8, label: "Soft keys", kind: "human", who: "Franky" }, { start: 9, length: 8, label: "Keys draft", kind: "copilot" }],
    [{ start: 9, length: 8, label: "Chorus melody", kind: "human", who: "Ziyi" }],
    [],
  ],
  shape: [
    [{ start: 1, length: 16, label: "Half-time groove · kept", kind: "human" }],
    [{ start: 5, length: 12, label: "Round bass · kept", kind: "human" }],
    [{ start: 1, length: 16, label: "Soft keys", kind: "human", who: "Franky · bar 15" }],
    [{ start: 9, length: 8, label: "Chorus melody", kind: "human", who: "Ziyi" }],
    [{ start: 9, length: 8, label: "Take 05", kind: "audio", who: "Lina" }],
  ],
  decide: [
    [{ start: 1, length: 16, label: "Half-time groove", kind: "human" }],
    [{ start: 5, length: 12, label: "Round bass", kind: "human" }],
    [{ start: 1, length: 12, label: "Soft keys · A", kind: "base" }, { start: 13, length: 4, label: "B · Fm", kind: "copilot", who: "2 votes" }],
    [{ start: 9, length: 8, label: "Chorus melody", kind: "human" }],
    [{ start: 9, length: 8, label: "Take 05", kind: "audio" }],
  ],
};

const STAGES: Array<{ id: Stage; label: Key; panel: Key; dot: string }> = [
  { id: "draft", label: "home.verse.draft", panel: "home.verse.draftPanel", dot: "bg-copilot" },
  { id: "shape", label: "home.verse.shape", panel: "home.verse.shapePanel", dot: "bg-human" },
  { id: "decide", label: "home.verse.decide", panel: "home.verse.decidePanel", dot: "bg-ink-400" },
];

/* Note positions for the four parts Copilot returns: [left %, top %, width %]. */
const RETURNED: Array<{ lane: Key; notes: Array<[number, number, number]> }> = [
  { lane: "home.lane.drums", notes: [[3, 20, 3], [15, 62, 3], [28, 20, 3], [40, 62, 3], [53, 20, 3], [65, 62, 3], [78, 20, 3], [90, 62, 3]] },
  { lane: "home.lane.bass", notes: [[2, 66, 10], [14, 56, 8], [26, 70, 10], [40, 48, 8], [52, 66, 10], [64, 56, 8], [76, 40, 10], [88, 56, 8]] },
  { lane: "home.lane.keys", notes: [[2, 30, 22], [2, 52, 22], [27, 38, 22], [27, 60, 22], [52, 24, 22], [52, 46, 22], [77, 34, 21], [77, 56, 21]] },
];

const CARDS: Array<{ title: Key; body: Key; image: string; alt: string }> = [
  { title: "home.card.roll", body: "home.card.rollBody", image: "/features/clips-keyboard.jpg", alt: "features.clipsImage" },
  { title: "home.card.record", body: "home.card.recordBody", image: "/features/events-turntable.jpg", alt: "features.eventsImage" },
  { title: "home.card.notes", body: "home.card.notesBody", image: "/features/notes-headphones.jpg", alt: "features.notesImage" },
  { title: "home.card.versions", body: "home.card.versionsBody", image: "/features/room-vinyl.jpg", alt: "features.roomImage" },
];

const STEPS: Array<{ title: Key; body: Key; image: string }> = [
  { title: "home.step1.title", body: "home.step1.body", image: "/workflow/create-room.jpg" },
  { title: "home.step2.title", body: "home.step2.body", image: "/workflow/build-track.jpg" },
  { title: "home.step3.title", body: "home.step3.body", image: "/workflow/stay-synced.jpg" },
];

const PRESETS: Key[] = ["home.preset.rnb", "home.preset.lofi", "home.preset.film", "home.preset.chords"];

function SectionHeading({ id, title, children }: { id: SectionId; title: string; children?: React.ReactNode }) {
  const { t } = useLanguage();
  const section = SECTIONS.find((item) => item.id === id)!;
  return (
    <div className="grid items-start gap-x-8 gap-y-3 lg:grid-cols-[112px_minmax(0,1fr)_minmax(0,420px)]">
      <p className="flex items-baseline gap-2 font-mono text-[13px] text-smoke lg:flex-col lg:gap-0.5 lg:pt-1">
        <span className="text-black">{section.bars.slice(0, 2)}</span>
        <span>{t(section.label)}</span>
      </p>
      <h2 className="max-w-[15em] text-balance font-display text-[32px] font-light leading-[1.12] tracking-[-0.02em] sm:text-[40px]">{title}</h2>
      {children ? <div className="text-base text-ink-700 lg:pt-1">{children}</div> : null}
    </div>
  );
}

function SongRuler() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<SectionId>("intro");
  const playheadRef = useRef<HTMLDivElement>(null);

  // Scroll updates the playhead through the DOM; React only re-renders this ruler when the section changes.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${progress * 100}cqw)`;
      const marker = window.innerHeight * 0.35;
      let next: SectionId = "intro";
      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= marker) next = section.id;
      }
      setCurrent(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="sticky top-0 z-30 bg-canvas">
      <div className="mx-auto max-w-[1280px] px-5 pb-3 pt-2 sm:px-8">
        <ol aria-label={t("home.ruler")} className="grid gap-[3px]" style={{ gridTemplateColumns: SECTIONS.map((section) => `${section.span}fr`).join(" ") }}>
          {SECTIONS.map((section) => {
            const active = section.id === current;
            return (
              <li key={section.id} className="min-w-0">
                <a
                  href={`#${section.id}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-[13px] transition-colors duration-150 ease-studio",
                    active ? "bg-black text-white" : "bg-cream text-black hover:bg-stone",
                  )}
                >
                  <span className="truncate">{t(section.label)}</span>
                  <span className="hidden font-mono text-[11px] opacity-70 sm:inline">{section.bars}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <div aria-hidden="true" className="relative mt-1 h-1.5 [container-type:inline-size]">
          <div className="bar-ticks absolute inset-0 opacity-60" />
          <div ref={playheadRef} className="absolute -top-0.5 bottom-[-2px] left-0 w-[1.5px] bg-black will-change-transform" />
        </div>
      </div>
    </div>
  );
}

function Arrangement() {
  const { t } = useLanguage();
  const [stage, setStage] = useState<Stage>("draft");
  const lanes = ARRANGEMENT[stage];
  const panel = STAGES.find((item) => item.id === stage)!.panel;

  return (
    <div className="rounded-2xl bg-cream p-1">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1 pl-4 pr-1">
        <span className="text-sm text-ink-700">Always session · C minor · 96 BPM</span>
        <div role="tablist" aria-label={t("home.verse.stage")} className="flex gap-0.5 rounded-full bg-stone p-[3px]">
          {STAGES.map((item) => {
            const active = item.id === stage;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="arrangement-panel"
                onClick={() => setStage(item.id)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-full px-3.5 text-sm transition-[background-color,box-shadow,color] duration-150 ease-studio",
                  active ? "bg-white text-black shadow-ring" : "text-ink-700 hover:text-black",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", item.dot)} aria-hidden="true" />
                {t(item.label)}
              </button>
            );
          })}
        </div>
      </div>
      <div id="arrangement-panel" role="tabpanel" className="mt-1 overflow-x-auto rounded-xl bg-white px-5 pb-5 pt-4 shadow-ring">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
            <span />
            <div className="grid font-mono text-[11px] text-ink-400" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {Array.from({ length: 16 }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}
            </div>
          </div>
          <div className="relative mt-2 flex flex-col gap-1.5">
            {LANES.map((lane, laneIndex) => (
              <div key={lane} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm">{t(lane)}</span>
                <div className="lane-grid relative h-11 rounded-lg">
                  {lanes[laneIndex].map((clip) => (
                    <div
                      key={`${stage}-${clip.label}`}
                      className={cn("absolute inset-y-[3px] flex items-center justify-between gap-1.5 overflow-hidden rounded-md border-[1.5px] px-2", CLIP_STYLE[clip.kind])}
                      style={{ left: `${((clip.start - 1) / 16) * 100}%`, width: `${(clip.length / 16) * 100}%` }}
                    >
                      <span className="truncate text-xs">{clip.label}</span>
                      {clip.who ? <span className={cn("flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] text-white", TAG_STYLE[clip.kind])}>{clip.who}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <span aria-hidden="true" className="absolute -bottom-1.5 -top-1.5 w-[1.5px] bg-black" style={{ left: "calc(108px + (100% - 108px) * 0.75)" }} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-[60ch] text-[15px] text-ink-700" aria-live="polite">{t(panel)}</p>
          <GlassButton href="/room/demo">{t("home.verse.open")}</GlassButton>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { t, language } = useLanguage();

  return (
    <main className="bg-canvas text-black">
      <Navbar />
      <SongRuler />

      <header id="intro" className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:pt-20">
        <div className="flex flex-col gap-7">
          <h1 className="font-display text-[32px] font-light leading-[1.1] sm:text-[40px] lg:whitespace-nowrap">
            {t("home.title1")} <em className={cn("font-light", /^(zh|ja|ko)/.test(language) && "not-italic")}>{t("home.title2")}</em>
          </h1>
          <p className="max-w-[52ch] text-lg leading-[1.44] text-ink-700">{t("home.lede")}</p>
          <div className="flex flex-wrap gap-2">
            <GlassButton href="/auth?mode=register" size="lg">{t("home.start")}</GlassButton>
            <Link href="/room/demo" className="inline-flex h-10 items-center gap-2.5 rounded-full bg-white pl-1.5 pr-4 text-sm shadow-ring transition-colors duration-150 ease-studio hover:bg-cream">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream" aria-hidden="true"><Play className="h-3 w-3 fill-black" /></span>
              {t("home.play")}
            </Link>
          </div>
          <ul aria-label={t("home.rings")} className="mt-2 flex flex-wrap gap-1.5">
            {RINGS.map(([label, ring]) => (
              <li key={label} className="flex h-[30px] items-center gap-2 rounded-full bg-cream pl-2 pr-3 text-sm text-ink-700">
                <span className={cn("h-3.5 w-3.5 rounded-full border-[1.5px]", ring)} aria-hidden="true" />
                {t(label)}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative h-[440px] overflow-hidden rounded-3xl bg-stone sm:h-[560px]">
          <Image src="/home/hero-hands.jpg" alt={t("home.heroImage")} fill priority sizes="(max-width: 1024px) 100vw, 440px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-black/55" />
          <figcaption className="absolute left-4 top-4 flex h-[30px] items-center gap-2 rounded-full bg-white/85 px-3 text-[13px]">
            <span className="h-2 w-2 rounded-full bg-human" aria-hidden="true" />
            {t("home.heroCaption")}
          </figcaption>
          <div className="absolute inset-x-5 bottom-5 flex flex-col gap-3 text-white">
            <div aria-hidden="true" className="flex h-14 items-end gap-1">
              {WAVE.map((height, index) => (
                <i key={index} className={cn("flex-1 rounded-full", index < 12 ? "bg-white" : "bg-white/45")} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="flex justify-between gap-3 text-[13px]">
              <span>{t("home.heroPeople")}</span>
              <span className="font-mono">Cm · 96 BPM</span>
            </div>
          </div>
        </figure>
      </header>

      <section id="verse" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 pb-28 sm:px-8">
        <SectionHeading id="verse" title={t("home.verse.title")}>
          <p>{t("home.verse.body")}</p>
        </SectionHeading>
        <Arrangement />
      </section>

      <section id="chorus" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 pb-28 sm:px-8">
        <SectionHeading id="chorus" title={t("home.chorus.title")} />
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <form
            className="flex flex-col gap-2 rounded-[30px] bg-white p-3 shadow-ring"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = "/room/demo";
            }}
          >
            <label htmlFor="home-prompt" className="px-3 pt-2 text-[15px] text-black/50">{t("home.chorus.label")}</label>
            <textarea
              id="home-prompt"
              key={language}
              rows={4}
              defaultValue={t("home.chorus.prompt")}
              className="resize-none bg-transparent px-3 pt-1 text-base leading-normal outline-none"
            />
            <div className="flex items-center justify-between gap-3 pl-2">
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <span key={preset} className="rounded-full bg-cream px-2.5 py-1 text-[13px] text-black/70">{t(preset)}</span>
                ))}
              </div>
              <button type="submit" aria-label={t("home.chorus.send")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors duration-150 ease-studio hover:bg-ink-700">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
          <div className="flex flex-col gap-2 rounded-2xl bg-cream p-2">
            <div className="flex justify-between gap-3 px-3 pt-2 text-sm text-ink-600">
              <span>{t("home.chorus.returned")}</span>
              <span className="font-mono text-xs">Cm Ab Eb Bb</span>
            </div>
            {RETURNED.map((part) => (
              <div key={part.lane} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-white py-2.5 pl-3.5 pr-2.5">
                <span className="text-sm">{t(part.lane)}</span>
                <div aria-hidden="true" className="relative h-8 overflow-hidden rounded-md border-[1.5px] border-dashed border-copilot bg-copilot-wash">
                  {part.notes.map(([left, top, width], index) => (
                    <i key={index} className="absolute h-[3px] rounded-sm bg-copilot-ink" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%` }} />
                  ))}
                </div>
                <div className="flex gap-1">
                  <span className="flex h-[30px] items-center rounded-full bg-black px-3 text-[13px] text-white">{t("home.chorus.keep")}</span>
                  <span className="flex h-[30px] items-center rounded-full bg-cream px-3 text-[13px]">{t("home.chorus.edit")}</span>
                </div>
              </div>
            ))}
            <p className="px-3 pb-2 text-[13px] text-ink-600">{t("home.chorus.note")}</p>
          </div>
        </div>
      </section>

      <section id="bridge" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 pb-28 sm:px-8">
        <SectionHeading id="bridge" title={t("home.bridge.title")} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => (
            <article key={card.title} className="flex flex-col rounded-2xl bg-cream p-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-stone">
                <Image src={card.image} alt={t(card.alt as Key)} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 310px" className="object-cover" />
              </div>
              <div className="flex flex-col gap-1 p-4 text-[15px]">
                <h3 className="font-normal text-ink-600">{t(card.title)}</h3>
                <p>{t(card.body)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="outro" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 pb-24 sm:px-8">
        <SectionHeading id="outro" title={t("home.outro.title")} />
        <ol className="grid gap-2 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative h-[420px] overflow-hidden rounded-2xl bg-stone lg:h-[480px]">
              <Image src={step.image} alt="" fill sizes="(max-width: 768px) 100vw, 420px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/60" />
              <div className="absolute inset-x-6 bottom-6 flex flex-col gap-1.5 text-white">
                <span className="font-mono text-[13px] text-white/75">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-[22px] font-normal leading-tight">{t(step.title)}</h3>
                <p className="text-[15px] text-white/85">{t(step.body)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-16 flex flex-col gap-6 border-t border-stone pt-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <VinylMark className="h-[72px] w-[72px]" />
            <h2 className="text-balance font-display text-[32px] font-light leading-[1.12] tracking-[-0.02em] sm:text-[40px]">{t("home.cta.title")}</h2>
          </div>
          <div className="flex gap-2">
            <GlassButton href="/auth?mode=register" size="lg">{t("home.start")}</GlassButton>
            <GlassButton href="/room/demo" variant="secondary" size="lg">{t("home.play")}</GlassButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-5 py-6 text-sm text-smoke sm:px-8">
          <p><span className="font-medium text-black">CollabMuse</span> · {t("home.footer.about")}</p>
          <div className="flex flex-wrap gap-6">
            <Link href="/dashboard" className="hover:text-black">{t("home.yourRooms")}</Link>
            <Link href="/room/demo" className="hover:text-black">{t("home.play")}</Link>
            <span>{t("home.footer.privacy")}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
