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

## M4b — layout and camera showcase gate

The showcase lives at `/m4b` in the playground and exposes every layout, slot,
responsive mode and camera behaviour with deterministic URL presets
(`?scene=flow|split|split-reversed|grid|stage|group|transition|camera`,
`&density=compact|large`, `&dir=rtl`, `&narrow=1`). Captures below were taken
against a clean production build at 1440×1100 with the Playwright headless
shell and a 9 s virtual-time budget.

| Capture | What it demonstrates | Grade |
|---|---|---|
| `m4b-split.png` | `split` with an explanation in `left` and a callout + list in `right`; the tutor's composed "explanation beside a question" register | ✅ |
| `m4b-stage.png` | all five `stage` regions populated (`top`, `left`, `center`, `right`, `bottom`), each readable at capture size | ✅ |
| `m4b-grid.png` | four unslotted nodes laid directly into a three-column `grid`; the fourth wraps onto the next row | ✅ |
| `m4b-rtl.png` | the same split mirrored under `dir="rtl"`; logical `left`/`right` swap without component changes | ✅ |
| `m4b-narrow.png` | 390 px container: split collapses to a stack in `narrowOrder`, no horizontal scroll | ✅ |
| `m4b-density-large.png` | `density="large"`: larger type and spacing with the heading wrapping at word boundaries (no mid-word break) | ✅ |
| `m4b-camera-tilt.png` | cue-driven camera path reached its close-up step: board vars carry `tilt-x: 8deg`, `tilt-y: -4deg`, `dolly: 48px`; the text layer stays flat and legible | ✅ with note |

Checklist mirroring the M4b acceptance list:

- **`flow`, `split`, `split-reversed`, `grid`, `stage` render and re-flow** —
  pass. The transition scene re-flows the same nodes between all four
  compositions with an 850 ms layout transition (`tests/react/layout-engine.test.tsx`).
- **All named slots** (`top`, `left`, `center`, `right`, `bottom`) — pass; the
  stage capture populates all five.
- **Responsive collapse and pinning** — pass at a 390 px board width; the
  container-query path uses the board's own width, not the window.
- **RTL** — pass; logical slots mirror and typography/quote borders follow the
  document direction.
- **Density** — pass. `large` writes the documented 1.18 scale and 56 px
  minimum target token; `tests/react/c2b.test.tsx` covers the token surface.
- **Animated layout re-flow, instant under reduced motion** — pass. FLIP is
  transform-only and the reduced-motion driver settles immediately.
- **Camera pan/zoom/tilt/dolly, presets and guided paths** — pass. The
  `camera-tilt-path` fixture runs overview → target close-up (zoom 1.4, tilt
  8/-4, dolly in) → overview, with each step triggered by a narration cue
  (`tests/react/camera.test.tsx`). The DOM verification for the capture showed
  the non-identity backdrop transform and the `focus-detail` cue fired.
- **Optional student pinch-pan with reset** — pass. One-finger drag pans,
  two-finger pinch zooms, the reset control restores the tutor's last framing,
  and reduced motion scrolls into view instead.
- **Exam fallback** — pass. `data-dg-exam` turns the camera and ambience off,
  removes student camera controls and calms node motion
  (`tests/react/exam.test.tsx`, `tests/core/exam-locks.test.ts`).
- **Figures inside tilted layers** — not demonstrable yet: figure renderers are
  M5 scope, so the camera capture shows zoom on real text but no figure depth.
  Tilt/dolly are applied to the backdrop and figure hooks, verified through the
  board CSS variables and the camera tests rather than a rendered figure.

Verification at this gate: `pnpm -s test` **608/608 tests, 55 files**;
`pnpm -s tsc --noEmit` clean; library and playground production builds green;
all seven captures regenerated from the clean build.

**Status: M4b complete, awaiting human approval before M5.**

## M4c — motion language, narration and transitions

Captures: `m4c-scene-1.png` … `m4c-scene-5.png` (headless Chromium, 1440×1200,
`/m4c?scene=0…4`). The five scenes replicate the reference's structure and
palette flips through protocol ops only: navy/SaaS hero, navy "Digital tools"
with an orbit diagram, paper "Momentum" count-up, paper typewriter headline with
caret, and paper closing line with pointer cue. They are stills, not a video.

Graded against §6.18, §11.3 and the M4c acceptance list:

- **Protocol only** — pass. `reference-saas-explainer.json`, `text-morph.json`,
  `scene-transitions.json`, `pointer-tour.json` and `lesson-turn-narration.json`
  carry no per-scene renderer code; the route slices the same fixture.
- **Narration beats, inline cue markers and reading pacing** — pass. Beat ids
  are cue ids, `[[cue:id]]` is parsed, duplicate ids raise `turn-invalid`, and
  unmatched pending cues raise `cue-orphan` then fire at turn end. Reading
  pacing schedules at 160 wpm and honours `lead`.
- **Scene transitions and midpoint mood flip** — pass. cut/fade/wipe/push/iris/
  morph are registered and rendered; the outgoing theme holds until midpoint.
  Unknown kinds report `transition-unknown` and fall back to fade.
- **New effects** (`tilt-rise`, `assemble`, `iris`), typewriter `caret`,
  keyed `morph` and `blur` support — pass in fixtures and kinetic tests. The
  `key` morph preserves unchanged words rather than diffing arbitrary DOM.
- **Pointer** — pass: dot/hand/arrow travel with ripple, `hide` clears, one per
  board. Not visible in the scene-5 still because the capture lands before the
  pointer beat; the cue is logged.
- **Orbit diagram, blueprint-grid/rings, glow, `night`/`paper`, drift camera** —
  schema, layout helper, presets, styles and unit tests pass. The orbit figure
  is drawn only from M5, so scenes 2 shows the heading/cue rather than a
  rendered orbit; no one-off placeholder was added.
- **Reduced motion** — pass by design: transitions collapse to cut, pointer
  becomes a static ring, drift is a no-op and kinetic effects settle instantly.
- **Exam restrictions** — pass by design/tests: transitions clamp to cut/fade,
  pointer is removed, camera and ambience are off; the existing exam tests cover
  the shared locks.
- **Performance** — **not formally verified at 60 fps.** No throttled profile
  was run for this milestone; the implementation animates transform/opacity and
  pointer schedules are timer-based, but the 60 fps requirement remains open
  for M8. Captures were taken at virtual-time budgets, which do not measure
  frame rate.
- **Storybook** — not present in the repository, so the "story per effect/
  transition/pointer" acceptance item is **not met**. This gap is recorded in
  DECISIONS and carried to M7 rather than claimed.
- **Visual polish** — the board title clips at the top of the playground
  container at 1440×1200; that is a host page height issue, not a board layout
  failure. Captures are otherwise legible and show the intended contrast.

Verification at this gate: `pnpm -s test` **641 tests / 55 files**; `tsc`
clean; library and playground production builds green; `/m4c` renders every
source and scene; all five captures regenerated from the clean build.

**Status: M4c implementation complete. Stopped at the Motion gate, awaiting
human approval before M4d. Known gaps: Storybook (M7) and formal 60 fps
measurement (M8).**

## M4d — tutor-addressable UI kit and shadcn parity

Captures: `m4d-kit.png`, `m4d-interactions.png`, `m4d-night.png`,
`m4d-narrow.png` (headless Chromium, raw CDP `Page.captureScreenshot`,
`/m4d` on the Next dev server at `localhost:3100`; desktop 1440×1200,
narrow 390×844). Verification used `localhost`, not `127.0.0.1`: Next 16 dev
blocks its `/_next` resources under the latter, so React never hydrates and the
board stays empty — a host/verification note, not a library defect.

Graded against the M4d acceptance list:

- **PARITY.md complete** — pass. `docs/components/PARITY.md` maps all 68
  components from the `https://ui.shadcn.com/docs/components` base-variant
  inventory (snapshot 2026-11-18) to Tutor / Host / Board / N-A, with a
  verification section and known gaps.
- **Blocks render from `ui-kit-blocks.json`, honour enter effects** — pass.
  The desktop capture shows all 12 block types (11 top-level nodes plus the
  nested card children) with their effects (`rise`, `pop`, `sweep`, `reveal`,
  `draw`, `count-up`, `wipe`). A few strings in `m4d-kit.png` are caught
  mid-stagger because the still lands while effects settle; `m4d-night.png`
  shows the settled board.
- **Blocks emit events** — pass. The interaction capture's event log shows
  `select` (`ui-carousel`, `ref: slide-two`), `action:dismiss` (`ui-alert`),
  and `action:toggle` (`ui-accordion`, `itemId: acc-two`, `open: true`).
  The Air tab was clicked by the script but produced no `select` in this run —
  a synthetic-`.click()` limitation with the Radix tabs trigger, not a product
  failure; the jsdom keyboard/pointer tests assert that event directly.
- **Hover becomes tap on touch** — pass. All interactive parts are real
  buttons with ≥44 px targets, and a new `@media (hover: none)` rule in
  `base.css` makes the card affordance persistent and adds `:active` feedback
  for dismiss/accordion/collapsible/carousel controls. Pinned by
  `tests/styles/base-css.test.ts`. `m4d-narrow.png` shows no hover-dependent
  affordance and `scrollWidth == clientWidth == 390` (no horizontal scroll).
- **Every component themable/replaceable, customization-surface + keyboard +
  screen-reader + axe pass** — pass in tests. `pnpm dg:component-docs`
  generated 24 component pages from metadata; the host-kit suite (8 tests)
  covers accordion/tabs/dialog/combobox/calendar/sidebar/command keyboard
  flows and axe (0 violations); the ui-kit suite (9 tests) covers events,
  enter triggers, override and axe. **Caveat:** this is automated jsdom/axe
  coverage, not a manual screen-reader pass; the M8 audit still owns that.
- **Single-component imports don't pull others; `ui` absent from core** —
  pass. `tests/build/tree-shaking.test.ts` (12 tests) verifies every `ui/`
  entry, leaf isolation, the composition graph, no `ui/` imports from
  core/schema/react, exports map and separated stylesheets. Measured gzip
  bytes for `dist/ui/button.js` are 397 vs. 8,002 for `ui/index`.
- **Sizes recorded** — pass with disclosure. `DECISIONS.md` records the
  measured table: index 82,592, react 66,785, core 50,637, ui/index 8,002;
  largest per-component chunks resizable 4,198, input-otp 4,113,
  dropdown-menu 3,716. Core and react **exceed** the 45 KB pre-lazy target
  from §13; that budget is not met at M4d and is carried into M8.

Verification at this gate: `pnpm lint` clean; `pnpm test` 59 files / 680 tests
passing (including the new touch-CSS test); library build emits all 54
`dist/ui/*` entries plus ESM/CJS/dts (the dts step needed a 2 GB heap on this
machine because the default 6 GB request was SIGTERM'd under memory pressure);
`/m4d` renders 11 nodes with event/error logs; four captures regenerated from
the live route.

**Status: M4d implementation complete. Known gaps carried forward: Storybook
stories (M7), formal 60 fps measurement and the pre-lazy bundle budget (M8),
manual screen-reader audit (M8).**
