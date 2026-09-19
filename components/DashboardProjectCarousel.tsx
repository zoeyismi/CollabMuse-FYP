"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { mockProjects } from "@/lib/mock-data";

const accentClass = {
  blue: "accent-blue text-white",
  red: "accent-red text-white",
  yellow: "accent-yellow text-[#11120b]",
};

const positions = [
  { x: "0px", s: 1, o: 1, size: 300, z: 20 },
  { x: "clamp(200px, 28vw, 330px)", s: 0.78, o: 0.88, size: 246, z: 10 },
  { x: "clamp(-330px, -28vw, -200px)", s: 0.78, o: 0.88, size: 246, z: 10 },
];

function TriangleArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <span
      className={`block h-0 w-0 ${
        direction === "left"
          ? "border-y-[5px] border-r-[8px] border-y-transparent border-r-current"
          : "border-y-[5px] border-l-[8px] border-y-transparent border-l-current"
      }`}
    />
  );
}

export function DashboardProjectCarousel() {
  const [active, setActive] = useState(1);

  const move = (direction: number) => {
    setActive((current) => (current + direction + mockProjects.length) % mockProjects.length);
  };

  return (
    <div className="node-panel relative overflow-hidden rounded-[34px] border border-white/14 bg-white/[0.06] px-5 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-white/42">Active projects</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Pick a room like an album.</h2>
        <p className="mt-4 text-sm leading-7 text-white/52">
          Project identity uses the same red, blue and yellow system from the homepage, while the controls stay clean.
        </p>
      </div>
      <div className="relative mx-auto mt-7 h-[370px] max-w-5xl overflow-hidden">
        {mockProjects.map((project, index) => {
          const slot = (index - active + mockProjects.length) % mockProjects.length;
          const position = positions[slot];
          return (
            <button
              key={project.title}
              className={`absolute left-1/2 top-8 flex -translate-x-1/2 flex-col items-center justify-center gap-4 rounded-full border border-white/18 p-8 text-center opacity-[var(--o)] shadow-[0_34px_90px_rgba(0,0,0,0.34)] transition-all duration-500 hover:-translate-y-1 ${accentClass[project.accent]}`}
              style={
                {
                  "--o": position.o,
                  width: position.size,
                  height: position.size,
                  transform: `translateX(-50%) translateX(${position.x}) scale(${position.s})`,
                  zIndex: position.z,
                } as CSSProperties
              }
              onClick={() => setActive(index)}
              aria-label={`Select ${project.title}`}
            >
              <div className="max-w-[76%]">
                <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.18em] opacity-65">
                  {project.status}
                </p>
                <h3 className="mt-3 text-balance text-[clamp(1.35rem,2vw,2.25rem)] font-semibold leading-[1.04]">
                  {project.title}
                </h3>
                <p className="mt-3 text-sm leading-5 opacity-72">{project.genre}</p>
              </div>
              <div className="max-w-[76%] text-sm leading-5 opacity-72">
                <p>{project.clips} clips</p>
                <p className="text-xs opacity-75">Updated {project.updated}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-white/14 bg-white/8 text-white/76 transition hover:bg-white/14"
          onClick={() => move(-1)}
          aria-label="Previous project"
        >
          <TriangleArrow direction="left" />
        </button>
        <Link
          href="/room/demo"
          className="rounded-full bg-[#f4f7f4] px-5 py-3 text-sm font-semibold text-[#071014] shadow-[0_0_34px_rgba(35,95,186,0.24)] transition hover:bg-white"
        >
          Open {mockProjects[active].title}
        </Link>
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-white/14 bg-white/8 text-white/76 transition hover:bg-white/14"
          onClick={() => move(1)}
          aria-label="Next project"
        >
          <TriangleArrow direction="right" />
        </button>
      </div>
    </div>
  );
}
