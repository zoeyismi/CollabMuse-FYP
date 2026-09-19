"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

const items = [
  {
    key: "rooms",
    title: "Rooms",
    description: "Create shared project spaces.",
    palette: "blue",
  },
  {
    key: "clips",
    title: "Clips",
    description: "Upload and arrange audio ideas.",
    palette: "red",
  },
  {
    key: "events",
    title: "Events",
    description: "Sync actions, not raw audio.",
    palette: "yellow",
  },
  {
    key: "chat",
    title: "Chat",
    description: "Keep creative notes in the room.",
    palette: "green",
  },
] as const;

const positions = [
  { x: 0, z: 165, ry: 0, s: 1, o: 1, size: 310 },
  { x: 470, z: -80, ry: -44, s: 0.76, o: 0.88, size: 270 },
  { x: 0, z: -330, ry: 0, s: 0.4, o: 0.2, size: 270 },
  { x: -470, z: -80, ry: 44, s: 0.76, o: 0.88, size: 270 },
];

const paletteClass = {
  blue: "accent-blue text-white [--dot-opacity:.22]",
  red: "accent-red text-white [--dot-opacity:.12]",
  yellow: "accent-yellow text-[#11120b] [--dot-opacity:.44]",
  green: "accent-green text-[#071014] [--dot-opacity:.18]",
  neutral:
    "bg-[linear-gradient(145deg,rgba(245,250,248,0.58),rgba(35,95,186,0.34))] text-white [--dot-opacity:.18] blur-[.4px]",
};

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

export function SphericalCarousel() {
  const [active, setActive] = useState(0);

  const move = (direction: number) => {
    setActive((current) => (current + direction + items.length) % items.length);
  };

  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm text-white/64">
          Core collaboration objects
        </span>
        <h2 className="mt-5 text-4xl font-semibold leading-[0.98] text-white sm:text-6xl">
          Rooms, clips, events.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/58">
          The interface treats musical work as shared objects and synchronized actions, with the album-inspired colors
          reserved for identity, motion and emphasis.
        </p>
      </div>
      <div className="orb-stage relative mx-auto mt-6 h-[450px] max-w-[1240px] overflow-hidden">
        <div className="absolute left-1/2 top-[176px] z-0 h-3.5 w-28 -translate-x-1/2 rounded-full bg-white/24 shadow-[0_0_38px_rgba(246,250,248,0.14)]" />
        {items.map((item, index) => {
          const slot = (index - active + items.length) % items.length;
          const position = positions[slot];
          const isActive = slot === 0;
          return (
            <button
              key={item.key}
              className={`orb-card absolute left-1/2 top-14 flex items-center justify-center overflow-hidden rounded-full border border-white/18 text-left shadow-[0_36px_90px_rgba(0,0,0,0.38)] transition-all duration-500 ${paletteClass[item.palette]}`}
              style={
                {
                  "--x": `${position.x}px`,
                  "--z": `${position.z}px`,
                  "--ry": `${position.ry}deg`,
                  "--s": position.s,
                  "--o": position.o,
                  width: position.size,
                  height: position.size,
                  marginLeft: -position.size / 2,
                  zIndex: isActive ? 20 : slot === 2 ? 1 : 10,
                } as CSSProperties
              }
              onClick={() => setActive(index)}
              aria-label={`Show ${item.title}`}
            >
              <div className="relative z-10 mx-auto w-[72%] text-center">
                <h3 className="text-3xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 opacity-75">{item.description}</p>
                <div className="mx-auto mt-5 h-2.5 w-[68%] rounded-full bg-current/28" />
                <div className="mx-auto mt-2 h-2.5 w-[44%] rounded-full bg-current/18" />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-[-18px] flex justify-center gap-4">
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-white/14 bg-white/8 text-white/76 shadow-[0_18px_46px_rgba(0,0,0,0.24)] transition hover:bg-white/14"
          onClick={() => move(-1)}
          aria-label="Previous collaboration object"
        >
          <TriangleArrow direction="left" />
        </button>
        <button
          className="grid h-14 min-w-14 place-items-center rounded-full bg-[#f4f7f4] px-5 text-sm font-semibold text-[#071014] shadow-[0_0_44px_rgba(35,95,186,0.30),0_18px_46px_rgba(0,0,0,0.24)] transition hover:bg-white"
          onClick={() => move(1)}
          aria-label="Rotate carousel"
        >
          {items[active].title}
        </button>
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-white/14 bg-white/8 text-white/76 shadow-[0_18px_46px_rgba(0,0,0,0.24)] transition hover:bg-white/14"
          onClick={() => move(1)}
          aria-label="Next collaboration object"
        >
          <TriangleArrow direction="right" />
        </button>
      </div>
    </section>
  );
}
