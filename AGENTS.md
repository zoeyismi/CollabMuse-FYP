# AGENTS.md

Guidance for coding agents (Claude Code, Codex, Cursor) working on CollabMuse.

## What this project is

CollabMuse is a final-year project: a **real-time collaborative music composition tool**. Several people share a room, play, record, import and edit tracks on one timeline, and use **Music Copilot** to generate music from text. It has comments, version history and export.

The direction now is to make it a *composition* tool and not only a synced audio editor. Prefer work that exposes musical structure (sections, chords, editable note parts, proposals and A/B) over more clip-level features.

## Stack

- Next.js 15 (App Router) + React 18 + TypeScript, Tailwind CSS 3, framer-motion, lucide-react
- Custom Node server `server.mjs`: Next.js plus Socket.IO for room sync and the REST endpoints
- Persistence: JSON files in `data/` (`rooms.json`, `auth.json`), uploads in `data/uploads/`. Override the location with `COLLABMUSE_DATA_DIR`.
- Music generation: `lib/music-provider.mjs` (ElevenLabs Music API), `lib/local-music-engine.mjs` and its worker (local fallback composer), plus optional OpenAI for Copilot planning

## Layout

```
app/            routes: / (home), /auth, /dashboard, /room/[roomId], /room/demo
components/     UI: WorkstationTimeline, WorkstationInspector, MusicAgentPanel, WaveformEditor,
                TrackList, ChatPanel, VersionCompare, GlassButton/GlassCard, Navbar, …
lib/            pure logic (.ts/.mjs): timeline placement, playback, WAV encoding,
                merge-room-edits, pending edits, i18n, music provider and engine
tests/          node:test unit tests (*.test.mjs) + server-integration.test.mjs
docs/           thesis drafts, verification log (verification-status.md), specs and plans
server.mjs      HTTP + Socket.IO server (~2.2k lines); room events are `room:*`
```

Socket events (server.mjs): `room:join`, `room:event`, `room:upload`, `room:note`, `room:note-reply`, `room:note-state`, `room:notes`, `room:timeline`, `room:tracks`, `room:composition`, `room:clips`, `room:transport`, `room:settings`, `room:reference-mute`.

## Setup and commands

```bash
npm install --replace-registry-host=always   # the lockfile points at registry.npmmirror.com
cp .env.example .env                         # optional: OPENAI_API_KEY, ELEVENLABS_API_KEY
npm run dev                                  # node server.mjs on http://localhost:3000
npx tsc --noEmit                             # type check
node --test $(ls tests/*.test.mjs | grep -v server-integration)   # unit tests (106)
npm run lint
```

Integration tests need a separately started server:

```bash
COLLABMUSE_TEST_URL=http://localhost:3001 COLLABMUSE_TEST_DATA_DIR=<tmp dir> COLLABMUSE_TEST_NO_ELEVENLABS=1 node --test tests/server-integration.test.mjs
```

- Without `ELEVENLABS_API_KEY`, Copilot falls back to the local composer. The ElevenLabs Music API is paid, so **never call it in tests or verification** unless the user asks.
- Point `COLLABMUSE_DATA_DIR` at a temporary folder when experimenting, so `data/rooms.json` is not touched.

## Working rules

1. **Design before code.** UI changes start on the Claude Design canvas "CollabMuse 介面重設計" and follow `DESIGN.md`. Do not invent new colours, radii or shadows in components; use the tokens.
2. **Logic goes in `lib/` with a test.** New pure behaviour (timing, placement, merging, music theory) belongs in `lib/` with a matching `tests/<name>.test.mjs`. Keep React components thin.
3. **Real-time safety.** Every room mutation goes through a `room:*` event, is validated server-side against room permissions, and carries `arrangementEpoch` where the existing handlers do. Remote edits must merge (see `lib/merge-room-edits.mjs`) and must not overwrite. Guard double-submits the way notes and replies already do.
4. **Bilingual UI.** Every user-facing string goes through `lib/i18n.tsx` with both English and Simplified Chinese.
5. **Record verification honestly.** After a change, append a dated entry to `docs/verification-status.md` in Chinese, matching the existing style: what changed, what was tested (unit, type check, browser), and what was **not** verified. Do not claim browser or audio behaviour you did not observe.
6. **Keep secrets server-side.** API keys stay in `.env` on the server. Never send them to the client or log them.
7. **Do not commit** `data/*.json`, uploads, `.env`, generated previews or Office files (see `.gitignore`).
8. Small, reviewable commits with plain messages. Do not push or open PRs unless asked; the repository belongs to its author.

## Known issues to keep in mind

- Timeline width is computed against a fixed 120s scale, so clips on longer timelines can be drawn at the wrong length (documented in `docs/verification-status.md`; not fixed).
- `next@15.5.6` has published security advisories. Upgrade before the final demo.
- Composition lives in `composition.score` (see `lib/score.mjs`): sections, a chord per bar and note parts edited in the Score view. Score playback is separate from the audio timeline transport, and A/B proposals are not built yet. A cloud `composition-features` branch may overlap; compare before merging.

## Design quick reference

See `DESIGN.md` for full details.

- Page `#fdfcfc`, cards `#f5f3f1` with 16px radius and no border, floating surfaces white with the ring shadow
- Buttons are 36px pills at 14px/400: black primary, or white secondary with a ring. No 1px borders.
- Display type is Inter Tight 300 with -0.02em tracking. Musical data is set in Geist Mono.
- Blue `#235fba` means written by people. Orange `#ff4704` means Copilot, not yet kept, and is drawn dashed.
- Motion is 150ms `cubic-bezier(0.4,0,0.2,1)`. The focus ring is 1.5px `#2b7fff` with a 2px offset.
