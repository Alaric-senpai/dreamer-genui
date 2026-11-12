# M3 showreel — self-review (§9.3 / §9.4)

**Date:** 2026-11-12
**Scope:** M3 only. The showreel demonstrates what M3 implements: renderer,
kinetic typography, marks/annotations, cues, theming and the styling paths.
Camera, receding, ambience runtime, diagram draw-in, hand-drawn annotation
strokes and detour return are deliberately **not** in this milestone. They are
graded as failures below rather than hidden.

**Artifacts** (in this folder):

| File | What it is |
|---|---|
| `showreel-desktop.mp4` | 1280×800, 70.5 s, full seven-scene run |
| `showreel-mobile.mp4` | 390×844 @2x, 70.6 s, portrait phone run |
| `showreel-reduced.mp4` | 1280×800, `prefers-reduced-motion: reduce`, 70.3 s |
| `showreel-hero.gif` | 11 s opening (kicker → hero slam → body) |

Recorded with `scripts/capture-showreel.mjs` using headless Chromium
(`Page.captureScreenshot` at 30 fps target, ffmpeg H.264). The screenshot loop
yields ~15 recorded fps; the **app's own** rAF metrics are reported separately
below and are the performance evidence. The videos are for visual review, not
frame-rate evidence.

**Reproduce:**

```bash
pnpm --filter dreamer-genui build
pnpm --filter playground build
pnpm --filter playground exec next start -p 3100
node scripts/capture-showreel.mjs --mode desktop   # or mobile | reduced | metrics | metrics-throttled
```

## What the reel shows (deterministic 70 s timeline)

| Time | Scene | Demonstrated |
|---|---|---|
| 0–7 s | **type** | kicker `wipe`, hero `slam` overshoot, body `words` |
| 7–15 s | **voices** | heading `chars`, definition `typewriter`, note `reveal`, quote `words` — all text variants |
| 15–24 s | **marks** | highlight, emphasis, term (clickable, emits `focus`), focusable (clicked), underline/box/strike/bracket/circle annotations, pulse/glow/underline/shake/bounce/wobble emphasis |
| 24–41 s | **entrances** | all 16 `EnterEffect` names, one line each (draw/morph are honest crossfade stand-ins, see gaps) |
| 41–51 s | **cues** | mock narrator fires `beat-1..4`; nodes are absent until their cue; `choices` answer intent |
| 51–60 s | **mood** | playful (paper-warm, springy) → solemn (near-black, slower, heavier) |
| 60–68.5 s | **detour** | `attach` on a clickable term expands inline, spotlight prop is accepted, end card via `replace` so the detour does not linger |
| 68.5 s | end | `Fin.` in the calm register |

## §9.3 checklist — honest grades

| # | Item | Grade | Evidence / reason |
|---|---|---|---|
| 1 | First visible text motion within ~300 ms of trigger | ✅ | Metrics mode: first node mount and first motion frame **28.2 ms**; 4× throttled: **212.1 ms**. Desktop *capture* reports 5074 ms because the screenshot loop starves rAF — that is a recorder artifact, not the app. |
| 2 | Hero has a clear, satisfying entrance (not a fade) | ✅ | Hero default is `slam`: units start at `scale(1.9)` / `y:-12` and settle to 1 (pinned by `variant-hooks.test.tsx`). Visible in the opening and `Light.` scenes. |
| 3 | At least 4 clearly different effects, each for a reason | ✅ with caveat | 16 effects are exercised. Real, distinct motions include `wipe`, `slam`, `words`, `chars`, `typewriter`, `pop`, `rise`, `sweep`, `zoom`, `scribble`, `count-up`. `draw` and `morph` are crossfade stand-ins until M5, and are labelled as such on screen. |
| 4 | One focal point at a time; receding content visibly de-emphasised | ❌ | **Receding is M4.** Scenes use `replace` to clear the board, which keeps most beats clean, but the marks scene intentionally stacks several emphasis samples and nothing previously entered is dimmed or shrunk. This is a real M3 failure, not a rounding error. |
| 5 | Camera moves at least twice, never harms legibility | ❌ | **Camera is M4.** The reel contains zero camera moves; `camera` ops are validated by core but not rendered. Cannot be graded as passing. |
| 6 | Two contrasting moods differ dramatically, including ambience and tempo | 🟡 | Playful → solemn is dramatic in colour/surface and tempo (see 52 s vs 56 s frames). **Ambience runtime is M4**, so atmosphere is only tokens/texture data, not a live layer. |
| 7 | Sequenced annotation strokes feel hand-drawn | ❌ | M3 ships CSS shapes: box border, strike, inline-bracket bars, rounded circle, underline. They are legible and distinct, but there is no SVG stroke draw-on or sequencing. That is the M5 annotation-primitives pass. |
| 8 | 60 fps on a CPU-throttled mid-range profile; no jank during entrances or camera moves | 🟡 | 4× CPU throttle: **58.34 fps average**, p50/p95 **16.7/16.7 ms**, first mount **212 ms**, but **6 frames > 50 ms** and a **1016.7 ms max stall** (scene setup/replace). Unthrottled: 59.67 fps, p95 16.8 ms, max 166.6 ms, 1 long frame. Camera jank is untestable because there is no camera. |
| 9 | Text stays AA-contrast under every shipped mood | ✅ with caveat | `tests/theme/palette.test.ts` iterates every shipped mood (calm, solemn, playful), asserts the guardrail adjusts nothing and that ink/muted ≥ 4.5:1 and accent family ≥ 3:1 against both bg and surface. Real-browser axe found 0 colour-contrast violations in the light scenes; the dark mood scene was not separately browser-axe-scanned (palette is unit-pinned). |
| 10 | Reduced motion delivers all content calmly and instantly | ✅ | Full-length reduced capture (`showreel-reduced.mp4`, 70.3 s) reaches every scene; kinetic effects render static or short-fade, ambience/camera are absent anyway. All text/content is present. |

**Score: 3 pass, 2 pass-with-caveat, 0 partial, 3 fail, 2 pass-with-caveat
counted within the passes; the explicit failures are items 4, 5, 7.**
In plain terms: M3's own scope is delivered; the full §9.3 bar is **not** met
until M4/M5 add receding, camera, ambience and hand-drawn strokes.

## §9.4 showreel-gate coverage

| Required by §9.4 | Status |
|---|---|
| Every enter effect | ✅ all 16 names exercised (draw/morph are M5 stand-ins) |
| Kinetic text variants | ✅ hero, kicker, heading, body, definition, note, quote |
| Annotations | ✅ highlight/emphasis/term/focusable/underline/box/strike/bracket/circle |
| A diagram drawing in | ❌ M5 (no diagram figure in M3) |
| Camera moves | ❌ M4 |
| Cue-driven entrance (mock narrator) | ✅ cue gate: **0 nodes mounted before, 10 after** |
| `attach` / `return` | 🟡 attach expands inline; **return control is M4** |
| Mood shift between two contrasting themes | ✅ playful → solemn |
| Each shipped ambience preset | ❌ M4 (no ambience runtime) |

The gate is therefore **partially satisfied by design**. The reel is the M3
deliverable; the missing rows are recorded M4/M5 work, not regressions.

## Accessibility evidence

- **axe (real Chromium, axe-core 4):** 0 violations at the marks scene and at
  the final end card in desktop, mobile and reduced runs.
- **Cue gating:** `before=0`, `after=10` nodes for the `s5-*` cue scene; nothing
  is mounted before its cue.
- **Full AX tree (CDP `Accessibility.getFullAXTree`):**
  - marks scene: 85 exposed nodes; heading names are exactly
    `"Point at the thing that matters."` and `"dreamer-genui M3 showreel"`.
  - final: 16 exposed nodes, `"Fin."` / `"THANK YOU"`, no leftover detour.
- **A real bug caught by this snapshot:** `chars` rendered every letter as an
  inline-block, so Chrome's accessible name was
  `"P o i n t a t t h e t h i n g …"`. Fixed in M3g:
  - plain `chars` runs now render an `.dg-sr-only` full-text copy and mark the
    animated copy `aria-hidden`;
  - `chars` + an interactive mark falls back to word splitting, so the
    term/focusable stays in the accessibility tree.
  - Pinned by two new kinetic tests; the post-fix AX name is the exact sentence.
- **Orca not run (honest limitation):** Orca 50.0.9 and AT-SPI 2.60/pyatspi are
  installed and the session bus is live, but headless Chromium does not
  register an AT-SPI application (pyatspi desktop enumeration lists GNOME apps
  only, no Chromium). `Xvfb`, `weston` and `cage` are not installed, so a
  virtual headful browser is unavailable; launching a visible browser window in
  the live Wayland session was deliberately not done. Screen-reader speech was
  therefore **not** verified; the evidence above is the browser AX tree plus
  axe.

## Performance evidence (app rAF, not the recorder)

| Profile | Avg fps | p50 | p95 | Max frame | Frames >50 ms |
|---|---|---|---|---|---|
| Unthrottled (1280×800) | 59.67 | 16.7 ms | 16.8 ms | 166.6 ms | 1 |
| 4× CPU throttle | 58.34 | 16.7 ms | 16.7 ms | 1016.7 ms | 6 |

First node mount: 28.2 ms unthrottled, 212.1 ms throttled. The long frames are
concentrated at scene replacement/board reset, not during per-word entrances.
Camera jank cannot be measured until M4.

## Fixes made during this gate

| Fix | Why |
|---|---|
| `chars` groups characters per word | mobile capture split “thing” into “thi / ng”; word wrappers make breaks happen only between words |
| `chars` sr-only copy + `aria-hidden` visual | AX name was letter-spaced; now reads the exact sentence |
| `chars` + interactive mark falls back to words | keeps terms/focusables in the accessibility tree |
| `heading` → `h2` | heading-only scenes jumped h1→h3, an axe `heading-order` violation |
| annotate circle/bracket CSS shapes | previously degraded to underline; now visually distinct in M3 (M5 adds hand-drawn strokes) |
| end card uses `replace` | the detour no longer lingers behind `Fin.` |
| hero fills the reading column + wraps | 320px verification: document `scrollWidth` == viewport, no horizontal scroll |

## Known limitations / next milestones

1. No camera moves (M4).
2. No receding/dimming of finished content (M4).
3. No ambience presets or runtime; moods only change tokens/surface/tempo (M4).
4. No detour placement/connector/spotlight return control; `attach` renders
   inline and `mode`/`placement` are accepted but not laid out (M4).
5. No diagram draw-in; `draw`/`morph` entrances are stand-ins (M5).
6. Annotation strokes are CSS shapes, not hand-drawn SVG draw-on (M5).
7. Recorded videos are ~15 fps because of the screenshot capture method; use
   the metrics mode for performance claims.
8. Real Orca speech output not verified (see above).
9. Storybook/visual-regression stories remain M7.

## Verdict

M3's renderer, kinetic text, marks, cues, theme shift and both styling paths are
demonstrated and pass the automated gates (`338/338` tests, `tsc` clean, library
and playground builds green, zero product strings in `packages/`). The full
§9.3/§9.4 showreel bar is **not** fully green: receding, camera, ambience,
diagram draw-in, hand-drawn strokes and detour return are missing by milestone
design.

**Status: M3g complete, awaiting human approval of the showreel before M4.**
