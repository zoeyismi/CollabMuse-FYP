# CollabMuse Design System

CollabMuse is a real-time collaborative music **composition** tool. The interface should feel like a quiet, editorial studio: warm paper, black ink, thin display type. Colour appears only in the music itself.

The visual language comes from ElevenLabs (elevenlabs.io). Values marked *measured* were read from the computed styles of elevenlabs.io and elevenlabs.io/music on 2026-11-11. Third-party DESIGN.md write-ups were used only for cross-checking, and several disagree with the live site (see "Corrections").

Design source of truth: the Claude Design canvas "CollabMuse 介面重設計" (boards: Workstation, Home, Style notes). Change the canvas first, then the code.

---

## 1. Principles

1. **Music is the only colour.** Chrome is achromatic and warm. Blue means "written by a person", orange means "drafted by Copilot and not yet kept". Never use either colour for decoration.
2. **Composition over clips.** Surfaces should expose musical structure (sections, chords, notes, parts), not only audio rectangles.
3. **Quiet hierarchy.** Size and colour carry hierarchy, not weight. Display type is light (300); UI type is regular (400); 500 is reserved for small labels and eyebrows.
4. **Flat by default, lifted when floating.** Cards sit flat on cream. Only floating things (popovers, selected segments, prompt boxes, white buttons) get the hairline-ring shadow.
5. **Proposals, not overwrites.** Any AI or collaborator change that would replace someone's work is shown as a proposal (dashed, orange or A/B) until someone accepts it.

## 2. Colour

### Neutrals (measured, ElevenLabs Tailwind scale)

| Token | Hex | Use |
|---|---|---|
| `paper` (gray-25) | `#fdfcfc` | Page background. Not pure white. |
| `white` | `#ffffff` | Floating surfaces: white buttons, prompt boxes, popovers, selected segment |
| `cream` (gray-100) | `#f5f3f1` | Cards, chips, segmented-control track, sidebars, piano-roll ground |
| `stone` (gray-200) | `#ebe8e4` | Hairline dividers, grid lines, hover on cream |
| `gray-400` | `#a59f97` | Disabled text, empty chord cells |
| `smoke` (gray-500) | `#777169` | Secondary text, captions, eyebrows, timestamps |
| `gray-600` | `#59544f` | Hover on dark buttons |
| `ash` (gray-700) | `#44403b` | Tertiary body text, black piano keys |
| `ink` | `#000000` | Text, primary buttons, play button |
| `hairline-alpha` | `rgba(0,0,0,0.05)` | Bottom borders, segmented track on cream |

### Music colours (CollabMuse)

| Token | Hex | Use |
|---|---|---|
| `human` | `#235fba` | Playhead, selection, notes written by people, live presence |
| `human-deep` | `#174a78` | Active section pill, collaborator tag text |
| `human-tint` | `#e9eff8` | Human clip background, selected bars |
| `copilot` | `#ff4704` | Notes and clips drafted by Copilot and not yet kept. ElevenLabs uses this exact orange as its accent. |
| `copilot-deep` | `#a33a0c` | Copilot tag text (passes 4.5:1 on tint) |
| `copilot-tint` | `#fff0e8` | Copilot clip background, ghost-note fill |
| `focus` | `#2b7fff` | Focus ring only (measured) |

Rules:
- Text must reach 4.5:1. `#777169` on `#fdfcfc` passes for body sizes; do not go lighter for real text.
- Blue and orange must also differ in lightness so they read in greyscale. Orange ghost notes are always dashed.
- No gradients in chrome. The only allowed gradients are the soft radial "orbs" used as track or part avatars (ElevenLabs uses these for voices).

## 3. Typography

| Role | Family | Size / line-height | Weight | Tracking | Source |
|---|---|---|---|---|---|
| Hero H1 | Inter Tight (stand-in for Waldenburg) | 48–56px / 1.05 | 300 | -0.02em | measured 48px / 300 / -0.96px |
| Section H2 | Inter Tight | 36px / 1.17 | 300 | -0.02em | measured |
| Panel title | Inter Tight | 24–32px / 1.13 | 300 | -0.02em | |
| Eyebrow | Inter | 15px | 500 | 0.15px | measured, `#777169` |
| Body large | Inter | 18px / 1.44 | 400 | 0.18px | measured |
| Body | Inter | 16px / 1.5 | 400 | 0.16px | measured |
| Card title | Inter | 15–18px | 400 | 0 | measured: card titles are not bold |
| UI / button | Inter | 14px / 1.5 | 400 | 0 | measured |
| Small / tag | Inter | 12–13px | 400–500 | 0 | |
| Musical data | Geist Mono | 11–13px | 400 | 0 | bars, BPM, chords, note names, timecode; tabular numbers |

- Waldenburg is ElevenLabs' licensed face. Do not ship it. Inter Tight 300 is the stand-in.
- Chinese text falls back to `PingFang SC`, `Noto Sans SC`, `Microsoft YaHei`. Never set CJK at weight 300.
- Never bold display type. Never use negative tracking on body text.
- Sentence case everywhere. The brand line "make your music" stays lowercase.

## 4. Shape, spacing, elevation

**Radius:** chips and buttons `9999px`, piano-roll notes `4px`, timeline clips `10px`, cards `16px` (measured), prompt boxes `30px` (measured), large media `24px`.

**Spacing:** 4px base. Use 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96. Sections are separated by 96–112px on marketing pages and 16–24px inside the workstation.

**Elevation (measured):**

```css
--ring: rgba(0,0,0,0.125) 0 0 0 0.5px,
        rgba(0,0,0,0.04) 0 1px 1px,
        rgba(0,0,0,0.04) 0 2px 4px;
```

- Cards: `background: cream; border-radius: 16px;` no border, no shadow.
- Floating: `background: white; box-shadow: var(--ring);`
- Dividers: `1px solid stone` or `rgba(0,0,0,0.05)`.
- Never use a 1px grey border on buttons. Never exceed 0.125 alpha on shadows.

## 5. Motion and states (measured)

- Transition: `150ms cubic-bezier(0.4, 0, 0.2, 1)` on colour, background, box-shadow. Enter animations use `cubic-bezier(0, 0, 0.2, 1)` at 200–300ms.
- Hover: step one grey up (`white → cream`, `cream → stone`, `black → gray-600`). No scale, no glow.
- Focus: `outline: 1.5px solid #2b7fff; outline-offset: 2px;` on `:focus-visible` only.
- Pressed and selected in a segmented control: white pill with `--ring` inside a cream track (not black-on-white).
- Respect `prefers-reduced-motion`. Playhead motion is functional and stays; decorative motion goes.
- Real-time edits from others fade in over 150ms with the collaborator's presence colour. Do not animate layout on every remote event.

## 6. Components

### Buttons
| Variant | Spec |
|---|---|
| Primary | `height 36px; padding 0 14px; radius 9999px; background #000; color #fff; 14px/400; border 0` |
| Secondary | same size; `background #fff; box-shadow var(--ring)` |
| Icon (round) | `36–44px` circle, same two fills; `aria-label` required |
| Play | 44–48px black circle, white triangle |
| Send (prompt) | 32–36px black circle with up-arrow |

### Chips
`padding 6px 10px; radius 9999px; background cream; color rgba(0,0,0,0.7); 13–14px/400`. Used for genre presets, BPM, key and time-signature readouts.

### Segmented control / tabs
Track: `cream`, `padding 4px`, `radius 9999px`. Selected item: white, `--ring`, ink text. Unselected: transparent.

### Prompt box (Copilot)
Modelled on elevenlabs.io/music: white, `radius 30px`, `padding 12px`, `--ring`. Inside: a 15px label in `rgba(0,0,0,0.5)`, a row of preset chips, a borderless textarea, and a black send button bottom-right. The prompt box is the hero on the home page and the top of the Copilot panel.

### Cards
Cream, 16px radius, 20–32px padding, no border. Title 15–18px/400, body `#777169`.

### Timeline (workstation)
- Rows: bar ruler → sections lane → chord lane → tracks. All rows are separated by `stone` hairlines.
- Sections are pills on the sections lane; the active section uses `human-deep` with white text.
- Chords are mono text centred in each bar; a changed chord shows `human-tint` behind it.
- Clips: human MIDI = `human-tint` + `human` notes; Copilot MIDI = `copilot-tint` + `copilot` notes; audio = `cream` + `ash` waveform; muted = 45% opacity.
- Presence label: a blue pill "Name · editing bar N" above the lane.

### Piano roll
Cream frame, white grid with `stone` beat lines (strong every 4). Out-of-key rows are tinted `#f8f6f4`. Human notes are solid `human`. Copilot suggestions are `copilot-tint` with a 1.5px dashed `copilot` border, plus a floating card offering "Keep notes" or "Discard".

### Proposals (A/B)
A cream card with a segmented A/B switch, one line describing the musical difference, and two actions: "Accept B into chorus" (primary) and "Keep A" (secondary).

## 7. Voice and copy

Measured from ElevenLabs: short, verb-first, sentence case, no exclamation marks ("Sign up", "Learn more", "Generate music for free").

- Buttons say what happens: "Write an editable draft", "Regenerate chorus", "Accept B into chorus".
- Name musical things musically: "bar 17", "C minor", "Fm on bar 15". Do not say "clip 3" when "chorus melody" is known.
- Copilot is a collaborator, not magic: avoid "AI-powered", "magic" and sparkle icons.
- Every string ships in English and Chinese through `lib/i18n.tsx`.

## 8. Accessibility

- Use real `<button>`, `<a href>`, `<input>` with `<label>`. Never use a clickable `div`.
- Icon-only controls need `aria-label`. Decorative SVG gets `aria-hidden="true"`.
- Touch targets are at least 44px on touch layouts. The 36px desktop buttons grow to 44px under 768px.
- Never rely on colour alone: human versus Copilot is also solid versus dashed, and tags carry the author's name.

## 9. Corrections to earlier summaries

| Earlier assumption (refero / third-party) | Live site (measured) |
|---|---|
| Buttons have a 1px `#e5e5e5` border | No border. Primary is solid black; secondary is white with a 0.5px ring shadow |
| Button and nav weight 500 | 400 |
| Page background `#ffffff` or `#f5f5f5` | `#fdfcfc` |
| Cards are white with a hairline border | Cream `#f5f3f1`, 16px radius, no border or shadow |
| Hero H1 at 64–88px | 48px on the home page, 36px on /music |
| Primary fill `#292524` | `#000000` |

## 10. Mapping to the codebase

The current code uses a different palette (`tailwind.config.js`: `ink #101216`, `sage`, `brass`, `clay`, glass shadows; `app/globals.css`: `--album-*` colours, `#f7f7f5` background). When implementing this system:

1. Add the tokens above to `tailwind.config.js` (`theme.extend.colors`, `boxShadow.ring`, `fontFamily.display`) and as CSS variables in `app/globals.css`.
2. Replace `GlassButton` and `GlassCard` with the button, chip and card specs above, keeping their component APIs.
3. Keep `--album-blue` (`#235fba`) as `human`; retire the other album colours from chrome.
4. Update the canvas first if anything here needs to change.
