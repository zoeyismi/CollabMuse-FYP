"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

const waveform = [12, 25, 18, 34, 22, 38, 28, 17, 31, 20, 36, 15, 29, 22, 35, 17, 26, 12];

export function SphericalCarousel() {
  const { t } = useLanguage();
  return (
    <section id="features" className="features-blend feature-editorial px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="feature-editorial-intro">
          <div>
            <p className="feature-editorial-kicker">{t("features.kicker")}</p>
            <h2>
              {t("features.title1")}
              <br />
              {t("features.title2")}
            </h2>
            <div className="feature-editorial-summary">
              <p>
                {t("features.summary")}
              </p>
              <Link href="/dashboard" className="feature-editorial-action">
                {t("features.action")} <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="feature-editorial-grid">
          <article className="feature-story feature-story-room">
            <Image src="/features/room-vinyl.jpg" alt={t("features.roomImage")} fill sizes="(max-width: 800px) 100vw, 46vw" className="feature-story-image" />
            <div className="feature-story-shade" />
            <div className="feature-room-status">
              <span>{t("features.roomStatus")}</span>
              <span className="feature-online">{t("features.online")}</span>
            </div>
            <div className="feature-story-copy feature-story-copy-large">
              <span>{t("features.rooms")}</span>
              <h3>{t("features.roomTitle")}</h3>
              <p>{t("features.roomDescription")}</p>
            </div>
          </article>

          <article className="feature-story feature-story-clips">
            <Image src="/features/clips-keyboard.jpg" alt={t("features.clipsImage")} fill sizes="(max-width: 800px) 100vw, 54vw" className="feature-story-image" />
            <div className="feature-story-shade" />
            <div className="feature-track-card">
              <div className="feature-track-meta"><strong>{t("features.take")}</strong><span>02:18</span></div>
              <div className="feature-track-wave" aria-hidden="true">
                {waveform.map((height, index) => <i key={`${height}-${index}`} style={{ height: `${height}px` }} />)}
              </div>
            </div>
            <div className="feature-story-copy">
              <span>{t("features.clips")}</span>
              <h3>{t("features.clipsTitle")}</h3>
              <p>{t("features.clipsDescription")}</p>
            </div>
          </article>

          <div className="feature-editorial-lower">
            <article className="feature-story feature-story-events">
              <Image src="/features/events-turntable.jpg" alt={t("features.eventsImage")} fill sizes="(max-width: 800px) 100vw, 26vw" className="feature-story-image" />
              <div className="feature-story-shade" />
              <div className="feature-event-list">
                <div><strong>{t("features.version")}</strong><time>{t("features.now")}</time></div>
                <div><strong>{t("features.synced")}</strong><time>10:42</time></div>
              </div>
              <div className="feature-story-copy feature-story-copy-compact">
                <span>{t("features.events")}</span>
                <h3>{t("features.eventsTitle")}</h3>
              </div>
            </article>

            <article className="feature-story feature-story-notes">
              <Image src="/features/notes-headphones.jpg" alt={t("features.notesImage")} fill sizes="(max-width: 800px) 100vw, 30vw" className="feature-story-image" />
              <div className="feature-story-shade" />
              <div className="feature-note-card">
                <strong>@Mina · 01:24</strong>
                <p>{t("features.note")}</p>
              </div>
              <div className="feature-story-copy feature-story-copy-compact">
                <span>{t("features.notes")}</span>
                <h3>{t("features.notesTitle")}</h3>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
