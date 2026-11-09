# AUDIT.md — dreamer-genui against AGENTS.md v2

*M0 deliverable, 2026-11-09. Audited at commit `a5d8030` (old-brief M3) + uncommitted reviewer-round-1 fixes.*

## 0. Build state snapshot

The old brief (v1) milestones M1 (protocol), M2 (core), M3 (renderer) are complete and reviewer-approved (`c7b82b0`…`3f7c464`, plus `a5d8030`). Current tree additionally contains **unfinished reviewer-fix work** (multi-select state, board→sink event/error bridge, id-keyed live announcer, provider memoization): all tests pass (**176/176**), `tsc --noEmit` for the library is clean, the library builds, but:

- The **playwright playground does not type-check** (`app/layout.tsx` line 19 has a comma-operator-in-JSX error). The layout was hand-edited with Montserrat/JetBrains Mono variable fonts (`apps/playground/fonts/`, commented-out ThemeProvider shell). This is a work-in-progress host edit, not a library defect; the audit treats it as input to the theming work (host font choices), not something to silently overwrite.
- The reviewer fixes are **uncommitted**. Before any v2 remediation, they should be committed as-is (no new design change assumed).

Honest overall verdict against v2: the **protocol/core skeleton is sound and largely reusable**, but the build **fails §9 (Art & Motion Direction) and §7.6 (styling architecture) almost completely**, and the cue/trigger/theme/camera/ambience domains **do not exist**. The protocol must be migrated in place (breaking-internal, versioned) rather than rebuilt.

## 1. Section-by-section audit

| § | Finding | State |
| :--- | :--- | :--- |
| §1 Mission | Ops-in/events-out works end-to-end. "Cues in, enter-notifications out" missing. Visual result is an unstyled column — fails the mission bar. | partial |
| §2 Principles | 1,2,4,5,6 ✓ (registry, fallback, sanitization-free, light). 3 (relevance-gated) ✗ — content mounts on arrival. 7 partial (default-overridable via registry, but no theme/mood system). 8 (delightful) ✗. | partial |
| §3 Scope ops | `append`/`attach`/`replace`/`update`/`remove` ✓ (validated, reducer-tested). **`theme` op ✗, `camera` op ✗.** `attach.theme` / `replace.theme` ✗ `scope` ✗. | partial |
| §3 Triggers | **No trigger concept at all.** Nodes mount on arrival; no `cue`/`after`/`event`/`start`, no `firedCues`, no `pacing`, no `flush`/`seek`, no `onEnter`/`onEntered`/`onCue`. | missing |
| §3 Blocks | All 9 block schemas exist; text renders + choices/callout/steps/group render, figure/table/math/code validated-but-fallback (correct per M5/M6 deferral). **Text variants `hero`/`kicker`/`quote` ✗.** Steps per-item `enter`/trigger ✗ (block-level only). | partial |
| §3 Marks | All 6 marks render. **Mark-level `enter` (with trigger) ✗** — MotionFields only (order/delay/duration, no effect). ColorToken lacks `ink`. | partial |
| §3 Motion | Enter effects: reveal/rise/pop/sweep/draw/stagger/none ✓ (7 of 16). **`typewriter` `words` `chars` `slam` `wipe` `scribble` `zoom` `count-up` `morph` ✗.** Emphasis: pulse/glow/underline ✓; **`shake` `bounce` `wobble` ✗**. Exit: fade/shrink ✓, **`wipe-out` ✗**. **`EaseName` enum ✗** (easings inline in driver). No central presets table — values scattered in driver.ts. Camera ✗. Reduced-motion global fallback ✓ (instant plain-div path, tested). | partial |
| §3 Theme engine | Static `lightTheme`/`darkTheme` + `resolveTheme` CSS-variables on the provider root. **No ThemeSpec, no moods, no `theme` op, no policy, no contrast guardrail, no transitions, no scoping, no `onThemeChange`, no font allowlist, no ambience hookup.** | missing |
| §3 Ambience | **Missing entirely.** | missing |
| §3 Styling | **Fails §7.6.** No compiled CSS, no `@layer dreamer-genui`, all styling is inline `style` props + semantic class names, tokens named `--dgui-*` (v2 mandates `--dg-*`). No Tailwind bridge/preset, no `tailwind-merge` slot merging, no `data-dg-*` state attributes (has ad-hoc `data-node-id`, `data-color`). | missing |
| §3 Streaming | Idempotent partials ✓ (ledger+djb2, tested). "Node enters when complete AND triggered" ✗ (arrival = entered). Streaming skeleton never shown (nothing renders partial nodes) — acceptable under v2 only if trigger logic added. | partial |
| §3 Plugin system | Registry manifest/loader split ✓, built-ins registered-lazy policy in manifests (loader hooks lazy). Moods/ambience/surfaces **not** registry entries. Asset packs not yet (M5). | partial |
| §3 Out-of-scope | No audio/network/telemetry/runtime-URL-loading. ✓ (nothing to remove) | ok |
| §4 Stack | TS strict ✓, Zod ✓, Motion+LazyMotion strict ✓, React 19 ✓, pnpm+tsup ✓, Vitest+TestingLibrary+jest-axe ✓ (Storybook absent — was deferred to M7, still pending). GSAP not added yet (M5 — licence check pending). **Styling stack violated (see §7.6).** `tailwind-merge` optional peer ✗. | partial |
| §5 Layout | `src/schema`, `core/`, `react/`, `theme/` (tokens only) ✓. **`src/ambience/`, `src/styles/`, `figures/`, `builtins/` dirs ✗** (builtins manifests live inside core registry — rework target). Exports for `themes/*`, `styles.css`, `tailwind.css`, `tailwind-preset` ✗. `docs/reference/` pending (human, v3). AUDIT.md = this file. | partial |
| §6.1 Ops | Covered above (theme/camera ✗; unknown keys: currently validator strips unknown keys? — must confirm and make "ignore with warning" explicit). `NodeRef` parent/item refs ✓ (`resolveNodeRef`). | partial |
| §6.2 Triggers | ✗ (covered above). `split` field ✗. | missing |
| §6.3 Cue semantics | ✗ entirely: no cue ids, no fired-set, no race handling, no flush/seek, no cycles, no notifications. The current live region (id-keyed announcer, announces newest *rendered* node) will need re-keying to *entered* nodes and to survive unmounted content. | missing |
| §6.4 Blocks | Covered (hero/kicker/quote ✗, steps item enter ✗). Prompt guide currently teaches v1 usage; **beats/one-idea-per-cue instructions ✗**. | partial |
| §6.5 Marks | Covered (mark enter ✗, `ink` ✗). The term-anchors-to-itself ruling stays valid. | partial |
| §6.6 Figures | Schema mostly matches (diagram node.enter ✗). Rendering is FallbackView everywhere (correct deferral to M5). | partial |
| §6.7 Motion | Covered above. Reduced-motion fallbacks exist per driver (instant) but presets are not tabulated. | partial |
| §6.8 ThemeSpec | ✗ entirely (covered above). Existing tokens feed into this — the `--dgui-*` set maps naturally onto the planned `--dg-*` set, but v2's token structure (color.*, font.*, radius.*, space, motion, texture) is richer: texture, tempo multiplier and display/body/mono font aliases are new. | missing |
| §6.9 Ambience | ✗. Existing live-region/jest-axe tests give the right a11y harness for "never below content". | missing |
| §6.10 Camera | ✗. Board currently renders a static section; auto-scroll not implemented either (planned M4 in v1, unchanged). | missing |
| §6.11 Events | ✓ matches v2 exactly (focus/select/answer/action). Verified by tests; board→sink bridge + emit-context landed in review round 1. | ok |
| §6.12 Errors | Codes: invalid-node, unknown-type, load-failed, duplicate-id, bad-target, depth-exceeded, version-mismatch ✓ all implemented/tested. **`theme-rejected` ✗, `cue-cycle` ✗.** | partial |
| §6.13 Fixtures | v1 set exists (12 valid+3 invalid). v2 names differ (`define-term`, `attach-explainer`); **new fixtures needed**: cued-narration, cue-before-node (race), theme-mood-shift, replace-with-theme, camera-moves, invalid cue-cycle, disallowed mood, unreadable palette. | partial |
| §7.1 Reducer | Pure/deterministic ✓ exhaustive tests for existing ops. **State lacks `theme` and `firedCues`.** Detours/history ✓ but no theme snapshots. | partial |
| §7.2 Streaming | Covered. | partial |
| §7.3 Registry | Manifest/loader ✓ promulgated (builtins via canonical schemas). Moods/ambience/surfaces registry entries ✗. | partial |
| §7.4 Asset packs | ✗ (M5 per plan; sanitized-SVG infra absent). | missing |
| §7.5 Attach layout | Core detour stack + depth-2 ✓ + return-emits-action in reducer. **No UI**: placement/connector/dim/spotlight/focus management all missing (M4). | partial |
| §7.6 Styling | **Fails outright** — see §3 Styling. The single biggest systems gap besides cues/theme. | missing |
| §7.7 A11y | Buttons+names ✓ (choices/term/focusable, aria-pressed multi, keyboard tested), jest-axe ✓, live region ✓ (must become "entered-content" keyed), focus-management ✗ (M4), skip/flush control ✗, contrast-preserving theming ✗ (theme work), reduced-motion ✓ everywhere built so far. | partial |
| §7.8 Security | No model HTML ✓ (nothing renders markup; KaTeX absent yet). Configurable limits: max nodes/text/diagram ✗. Theme input validation ✗ (theme work). | partial |
| §8 Generators | schemaToJsonSchema ✓ (zod-to-json-schema, registry-aware types), getSystemPromptGuide ✓ registry-aware w/ options + examples + snapshot test, serializeBoard ✓ (nodes/parent-item/detours/history), getCapabilities ✓. **All need v2 additions**: cue/beat instructions, moods-with-descriptions (also as enum in JSON Schema), entered-vs-pending + pending-cues in serializeBoard, moods/effects/ambience/surfaces in capabilities. | partial |
| §9 Art & Motion | **Fails.** Current default output: unstyled semantic HTML in a vertical flow, uniform rise/fade entrances, no type scale beyond h3/p, no receding, no camera, no mood. A `dgui-*` class name system exists but nothing styles it. This section needs its own workstream (kinetic text engine, presets table, receding behavior, camera, default mood/surface). | failing |
| §10 React API | Provider: registry ✓, theme (host static tokens only) ✗ ThemeSpec/policy/colorScheme. Board: store/onEvent/onError ✓ (+ bridges), **pacing/camera/ambience/classNames/onEnter/onCue/onThemeChange ✗**. useBoard: state/applyFinal/applyPartial/back/reset ✓, **cue/flush/seek ✗**. | partial |
| §11 Quality bars | Strict TS ✓ no-`any` public API ✓ TSDoc partial. Bundle budget: **no size check at all**. Performance: transform/opacity-only presets ✓; no throttling harness yet. Tests: strong protocol/core suites (schema 96, core 84 tests) — cue/theme suites pending. Determinism ✓ for existing ops. | partial |
| §12 Milestones | Old M1–M3 map to v2-M1..M3 partially (see plan). v2-M0 starts immediately below. | partial |
| §13 Working rules | Generic library ✓ (no product strings). Small commits + step prefixes followed. DECISIONS.md current (all rulings recorded, reviewer process live). Keep. | ok |
| §14 Decisions to record | Existing: native-buttons-vs-Aria, LazyMotion strict, reduced-motion plain-div, BoardStore version counter, live-region, group nesting, term anchor, peer deps. **Still owed**: Radix-vs-Aria-vs-neither final call (currently "neither, native" — formalize), Lottie player, code highlighter, dagre, GSAP licence, bundle thresholds, ambience impl + lite-mode detection, visual-regression tooling, token/effect renames. | partial |
| §16 v3 pending | No reference material yet. Plan keeps all tunables centralised (presets table) so retuning is cheap. | pending |

## 2. What survives vs what is reworked

**Keep as-is (correct, tested):** envelope/ops Zod core + JSON Schema + prompt-guide machinery; validator/resolver (ledger idempotency, dedupe, depth caps, unknown-type routing); reducer history/detours; EventBus; provider/BoardStore/useBoard/useSyncExternalStore architecture (incl. the reviewer's bus bridge + pre-mount error buffer); reduced-motion driver scaffold; fixture-based test harness; 176-test suite; playground app shell + event/error logging.

**Rework in place (breaking internal changes, logged in DECISIONS.md):** schema (triggers, expanded effects/easings, text variants, mark-enter, ThemeSpec, theme/camera ops, new error codes); BoardState (+theme, +firedCues, theme snapshots in history); rendering gate (not-mounted-until-triggered); token naming `--dgui-*` → `--dg-*`; motion presets consolidated into `motion/presets.ts`; fixture set to v2 names.

**Build new:** cue engine; theme resolver + mood/ambience/surface registries + contrast guardrail + transitions; kinetic text engine; compiled CSS `@layer` + Tailwind bridge/preset + slot classNames + data-dg-* states; camera; ambience runtime; default "looks good at zero config" board design.

## 3. Remediation plan (ordered by v2 §12)

> Each step keeps the repo green (`pnpm test`, `tsc --noEmit`) and commits with the v2 milestone prefix. Tunables (effects, easing, tempo, type scale, palette) live in one place per domain (`motion/presets.ts`, `theme/tokens.ts`, `theme/moods`) so the v3 reference pass can retune quickly.

**Step 0 — housekeeping (no v2 design).**
Commit the outstanding reviewer-round-1 fixes verbatim (`M3: review round 1 — choices state, bus bridge, announcer, provider memo`). Record in DECISIONS.md: the playground layout.tsx hand-edit is flagged (comma-operator bug) and added to the M3 styling work rather than silently fixed here. GSAP licence check recorded.

**Step 1 — v2-M1 Protocol.**
Schema: `TriggerSchema` (+ cue/after/event/start), `Enter.trigger`/`Enter.split`, expanded `EnterEffect`/`Emphasis`/`Exit`/`EaseName`; text variants `hero`/`kicker`/`quote`; `ink` color token; mark-level `enter` (marks keep MotionFields and gain an optional `enter` object — deviation note for `{ text } & MotionFields` compat); `ThemeSpec`; `theme`/`camera` ops (unknown keys ignored-with-warning, explicitly tested); new error codes; diagram node `enter`; steps item `enter`.
Fixtures: keep generic; add v2 set (cued-narration, cue-before-node, theme-mood-shift, replace-with-theme, camera-moves, cue-cycle-invalid, disallowed-mood-invalid, unreadable-palette-invalid) and rename define-biology→define-term, attach-botany→attach-explainer (old names retired). Prompt guide learns beats/cues/mood guidance. **Accept:** v2-M1 acceptance; invalid fixtures produce v2 error codes.

**Step 2 — v2-M2 Core.**
Reducer: `theme` + `firedCues` in state; `theme`/`camera` ops reduced (theme-scoped to board or top detour; camera op validated not reduced — camera is presentation); history snapshots carry theme; `back()` restores theme. Cue engine module (`core/cues.ts`): fire/remember/flush/seek, `after`-chain cycle detection → `cue-cycle` error + fall back to `start`, race handling (cue-before-node), pacing computation, `onEnter/onEntered/onCue` notifications. Theme resolver (`core/theme.ts`): mood/surface/ambience/surfaces as registry entries, `themePolicy` (none/moods/moods+tokens), allowlists, colour parsing/validation, clamping, WCAG AA contrast guardrail (`onThemeAdjusted`), precedence chain, transition data, `scope`/detour-scoping with revert-on-return, `theme-rejected` on disallowed. Generators: moods-with-descriptions in prompt guide + JSON Schema enums (registry-aware), serializeBoard gained entered/pending/pending-cues/mood, capabilities gained effects/moods/ambience/surfaces. **Accept:** v2-M2 acceptance (race test, auto-contrast, theme-rejected, cue cycle, prompt-guide snapshot).

**Step 3 — v2-M3 Renderer, styling, kinetic text (+ showreel gate).**
(a) Styling architecture: tokens → `--dg-*` (name map logged), compiled plain CSS in `@layer dreamer-genui` at low specificity, `components/styles/base.css` + exports (`styles.css`, `tailwind.css` v4 bridge, `tailwind-preset` v3), slot `classNames` (tailwind-merge when present), `data-dg-state`/`data-dg-mood`/`data-dg-variant`, `colorScheme`.
(b) Motion presets table (`motion/presets.ts`): every EnterEffect/Emphasis/Exit with duration/stagger/easing/overshoot + reduced-motion behavior; EaseName → cubic-bezier table; tempo multiplier from theme `motion.speed`.
(c) Not-mounted-until-triggered: resolver exposes entry state (pending/entered); Animated/Board gate mounting on trigger satisfaction; live region re-keyed to entered-node entrances; `flush` fast-forward and `seek` remaining-instant.
(d) Kinetic text engine (`react/kinetic/`): word/char/line splitting (plain DOM, no GSAP yet), effects words/chars/typewriter/wipe/slam/count-up/scribble (scribble as SVG stroke path later refined in M5), per-variant defaults (§9.2). GSAP stays out (no splitting engine dependency); licence check done but library untouched.
(e) Theme visuals: default zero-config mood + surface ("flat" light + dark + one example register per family), mood transitions tween tokens, detour theme scope honored, `onThemeChange`.
(f) Default components: text variants with kinetic defaults, choices/callout/steps/group restyled per §9 (big type scale contrast, receding behavior flag), hero screen-owning layout.
(g) Playground: Tailwind v4 config + bridge import, mock narrator (cue timeline), cued-narration run, flush/seek UI, fix the host layout.tsx font setup into the theme properly, plain-CSS-only sample page, board adopts host Tailwind theme with zero extra config. Storybook deferred to M7 (unchanged).
**Accept:** v2-M3 acceptance items + §9.3 checklist self-grade + **Showreel gate: STOP [ASK]**.

**Step 4 — v2-M4.** attach visuals (placements/connectors/annotate/dim/focus), receding, auto-scroll, camera (auto + op), ambience runtime + example presets (lite mode, pause rules), theme op end-to-end (which Step 2 built + M3 rendered).

**Step 5 — v2-M5.** Figures (SVG draw-on via lazy GSAP — dependency added after licence check is recorded), diagram layouts, labeled/asset packs + starter pack, annotation stroke primitives.

**Step 6 — v2-M6.** Built-ins math/chart/table/lottie/code, lazy, theme-respecting.

**Step 7 — v2-M7.** Storybook stories, README (incl. cue guide, theming guide, Tailwind/plain-CSS guide, narrator adapter pattern), mock tutor.

**First decisions to log (§14):** token prefix rename; fixture renames; `neither` headless-primitives ruling formalised; kinetic splitting implemented without GSAP first; theme op reduces to state+events (camera op validates and emits, presentation-only); group nesting cap unchanged.

## 4. Open questions for the human (from the audit)

1. v2-M3 is large (styling + kinetic text + theme + triggers in one milestone). Is that intended as one milestone, or may the showreel use only what exists by its end?
2. Old fixture names (`define-biology` etc.) — confirm retiring them in favour of the v2 names, since tests/prompt-guide examples reference them.
3. The hand-edited playground layout (Montserrat/JetBrains Mono): treat as the host's font identity for the M3 theming work?
