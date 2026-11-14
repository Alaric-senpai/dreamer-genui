# RECONCILE — M4b: retrofit and foundations (v2.1 + v2.2 items)

**Status:** draft for human approval. **No M4b code has been written.** Per `AGENTS.md` §0 and §15.3, implementation starts only after this document is approved.

**Baseline:** M0–M3 approved; M4 complete and pushed (`08cad0b`). Working tree contains only the human's uncommitted `AGENTS.md` v2.2 edit (not ours to commit). Current gates: 379 tests green, `tsc` clean, library and playground builds green, no product strings in `packages/`.

**Purpose:** enumerate every M4b item with the files/modules it touches, the intended change and its risks, so the human can approve or amend scope before any retrofit begins.

---

## 0. Baseline inventory (what M4b retrofits)

| Area | Current shape | M4b impact |
| :--- | :--- | :--- |
| Protocol | `src/schema/{ops,blocks,figures,inline,theme,events,errors,motion,envelope,json-schema}.ts` — single-column, no layout, no questions/assessment, no model schemas | **Heavy additive change** (Part A) |
| Registry | `src/core/registry.ts` — a block-type map with `TypeManifest`, plus ad-hoc mood/ambience/surface maps | **Replace with the plugin SDK + registries** (Part B) |
| Reducer/state | `src/core/{reducer,cues,validator,resolver,theme,events,types}.ts` — no layout, assessments, persistence or middleware | **Extended** (Part B) |
| Generators | `src/core/generators/{json-schema,capabilities,prompt-guide,serialize-board}.ts` — single profile, no models/assessments/layout | **Extended** (Part B) |
| Renderer | `src/react/{board,provider,use-board}.tsx` + `components/{block-renderer,blocks,inline,detour}.tsx`, `kinetic/`, `motion/`, `ambience/` | **Layout engine + component anatomy + camera** (Part C) |
| Presets | `src/theme/presets.ts` (moods/ambience/surfaces), `src/motion/presets.ts`, `src/ambience/particles.ts` | **Moved behind default plugins** (Part B) |
| Styling | `styles/base.css` (`@layer dreamer-genui`), `styles/tailwind.css`, v3 preset | **Layout/density/RTL/component tokens** (Part C) |
| Fixtures | 21 files: 13 valid, 8 invalid | **~30 new valid/invalid** (Part A) |
| Tests | 36 files / 379 tests | **New suites** for layout, assessment, persistence, middleware, profiles, connectors, customization surface |
| Playground | `/`, `/m1`–`/m4`, `/plain-css`, `/showreel` | **`/m4b` gate route** (Part D) |

Empty leftover directories `src/builtins/`, `src/figures/` exist and are unused; M4b may delete them (no public API).

---

## Part A — Protocol amendment (pre-release, no version bump)

Treat as v1: additive except `diagram.flow` removal and camera extension. Every schema stays Zod-first; `schema` must remain free of React/DOM imports.

### A1. Ops and layout

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/ops.ts` | Add `layout` op (`LayoutSpec`, transition). Add `slot?` to `append`. Add `layout?` to `replace`. Add `theme?` to `attach`. Extend `camera` to the `CameraMove` shape and `path` form (A9). | Low–medium: op union consumers (`reducer`, validator, generators, playground inspector) must handle a new op; camera is a **breaking shape change** to the existing `camera` op fields (consumers must be updated in lockstep). |
| `src/schema/layout.ts` (new) | `Gap`, `Ratio`, `LayoutSpec` (`flow`, `split`, `grid`, `stage`), region/slot enums, `Slot`. | Low. |
| `src/schema/common.ts` | Export `SlotSchema` / `NodeRef` refinements if needed. | Low. |
| `src/core/reducer.ts` | Handle `layout` op: pure set + history entry semantics. | Low. |

**Deviation to log:** the existing `camera` op stores `{ to, preset, zoom, duration, ease }`; M4b replaces it with `CameraMove` (`pan`, `tilt`, `dolly`, `trigger`, `path`). This is not additive for that one op but is pre-release and required by §6.12; M4 camera code is updated in the same change. Old `camera-moves.json` is migrated to the new shape.

### A2. Node placement and richer `group`

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/blocks.ts` | Add to `NodeBase`: `slot`, `span`, `align`, `justify`, `size`, `reserve`. Expand `group` with `layout: stack\|row\|grid`, `direction`, `wrap`, `align`, `justify`, `gap`, `columns`, `minItemWidth`, `ratio`, `reverseOnNarrow`. | Medium: `NodeBase` widens every block; strict schemas may now accept fields that the renderer ignores until Part C. Acceptable (additive), but the renderer must warn rather than mis-render. |
| `src/react/components/blocks.tsx` | Implement `group` vocabulary (Part C). | Medium. |

### A3. New blocks

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/blocks.ts` | Add `list` (rendered in M4b), `compare` (schema now, renderer M5), `question`, `flashcards`, `assessment` (schema now, widgets M6b). | Medium: `BlockSchema` discriminated union grows; every exhaustive `switch` in the renderer/validator/generators must gain a default path. The per-node error boundary must catch unimplemented kinds gracefully. |
| `src/schema/question.ts` (new) | `Question`, all `QuestionKind` variants, `AnswerValue`, `status`/`feedback`, `blank` constraints. | Medium: large surface; validation rules (A10). |
| `src/schema/assessment.ts` (new) | `Assessment`, modes, timer, sections, navigation, shuffle, submit, result. | Medium. |
| `src/react/components/blocks.tsx` | Render `list` only in M4b. | Low. |

### A4. Inline `blank` mark

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/inline.ts` | Add `blank` mark (`id`, `options`, `width`). | Low–medium: validator must reject `blank` outside a `cloze` question (`blank-outside-cloze` → `invalid-node`). |
| `src/core/validator.ts` | Cross-node rule: blank marks only inside cloze; ids unique per question. | Medium. |

### A5. Figures

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/figures.ts` | **Remove `flow` from `diagram`.** Add `flowchart` (nodes/shapes/lanes/edges/inputs/outputs/numbered/flow/narrow/reveal/focusable), `timeline`. Add `model3d` and `scene3d` to the union (A10). | Medium: removing `flow` breaks `tests/schema/figures.test.ts` (loops over `tree|radial|flow|cycle`), the prompt-guide enum text and its snapshot; no fixture uses it (`diagram-radial.json` is `radial`). Migrate all three in Part A. |
| `fixtures/diagram-radial.json` | Verify/normalise against the new schema. | Low. |

### A6. ThemeSpec

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/theme.ts` | Add `motionPreset`; `density` to `ThemeTokens`; `components` component-level tokens. | Low–medium: resolver must validate component tokens against component metadata; until Part C metadata exists, validation is permissive with a warning. |
| `src/theme/tokens.ts` | Emit density/component token variables. | Medium. |

### A7. Events

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/events.ts` | Add `answer.meta`, `assessment` event, `action.detail`, namespaced plugin events. | Low. |
| `src/core/events.ts` | Ensure the bus accepts the new event union. | Low. |

### A8. Errors

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/errors.ts` | Add `layout-invalid`, `assessment-invalid`, `key-in-exam`, `plugin-conflict`, `plugin-incompatible`, `middleware-error`, `model-not-found`, `model-load-failed`, `unknown-part`, `unknown-view`, `webgl-unavailable`, `connector-error`, `model-budget-exceeded`, `bad-slot`, `blank-outside-cloze`, `flowchart-dangling-edge`. | Low. |

### A9. Camera extension (v2.2)

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/ops.ts` (or new `camera.ts`) | `CameraMove { to, preset, zoom, pan?, tilt?, dolly?, duration?, ease?, trigger? }`; op forms: single move and `{ path: CameraMove[] }`. Bounds: zoom 1–1.6, tilt ±15°, dolly bounded. | Medium: renderer camera bus/reducer validator must accept both forms; existing M4 camera tests migrate. |
| `src/core/validator.ts` | Validate bounds/path length/trigger references; `camera` stays out of `BoardState` (M4 ruling). | Medium. |
| `src/react/board.tsx` | Consume the extended move (Part C). | **High** — see C3. |

### A10. 3D and connector schemas (v2.2, **types only**)

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/model.ts` (new) | `PartId`, `ViewRef`, `Model3D`, `TourStep`, `Scene3D`, `ModelManifest`, `ModelSummary`, `ModelQuery`, `AssetRef`. Strict limits (64 scene objects, tube ≤16 points). | Medium: large schema; must not import `three` or DOM. |
| `src/schema/connector.ts` (new) | `ModelConnector` **type** contract (`getManifest`, `getAsset`, `search?`, `getVersion?`, `prefetch?`, `map?`), `ConnectorContext`. Interface only; no fetch implementation in M4b. | Low. |
| `src/schema/index.ts` | Export new modules. | Low. |
| `src/schema/figures.ts` | Include `model3d`/`scene3d` in `FigureSchema` (gated advertisement later). | Low. |

**Not in M4b:** any loader, three.js, decoder, connector implementation, poster loading, picking. Those are M5b. M4b ships schemas + registry hooks + mock connector tests.

### A11. JSON Schema, fixtures, schema tests

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/schema/json-schema.ts`, `src/core/generators/json-schema.ts` | Export the new unions; registry-aware enums for layouts/effects/moods/ambience/surfaces. | Medium: unsupported Zod constructs (discriminated unions with transforms) need explicit handling. |
| `fixtures/*` | Add: `split-explanation-question`, `split-reversed`, `layout-change-animated`, `group-flex-grid`, `process-flowchart`, `timeline`, `compare`, `list`, `question-kinds`, `assessment-practice`, `assessment-exam`, `assessment-review`, `flashcards`, `camera-tilt-path`, `model3d-basic`, `model3d-tour`, `model3d-hotspot-question`, `model3d-label-question`, `scene3d-solids`. Invalid: `invalid-bad-slot`, `invalid-key-in-exam`, `invalid-blank-outside-cloze`, `invalid-flowchart-dangling-edge`, `invalid-plugin-collision`, `invalid-unknown-part`, `invalid-unknown-view`, `invalid-model-not-found`, `invalid-model-over-budget`, `invalid-model-manifest`. | Medium: fixtures whose renderers are later milestones will validate but render a graceful fallback; the `/m4b` fixture picker must label them "schema only". |
| `tests/schema/*` | One test per new schema + invalid fixture → exact error code. | Medium. |

**Acceptance mapping (Part A):** `pnpm test` green; `schema` imports with no React/DOM; old fixtures migrated; invalid fixtures yield the specified codes.

---

## Part B — Core

### B1. Plugin SDK and registries (the largest structural change)

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/registry.ts` | Replace the block-map with a registry keyed by kind (`blocks`, `marks`, `figures`, `questions`, `effects`, `layouts`, `moods`, `ambience`, `surfaces`, `themes`, `motionPresets`, `iconSets`, `assetPacks`, `modelConnectors`, `modelPacks`, `primitives`, `strings`, `renderers`, `middleware`, `profiles`, `devtoolsPanels`). Add `use`, `override`, `disable`, `enable`, `list`, `get`. Keep `getManifest`, `resolve`, `getCapabilities` behaviour. | **High.** Every consumer of the current registry (`resolver`, `validator`, generators, provider, playground) must migrate. Mitigation: compatibility facade + migrate consumers in the same PR; registry tests first. |
| `src/core/sdk.ts` (new) | `definePlugin`, `defineBlock`, `defineMark`, `defineFigure`, `defineQuestion`, `defineEffect`, `defineLayout`, `defineMood`, `defineAmbience`, `defineSurface`, `defineTheme`, `defineMotionPreset`, `defineIconSet`, `defineAssetPack`, `defineModelConnector`, `defineModelPack`, `definePrimitive`, `defineStrings`, `defineRenderer`, `defineMiddleware`, `defineProfile`, `defineDevtoolsPanel`; manifest vs lazy `load`; namespacing; `engine` range; `requires`; conflict/priority rules; dev throw vs prod warn. | **High.** Public API surface; type ergonomics; lazy-loading contract. Mitigation: the toy third-party plugin acceptance test drives the API before built-ins migrate. |
| `src/plugins/{themes-default,ambience-default,motion-default,layouts-default,icons-default}/` (new) | Move `theme/presets.ts`, `motion/presets.ts`, layout descriptors and a first icon set behind `definePlugin` manifests. Keep temporary re-exports from the old paths. | Medium: circular imports possible; plugin manifests must stay tiny (no React). |
| `src/core/index.ts`, `src/index.ts` | Export the SDK; keep existing named exports working. | Medium. |

**Reserved names:** core names (`text`, `flow`, `split`, `grain`, …) are reserved; third-party must be `vendor:name`. Duplicate without `override` = `plugin-conflict`.

### B2. Middleware

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/middleware.ts` (new) | Ordered pipeline (`priority`, stable registration order), `onOp` (op → op/op[]/null), `onEvent`, `onThemeResolve`, `onNodeResolve`; isolation (`middleware-error`, continue). | Medium: op expansion interacts with reducer ordering/history; event suppression must not swallow assessment events. Tests: ordering + isolation. |
| `src/core/reducer.ts`, `src/core/events.ts`, `src/core/resolver.ts` | Route through middleware before/after the pure step. Keep the reducer itself pure (middleware runs in the store wrapper). | Medium. |

### B3. Layout model

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/layout.ts` (new) | Resolve `LayoutSpec` → regions; assign nodes to slots; unslotted → primary; undefined slot → primary + `layout-invalid` warning; responsive collapse decision (container width vs breakpoints, `narrow`, `narrowOrder`, `pin`); `layout` op diffing for shared-layout animation. | **High** — layout correctness is a gate criterion. Mitigation: pure model with exhaustive unit tests before the React engine. |
| `src/core/types.ts` | `BoardState.layout`; detour layout; history snapshots include layout. | Medium (state shape/serialization). |
| `src/core/reducer.ts` | `layout` op, `replace.layout`, slot assignment passthrough. | Medium. |

### B4. Assessment state machine

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/assessment.ts` (new) | Headless state machine: modes (`practice`/`quiz`/`exam`/`review`), answers, flags, visited, current question, navigation (`free`/`linear`/`locked-after-answer`), deterministic shuffle, timer with injectable clock, `extendTime`/`pause`/`resume`, submit/confirm, snapshot/restore, mode-transition rules. | **High.** Many rules; must be UI-free in M4b. Mitigation: fake-clock unit tests first; no rendering in Part B. |
| `src/core/types.ts` | `BoardState.assessments`. | Medium. |
| `src/core/reducer.ts` | `assessment`/`question` node handling, updates (`status`, `feedback`, `result`), exam locks and op queueing. | High. |
| `src/core/validator.ts` | `key-in-exam`, `assessment-invalid`, `blank-outside-cloze`, size limits. | Medium. |
| `src/core/cues.ts` | Exam mode ignores cue triggers (`pacing: "auto"`). | Medium. |

**Not in M4b:** the assessment/question *widgets* (M6b). M4b exposes the store API and state only.

### B5. Persistence and replay

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/persistence.ts` (new) | `snapshot()`, `restore()`, `exportOps()`, `replay(log, { speed })`, `migrate()`, versioned `BoardSnapshot`; cue timeline with relative timestamps; restore settles without entrance animation. | Medium–high: replay determinism, timers/cues, assessment state. Round-trip tests. |
| `src/react/use-board.ts` | Expose `snapshot`, `restore`, `exportOps`, `replay`, `assessments`. | Medium. |
| `src/react/board.tsx` | Hydration/restore path skips entrance animations. | Medium. |

### B6. Mounted-node cap, asset resolver, limits

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/react/board.tsx` | `maxMountedNodes` (default 80): archive older finished content into an expandable compact summary; state untouched; focus/a11y handled. | Medium: archiving must not break detours or assessment nodes. |
| `src/react/provider.tsx` | `resolveAsset(id)` with cache; `{ asset }` references in image/lottie/labeled. | Medium: async resolution + SSR safety. |
| `src/core/limits.ts` (new) | Configurable limits: nodes/board, text length, diagram/flowchart size, assessment size, ambience intensity, scene objects. | Low. |

### B7. Strings, i18n and direction

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/strings.ts` (new) | `defineStrings`, locale bundles (`en`, `sw` minimal), lookup with fallbacks. | Low. |
| `src/react/provider.tsx` | `locale`, `dir`, strings wiring; remove hard-coded UI strings from components. | Medium: every built-in control must use the registry. |
| `src/react/*` | `Intl` number/date formatting helpers. | Low. |

### B8. Profiles and generators

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/profiles.ts` (new) | `lesson`, `assessment`, `minimal`; `defineProfile`; include/exclude; plugin visibility. | Medium: profile output must remain honest as plugins are added. |
| `src/core/generators/prompt-guide.ts` | Registry-aware, profile-aware; layout/camera/model/assessment instructions; `guideOverrides`; compact/language. | Medium. |
| `src/core/generators/serialize-board.ts` | Layout, entered/pending, assessments, models in use, history. | Medium. |
| `src/core/generators/capabilities.ts` | All registries, profiles, connector support, 3D gating. | Low. |
| `tests/core/__snapshots__` | Update/add per-profile snapshots. | Low. |

### B9. Connector registry and model tools (v2.2 contract)

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/core/connectors.ts` (new) | Register connectors; id resolution (`modelId` in priority order, `connectorId:modelId` explicit); `getManifest` → `map` → Zod validation; `connector-error`; budget checks; `allowedOrigins`; abort signals. | Medium–high: contract correctness while runtime is M5b. Mitigation: mock connectors only, no network. |
| `src/core/model-tools.ts` (new) | `getModelTools(registry)` → `find_models`, `get_model` (framework-agnostic, Zod inputs, executors bound to connectors); `getModelContext(summaries)`. | Medium: tool shape must work with Vercel AI SDK or plain executors. |
| `src/core/generators/*` | Advertise `model3d` only with a connector; `scene3d` always; compact `ModelSummary` only. | Low. |
| `src/schema/model.ts` | Manifest validation used by the registry. | Medium. |

**Not in M4b:** `createStaticModelConnector`, `createHttpModelConnector`, cache/prefetch wrappers, poster/model loading, three.js (all M5b). M4b tests use mock connectors returning raw shapes.

**Acceptance mapping (Part B):** exhaustive layout/slot reducer tests; assessment fake-clock tests incl. reload restore and key rejection; snapshot/replay round-trips; middleware ordering/isolation; prompt snapshots per profile; toy third-party plugin (block + effect + mood + layout) via public SDK; mock connector mapping/validation with `connector-error`.

---

## Part C — Renderer and styling

### C1. Layout engine and region-aware board

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/react/layout/` (new: `LayoutRoot`, `FlowRegion`, `SplitLayout`, `GridLayout`, `StageLayout`, `Region`) | Render the layout model; slots; span/align/justify/size; container-query collapse (stack/tabs, `narrowOrder`, `pin`); shared-layout animation on `layout` changes via `motion`; reduced-motion instant. | **High** — art-direction gate. Mitigation: `/m4b` demos every layout; Playwright visual checks; reduced-motion tests. |
| `src/react/board.tsx` | Render region tree instead of the current single column; region-aware receding, attach placement, spotlight and camera. | **High.** Refactor of the M4 board shell; regression risk for `/m1`–`/m4`. Mitigation: keep M4 tests green throughout; `/m4` remains the regression page. |
| `styles/base.css` | Layout grid/flex classes, container query breakpoints, region/slot hooks, `group` vocabulary. | Medium. |
| `src/react/components/blocks.tsx` | `list` block; `group` flex/grid. | Medium. |

### C2. Component anatomy contract

| Files | Change | Risk |
| :--- | :--- | :--- |
| Every `src/react/components/*` and chrome component | Export metadata `{ name, parts, tokens, variants, dataAttrs, events, effects }`; `data-dg-part` + `dg-<component>-<part>`; `--dg-<component>-*` tokens; `classNames`/`styles`; replaceable via `components` prop with the documented override signature. | **High** and broad: many components, subtle CSS coupling. Mitigation: contract test enumerates parts and overrides every one; token-only lint. |
| `src/react/components/registry.tsx` (new) | Slot/part/type override resolution (host override > type replacement). | Medium. |
| `src/react/provider.tsx` | `components`, `middleware`, `themePolicy`, `density`, `locale`, `dir`, `resolveAsset`, `strings` props. | Medium. |
| `styles/base.css` | Component tokens for all existing components; remove non-token colours/fonts/radii/durations. | **High** visual-regression risk. Mitigation: visual capture before/after; token map documented. |
| `docs/components/` generator (`tools/`) | Generate docs from metadata in CI; fail on missing metadata/non-token styling. | Medium. |
| `tests/react/customization-surface.test.tsx` (new) | For every component: metadata present, every part rendered, every part overridable. | Medium. |

### C3. 2D camera extension

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/react/camera/` (new: `CameraLayer`, `CameraController`, `useCameraPath`, `CameraControls`) | Pan, zoom, tilt/perspective (figure layers + backdrop only), dolly, presets, cue-triggered moves, `path`, bounds, reduced-motion → scroll-into-view, exam off. | **High.** Transform composition, tilt isolation from text, path sequencing, user override/reset. Mitigation: pure camera math tests + browser probes. |
| `src/react/board.tsx` | Replace M4's zoom-only wrapper with the camera layer; keep `camera="auto"|"off"`. | High. |
| `src/react/provider.tsx` / `board.tsx` | `cameraControls="none" | "pinch-pan"` with reset control; user input temporarily overrides auto camera; released on next tutor move/reset. | Medium. |
| `styles/base.css` | Camera layers, perspective, controls, reset. | Medium. |

### C4. Exam-mode enforcement

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/react/board.tsx` | Distraction-free lock driven by core assessment state: camera off, ambience off, theme/layout/camera ops from outside queued or rejected per host config, calm motion preset, locked theme policy. | Medium–high: interaction with middleware/queueing. |
| `src/react/ambience/AmbienceLayer.tsx` | Off in exam mode. | Low. |
| `src/react/motion/*` | Calm preset downgrade. | Medium. |

### C5. States, density, RTL, SSR, headless, devtools

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/react/components/board-chrome/*` (new) | `status` indicator (`idle`/`thinking`/`listening`/`speaking`), empty/loading/error states, skip/flush control — all customizable parts. | Medium. |
| `src/react/provider.tsx`, `styles/base.css` | Density (`compact`/`comfortable`/`large`), min target ≥44 px (≥56 px at `large`); `dir`/RTL mirroring of `left`/`right`; logical properties. | Medium. |
| SSR/hydration | Stable ids (`useId`), no random render values, no entrance animation during hydration, client-only ambience/camera/devtools. | Medium: Next build + hydration warnings. |
| `src/react/headless.ts` (new) + package export `dreamer-genui/core` hooks | `useBoardStore`, `useNode`, `useNodeEnter`, `useCue`, `useTheme`, `useLayout`, `useAssessment`, `useRegistry`, `useBoardStatus` — no default components/CSS import. | Medium. |
| `src/react/devtools/` (new, dev-only) | Initial overlay: node tree, cues, theme/contrast, layout regions, registry, plugin load status, perf, logs, snapshot export; panel registry. | Medium; must tree-shake from production. |
| `src/react/components/*` | Per-node error boundaries + fallback rendering. The current renderer has resolver-level fallbacks but **no React error boundary**, so this is new (a class component around each node, reporting `load-failed`/render errors, keeping the rest of the board alive). | Medium: React error boundaries only catch render/lifecycle errors, not async; pair with the resolver fallback. |

### C6. Starter packs

| Files | Change | Risk |
| :--- | :--- | :--- |
| `src/packs/starter/` (new) | Move/define example asset packs and the demo 3D model placeholder; **not registered by default**; playground-only registration. | Low: currently no packs exist in core, so this is mostly a new home + docs. |

**Acceptance mapping (Part C):** `split-*` render (incl. RTL); `layout-change-animated` re-flows smoothly/instantly; narrow collapse; customization-surface test; headless demo; SSR no warnings; density `large` ≥56 px; `camera-tilt-path` cue-synced pan/zoom/tilt + user pinch/pan reset + text never skewed + reduced-motion fallback.

---

## Part D — Layout showcase gate

| Files | Change | Risk |
| :--- | :--- | :--- |
| `apps/playground/app/(tailwind)/m4b/page.tsx` (new) | Description; demos of every layout, slot, responsive collapse, layout transition, RTL, density, camera pan/tilt/path; fixture picker scoped to M4b; event/error/cue logs; acceptance checklist linking tests. | Medium: fixture import depth (`../../../../../fixtures/...`) and build. |
| `apps/playground/app/(tailwind)/m4b/layout.tsx` (new) | Route metadata. | Low. |
| `apps/playground/app/(tailwind)/page.tsx` | Mark `/m4b` shipped and link it. | Low. |
| `docs/showreel/m4b/` (new) | Captures (layout, reflow, RTL, density, camera path) + `SELF_REVIEW.md` honesty grades. | Low–medium. |

**Gate:** `/m4b` works, checklist filled with pass/fail + test links, captures saved, self-review honest. **STOP for human approval [ASK].**

---

## 2. Migration and compatibility plan

1. **Protocol first, behind tests.** Add schemas + fixtures + validation tests before touching the reducer/renderer. Old fixtures must keep validating (except the documented `camera` shape and `diagram.flow` removal).
2. **Registry facade.** Introduce the SDK alongside the old registry API, migrate consumers one at a time, then delete the old shape. Keep `createRegistry()` and its existing methods working until Part C is done.
3. **Presets move without behaviour change.** `theme/presets.ts` and `motion/presets.ts` become default-plugin data; old import paths re-export for one milestone. No preset values change in M4b (visual regression must be zero).
4. **Renderer refactor in slices.** Layout shell → group/list → camera → component anatomy → states/density/RTL → headless/devtools. Run `pnpm test`, `tsc --noEmit`, library build and playground build after each slice; `/m1`–`/m4` are regression pages.
5. **No new runtime dependencies in M4b** beyond what already exists (`motion`, Zod, React Aria focus/interactions). Flowchart layout engine, three.js, drag-and-drop, KaTeX etc. are later milestones. This keeps the bundle budget check meaningful.
6. **Fixtures for later milestones** validate and render a graceful fallback; `/m4b` labels them "schema only".
7. **Generic-library check** after every slice: grep for product/curriculum/subject strings in `packages/`; all examples stay in fixtures/docs.

## 3. Decisions to record in `DECISIONS.md` during M4b

- Plugin registry shape, namespacing, conflict/priority rules, manifest-vs-implementation boundary.
- `components` override typing (generic per-part map vs discriminated union).
- Middleware ordering/expansion semantics and isolation.
- Snapshot/ops-log formats and version/migration strategy.
- Layout breakpoints + container-query strategy; tab vs stack defaults; `pin` behaviour.
- Camera transform composition, tilt isolation, pan/dolly bounds, path sequencing, user-override release.
- Exam lock policy: queue vs reject default; host opt-outs.
- Density scale values and min-target enforcement.
- Icon set source/licence; strings bundle shape; RTL logical-property strategy.
- Connector manifest versioning/caching contract (implementation M5b).
- Browserlist and bundle budget thresholds after first M4b measurement.
- Flowchart layout engine: **deferred to M5** (schema only in M4b), recorded as a deferral.
- Headless primitives: **continue with React Aria focus/interactions only** (no new primitive library) unless a specific need appears.

## 4. Top risks and mitigations

| Risk | Mitigation |
| :--- | :--- |
| Registry refactor breaks M1–M4 | Facade + slice-by-slice migration + full suite after each slice; `/m1`–`/m4` regression routes. |
| Layout refactor regresses M4 detours/camera/receding | Keep M4 tests; region-aware detour placement tests; `/m4` regression page. |
| Component anatomy sweep causes visual drift | Zero preset/token value changes; before/after captures; token-only lint; customization-surface test. |
| Camera tilt harms legibility | Tilt applied only to figure/backdrop layers; text in a flat plane; browser probes at 320–1440 px. |
| Assessment state machine grows into UI | M4b ships headless state only; widgets are M6b; tests use fake clock and no DOM. |
| Fixtures for later milestones look "broken" | `/m4b` labels schema-only fixtures; fallback rendering tested. |
| Scope creep into M5/M5b | Explicit non-goals below; no three.js/flowchart layout/question widgets/connector implementations. |

## 5. Execution order (after approval)

1. **A** — schemas, fixtures, validation, JSON Schema, schema tests; old fixtures migrated.
2. **B1–B2** — SDK/registries + middleware; toy third-party plugin test; built-ins moved behind manifests.
3. **B3, B5, B6, B7** — layout model, persistence, cap/assets, strings.
4. **B4, B8, B9** — assessment state machine, profiles/generators, connector registry + model tools (mocks).
5. **C1–C2** — layout engine, group/list, component anatomy, docs generation, customization-surface test.
6. **C3–C4** — camera extension, exam enforcement.
7. **C5–C6** — states/density/RTL/SSR/headless/devtools, starter packs.
8. **D** — `/m4b` showcase, captures, self-review; full gates; **stop for approval**.

Each step ends with tests + `tsc` + both builds; commits per coherent slice (not one giant commit).

## 6. Explicit non-goals for M4b

- Flowchart/timeline/compare **rendering** (M5); flowchart layout engine (M5).
- Question and assessment **widgets**, flashcards UI, navigator UI, exam simulator (M6b).
- `model3d`/`scene3d` **runtime**, three.js, loaders/decoders, picking, WebGL fallback (M5b).
- Reference connector **implementations** (`static`, `http`, cache, prefetch) — M5b. M4b: contract, registry, mock tests.
- Storybook, authoring docs, full devtools, BoardControls polish (M7).
- Any new first-party opt-in plugin; any model-preparation CLI (requires separate **[ASK]**).

## 7. Approval requested

Approve this reconcile (or amend scope) so M4b can start at Part A. On approval I will:

1. Log the M4b rulings in `DECISIONS.md` as they land.
2. Execute A → D in the order above, keeping M1–M4 green.
3. Build `/m4b` and its Layout showcase, capture evidence, self-grade honestly.
4. **Stop at the Layout showcase gate for human approval** before M5.
