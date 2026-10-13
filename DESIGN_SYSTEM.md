# Our shelf — frontend design system

A private editorial journal: limestone paper, olive ink, confident artwork, quiet human details. The verified production backend is not part of the redesign.

## Foundations

- Background #f6f5f0, near-white surfaces #fffefa, primary ink #252d27.
- One accent: deep olive #425b49. Semantic destructive/success/warning tokens only.
- Noto Sans body + Noto Serif display, self-hosted by next/font with Latin/Cyrillic coverage. Display text is restrained; notes prioritize reading.
- Framing: 1264px content, fluid 18–56px gutters, 32–64px section gaps.
- Radii: 10px controls, 16px artwork, 24px panels, 32px editorial hero.
- Motion: 160/260/420ms, cubic-bezier(.22,1,.36,1). Motion features load separately; reduced motion is respected. No scroll hijacking or WebGL.

## Components

Image-first landscape/poster cards; compact rows; progress cards; editorial featured artwork. Avatar stacks, editorial statistics, native-dialog mobile sheets, keyboard segmented controls, restrained note threads and contextual skeletons.

## Integrity

All journal content and statistics come from existing production data. Missing imagery gets a neutral book-form fallback, not stock photography. Names/photos/dates are stored user values. No fabricated milestones, browser-persistence fallback, fake controls, or backend/schema/policy changes.

## Accessibility and runtime

- Native modal dialogs with explicit initial-field focus, Tab/Shift+Tab containment, Escape, backdrop dismissal, and focus return. Small screens use an independently scrolling bottom sheet.
- Visible keyboard focus, labelled icon actions, roving segmented/day controls, contrasting avatar initials, semantic progress, screen-reader-readable statistics, and 16px mobile fields.
- Viewport safe-area support and dynamic viewport heights. Touch targets remain visible without hover; tilt is mouse-only and disabled by reduced motion.
- Local calendar/activity dates wait for the browser timezone; `<time>` labels use a deterministic UTC hydration snapshot. No suppressed hydration warnings.
- Self-hosted subset fonts, responsive optimized artwork on approved hosts, priority for the featured image, reserved image geometry and contextual skeletons. Private signed images remain browser-fetched through the existing access mechanism.
- Matching artwork layout IDs and framing provide continuity; normal Next navigation is retained without an experimental router/animation integration. No guaranteed cross-route FLIP animation is claimed.

## Verification

See `FRONTEND_VERIFICATION.md` for the final production-browser results and the measured cold-load performance limitation. Functional acceptance is not a claim of passing field Core Web Vitals.
