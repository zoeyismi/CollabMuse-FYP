"use client";

import { useState } from "react";

const items = [
  { key: "rooms", title: "Rooms", description: "Create shared project spaces.", palette: "blue" },
  { key: "clips", title: "Clips", description: "Upload and arrange audio ideas.", palette: "red" },
  { key: "events", title: "Events", description: "Sync actions, not raw audio.", palette: "yellow" },
  { key: "chat", title: "Chat", description: "Keep creative notes in the room.", palette: "green" },
] as const;

function TriangleArrow({ direction }: { direction: "left" | "right" }) {
  return <span className={`block h-0 w-0 ${direction === "left" ? "border-y-[5px] border-r-[8px] border-y-transparent border-r-current" : "border-y-[5px] border-l-[8px] border-y-transparent border-l-current"}`} />;
}

export function SphericalCarousel() {
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + items.length) % items.length);
  const visibleItems = [-2, -1, 0, 1, 2].map((offset) => ({ item: items[(active + offset + items.length) % items.length], offset }));

  return (
    <section id="features" className="features-blend relative px-5 pb-24 pt-20 sm:pt-28">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <span className="feature-kicker">Core collaboration objects</span>
          <h2 className="mt-6 text-4xl font-light leading-tight tracking-[-0.03em] text-[#111820] sm:text-6xl">Rooms, clips, events.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#50677d]">Keep the music, the edits and the conversation in one shared place.</p>
        </div>

        <div className="feature-showcase mx-auto mt-12 max-w-[1240px] overflow-hidden">
          <div className="feature-tabs" role="tablist" aria-label="Collaboration objects">
            {items.map((item, index) => (
              <button key={item.key} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)} className={active === index ? "feature-tab feature-tab-active" : "feature-tab"}>
                <span className={`feature-dot feature-dot-${item.palette}`} />{item.title}
              </button>
            ))}
          </div>

          <div className="feature-orbit" aria-live="polite">
            {visibleItems.map(({ item, offset }) => {
              const distance = Math.abs(offset);
              const isActive = offset === 0;
              return <button key={`${item.key}-${offset}`} type="button" onClick={() => setActive((active + offset + items.length) % items.length)} aria-label={`Show ${item.title}`} className={`feature-sphere feature-sphere-${item.palette} ${isActive ? "feature-sphere-main" : ""}`} style={{ opacity: distance === 2 ? 0.48 : distance === 1 ? 0.82 : 1 }}>{isActive ? <span className="feature-play">›</span> : null}</button>;
            })}
          </div>

          <div className="feature-captions">
            {visibleItems.map(({ item, offset }) => <div key={`${item.key}-caption-${offset}`} className={offset === 0 ? "feature-caption feature-caption-main" : "feature-caption"}><h3>{item.title}</h3><p>{item.description}</p></div>)}
          </div>

          <div className="feature-controls">
            <button type="button" className="feature-arrow" onClick={() => move(-1)} aria-label="Previous collaboration object"><TriangleArrow direction="left" /></button>
            <span className="feature-current">{items[active].title}</span>
            <button type="button" className="feature-arrow" onClick={() => move(1)} aria-label="Next collaboration object"><TriangleArrow direction="right" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
