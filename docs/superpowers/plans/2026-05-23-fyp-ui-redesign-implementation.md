# FYP UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved red/yellow/blue premium UI redesign across homepage, dashboard, and room/editor.

**Architecture:** Use the existing Next.js app as the single authoritative implementation path. Add focused reusable visual components for the product reveal and spherical/project carousels, then clean page-level styling so the old layered CSS overrides no longer fight the new design.

**Tech Stack:** Next.js 15, React 18, TypeScript, TailwindCSS, existing local icon components.

---

## File Structure

- Modify: `app/globals.css` — replace old broad visual overrides with clean global theme primitives, dark node background, carousel animations, and room-specific scoped utilities.
- Modify: `app/page.tsx` — rebuild homepage around `make your music`, product reveal, spherical feature carousel, and clean follow-up sections.
- Modify: `app/dashboard/page.tsx` — rebuild dashboard around a compact project carousel and practical room actions.
- Modify: `app/room/demo/page.tsx` — keep room structure but apply clean DAW layout classes.
- Modify: `components/GlassButton.tsx` — update button variants to neutral + red/yellow/blue accent system.
- Modify: `components/GlassCard.tsx` — keep reusable neutral surfaces.
- Modify: `components/TrackList.tsx` — convert side panel to neutral editor panel.
- Modify: `components/Timeline.tsx` — convert timeline to dark neutral workspace with red/yellow/blue details.
- Modify: `components/AudioClip.tsx` — make clip colors explicit and consistent.
- Modify: `components/ChatPanel.tsx` — convert right side panel to neutral editor panel.
- Modify: `components/ControlPanel.tsx` — align playback/upload UI with room redesign.
- Modify: `lib/mock-data.ts` — update project and clip color data to the approved red/yellow/blue palette.
- Create: `components/HomepageProductReveal.tsx` — hero editor preview that rises from bottom visually.
- Create: `components/SphericalCarousel.tsx` — homepage red/blue/yellow spherical feature carousel.
- Create: `components/DashboardProjectCarousel.tsx` — compact dashboard project carousel.

## Task 1: Clean Global Theme

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace global CSS with clean theme primitives**

Write CSS that keeps Tailwind directives, adds dark node background, neutral surfaces, red/yellow/blue accent variables, keyframes, and scoped room utilities. Remove the older stacked `!important` room experiments.

Key content to include:

```css
:root {
  color-scheme: dark;
  --background: #030507;
  --foreground: #f7faf8;
  --album-blue: #235fba;
  --album-blue-dark: #071f55;
  --album-red: #b71912;
  --album-red-dark: #72100d;
  --album-yellow: #efd84c;
  --album-yellow-dark: #a88d1d;
  --surface-light: #f4f7f4;
  --surface-dark: rgba(9, 14, 18, 0.76);
}

body {
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 18% 10%, rgba(35, 95, 186, 0.18), transparent 24rem),
    radial-gradient(circle at 82% 18%, rgba(183, 25, 18, 0.1), transparent 22rem),
    radial-gradient(circle at 72% 74%, rgba(239, 216, 76, 0.09), transparent 24rem),
    linear-gradient(180deg, #030507 0%, #071015 52%, #030507 100%);
  color: var(--foreground);
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(230, 244, 246, 0.18) 1px, transparent 1px),
    linear-gradient(rgba(230, 244, 246, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(230, 244, 246, 0.035) 1px, transparent 1px);
  background-size: 30px 30px, 120px 120px, 120px 120px;
  opacity: 0.42;
  mask-image: linear-gradient(180deg, black, rgba(0, 0, 0, 0.78), transparent 94%);
  z-index: -1;
}
```

- [ ] **Step 2: Run quick CSS scan**

Run: `rg -n "!important|fog-blue|clean fog-blue|dark clean fog-blue" app/globals.css`

Expected: no old room experiment strings. `!important` should not appear.

## Task 2: Shared Visual Components

**Files:**
- Create: `components/HomepageProductReveal.tsx`
- Create: `components/SphericalCarousel.tsx`
- Create: `components/DashboardProjectCarousel.tsx`
- Modify: `components/GlassButton.tsx`
- Modify: `components/GlassCard.tsx`

- [ ] **Step 1: Create homepage product reveal**

Implement `HomepageProductReveal` as a self-contained hero preview with neutral side panels, dark timeline, and red/yellow/blue clip accents.

- [ ] **Step 2: Create spherical carousel**

Implement `SphericalCarousel` with four items: Clips red on left, Rooms blue in center, Events yellow on right, Chat faded behind. Use CSS classes for positioning and animation.

- [ ] **Step 3: Create dashboard project carousel**

Implement `DashboardProjectCarousel` using `mockProjects`, with the active center project blue and side projects red/yellow.

- [ ] **Step 4: Update buttons/cards**

Update `GlassButton` and `GlassCard` so default surfaces are neutral and accent color comes from variants or explicit page classes, not pale-blue panels.

- [ ] **Step 5: Type check component exports**

Run: `npm run lint`

Expected: no TypeScript/ESLint errors from new component props or imports.

## Task 3: Homepage Redesign

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace old hero**

Set the homepage title to `make your music`, use `HomepageProductReveal`, and keep the project explanation focused on event-based collaboration.

- [ ] **Step 2: Replace flat feature grid**

Use `SphericalCarousel` for Rooms / Clips / Events / Chat.

- [ ] **Step 3: Keep supporting sections minimal**

Add compact workflow and CTA sections using neutral surfaces and small red/yellow/blue accents.

- [ ] **Step 4: Verify homepage route**

Run: `npm run lint`

Expected: no import or JSX errors.

## Task 4: Dashboard Redesign

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `lib/mock-data.ts`

- [ ] **Step 1: Update project data**

Add `accent` fields to mock projects with values `blue`, `red`, and `yellow`.

- [ ] **Step 2: Replace old project grid**

Use `DashboardProjectCarousel` as the main dashboard visual.

- [ ] **Step 3: Add practical status/actions**

Keep create room, enter demo room, project metadata, and first-version scope visible in neutral panels.

- [ ] **Step 4: Verify dashboard route**

Run: `npm run lint`

Expected: no import or JSX errors.

## Task 5: Room / Editor Redesign

**Files:**
- Modify: `app/room/demo/page.tsx`
- Modify: `components/TrackList.tsx`
- Modify: `components/Timeline.tsx`
- Modify: `components/AudioClip.tsx`
- Modify: `components/ChatPanel.tsx`
- Modify: `components/ControlPanel.tsx`
- Modify: `lib/mock-data.ts`

- [ ] **Step 1: Scope the room page**

Add a `room-shell` page class and use neutral editor surfaces instead of broad global glass overrides.

- [ ] **Step 2: Update side panels**

Make TrackList and ChatPanel off-white/neutral panels with dark text and small red/yellow/blue markers.

- [ ] **Step 3: Update timeline**

Make Timeline a dark neutral workspace with subtle grid, blue playhead, and red/yellow/blue clip accents.

- [ ] **Step 4: Update controls**

Make ControlPanel compact and neutral, with primary actions using near-white buttons and small accent details.

- [ ] **Step 5: Verify room route**

Run: `npm run lint`

Expected: no import or JSX errors.

## Task 6: Build and Browser Verification

**Files:**
- No new source files unless verification exposes a fix.

- [ ] **Step 1: Run production build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 2: Start local dev server**

Run: `npm run dev`

Expected: local server starts on `http://localhost:3000`.

- [ ] **Step 3: Check routes in browser**

Open:

- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/room/demo`

Expected:

- Homepage shows `make your music`.
- Homepage shows product reveal and spherical red/blue/yellow carousel.
- Dashboard shows compact project carousel.
- Room shows neutral side panels and dark timeline with red/yellow/blue details.

- [ ] **Step 4: Mobile sanity check**

Use a narrow viewport and verify no major text overlap or clipped primary controls.

## Self-Review

Spec coverage:

- Homepage A3 product reveal: Task 2 and Task 3.
- Red/blue/yellow spherical carousel: Task 2 and Task 3.
- Dashboard mini project carousel: Task 2 and Task 4.
- Clean DAW room/editor: Task 5.
- No pale/fog-blue broad surface: Task 1 and Task 5.
- Verification: Task 6.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps remain.

Type consistency:

- New components are named `HomepageProductReveal`, `SphericalCarousel`, and `DashboardProjectCarousel` consistently across the plan.
