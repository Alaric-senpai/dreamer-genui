# RECONCILE — v3.0 audit and plan for M4c to M9

**Status:** audit and implementation plan for the remaining `1.0.0` milestones. Written against `AGENTS.md` v3.0 (1404 lines), which supersedes v2.2 and every earlier brief. M0 to M4b are complete and approved and are **not** reopened; where v3 touches their output, the work is scheduled in the first remaining milestone that owns the area.

**Baseline:** `HEAD` is `f63d8d8` (`feat(playground): C5 layout and camera showcase`). The working tree contains the uncommitted removal of the unapproved `visibleNodeIds` prop (renderer-only; see §1.1), the copied reference video at `docs/reference/saas-explainer-reference.mp4`, and unrelated in-flight playground playback work by another session. The post-removal baseline is **604 tests across 54 files**, `tsc --noEmit` clean (verified after stripping `visibleNodeIds`); the playground build is re-checked before M4c starts.

**Consent:** the human granted conditional early consent: “i am giving earlier consent after reaching the ask point if the reconcile is true to the agents.md you are to proceed i will be away from console.” This document is the reconcile. If it is faithful, work proceeds into M4c without a separate RECONCILE approval; the **Motion gate (M4c), 3D showcase (M5b), Exam run-through (M6b), Voice sync gate (M6d) and the final `1.0.0` publish remain [ASK]**.

---

## 1. Baseline audit

### 1.1 The `visibleNodeIds` deviation (removed)

M4b shipped a `<Board visibleNodeIds>` render window that is not in v3.0 or any approved protocol. It has been stripped:

- `packages/dreamer-genui/src/react/board.tsx`: prop, visibility filtering in `orderedIds`/`pending`, live-announcer filtering, `onEnter` suppression, auto-camera filtering and memo dependency removed.
- `tests/react/viewport.test.tsx`: deleted.
- `DECISIONS.md`: the “M4b host render window” ruling removed.
- `apps/playground/app/(tailwind)/app/page.tsx`: the prop usage removed; that file also carries another session’s unrelated playback work and is not committed as part of this change.

No protocol, reducer or snapshot semantics change: `BoardState` never contained a window, so removal is renderer-only and returns the renderer to the brief.

### 1.2 Repository shape

| Area | Current shape | Gap against v3.0 |
| :--- | :--- | :--- |
| Version | `0.1.0` | Must become `1.0.0` at M9; rc on `next` first. |
| Licence | No `LICENSE`, no `THIRD_PARTY_NOTICES.md` | MIT licence files and dependency audit at M9. |
| Schema (`src/schema/`) | `assessment, blocks, common, connector, envelope, errors, events, figures, index, inline, json-schema, layout, model, motion, node, ops, question, theme` | Missing narration/turn, transition, pointer, `key`, cue `lead`, new effects, UI-kit blocks, `orbit`, glow, drift. |
| Core (`src/core/`) | `assessment, assets, cues, errors, events, generators, index, layout, middleware, model, mounted, persistence, plugin, profiles, reducer, registry, resolver, strings, theme, types, validator` | Missing transitions registry, cue lead/reading, end-of-turn flush, turn validation, tutor/voice registries. |
| Built-in plugins | No `src/plugins/` at all; `src/builtins/` and `src/figures/` are empty; preset code lives in `src/theme` and `src/motion` | Every §9.2 plugin is unbuilt: `math, code, table, chart, lottie, diagrams, labeled, model3d, scene3d, questions, assessment, ui-kit, transitions-default`, plus plugin folders for `themes-default, ambience-default, motion-default, layouts-default, icons-default`. |
| Registries (`core/plugin.ts`) | `blocks, marks, figures, questions, effects, layouts, moods, ambience, surfaces, themes, motionPresets, iconSets, assetPacks, modelConnectors, primitives, strings, renderers, middleware, profiles, devtoolsPanels` | Missing `transitions`, `tutorConnectors`, `voiceProviders`; `CORE_PLUGIN_NAMES` missing `ui-kit`, `transitions-default`, `strings-default` is present. |
| Default registry (`core/registry.ts`) | Registers only `CORE_BLOCK_PLUGIN, THEME_PLUGIN, MOTION_PLUGIN, LAYOUT_PLUGIN, PROFILES_PLUGIN, STRINGS_PLUGIN` | Must register the full §9.2 set lazily; built-ins must move to `src/plugins/` and dogfood the SDK. |
| Renderer (`src/react/`) | `anatomy, anatomy-meta, board, emit-context, headless, index, provider, store-context, use-board`; empty `components/`, `kinetic/`, `layout/`, `motion/` are populated | Missing transitions, pointer, morph, UI-kit blocks, figures, question widgets, voice/tutor UI. |
| Subpaths | `.`, `./schema`, `./schema/*`, `./core`, `./react`, `./headless`, `./devtools`, styles/Tailwind | Missing `./plugins/*`, `./packs/*`, `./connectors`, `./ui`, `./voice` (+ engines/providers), `./tutor`, `./server`, `./testing`. |
| Build | `tsup` single config; `files: ["dist","styles"]` | Needs entry points, lazy chunks, subpath size budgets, `sideEffects`, `"use client"` handling. |
| Playground routes | `/`, `/m1`–`/m4`, `/m4b`, `/showreel`, `/app`, `/plain-css` | Missing `/m4c`, `/m4d`, `/m5`, `/m5b`, `/m6a`–`/m6d`, `/m7`–`/m9`. |
| Fixtures | 50 files (38 valid, 12 invalid) | All v3 fixtures missing: narration/turn, text-morph, scene-transitions, pointer-tour, reference-saas-explainer, ui-kit-blocks, plus invalid orphan/duplicate beat/unknown transition/malformed turn. |
| Docs | `docs/components/*.md` for 12 core components; `docs/showreel/`; `docs/reference/` video | No Storybook, no `docs/authoring/`, no `docs/components/PARITY.md`, no 3D/voice/tutor guides, no API report. |
| Network | Core, schema and renderer perform no fetches | Correct; keep it that way. All network lands only in `connectors`, `tutor`, `server` and remote voice providers. |

### 1.3 What v3.0 adds on top of M4b

| Area | New in v3.0 | Scheduled |
| :--- | :--- | :--- |
| Narration | `Beat`, `LessonTurn`, `StudentTurn`, cue `lead`, `[[cue:id]]`, safety nets, reading pacing | M4c schema/core; M6d Conductor |
| Scene motion | `SceneTransition`, `update.transition`, `key`, `pointer` op, `tilt-rise`, `assemble`, `iris`, `caret`, `blur`, `drift`, `orbit`, `blueprint-grid`/`rings`, glow, `night`/`paper` | M4c |
| UI kit | shadcn-parity host kit + tutor-addressable blocks, Radix, `ui-kit` plugin, `dreamer-genui/ui` | M4d |
| Figures | Real figure runtimes and flowchart/timeline/labeled | M5 |
| 3D | Runtime, model connectors, model tools, mock registry | M5b |
| Content | Math, chart, table, Lottie, code plugins | M6a |
| Questions/assessment | Widgets and shell on the UI kit, 3D questions | M6b |
| Tutor | `TutorConnector`, HTTP/AI SDK/OpenAI-compatible adapters, server helper, eval harness | M6c |
| Voice | Narrator/Listener/Conductor, OSS engines, remote providers, captions, privacy | M6d |
| Static/offline | `toMarkdown`, `toHTML`, offline recipes | M7 |
| Release | MIT, notices, API report, provenance, rc/final publish | M8/M9 |

### 1.4 Reference study (Section 18)

`docs/reference/saas-explainer-reference.mp4` is the supplied 24.43 s, 1080×1920, 30 fps H.264/AAC file. Frames were extracted at 2 fps to `/tmp/opencode/ref-frames/` (49 frames), with a contact sheet and a nine-frame grid; the scene breakdown in §18 was verified visually.

**No offline speech-to-text tool is installed** (`whisper`, `whisper.cpp`, `faster-whisper`, Vosk and Whisper caches are absent). Narration transcription is therefore **not yet done**; visual timing is measured at 0.5 s frame precision. Exact word-to-visual lead will be measured in M6d with the chosen local engine and a forced-alignment pass, and the defaults below will be re-tuned at the Motion gate. This limitation is recorded in `DECISIONS.md`.

Observed visual timings (initial defaults for `motion-default`; all overridable):

| Behaviour | Observation | Proposed default |
| :--- | :--- | :--- |
| Headline rise with tilt | ~0.5–0.7 s, settles with slight overshoot | `tilt-rise` 620 ms, `overshoot` |
| Letter/word morph | ~1.0–1.3 s; accent letters persist | `morph` 700 ms; per-letter stagger 18 ms |
| Grid/guide draw | ~0.8 s, lines precede content | `draw` 800 ms, `smooth` |
| Icon cluster pop | 5–7 items, visibly staggered | `pop` 380 ms, stagger 60 ms |
| UI cards slide | Fast, slight motion blur | `push` 520 ms; blur peak ~6 px |
| Typed headline | ~1.4 s per short line with caret | 45–65 ms per grapheme, caret blink 900 ms |
| Hard cuts | Only three in 24 s | `cut` reserved; `fade`/motion default |
| Iris reveal | ~0.9–1.1 s from a point | `iris` 900 ms, origin point |
| Counter/rings | Rings expand ~0.9 s; badges orbit continuously | ring stagger 120 ms; orbit 18–24 s/rev |
| Pointer dot travel | ~0.5–0.7 s between words; small ripple on tap | travel 600 ms, ripple 400 ms |
| Scene length | ~4–6 s per idea | prompt-guide guidance |
| Cue lead (visual before word) | Visuals lead speech by roughly 0.1–0.3 s | `lead: 180 ms` (tune at M6d) |
| Drift camera | Slow continuous push over a static scene | 10 s, 1.0 → 1.06 scale |
| Palette flip | Navy/cyan ↔ light grey/blue at scene midpoint | transition `theme` applied at 50 % |

---

## 2. Cross-cutting foundations

These land incrementally in the milestone that first needs them; they are listed once here so no milestone silently forks the architecture.

### 2.1 Protocol and schema (`packages/dreamer-genui/src/schema/`)

- **New `narration.ts`:** `BeatSchema`, `LessonTurnSchema` (`v`, `ops`, `narration?`, `meta?`), `StudentTurnSchema`, `NarrationStateSchema` (`spokenUpTo`, `interrupted`). `ReplySchema` becomes an alias of `LessonTurnSchema`; existing `{v, ops}` replies remain valid.
- **`ops.ts`:** `replace.transition`, `update.transition`, `pointer` op, cue `lead`.
- **`motion.ts`:** new effect names (`tilt-rise`, `assemble`, `iris`), `caret`, `blur`, camera preset `drift`.
- **`node.ts` / `inline.ts`:** `key?: string` on nodes and marks; `speakable?: boolean`; richer `term.detail`.
- **`blocks.ts`:** UI-kit block schemas (M4d).
- **`figures.ts`:** `orbit` diagram layout (M4c schema; M5 rendering).
- **`theme.ts`:** `texture.glow`, density/typography additions for `night`/`paper`.
- **`errors.ts`:** `cue-orphan`, `turn-invalid`, `tutor-connector-error`, `voice-error`, `voice-unsupported`, `transition-unknown`.
- **`json-schema.ts`:** registry-aware export must include transitions, new effects, UI-kit blocks and narration; profiles must exclude disabled plugins.
- Every change is additive at `v: 1` and logged in `DECISIONS.md`.

### 2.2 Registries and plugins

- `RegistryKind` gains `transitions`, `tutorConnectors`, `voiceProviders`; `REGISTRY_KINDS`, `RegistryValueMap`, `KIND_ORDER`, `provides` typing and `providedNames` follow.
- Helpers: `defineTransition`, `defineTutorConnector`, `defineVoiceProvider`.
- `CORE_PLUGIN_NAMES` and reserved names gain `ui-kit`, `transitions-default`; existing names stay reserved.
- Built-in plugin folders move to `src/plugins/<name>/` with `manifest` (schema/metadata/prompt guide, always loaded) and lazy `load: () => import(...)` implementations. Preset code moves behind `themes-default`, `ambience-default`, `motion-default`, `layouts-default`, `icons-default`, `strings-default`.
- `DEFAULT_PLUGINS` becomes the full §9.2 set, lazily. `model3d` is registered but not advertised without a connector.
- Conformance suite and customization-surface test must run against every built-in plugin from M6a onward; the CI import-boundary check forbids `src/plugins/**` importing private core internals.

### 2.3 Exports and build

Target exports (additions only; existing paths unchanged):

| Subpath | Owner milestone |
| :--- | :--- |
| `./plugins/*` | M6a (content), M5/M5b (figures/3D), M4d (`ui-kit`) |
| `./packs/*` | M5b (`packs/starter` demo model) |
| `./connectors` | M5b (network-capable, opt-in) |
| `./ui` | M4d |
| `./voice`, `./voice/engines/*`, `./voice/providers/*` | M6d |
| `./tutor` | M6c |
| `./server` | M6c |
| `./testing` | M7 (published test utilities) |

`tsup` gains entry points and lazy chunking; `package.json` gains `sideEffects` for CSS, explicit `types`, `engines`, optional peers (`ai`, `openai`, `tailwind-merge`), and per-subpath size limits at M8/M9. `"use client"` boundaries are handled in the build, not by hand-editing dist.

### 2.4 Fixtures and tests

- All new fixtures are authored in the milestone that implements them; invalid fixtures assert exact error codes.
- Test suites: schema snapshots, reducer/ops, cue lead/reading/flush, transitions (midpoint theme, exam restriction), pointer travel/reduced motion, keyed morph, UI-kit interactions, figures/flowchart layout, 3D connectors and fallbacks, question kinds and assessment, tutor connectors, Conductor with `FakeVoice`, static render, SSR, axe, tree-shaking, size budgets.
- Every visual component gets a Storybook story and `docs/components/<name>.md` generated from metadata.

### 2.5 Network, privacy and genericity

- Core, schema, `ui` and renderer never fetch. `connectors`, `tutor`, `server`, remote voice providers and voice-engine weight loading are the only network code, each opt-in and host-configured.
- No analytics or telemetry anywhere. Voice defaults: local processing, `allowRemoteAudio: false`, `retainAudio: false`.
- No subject, curriculum, exam board, voice vendor or product names in `packages/`; example content lives only in fixtures, presets and docs.
- No model weights in the npm package.

---

## 3. M4c — Motion language upgrade

**Goal:** make the board feel like the reference video: scene transitions, keyed text morph/assemble, a travelling pointer, structural decor, glow, drift camera, and cue timing that can follow narration. Route `/m4c`; Motion gate at the end.

**Existing pieces:** effect presets in `src/motion/presets.ts`; kinetic text in `src/react/kinetic/`; ambience particles in `src/ambience/particles.ts`; camera in `src/react/motion/` and `board.tsx`; cue engine in `src/core/cues.ts`/`resolver.ts`; theme tokens in `src/theme/`.

**Schema**
- `Beat`, `LessonTurn`, `StudentTurn`, narration state, `[[cue:id]]` marker parsing (strip before display/synthesis).
- `SceneTransition` on `replace`; `update.transition` (`morph | fade | none`); `key` on nodes and marks.
- `pointer` op with `to: NodeRef | "hide"`, `style`, `trigger`, `duration`, `ease`.
- `lead` on cue triggers; `reading` pacing enum.
- Effects `tilt-rise`, `assemble`, `iris`; `caret`, `blur`; `diagram.layout: "orbit"`; `texture.glow`; camera preset `drift`; new error codes.
- JSON Schema, prompt guide (pacing, pointer, transitions, one-idea scenes, narration beats) and `serializeBoard` (`spokenUpTo`, pending cues, scene title/keys).

**Core**
- Cue engine: `lead` offsets, beat-level fallback, orphan detection (`cue-orphan`), end-of-turn flush after the last beat or `maxWaitMs`, reading-speed estimation from beat text.
- `pacing: "reading"` timing source with a configurable words-per-minute default and deterministic tests.
- Transition registry and resolution: unknown kind → `transition-unknown` and `fade`; exam mode only `cut`/`fade`; midpoint theme flip.
- Pointer is transient presentation state, **not** `BoardState`: a pointer bus/state slice outside snapshots, replayable from the ops log; one pointer per board; hide on replace/back.
- Text morph support: keyed span matching is core-adjacent (a pure matcher that returns old→new pairs); rendering is React.
- `serializeBoard` and prompt guide updated; no new network.

**Renderer/plugins**
- `transitions-default` plugin with `cut, fade, wipe, push, iris, morph`; shared-layout-style morph for matching keys, cross-fade for the rest; FLIP/`motion` layout animation; reduced motion → instant; mid-transition theme applied without a flash.
- `motion-default` gains the new effects, caret typewriter, cheap velocity blur (CSS filter/transform approximation; disabled for reduced motion, low-end devices and exam mode), and the measured timings above.
- Text morph/assemble: grapheme-safe split (Intl.Segmenter), keyed spans, persistent accent spans, `aria-live` output stable during morph, DOM text remains selectable and screen-reader correct at rest.
- Pointer renderer: dot/hand/arrow from tokens, eased travel, ripple tap, `data-dg-part`, reduced-motion highlight ring, exam off, pointer hidden on scroll/narrow fallback if it would obscure content.
- `orbit` layout: pure ring-placement algorithm + schema; diagram rendering itself lands in M5. M4c tests the algorithm and registers the layout name so `diagram` can use it later.
- `ambience-default`: `blueprint-grid` (SVG/CSS guide lines drawn on) and `rings` (structural, slow), with lite mode and static reduced-motion; frame-budget tests.
- Glow token applied to accent text/borders/figures; `night` and `paper` example moods (navy/cyan, light grey/blue) with strong weight contrast and a light italic secondary face.
- `drift` camera preset: slow continuous push-in within bounds; pauses offscreen/hidden; reduced motion → none; exam off.
- Showreel v2: five reference-like scenes authored **only** in protocol ops, driven by the mock narrator cue timeline; no one-off renderer code.

**Fixtures/tests**
- Valid: `lesson-turn-narration.json`, `text-morph.json`, `scene-transitions.json`, `pointer-tour.json`, `reference-saas-explainer.json`.
- Invalid: `invalid-cue-orphan.json`, `invalid-duplicate-beat.json`, `invalid-unknown-transition.json`, `invalid-malformed-turn.json`.
- Tests: turn parsing/validation; marker stripping; cue lead/reading/flush; transition kinds + midpoint theme + exam restriction; keyed morph matching; pointer travel/ripple/reduced motion/exam; drift bounds; orbit placement; glow contrast; showreel fixture snapshot.

**Risks**
- Text morph and assemble are the highest-complexity renderer work: keyed span matching, RTL/grapheme safety, stable accessibility. Mitigation: start with word-level morph, then letters; fall back to a cross-fade when matching is ambiguous.
- Cross-browser shared-layout animation (View Transitions vs FLIP) must be chosen and recorded; Safari behaviour needs explicit tests.
- Blur can be expensive; keep it optional and device-gated.
- Pointer and camera can fight for attention; enforce one focal point and pointer visibility rules.
- Exact cue lead cannot be measured until M6d (no STT now); default 180 ms is provisional and must be re-tuned at the gate.

**Gate:** side-by-side capture against the reference in `docs/showreel/`, `SELF_REVIEW.md` honesty pass, 60 fps throttled profile, all §11.3 items. **STOP for human approval.**

---

## 4. M4d — UI kit (shadcn parity)

**Goal:** a token-themed, density-aware, tap-first UI kit with shadcn capability parity: a host-only kit and a tutor-addressable block subset. Route `/m4d`.

**Existing pieces:** component anatomy in `src/react/anatomy*` and `COMPONENT_META`; tokens/density in `src/theme`; strings registry; existing question/assessment state machines that will consume the kit later.

**Inventory**
- Snapshot the current shadcn/ui component list from its documentation into `docs/components/PARITY.md` with, per component: board counterpart, status (`tutor-addressable`, `host-only`, `not applicable` + reason), notes.
- Tutor-addressable: `card`, `alert`, `accordion`, `collapsible`, `tabs`, `badge`, `progress`, `counter`, `avatar`, `separator`, `carousel`, `kbd`, plus `term` tooltip/hover card.
- Host-only: button, input, textarea, select, checkbox, radio group, switch, slider, label, form, dialog, alert dialog, sheet, drawer, popover, dropdown/context menu, command/combobox, navigation menu, menubar, breadcrumb, pagination, calendar/date picker, resizable, scroll area, sidebar, toast, spinner, empty, input OTP, toggle/toggle group, aspect ratio, typography, and the remainder of the inventory.

**Implementation**
- Radix primitives (confirmed in DECISIONS; deviation only with justification), tree-shakeable per component; no Tailwind dependency; plain CSS in `@layer dreamer-genui` using `--dg-*` (including component tokens).
- `src/ui/` components with metadata, parts, `data-dg-*`, `classNames`/`styles`, replaceable through `components`, RTL-safe, density-aware (≥44 px default, ≥56 px at `large`), focus-visible, keyboard and screen-reader complete.
- Tutor blocks registered by the default `ui-kit` plugin with schemas, prompt guides, fallbacks and nested `blocks`; `enter`/triggers/slots; events: accordion/collapsible `action: "toggle"`, tabs/carousel `select`, interactive card `select`.
- Animated `progress` and `counter` (cue-driven); `term` tooltip/hover card with real text, not raw HTML.
- `dreamer-genui/ui` subpath, individually importable; `ui` must not appear in the core bundle.
- Stories per component (mood/density/RTL variants), axe and keyboard tests, customization-surface test, tree-shaking test.

**Fixtures/tests:** `ui-kit-blocks.json`; interaction tests per tutor block; size report per component; docs generated.

**Risks:** Radix version drift and accessibility regressions; bundle growth from a broad host kit (mitigated by per-component exports and size budgets); shadcn inventory changes over time (the parity doc is a dated snapshot); density tokens interacting with existing layout spacing.

---

## 5. M5 — Figures

**Goal:** real figure runtimes replacing the alt-only shell: icons, images, diagrams (tree/radial/orbit/cycle), flowcharts, timelines, `compare`, labeled art, annotation strokes, charts deferred to M6a.

**Existing pieces:** figure schemas in `src/schema/figures.ts`; `resolveAsset` in `core/assets.ts`; empty `src/figures/`; no GSAP/d3 dependency yet.

**Implementation**
- `diagrams` plugin: `d3-hierarchy` for tree/radial (lazy), in-repo orbit/cycle layout; sequential reveal, focusable nodes, text summaries, alt fallback.
- `flowchart`: choose dagre or elkjs (record why in DECISIONS), layered layout with decisions, labelled branches, back-edges/recycle loops, inputs/outputs, lanes, numbering, pulse flow; narrow `stepper`/`compact` modes with camera follow; lazy layout chunk.
- `timeline` (horizontal/vertical), `compare` block, `labeled` asset packs with part highlighting/hotspots, image/icon with asset resolver.
- Annotation primitives: hand-drawn SVG strokes (circle/underline/box/bracket/strike) reused by `attach.target.annotate`; GSAP draw-on, lazy chunk.
- Figure error boundaries: any failure renders `alt` plus a text summary.
- Prompt guide/capabilities per figure; registry metadata; generated docs and stories.

**Acceptance:** every kind renders from fixtures; `process-flowchart.json` draws sequentially with a decision and recycle loop on a phone, focusable steps emit `focus`; GSAP/flowchart/ambience are not in the initial bundle; forced failure shows alt; figures respect layout regions.

**Risks:** flowchart layout quality (back-edges, long labels) is the main risk; phone legibility; GSAP licensing (verify and record); large fixture surface.

---

## 6. M5b — 3D figures and the Model Connector

**Goal:** `model3d` and `scene3d` runtimes plus the connector contract and tutor model tools. Route `/m5b`; 3D showcase gate.

**Existing pieces:** complete `ModelManifest`, `ModelConnector`, `ModelSummary`, `model3d`/`scene3d` schemas and validation tests (M4b); no runtime, no `src/connectors/`.

**Implementation**
- Lazy `three` chunk with GLTFLoader, Draco/Meshopt/KTX2 decoders bundled locally; thin in-repo wrapper for named-part picking, views, highlight/dim/isolate/explode/cutaway, tweened camera, HTML labels, flow paths, clips, LOD selection, poster, disposal, render-on-demand, pixel-ratio cap, context limit (1–2 live figures) and snapshot freezing.
- Student controls: orbit/pinch/pan, keyboard, views bar, reset; token-driven materials/lighting; WebGL-unavailable fallback (poster + alt + parts list); `focus` events with `figureId/partId`.
- `scene3d` primitives, `place`/`arrange`, limits, shared runtime.
- `src/connectors/`: `createStaticModelConnector`, `createHttpModelConnector`, `withModelCache`, `withPrefetch`, `defineModelPack`; allowed origins, budgets, signed-URL retry, validation to `ModelManifest`, offline cache.
- `getModelTools`/`getModelContext` completed; `serializeBoard` lists models in use; prompt guide tells the tutor to use only returned ids.
- `dg:model-check <glb> <manifest>` in `tools/`.
- Playground `/api/mock-models` with a tiny bundled demo model, connector switcher (static/HTTP/cached), model tour demo.

**Acceptance:** `model3d-basic.json` and `model3d-tour.json` load identically through static and HTTP connectors; poster first; tour syncs views/highlights/isolate/labels with mock cues; part taps emit focus; unknown part/view/model degrade gracefully; WebGL fallback; offline cache; three.js not in initial bundle; idle renders no frames; smooth orbit throttled; `scene3d-solids.json`; conformance passes.

**Risks:** 3D performance and GPU memory on low-end Android; decoder WASM size; signed-URL refresh; accessibility of canvas content; the demo model licence and size.

---

## 7. M6a — Content built-ins

**Goal:** `math`, `chart`, `table`, `lottie`, `code` as lazy default plugins built only with the public SDK.

**Existing pieces:** block schemas exist; no plugin folders or runtimes.

**Implementation**
- `math`: KaTeX + mhchem, block and inline, `trust: false`, lazy CSS bundled with the chunk.
- `chart`: d3-scale/d3-shape SVG, bar/line/pie/scatter, text summary and alt.
- `table`: column/row highlight, focusable cells, responsive overflow.
- `lottie`: light expression-free player (choose and record), asset resolver, alt fallback.
- `code`: lightweight lazy highlighter, default languages recorded, copy control (host string from strings registry).
- Each plugin: manifest + lazy implementation + prompt guide + parts/tokens + conformance suite; disable/override tests; unknown-type fallback when disabled.

**Risks:** dependency licences and bundle size; Lottie player behaviour; KaTeX CSS isolation; charts on narrow screens.

---

## 8. M6b — Questions and assessment

**Goal:** question widgets and the assessment shell on the UI kit, plus 3D hotspot/label questions. Route `/m6b`; Exam run-through gate.

**Existing pieces:** complete question/assessment schemas, `core/assessment.ts` state machine, exam-lock resolver and board enforcement, fixtures for kinds/practice/exam/review.

**Implementation**
- `questions` plugin: mcq, truefalse, short, numeric, cloze (`blank` mark), matching, ordering, hotspot, labelDiagram, extended; flashcards; hint ladder; status/feedback animation; keyboard equivalents for all drag interactions; screen-reader labelling and live regions.
- `assessment` plugin: shell (title/instructions/timer/navigator/sections/marks/flag/submit confirm), modes practice/quiz/exam/review, review driven by `update` ops, local-first autosave/restore, host API, `onAssessmentState`, distraction-free presentation.
- 3D questions: raycast part picking and part-id answers, accessible parts list as the keyboard path.
- Prompt guide/assessment profile; host UI strings from the registry.
- Playground exam simulator.

**Acceptance:** fixtures work end to end; timer survives reload; answers restore; exam payload keys rejected; no feedback before review; all kinds keyboard/screen-reader operable; 3D hotspot and label-drag work; conformance.

**Risks:** drag accessibility is the main risk; timer/clock edge cases; large UI surface; interaction with exam locks and voice silence (M6d).

---

## 9. M6c — Tutor connectors and server helper

**Goal:** any tutor, same `LessonTurn` stream. Route `/m6c`.

**Implementation**
- `TutorConnector` and `defineTutorConnector` in the registry; `src/tutor/`:
  - `createHttpTutorConnector` with `toRequest`/`fromResponse` for legacy/platform APIs, SSE/NDJSON parsing, abort, retry/backoff.
  - `createAiSdkTutorConnector` (verify supported AI SDK majors; record).
  - `createOpenAICompatibleTutorConnector` (JSON-schema structured output or tool calling; browser requires proxy/token).
- `src/server/` `createLessonHandler`: prompt assembly from `getSystemPromptGuide`, `serializeBoard`, capabilities, `spokenUpTo`, model tools; streams `LessonTurn`; validates every op, bounded repair/retry, limits, untrusted-content delimiting, prompt-injection defence, trace hooks, server-only credentials.
- `dg:tutor-eval` harness with mock model and validity report.
- Playground mock endpoints for all three connectors, including a legacy-shaped API and a server-helper model path.

**Acceptance:** identical fixtures through all connectors; invalid ops repaired/dropped with report; works in a Next.js route; credentials never client-side; injection tests pass; eval runs; network only in opt-in subpaths.

**Risks:** AI SDK API churn; streaming parser differences; repair policy correctness (never mask protocol bugs); server helper becoming a de-facto backend (keep it optional and generic).

---

## 10. M6d — Voice and the Conductor

**Goal:** narration and board cues in lockstep, local-first, with graceful degradation. Route `/m6d`; Voice sync gate.

**Implementation**
- `src/voice/`: `Narrator`, `Listener`, `Conductor`/`useConductor`, `<VoiceControls>`, `<Captions>`, `<SpeakButton>`, `speakable`; `defineVoiceProvider`; TTS/STT/VAD interfaces; `RealtimeVoiceAdapter` interface only (reference adapter is [ASK]).
- Engines:
  - Web Speech default fallback.
  - **OSS TTS: Piper** (MIT code; per-voice licences recorded; ONNX/WASM; host `modelBaseUrl`, size consent, Cache API; Kiswahili voice availability investigated and documented — if none is usable, document the gap and fall back to Web Speech for `sw`).
  - **OSS STT: Whisper via Transformers.js** (Apache-2.0 code, MIT weights; multilingual incl. Swahili; host-hosted quantized model; consented download and cache).
  - **VAD: Silero VAD** (MIT; WASM/ONNX; host assets).
  - Remote opt-in: OpenAI-compatible TTS and ElevenLabs (alignment timestamps when present); credentials via host token/proxy.
- Conductor: speak beat 1 on completion; prefetch ~2 beats; schedule cues on the audio clock with `lead`; beat/aligned/estimated/reading modes; `[[cue:id]]` markers; barge-in/interrupt; `spokenUpTo`/`interrupted` into the next `StudentTurn`; pause/resume/replay/skip/speed 0.75–1.5×; captions with word highlight; turn-taking push-to-talk default; autoplay gesture; permission UX; degradation chain; privacy defaults; exam silent except `readAloud`.
- `FakeVoice` and cue-timeline tests with a fake audio clock; per-engine Kiswahili behaviour in docs/DECISIONS.
- Playground voice demo with scripted timings and a real local engine where available.

**Acceptance:** cues land within documented tolerance on the audio clock; first beat speaks before the turn finishes; barge-in and `spokenUpTo`; fallback chain; remote audio blocked by default; permission/autoplay flows; Kiswahili documented; no weights in the package; budgets; exam silent.

**Risks:** engine download size and low-end performance; Safari/Web Audio quirks; voice quality and Swahili coverage; autoplay policies; microphone permission UX; flaky audio tests (use fake clock and deterministic fixtures); remote provider terms.

**Gate:** capture of a narrated lesson with cues landing on beats. **STOP for human approval.**

---

## 11. M7 — Playground, tooling and docs

**Goal:** a coherent developer experience: every route, fixture picker, JSON editor, mock tutor/narrator, exam simulator, showreel, layout/3D/voice showcases, Storybook, templates, authoring docs, static render.

**Implementation**
- `/` index plus polished `/m1`–`/m9` routes with consistent checklist panels and links to tests; keep earlier routes as regression pages.
- JSON editor → live board, fixture picker scoped per milestone, theme/mood/ambience/layout/density switchers, mock tutor and cue timeline UI, exam simulator, event/error/cue logs.
- `<BoardControls>` (skip, replay beat, back, progress dots) customizable.
- Devtools overlay final pass with plugin panels; published testing utilities, conformance suite, `pnpm dg:plugin-check`; templates (plugin, theme, mood+ambience).
- Storybook story per component and fixture (mood/layout/density variants).
- `toMarkdown`/`toHTML`, offline recipes, docs/authoring for every recipe (including 3D and connector authoring, tutor integration), README.
- Versioned docs for voice engines, model weights, permissions and privacy.

**Risks:** docs scope is large; Storybook adds build time; playground can drift from the library — keep demos fixture-driven.

---

## 12. M8 — Hardening

**Goal:** prove the quality bars before release.

- Accessibility: axe plus manual screen-reader/keyboard passes (board, exam, UI kit, 3D parts list, voice controls).
- Performance: CPU-throttled low-end profile, 3D memory/context behaviour, voice load time and real-time factor, ambience frame budget, mounted-node cap.
- Privacy review: audio handling, consent, retention, remote-provider gating.
- Bundle audit: per-subpath budgets, tree-shaking, no core escalation.
- SSR/RSC, browser matrix (current Android Chrome, Samsung Internet, Safari iOS, last ~3 years; no Opera Mini), security review (CSP, sanitization, limits, plugin boundaries), API freeze, `migrate()` coverage.
- Clean-room installs in fresh Next.js (Tailwind and non-Tailwind) and Vite apps.

**Risks:** low-end 3D/voice performance may force budget or engine changes; API freeze may surface naming issues (resolve before M9).

---

## 13. M9 — Release candidate and 1.0.0

**Goal:** publish `dreamer-genui@1.0.0` under MIT, with the human approving the final `latest` tag.

- `LICENSE` (MIT), `THIRD_PARTY_NOTICES.md` (runtime deps, fonts/icons/assets, demo model, voice engines and weights), GSAP/voice licences verified.
- API report checked in and diffed; exports map, `files`, `sideEffects`, ESM/CJS, `"use client"`, types/source maps, `engines`, optional peers, size limits.
- Provenance-enabled CI; lint/typecheck/unit/e2e/axe/size/licence/build matrix; Changesets and changelog.
- Publish `1.0.0-rc.1` on `next`, clean-room installs, iterate `rc.N`; final `1.0.0` on `latest` only with explicit human approval.
- `/m9` release checklist; README, Storybook, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, compatibility matrix.

**Risks:** npm name availability (ASK if unavailable); trusted publishing setup; final size/licence gate; release timing.

---

## 14. Fixture matrix (v3 additions)

| Fixture | Milestone | Purpose |
| :--- | :--- | :--- |
| `lesson-turn-narration.json` | M4c | Beats + ops, beat ids as cues, inline markers |
| `text-morph.json` | M4c | Keyed spans, morph/assemble, caret |
| `scene-transitions.json` | M4c | cut/fade/wipe/push/iris/morph + midpoint theme |
| `pointer-tour.json` | M4c | Pointer travel, tap ripple, hide |
| `reference-saas-explainer.json` | M4c | Five-scene reference replication, ops only |
| `ui-kit-blocks.json` | M4d | Every tutor-addressable block and event |
| `invalid-cue-orphan.json` | M4c | `cue-orphan` |
| `invalid-duplicate-beat.json` | M4c | `turn-invalid` |
| `invalid-unknown-transition.json` | M4c | `transition-unknown` |
| `invalid-malformed-turn.json` | M4c | `turn-invalid` |

Existing fixtures (`process-flowchart`, `diagram-*`, `timeline`, `compare`, `labeled-art`, `model3d-*`, `scene3d-solids`, `question-kinds`, `assessment-*`, `flashcards`) become **rendering** fixtures in M5–M6b; until then they validate only. This is expected and tracked per route.

---

## 15. Decision queue

Recorded as work lands (all in `DECISIONS.md`):

- Transition implementation (FLIP vs View Transitions), morph matching rules, blur approximation and device gate.
- Cue lead default (provisional 180 ms) and reading-speed default; re-measured at M6d.
- Pointer state placement (transient bus, not `BoardState`).
- Radix confirmation, shadcn inventory date, UI-kit per-component size budget.
- Flowchart engine (dagre vs elkjs) with justification.
- Lottie player, code highlighter and default languages; icon set licence.
- GSAP licence verification; browserslist; ambience lite-mode detection; visual regression tooling.
- 3D wrapper, decoder hosting, picking, label occlusion, context strategy, connector cache/manifest versioning.
- Voice engines and licences, weight hosting/cache, Kiswahili coverage, AI SDK majors, structured-output strategy, repair/retry policy, release tooling.
- Every protocol deviation, however small.

**ASK points:** Motion gate (M4c), 3D showcase (M5b), Exam run-through (M6b), Voice sync gate (M6d), final publish (M9), plus the §15.3 optional items (opt-in first-party plugins, model-prep/eject CLIs, realtime speech-to-speech reference adapter) if they ever come up.

---

## 16. Execution order and gates

1. Commit the `visibleNodeIds` removal (library-only files) and the reference copy.
2. M4c: protocol → cue engine → transition/pointer/morph → decor/glow/moods/drift → showreel v2 → `/m4c` → tests/build → **Motion gate [ASK]**.
3. M4d → `/m4d`.
4. M5 → `/m5`.
5. M5b → `/m5b` → **3D showcase gate [ASK]**.
6. M6a → `/m6a`.
7. M6b → `/m6b` → **Exam run-through gate [ASK]**.
8. M6c → `/m6c`.
9. M6d → `/m6d` → **Voice sync gate [ASK]**.
10. M7 → all routes, Storybook, docs.
11. M8 → hardening audits.
12. M9 → rc, clean-room installs, **final publish approval [ASK]**.

Each milestone commits separately, keeps `tsc --noEmit`, the full test suite and the playground build green, and fills its acceptance checklist on its route. Completed milestones (M0–M4b) are not modified except where a later milestone explicitly owns the change (for example moving presets behind plugins in M6a, or adding registry kinds in M4c/M6c/M6d).
