# M4 showreel — self-review (§9.3 / §9.4)

**Date:** 2026-11-13
**Scope:** M4. The reel now demonstrates the full §9.4 surface: the M3
language plus attach/return detours, receding scenes, camera moves, all seven
ambience presets and streaming partials. Diagram draw-in and hand-drawn
annotation strokes remain **M5**; they are graded as failures below rather
than hidden.

**Artifacts** (in this folder):

| File | What it is |
|---|---|
| `showreel-desktop.mp4` | 1280×800, 109.4 s, full eleven-scene run |
| `showreel-mobile.mp4` | 390×844 @2x, 109.2 s, portrait phone run (flow-detour fallback) |
| `showreel-reduced.mp4` | 1280×800, `prefers-reduced-motion: reduce`, 109.2 s |
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

## What the reel shows (deterministic 109 s timeline)

| Time | Scene | Demonstrated |
|---|---|---|
| 0–7 s | **type** | kicker `wipe`, hero `slam` overshoot, body `words` |
| 7–15 s | **voices** | heading `chars`, definition `typewriter`, note `reveal`, quote `words` — all text variants |
| 15–24 s | **marks** | highlight, emphasis, term (clickable, emits `focus`), focusable (clicked), underline/box/strike/bracket/circle annotations, pulse/glow/underline/shake/bounce/wobble emphasis |
| 24–41 s | **entrances** | all 16 `EnterEffect` names, one line each (draw/morph are honest crossfade stand-ins, see gaps) |
| 41–51 s | **cues** | mock narrator fires `beat-1..4`; nodes are absent until their cue; `choices` answer intent |
| 51–60 s | **mood** | playful (paper-warm, springy) → solemn (near-black, slower, heavier) |
| 60–68.5 s | **detour** | spotlight attach on a clickable term: floating panel, SVG arrow connector, circled target, detour-scoped `eerie` theme, dimmed/inert background, Return control restores focus and reverts the theme |
| 68.5–77 s | **recede** | three appended lines and a hero; as each new scene lands, older nodes visibly step back (4/5 marked `data-dg-receded`) |
| 77–86 s | **camera** | explicit push-in to the hero (`scale(1.35)`), overview return (`scale(1)`), second push to the note, overview again |
| 86–100 s | **ambience** | every shipped preset named on screen in turn: grain, vignette, dust, embers, fog, stars, flicker; particles animate, CSS layers render, hidden tab pauses |
| 100–109 s | **stream** | a partial reply applied one op at a time (text only), then the final reply adds choices; then `Fin.` in the calm register |

## §9.3 checklist — honest grades

| # | Item | Grade | Evidence / reason |
|---|---|---|---|
| 1 | First visible text motion within ~300 ms of trigger | ✅ | App rAF metrics (not the recorder): first node mount and first motion frame are **95.9 ms** unthrottled and **140.5 ms** under 4× CPU throttle, both well inside 300 ms. |
| 2 | Hero has a clear, satisfying entrance (not a fade) | ✅ | Hero default is `slam`: units start at `scale(1.9)` / `y:-12` and settle to 1 (pinned by `variant-hooks.test.tsx`). Visible in the opening, the recede hero and the camera scene. |
| 3 | At least 4 clearly different effects, each for a reason | ✅ with caveat | 16 effects are exercised. Real, distinct motions include `wipe`, `slam`, `words`, `chars`, `typewriter`, `pop`, `rise`, `sweep`, `zoom`, `scribble`, `count-up`. `draw` and `morph` are crossfade stand-ins until M5, and are labelled as such on screen. |
| 4 | One focal point at a time; receding content visibly de-emphasised | ✅ | The recede scene appends four scenes; at the hero the probe finds **4 of 5** nodes carrying `data-dg-receded="true"` (the current scene stays at full strength). The detour scene goes further: non-target top-level nodes are dimmed, `aria-hidden` and `inert`. |
| 5 | Camera moves at least twice, never harms legibility | ✅ | Desktop/mobile probe: `pushed=scale(1.35)`, `overview=scale(1)`, then a second push/return. Zoom is clamped to 1.6 at the renderer; the camera layer never reflows the board. Under reduced motion the probe is `scale(1)` — no zoom. |
| 6 | Two contrasting moods differ dramatically, including ambience and tempo | ✅ | Playful → solemn is dramatic in colour/surface/tempo (see 52 s vs 56 s frames), and the ambience scene cycles all seven presets under the solemn register. |
| 7 | Sequenced annotation strokes feel hand-drawn | ❌ | Still CSS shapes: box border, strike, inline-bracket bars, rounded circle, underline. Legible and distinct, but there is no SVG stroke draw-on or sequencing. That is the M5 annotation-primitives pass. |
| 8 | 60 fps on a CPU-throttled mid-range profile; no jank during entrances or camera moves | 🟡 with caveat | App rAF, 4× CPU throttle: **56.6 fps average, p95 16.8 ms, 36 long frames in 6088**, but a **849.9 ms maximum frame**. Unthrottled: **58.8 fps, p95 16.8 ms, 23 long frames, 183.2 ms max**. Average and p95 are at budget; the max-frame tail is not, so this is not claimed as a clean pass. Aggregate metrics cannot attribute the 850 ms frame to a specific scene. |
| 9 | Text stays AA-contrast under every shipped mood | ✅ | `tests/theme/palette.test.ts` iterates every shipped mood and pins ink/muted ≥ 4.5:1 and accent family ≥ 3:1. Real-browser axe: **0 violations** at marks, detour, ambience and final in desktop, mobile and reduced runs. The detour ink bug axe caught in the first M4 pass (three contrast nodes) is fixed and re-verified. |
| 10 | Reduced motion delivers all content calmly and instantly | ✅ | Full-length reduced capture reaches every scene; the camera probe stays at `scale(1)` and every particle ambience is `static`. Content is complete; no scene depends on motion. |

**Score: 7 pass, 3 pass-with-caveat/partial (items 3, 8 and 9), 1 fail (item 7).**
M4 closes the M3 failures for receding, camera and ambience and adds the
attach/return and streaming surfaces. The full §9.3 bar is still not met
because hand-drawn annotation strokes are M5 and the throttled frame-time tail
is not yet at budget.

## §9.4 showreel-gate coverage

| Required by §9.4 | Status |
|---|---|
| Every enter effect | ✅ all 16 names exercised (draw/morph are M5 stand-ins) |
| Kinetic text variants | ✅ hero, kicker, heading, body, definition, note, quote |
| Annotations | ✅ highlight/emphasis/term/focusable/underline/box/strike/bracket/circle (CSS shapes, M5 draws them by hand) |
| A diagram drawing in | ❌ M5 (no diagram figure yet) |
| Camera moves | ✅ push-in ×2, overview return ×2, clamped and reduced-motion safe |
| Cue-driven entrance (mock narrator) | ✅ cue gate: **0 nodes mounted before, 10 after** |
| `attach` / `return` | ✅ floating spotlight + connector + annotation + scoped theme + Return; probe confirms all six and axe 0 |
| Mood shift between two contrasting themes | ✅ playful → solemn, plus detour-scoped eerie that reverts |
| Each shipped ambience preset | ✅ grain, vignette, dust, embers, fog, stars, flicker all observed live (desktop + reduced); hidden tab pauses and reduced motion is static |

The gate is complete except the diagram row, which is explicitly M5.

## Accessibility evidence

- **axe (real Chromium, axe-core 4):** 0 violations at the marks, detour,
  ambience and final snapshots in **desktop, mobile and reduced** runs.
- **Detour focus/background:** while a floating detour is open, every
  non-target top-level node carries `aria-hidden="true"` and `inert`; the
  target is annotated. Return restores focus to the target item; Escape closes
  locally too. Pinned by `tests/react/m4-board.test.tsx`.
- **Narrow viewport fallback:** at 390 px the attach detour resolves to
  `placement=below`, renders **in flow** (no overlay, connector or backdrop),
  is 318 px wide inside the board, and the document is exactly 390 px wide
  (`scrollWidth == clientWidth == 390`). No horizontal scroll.
- **Cue gating:** `before=0`, `after=10` nodes for the cue scene; nothing is
  mounted before its cue.
- **Full AX tree (CDP `Accessibility.getFullAXTree`):**
  - marks scene: 85 exposed nodes; heading names are exactly
    `"Point at the thing that matters."` and `"dreamer-genui showreel"`.
  - final: 29 exposed nodes; `"The answer arrives as it is written."` and the
    two answer buttons are exposed, with no leftover detour.
- **Orca not run (honest limitation):** Orca 50.0.9 and AT-SPI 2.60/pyatspi are
  installed and the session bus is live, but headless Chromium does not
  register an AT-SPI application. `Xvfb`, `weston` and `cage` are not
  installed, so a virtual headful browser is unavailable. Screen-reader speech
  was therefore **not** verified; the evidence above is the browser AX tree
  plus axe.

## Performance evidence (app rAF, not the recorder)

| Profile | Frames | Avg frame | fps | p50 | p95 | Max | Long frames | First node mount |
|---|---|---|---|---|---|---|---|---|
| unthrottled | 6325 | 16.995 ms | **58.84** | 16.7 ms | 16.8 ms | 183.2 ms | 23 | 95.9 ms |
| 4× CPU throttle | 6088 | 17.660 ms | **56.63** | 16.7 ms | 16.8 ms | **849.9 ms** | 36 | 140.5 ms |

Both runs cover the full 108 s timeline and all eleven scenes. The p95 frame
time is at the 60 fps budget (16.8 ms) in both profiles and first motion is
well under 300 ms. The averages (58.8 / 56.6 fps) and the long-frame tail are
not a clean 60 fps pass, so item 8 is graded partially rather than ✅. The
metrics payload records only aggregates, so the 849.9 ms frame cannot be
attributed to an entrance or a camera move from this evidence.

The earlier capture-mode numbers (desktop 58.1 fps, max 466.6 ms; mobile
58.3 fps, max 200 ms) are recorder-contended and are not used as performance
evidence. Camera moves are presentation-layer transforms and the metrics run
exercises both push-ins and both returns.

## Fixes made during this gate

| Fix | Why |
|---|---|
| Detour measures synchronously before its rAF correction | the rAF-only measure left the overlay hidden for a frame and made jsdom tests depend on rAF scheduling under load; the synchronous pass removes the flash and the flake |
| Camera ops cancel the auto-return timer and set a hold window | the showreel's explicit push-in was snapped back to `scale(1)` by the earlier auto-focus timer |
| Detour re-resolves `color` from its scoped ink | a dark detour theme inherited the board's dark ink on a dark surface; axe found 3 contrast violations |
| Background `inert` + `aria-hidden` while a floating detour is open | the spotlight dimmed content visually but left it in the tab order and the a11y tree |
| Receding suppressed while a detour is open | the detour owns focus; dimming the board around it double-de-emphasised the target |
| Vitest `testTimeout`/`hookTimeout` raised to 20 s | the CPU-heavy jsdom + axe suite flaked at the 5 s default under parallel load; three different tests timed out across two runs, all passing in isolation |
| Showreel re-applies mood after `replace` | `replace` resets board theme by the M2 ruling, so the detour/end scenes explicitly restore their register |

## Known limitations / next milestones

1. No diagram draw-in; `draw`/`morph` entrances are stand-ins (M5).
2. Annotation strokes are CSS shapes, not hand-drawn SVG draw-on (M5).
3. Recorded videos are ~15 fps because of the screenshot capture method; use
   the metrics mode for performance claims.
4. Real Orca speech output not verified (see above).
5. Ambience runs in `lite` on this machine because `hardwareConcurrency <= 4`;
   that is the documented auto-lite rule, not a failure. CSS-only presets
   (grain/vignette/fog) expose no canvas state.
6. The camera currently models zoom + target focus; the fuller pan/tilt/dolly
   camera is M4b scope in the v2.2 brief.
7. The 4× throttled frame-time tail is above budget (849.9 ms max, 56.6 fps
   average, 36 long frames). p95 is at 16.8 ms, so this is a tail problem, not
   a constant regression; it is left for profiling in M4b/hardening.

## Verdict

M4's attach/return, receding, camera, ambience, streaming and theme scoping are
demonstrated end to end and pass the automated gates (`379/379` tests, `tsc`
clean, library and playground builds green, zero product strings in
`packages/`). The full §9.3/§9.4 showreel bar is **not** fully green: diagram
draw-in and hand-drawn annotation strokes are M5, item 7 is a real failure
until then, and item 8's throttled frame-time tail is a partial pass.

**Status: M4 complete, awaiting the human's spec changes before M5.**
