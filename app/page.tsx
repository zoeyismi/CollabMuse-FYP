"use client";

import { ArrowRight, LayoutDashboard, RadioTower, Sparkles } from "@/components/Icons";
import { GlassButton } from "@/components/GlassButton";
import { Navbar } from "@/components/Navbar";
import { SphericalCarousel } from "@/components/SphericalCarousel";
import { useLanguage } from "@/lib/i18n";

const workflowImages = [
  "/workflow/create-room.jpg",
  "/workflow/build-track.jpg",
  "/workflow/stay-synced.jpg",
];

export default function Home() {
  const { t } = useLanguage();
  const workflow = [1, 2, 3].map((step) => ({
    step: String(step).padStart(2, "0"),
    title: t(`workflow.step${step}.title` as "workflow.step1.title"),
    description: t(`workflow.step${step}.description` as "workflow.step1.description"),
  }));

  return (
    <main className="relative overflow-hidden">
      <Navbar overlay />
      <section className="home-hero relative -mt-[72px] flex min-h-screen items-center overflow-hidden px-5 pb-16 pt-[136px] text-center sm:pb-20 sm:pt-[152px]">
        <div className="home-flow-scene pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="home-flow-shape home-flow-shape-a" />
          <span className="home-flow-shape home-flow-shape-b" />
          <span className="home-flow-shape home-flow-shape-c" />
          <span className="home-flow-shape home-flow-shape-d" />
          <span className="home-flow-haze" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center">
          <div className="fade-up inline-flex items-center gap-2 rounded-full border border-[rgba(23,50,75,0.18)] bg-white/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[rgba(23,50,75,0.68)] backdrop-blur-2xl sm:text-sm">
            <Sparkles className="h-4 w-4 text-[#315f86]" />
            {t("hero.eyebrow")}
          </div>
          <h1 className="fade-up mt-7 whitespace-nowrap text-[52px] font-light leading-none tracking-normal text-[#111820] sm:text-[82px] lg:text-[112px]">
            {t("hero.title")}
          </h1>
          <p className="fade-up mx-auto mt-8 max-w-2xl text-base leading-8 text-[rgba(23,50,75,0.68)] sm:text-xl">
            {t("hero.description")}
          </p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <GlassButton href="/dashboard" icon={LayoutDashboard} className="!border-[#111820] !bg-[#111820] !text-[#f7f4ec] hover:!bg-[#24435f]">
              {t("hero.dashboard")}
            </GlassButton>
            <GlassButton href="/room/demo" icon={RadioTower} variant="secondary" className="!border-[rgba(23,50,75,0.28)] !bg-white/60 !text-[#17324b] hover:!bg-white/85">
              {t("hero.demo")}
            </GlassButton>
          </div>
        </div>

      </section>

      <SphericalCarousel />

      <section id="workflow" className="workflow-section px-5 py-20">
        <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[#50677d]">{t("workflow.eyebrow")}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#172033] sm:text-5xl">
              {t("workflow.title")}
            </h2>
          </div>
          <p className="text-sm leading-7 text-[#50677d]">
            {t("workflow.description")}
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-[0.9fr_1.25fr_0.9fr] md:items-start">
          {workflow.map((item, index) => (
            <article key={item.step} className={`workflow-photo group relative overflow-hidden rounded-[28px] border border-white/24 shadow-[0_28px_70px_rgba(13,42,69,0.26)] ${index === 1 ? "h-[520px]" : "h-[400px] md:mt-16"}`}>
              <img src={workflowImages[index]} alt={`${item.title} workflow`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
              <div className="workflow-photo-grade absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
                <span className="text-xs font-semibold tracking-[0.22em] text-white/68">{item.step}</span>
                <h3 className="mt-2 text-2xl font-medium">{item.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/72">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section className="workflow-section px-5 py-20">
        <div className="mx-auto max-w-7xl">
        <div className="node-panel node-panel-light overflow-hidden rounded-[28px] border border-[#50677d]/15 bg-white/45 p-8 text-center shadow-[0_22px_70px_rgba(79,101,119,0.12)] sm:p-12">
          <p className="text-sm uppercase tracking-[0.28em] text-[#50677d]">{t("demo.eyebrow")}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight text-[#172033] sm:text-5xl">
            {t("demo.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#50677d]">
            {t("demo.description")}
          </p>
          <div className="mt-8 flex justify-center">
            <GlassButton href="/dashboard" icon={ArrowRight}>
              {t("demo.launch")}
            </GlassButton>
          </div>
        </div>
        </div>
      </section>

      <footer className="workflow-section mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-[#50677d] md:flex-row md:items-center md:justify-between">
        <p>{t("footer.left")}</p>
        <p>{t("footer.right")}</p>
      </footer>
    </main>
  );
}
