# FYP UI Redesign Design

Date: 2026-05-23

## Goal

Redesign the FYP prototype UI as a coherent music collaboration product across three pages:

- Homepage
- Dashboard
- Room/editor

The site should feel like a polished music platform, not a generic admin dashboard. The visual language should use a dark node/dot background, refined neutral surfaces, and album-cover-inspired red, blue, and yellow as the only main accent colors.

## Product Context

The project is a Real-time Collaborative Music Composition Tool. It is not a live audio streaming system. The UI should make the intended scope clear:

- Users create collaboration rooms.
- Users upload and manage clips.
- Users edit music project state together.
- Users chat and see collaborators.
- Real-time behavior is based on synchronized user actions and events, not raw audio streaming.

## Overall Visual System

The approved direction is expressive on entry pages and clean inside the editor.

Background:

- Use a deep dark base with subtle node/dot patterns.
- Keep the background atmospheric but not visually noisy.
- Avoid large flat gray areas.

Accent palette:

- Primary active color: deep album-cover blue.
- Secondary expressive colors: deep red and warm yellow.
- Neutral UI surfaces: deep black, near-black, soft off-white, and restrained translucent glass.
- Avoid pale/fog-blue as a general UI surface color because it weakens the red/yellow/blue system.
- Red, yellow, and blue should appear as accents, glows, thin borders, clip highlights, carousel objects, badges, and interactive states.
- Avoid filling most of a page with large flat red/yellow/blue blocks. The colors should add energy while the interface remains premium and readable.

Visual balance:

- Homepage and dashboard can use stronger music-product visuals.
- Room/editor must stay readable and functional.
- Red, yellow, and blue should be present across all pages so the visual system feels unified.
- In practical UI areas, these colors should be used with restraint. They should support hierarchy and interaction, not become noisy decoration.

## Homepage Design

Approved direction: A3 hero with product reveal.

Hero:

- Main title: `make your music`
- Large centered headline with strong breathing room.
- Short subtitle explaining event-based collaborative music editing.
- Primary CTA: open dashboard.
- Secondary CTA: enter demo room.
- Product/editor preview rises from the bottom of the hero.

Motion:

- Navbar fades down.
- Eyebrow, headline, subtitle, and buttons fade upward in sequence.
- Editor preview slides up from the bottom with a soft perspective effect.
- Timeline clips can drift subtly.

Carousel section:

- Replace ordinary feature cards with a spherical left/right carousel inspired by the provided reference.
- Keep open space between carousel items.
- Center item uses the blue album-cover palette.
- Left item uses the red album-cover palette.
- Right item uses the yellow album-cover palette with subtle halftone texture.
- Suggested objects: Rooms, Clips, Events, Chat.
- Carousel motion should feel smooth and premium, not playful or chaotic.
- The carousel can be the most color-forward section, but surrounding copy, controls, and background should stay neutral so the page keeps a high-end feel.

## Dashboard Design

Approved direction: mini project carousel.

Purpose:

- The dashboard should feel like a music project hub, not a plain admin list.
- It should bridge the expressive homepage and the practical room/editor.

Layout:

- Use the same deep node/dot background.
- Present current/recent projects as a smaller carousel.
- Active project appears in the center with the blue palette.
- Side projects use red and yellow album-cover colors.
- Keep actions visible: create room and enter demo room.
- Supporting dashboard cards and metadata surfaces should be neutral, not pale blue. Use red/yellow/blue only for project identity, status marks, small icons, progress accents, and hover states.

Content:

- Show mock projects/rooms.
- Show basic project metadata such as clip count, track count, and recent activity.
- Provide a clear path into the demo room.

Motion:

- Project carousel gently shifts or floats.
- Cards may scale slightly on hover.
- Avoid excessive rotation or motion that hides dashboard information.

## Room / Editor Design

Approved direction: clean DAW workspace.

Purpose:

- This page must be the clearest and most functional page.
- It should demonstrate the FYP concept: collaborative music editing through synchronized actions.

Layout:

- Top bar with room name, online status, collaborators, sync status, and share action.
- Left panel: track list.
- Center panel: timeline and playback/control area.
- Right panel: chat.
- Bottom/stat area optional, kept compact.

Color:

- Page background remains dark node/dot.
- Left and right panels use off-white or neutral glass surfaces.
- Center timeline uses a dark neutral workspace surface, not a large pale-blue panel.
- Blue appears through the active playhead, grid highlights, selected clips, sync indicators, and subtle glow.
- Red and yellow appear as small clip highlights, collaborator markers, status dots, or event badges.
- Avoid random blue/black/gray block mixing.
- Avoid using pale/fog-blue as the room's main panel color; the editor should feel clean, dark, and controlled.

Motion:

- Keep room/editor motion restrained.
- Use hover states, subtle clip movement, and gentle panel entrance.
- Do not use large carousel effects inside the editor.
- Color motion should be subtle: small glow shifts, selected clip emphasis, and status transitions only.

Readability:

- Text must remain high contrast.
- Timeline, tracks, chat, and controls should be visually distinct.
- UI should look clean enough for a supervisor/demo audience to understand quickly.

## Components

The implementation should preserve or evolve the existing component structure:

- Navbar
- GlassButton
- GlassCard
- HeroVisual or replacement homepage hero preview
- Feature/card carousel components
- RoomCard or project carousel item
- TrackList
- Timeline
- AudioClip
- ChatPanel
- CollaboratorAvatars
- ControlPanel

New or revised components likely needed:

- SphericalCarousel
- CarouselOrb or ProjectOrb
- HomepageProductReveal
- DashboardProjectCarousel
- RoomShell or RoomLayout to keep editor styling isolated

## Styling Strategy

The current CSS has many layered overrides from earlier experiments. The redesign should avoid adding more competing overrides.

Implementation should:

- Consolidate page-level theme classes.
- Separate homepage, dashboard, and room/editor visual rules.
- Use clear component classes or Tailwind patterns instead of broad repeated `!important` overrides.
- Keep room/editor styles scoped so homepage carousel colors do not leak into the editor.

## Responsive Behavior

Homepage:

- Desktop: centered hero with bottom product reveal.
- Mobile: headline remains large but not clipped; product preview becomes narrower and simplified.

Carousel:

- Desktop: center item large, side items visible left/right.
- Mobile: center item prominent, side items partially visible or stacked as horizontal scroll.

Dashboard:

- Desktop: carousel plus supporting project details/actions.
- Mobile: carousel cards stack or become horizontally scrollable.

Room/editor:

- Desktop: three-column editor layout.
- Tablet/mobile: stack panels in this order: top bar, timeline, tracks, chat.

## Success Criteria

- The site has one coherent visual identity across homepage, dashboard, and room/editor.
- Homepage title is `make your music`.
- The homepage uses a product reveal and red/blue/yellow spherical carousel.
- Dashboard uses a smaller project carousel.
- Room/editor remains clean and readable, with neutral side panels and a dark timeline accented by red/yellow/blue details.
- Red, yellow, and blue are the consistent accent colors across all pages.
- Pale/fog-blue is not used as a broad page or panel color.
- The UI clearly communicates event-based collaboration, not live raw audio streaming.
- Motion improves polish without making the interface hard to understand.

## Out of Scope

- Real backend implementation.
- Real audio playback/storage.
- Real Socket.io synchronization.
- Authentication.
- Deployment changes.
- Rewriting the whole product concept.

## Open Implementation Notes

- Before editing, decide whether the production UI should be implemented in the Next.js pages, `preview-server.mjs`, or both.
- The current project has both Next.js files and a standalone preview server. The implementation plan should choose one authoritative path to prevent version drift.
- Because the project directory currently is not a git repository, this design document cannot be committed unless git is initialized or the project is moved into a repository.
