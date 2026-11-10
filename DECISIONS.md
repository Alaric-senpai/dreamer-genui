# DECISIONS.md — dreamer-genui

> Record each decision with a one-paragraph rationale.

---

## Versioning

- `v: 1` is the only accepted protocol version. All `Reply` objects must have `v: 1`.
  - Rationale: Single-version schema simplifies validation; multiple versions would burden both the tutor and renderer with migration logic.
- Version increments require a migration plan and a new Zod schema version published under a new npm version.
  - Rationale: Backwards compatibility at the schema level ensures host apps can pin to a specific schema version.

---

## [AGENT DECIDES] Technical Choices

### Radix vs React Aria vs neither

**Decision: React Aria** (via `@react-aria/focus` / `@react-aria/interactions`)

Rationale: `@react-aria/*` packages are tree-shakeable, framework-agnostic, and provide best-in-class keyboard/focus behavior without the full Radix UI dependency bundle. For a library targeting low-end Android browsers, smallest footprint wins. React Aria powers the focus management and keyboard behavior without pulling in Radix's component primitive overhead. Implementation deferred to M3 (Renderer milestone).

---

### Lottie player

**Decision: `@lottiefiles/dotlottie-web`** — expression-free, smaller than `lottie-web`

Rationale: The spec requires "expression-free" (security). `dotlottie-web` is modern, web-first, smaller than `lottie-web`, and deliberately excludes expression evaluation. Full implementation deferred to M6 (Built-ins milestone). Will verify bundle size vs `lottie-web` light build at that point.

---

### Code highlighter

**Decision: `shiki` with lazy grammars**

Rationale: Best quality tokenization, tree-shakeable via lazy grammar loading, zero runtime cost until used. `shiki` supports server-side rendering which aligns with Next.js App Router. Default languages: JavaScript, Python, TypeScript, JSON. Full implementation deferred to M6 (Built-ins milestone).

---

### `dagre` for diagrams

**Decision: No `dagre` — use `d3-hierarchy` + in-repo flow/cycle layout**

Rationale: `d3-hierarchy` handles `tree` and `radial` layouts natively. The `flow` and `cycle` layouts are simple enough to implement in-repo (positional layout with configurable direction). Adding `dagre` would add a ~30 KB dependency for just the hierarchical layout algorithm that `d3-hierarchy` already covers. Revisit if `tree` layout with complex multi-parent edges proves insufficient.

---

### GSAP licence check

**Decision: Deferred — check licence before adding in M5**

GSAP licence: "Free for commercial use with attribution" (GSAP Standard). Not copyleft. The key concern is not licence pollution but ensuring we correctly attribute GSAP in the product. Will verify current licence terms in M5 when implementing `draw` and `stagger` effects for SVG diagrams and annotation strokes. If licence changes or attribution becomes problematic, fall back to CSS animations + manual SVG draw-on with `motion` library.

---

### Bundle budget thresholds

**Decision: 45 KB core (initial), lazy chunks unlimited pending measurement**

Initial targets per spec:
- Core + React renderer (excluding lazy): ≤ ~45 KB gzipped
- KaTeX, Lottie, GSAP, code highlighting, chart code: separate lazy chunks

Will measure actual sizes with `pnpm build && du -h dist/*.js` after M3 and set precise thresholds before CI is added in A10. Current gz estimate (before any real code): schema package ~8 KB, core minimal ~12 KB. Threshold is provisional.

---

### Naming of tokens and effect presets

**Decision: Follow spec exactly**

No changes from spec names. Tokens use CSS custom property names (`--color-accent`, `--color-info`, etc.). Effect presets use spec enum values (`reveal | rise | pop | sweep | draw | stagger | none`). Colour tokens are theme token names only (`accent | info | success | warn | danger | muted`), never raw hex colours.

---

## Deviations from AGENTS.md (recorded)

### Inline: arrays are not `Inline` directly

AGENTS.md section 6.4 defines `type Inline = string | Mark` — no array form. The spec shows `content: Inline[]` in blocks. So `['hello', mark]` is `Inline[]`, not `Inline`. Schema tests confirm this. Decision: `Inline` is `string | Mark` only; arrays use `z.array(InlineSchema)`.

---

## M1 Rulings During Implementation

1. **Ruling: `zod-to-json-schema` v3 uses `anyOf` not `oneOf`** for discriminated unions. Test updated to check `hasUnionType` instead of asserting `oneOf`. — Cost if wrong: negligible; JSON Schema is for tool-call schemas, not runtime validation.

2. **Ruling: `MotionFieldsSchema.shape` spread before explicit fields may cause field-order issues** — Avoid using `...MotionFieldsSchema.shape` at object start. Define `order`, `delay`, `duration` explicitly in each schema that needs them. — Cost if wrong: fields silently dropped from parsed objects, visible in UI as missing.

3. **Ruling: `zod-to-json-schema@^3.25.2`** (not `^4.0.2`) — v4 does not exist on npm. — Cost if wrong: install failure.

4. **Ruling: `z.array(InlineSchema)` not needed in schema** — Block schemas use `z.array(InlineSchema)` directly for `content` fields. Inline schema itself is `z.union([z.string(), MarkSchema])`. — Cost if wrong: would need refactoring if inline ever needed to be recursive.

---

## M2 Rulings During Implementation

1. **Ruling: `EventBus` is generic (`EventBus<T>`)** — The resolver holds a separate `EventBus<UIEvent>` (framework events to the host) and `EventBus<LibraryError>` (errors to the host). A non-generic bus would force unsafe casts when emitting typed payloads. — Cost if wrong: type-erased event payloads at the host boundary.

2. **Ruling: `back()` with empty history is a no-op** — Popping nothing leaves the board (including open detours) unchanged; detours are only cleared when a snapshot is actually restored. — Cost if wrong: a stray "Back" tap could silently wipe an open detour.

3. **Ruling: zod `.optional().default()` makes fields required in the inferred OUTPUT type** — `AttachOp` output requires `placement`, `connector`, `mode` even though Zod parse accepts them missing. Constructing attach op literals in TS requires providing all three (library-internal code and tests; fine, defaults made explicit). — Cost if wrong: type errors or accidental contracts where defaults aren't documented.

4. **Ruling: idempotency key is `"${index}:${contentHash(op)}"`** — index alone is not stable across partial refetches; content hash guards against tutor edits mid-stream producing duplicate node ids. — Cost if wrong: duplicate nodes or silently skipped ops during streaming.

5. **Ruling: resolver exposes errors via `errors` event bus + `onError` callback** — Both the stream API (`onError` per host) and bus (Blurs the line: `errors` bus is for internal observers, `onError` is the host-facing path). Duplicate handlers are okay (idempotent surface). — Cost if wrong: error delivered twice during a host event.

6. **Ruling: prompt guide escapes double backslashes in template literals** — KaTeX `\\ce{}` needs one literal backslash in the emitted guide; template-literal escaping produces the desired `\\ce{...}` JSON escape. Verified in worked examples. — Cost if wrong: tutor copies an escaped wrong and gets a KaTeX parse error.

---

## M2 Deliverables

- `packages/dreamer-genui/src/core/`: `types.ts`, `errors.ts`, `events.ts` (generic `EventBus<T>`), `registry.ts` (9 built-in manifests with `promptGuide` snippets, lazy loader hooks), `validator.ts` (`validateOp`, `resolveNodeRef`, `MAX_DETOUR_DEPTH = 2`), `reducer.ts` (pure `boardReducer`, `back`, `createBoard`), `resolver.ts` (`BoardResolver` with `events`/`errors` buses, idempotent `applyPartial`, history-capped `back`), `generators/` (`serialize-board.ts`, `prompt-guide.ts`, `capabilities.ts`), `index.ts` (public re-exports).
- Tests: `tests/core/{reducer,resolver,validator,registry,events,generators}.test.ts` — 58 core tests. Total suite: **144 tests, all passing**; `tsc --noEmit` clean; zero React import in `schema/` and `core/`.

---

## M2 Review Round (independent reviewer → request-changes → all findings fixed)

Independent reviewer verified with commands and found 8 majors + several minors. Fixes applied:

1. **`applyFinal` was ledger-blind** — the canonical streaming flow (partials → final) re-validated every op and produced a `duplicate-id` storm. `applyFinal` is now ledger-aware (skips already-applied keys, retries failed ones, then clears the ledger); test asserts zero error emissions.
2. **`parentId/itemId` refs bypassed `bad-target`** — `resolveNodeRef` now returns the parent id only when the parent node exists in board state.
3. **Intra-op duplicate ids slipped through** — duplicate detection is now set-based per op, checking the op itself, existing nodes, and open detour block ids.
4. **Detour block ids invisible** — `serializeBoard` now lists each detour block's id and type, and also emits `parentId/item` refs for `choices`/`steps`/`table`, so the tutor can reference detour items and items next turn. `Detour` gained `targetRef` (original authored ref) for the M4 return control.
5. **Prompt guide is registry-aware** — per-type snippets now come from registered manifests (built-ins and plugins alike); `include` filters types, `exclude` supports `ops`/`protocol`/`examples`/type ids, `compact` omits protocol details and examples, `language` appends an output instruction. Snapshot test added.
6. **Registry manifests used loose hand-rolled schemas** — they now import the canonical per-type schemas from `schema/blocks.ts` (single source of truth; the registry can never drift from the protocol schema). Per-type schemas are exported from `blocks.ts` for this purpose.
7. **Resolver never consulted the registry** — a registry precheck runs before schema parse so unknown block types surface as `unknown-type` (not generic `invalid-node`).
8. **Idempotency hash was prefix-based** — replaced with a full-string djb2 hash; retry-on-failure semantics documented on `applyPartial`/`applyFinal`.
9. **Minors:** `update` props can no longer override `id`/`type`; `remove` drops detours targeting the removed node; history-cap (50) now tested; `./core` subpath export added (plus the matching tsup `core/index` entry after review round 2 flagged the build miss); `foo` stub removed from the root export; `core/index.ts` re-exports the protocol types; figure kinds derived from `FigureSchema` instead of a duplicated list.

Verification: `pnpm test` → **160/160 passing**; `tsc --noEmit` clean; build emits `dist/core/index.js` (esm/cjs/dts) and the `./core` export was import-verified in node. Commits: `403282c` (M2 initial) → `2b778ab` (review round 1 fixes) → `d5fb9ae` (review round 2: tsup core entry + nit sweep). Final verdict: **approve**.

### Deferred rulings (recorded, not silently dropped)

- **Per-node registry resolution (loader kickoff, skeletons, fallbacks) is wired in M3**, not in the headless resolver. The M2 resolver validates + reduces + routes unknown-type; full manifest-driven loading happens when the React renderer builds the pipeline (AGENTS 7.3).
- **`update` props are not validated per node type at M2** — the resolver applies them through a merge that excludes identity fields; full per-type validation arrives with the M3 registry-driven node resolution.
- **Registry-wired tape**: `back()` restores the snapshot without re-opening its detours (detours were cleared when the snapshot was pushed); acceptable for "back to previous topic" semantics and unchanged from the M2 plan.

---

## M3 Rulings (renderer)

1. **Native `<button>` instead of React Aria for choices/term/focusable** — axe-clean markup with `aria-pressed` (multi-select choices) and `role="button"` terms; zero extra bundle. `@react-aria/focus`/`interactions` remain installed (M4 will use them for roving focus if needed). — Cost if wrong: rework if keyboard focus management outgrows native semantics.

2. **`LazyMotion features={domAnimation} strict`** — `m.div` only works inside the provider's `LazyMotion`, which tree-shakes motion to the dom-animation feature set and hard-throws on forbidden usage. `MotionDriver` presets animate transform/opacity only. GSAP untouched (M5). — Cost if wrong: silent bundle growth.

3. **Reduced motion renders plain divs** — `createReducedMotionDriver()` returns `null` for every preset, so `<Animated>` takes the unanimated path; content, ordering, and interactions are identical. Enforced by test: wrappers must carry no inline animation styles. — Cost if wrong: motion-safety regression invisible to tests.

4. **jsdom matchMedia stub with getter-backed `matches` + listener notification** — motion initializes its reduced-motion store on the first `useReducedMotion()` call and holds the query object forever; a static `matches` value freezes the first (false) state across tests. `setup.ts` re-evaluates `matches` on each access and `setReducedMotion(on)` notifies subscribed listeners. — Cost if wrong: order-dependent false-green tests.

5. **`BoardStore` = headless `BoardResolver` + version counter** — `useSyncExternalStore` subscribes to a monotonically increasing integer; state is read imperatively on each render. Mutating methods wrap the resolver and bump `version`. — Cost if wrong: stale or looping renders.

6. **Live region announces only the newest node** — `role="status"` + `aria-live="polite"` + `aria-atomic`, one node text per append; announcing the whole board each op would be noise. — Cost if wrong: verbose screen-reader output.

7. **Group nesting capped at one level (`nested` prop)** — a group inside a group renders `FallbackView` and emits `depth-exceeded`; recursion is bounded by the renderer regardless of protocol validation. — Cost if wrong: stack overflow on adversarial content.

8. **`term` mark anchors to itself** — `emit({ type: 'focus', nodeId: mark.text, label: definition })`; the protocol has no ref on `term`, so the term text is the anchor id tutors match on.

9. **Node-state classes are part of the surface** — every rendered node wrapper gets `dgui-node dgui-node-<state>` + `data-node-id`; hosts (and M4 behavior) style/hook off these classes rather than re-rendering internals.

10. **Peer deps for React** — `react`/`react-dom` are `peerDependencies >=18 <20`; `motion` a regular dep. Root devDeps carry react 19 for the test env (pnpm workspace, playground uses react 19.2.8).

### Deferred to M4+

- **Per-node registry-driven resolution** (loader kickoffs, skeletons, per-type update validation) — the M2 deferral still stands; M3 renders resolver output with fallback views.
- **Board-level `onEvent`** is plumbed as a prop but events currently flow through the provider sink; merging both sinks is M4.
- figure/table/math/code render `FallbackView` until M5 (figures) / M6 (table/math/code).

## M3 Deliverables

- `packages/dreamer-genui/src/theme/tokens.ts`: token set (colour roles, typography, shape/space, motion), `lightTheme`/`darkTheme`, `resolveTheme(name, overrides)`.
- `packages/dreamer-genui/src/react/motion/`: `driver.ts` (`MotionDriver`, enter/emphasis/exit presets, `createMotionDriver` + `createReducedMotionDriver`, `STAGGER_SECONDS = 0.12`), `animated.tsx` (`MotionProvider` with `LazyMotion strict` + reduced-motion driver selection, `Animated` rendering `m.div` or plain `div`).
- `packages/dreamer-genui/src/react/provider.tsx`: `DreamerProvider` (registry, theme CSS variables on wrapper, event/error sinks, i18n strings), `useDreamer`, `useEmitEvent`.
- `packages/dreamer-genui/src/react/use-board.ts`: `createBoardStore`, `useBoard`, `useBoardVersion`.
- `packages/dreamer-genui/src/react/components/`: `inline.tsx` (highlight/emphasis/term/focusable/annotate/math marks), `blocks.tsx` (Text variants, Choices chips/list/grid + select/answer, Callout, Steps, Group), `block-renderer.tsx` (`NodeView`, `FallbackView`, group nesting cap, M5/M6 placeholders), plus `board.tsx` (`Board` + live region) and `index.ts`.
- `apps/playground/`: Next 16.4 playground (fixture picker incl. invalid fixtures, live board, event/error logs, light/dark switch) — `next build` passes.
- Tests: `tests/react/board.test.tsx` (13 tests). **Total: 173/173 passing; `tsc --noEmit` clean; `pnpm --filter dreamer-genui build` emits `dist/react/index.js` (esm/cjs/dts); `grep` confirms zero React imports in `schema/` and `core/`.**

---

## Brief update: AGENTS.md v2 (M0)

**Naming ruling (M0).** The package remains **version 1**; the brief's depth additions (triggers, cue engine, theme/mood system, camera, ambience, kinetic text) are executed under the ordinary milestone names M0–M7 with no version bump and no `v2-`-prefixed artifacts. "AGENTS.md v2" appears only where it names the brief document itself.

**GSAP licence check (§14, required before motion work).** Webflow acquired GreenSock (Oct 2024); since 30 Apr 2025 GSAP is 100% free for everyone, including all previously-paid plugins, under the GSAP Standard License. That license excludes use in a competing visual/no-code animation-builder product. `dreamer-genui` is not such a product; the playground is a developer demo, not a visual authoring tool. Result: **cleared to add GSAP as a lazy dependency** (deferred to M5 per plan). — Cost if wrong: re-evaluate if dreamer-genui ever ships a visual timeline editor.

**Reviewer round 1 (old-brief M3) — all findings fixed, committed at `9831104`.** Majors: ChoicesView selection now component state (multi-select accumulates); resolver error bus bridges to host sinks via `Board` (pre-mount errors buffered and replayed to the first subscriber); live announcer keyed on newest node *id* (announces `replace`, richer text: marks/labels/alt). Minors: emission errors in effects not render; figure `alt` surfaced in fallback; term Space preventDefault; provider context memoized; playground loads a fixture on mount; fixtures de-duplicated (playground imports the repo `fixtures/`); `exit` documented as AnimatePresence-gated (M4).

**Protocol migration policy for the updated brief.** The protocol is migrated in place (breaking to internal wiring, since there are no external consumers yet): `--dgui-*` token prefix renames to `--dg-*`; fixtures adopt the new names (`define-biology`→`define-term`, `attach-botany`→`attach-explainer`, new cue/theme/camera fixtures); the `theme` op reduces state (board or detour scope) while the `camera` op is presentation-only (validated, emits no state change beyond a clock/resolver surface). Every effect/easing/tempo value moves to a central presets table so the v3 reference pass can retune quickly.

**User host edit noted (not agent-authored).** `apps/playground/app/layout.tsx` + `apps/playground/fonts/` (Montserrat + JetBrains Mono variable fonts, local) are the host font identity — flagged into the M3 theming work. The file currently has a comma-operator type error and is corrected during M3, not before.

## M2 core — rulings

**Entry gates are derived, not stored (cue engine).** Nodes stay payload-only; "entered" is a pure projection (`core/cues.ts: computeEntryPlan(state, pacing)`) over `firedCues`/`firedEvents`/`flushed` + triggers. The resolver diffs entry plans after every state change and emits `onEnter` on the enter bus. Mark-level triggers are renderer timing (M3 kinetic text), not board gates.

**`after`-cycle handling.** Detected in the validator at op-arrival, among the op's own blocks (chains into existing state cannot cycle). Cyclic triggers are rewritten to `start`; the op still applies; a `cue-cycle` `LibraryError` is emitted on the error bus and carried on the `ResolvedOp` as a non-fatal warning on an `applied` result.

**Theme pipeline layering.** The pure reducer never sees a raw `ThemeSpec`: the resolver runs `createThemeResolver` (policy → mood → tokens → contrast) and applies the resulting `ResolvedTheme` via `applyResolvedTheme`. `scope:"detour"` themes live on the Detour record (revert when the detour closes); board theme resets on `replace` and is restored with cues/events/flush flags through history snapshots via `back()`.

**Theme policy semantics.** `none` rejects whole requests; `moods` permits mood/intensity/ambience/surface/transition and warns (`theme-rejected`) while stripping `tokens`; `moods+tokens` applies tokens (still sanitised: parsed colours hex/hsl/oklch only, CSS-unsafe font strings dropped, numbers clamped, WCAG AA enforced). Rejections are per-piece: a valid mood survives an invalid ambience name. Precedence: library defaults < host baseline < mood (blended by `intensity`) < spec tokens.

**Contrast guardrail.** Roles `ink`/`muted` at 4.5:1, accent family at 3:1, checked against both `bg` and `surface`; adjusted colours re-emit as `rgb(r g b)` and hosts are notified via `onThemeAdjusted`/adjusted roles. Shipped example presets (`calm`, `solemn`, `playful`, `eerie`) ship AA-passing (tested); `playful.warn` was darkened from `#d9971e` to `#b97400` to meet 3:1 on white.

**Op typing and apply signatures.** Op types stay `z.infer` (defaults baked); `applyOps/applyPartial/applyFinal` accept `ReplyLike { v?, ops: readonly unknown[] }` — parse-time Zod baking keeps the wire permissive for hosts and tests.

**Registry-aware JSON Schema.** `registryToJsonSchema(registry)` rebuilds the reply envelope with mood/ambience/surface enums from registry entries, so a schema-constrained tutor can only name registered presets.

### M2 review round 1 — fix rulings

The independent reviewer (see `review-m2.md`) returned **fix-first** with three majors; all fixed and re-verified:

1. **`attach.theme` is detour-scoped (§6.1).** A `theme` object carried on an `attach` op applies only to the open detour record (reverts on return), never the board. `theme` ops keep their own `scope`; `replace` themes the new board. Pinned by tests.
2. **Contrast guardrail rewritten for two-background correctness.** Text roles are adjusted against ALL backgrounds (smallest passing step in both white/black directions; a "best improvement" fallback so a role is never made worse than its original). When no ink adjustment can satisfy both `bg` and `surface` (internally contradictory palette), `surface` moves toward `bg` in steps until ink passes — verified on the reviewer's pathological case (white bg + dark-green surface). Also fixed a double `/255` in `relativeLuminance` that had flattened all ratios to ~1.0.
3. **Product string removed.** JSON Schema top-level name `JifunzeReply` → `DreamerGenuiReply`; packages/ keeps zero product references (grep-checked).

Additional fixes along the way: `rgb()/rgba()` numeric forms now re-parse in `color.ts` so guardrail output round-trips through the theme resolver. The `playful.warn` darkening to `#b97400` landed in the M2 core commit (the first contrast implementation flagged it); this round re-verified all shipped presets as needing zero adjustment with the corrected luminance math. A true detour-close revert test (board theme restored after closing the detour) is deferred to M4, together with detour closing itself.

## M3 — rulings (batch 1: provider, board shell, token foundation)

**Token prefix and name map (§7.6).** All CSS custom properties renamed `--dgui-*` → `--dg-*` (audit first-decision). Map: schema `ThemeTokens.color.role` → `--dg-color-<role>` (bg|surface|ink|muted|accent|info|success|warn|danger|border), `font.display/body/mono` → `--dg-font-*`, `radius.*` → `--dg-radius-*` (px), `space.scale` → `--dg-space-scale`, `motion.speed/ease` → `--dg-motion-speed/ease`, `texture.grain/vignette` → `--dg-texture-*`. Renderer-internal extras (not tutor-facing): `--dg-text-hero|heading|body|small|kicker`, `--dg-line-height`, `--dg-motion-duration-base`. `theme/tokens.ts` carries `tokensToVars()` and `resolveTheme('light'|'dark')`. Legacy `dgui-*` class names stay until the compiled stylesheet lands (M3d), then rename to `dg-*` in the same commit.

**Engine vs presentation split.** Theme policy/allowlists/baseline/registry/onError and the resolver live at store creation (`createBoardStore({ registry, onError, theme })`) because ops may arrive before React mounts (streaming, SSR data); `DreamerProvider` is presentation-only (registry context, `colorScheme` 'auto' via media query with SSR-safe light default, i18n strings, sink fan-out). §10's `themePolicy`-on-provider is correspondingly documented as engine-level; the deviation is deliberate and noted here.

**Entry gating lives in the Board, not the engine.** The `<Board>` computes the entry plan per render (`computeEntryPlan(state, pacing)`), `pacing` prop overriding a pure `defaultPacing(state)` helper ('cued' once any node uses a cue trigger, else 'auto'). Unentered nodes are unmounted — absent from DOM and accessibility tree. The enterBus keeps emitting at engine level for host sync; visual pacing stays a render concern. Detour blocks (state only carries Block[]) render inside a `.dgui-detour` section via the same Node shape; visual placement/dimming is M4.

**Board theme rendering.** `<Board>` maps `state.theme.tokens` (already policy-blended and contrast-corrected by the M2 resolver: defaults < host baseline < mood < spec tokens) onto the board root as `--dg-*` variables over `resolveTheme(scheme)` defaults, plus `data-dg-mood`/`data-dg-surface` hooks. Token transitions (tween) are M3c/f. Live region announces the newest *entered* node only (unentered content never announced).

## M3 — rulings (batch 2: motion presets table, kinetic text engine)

**One tunable table.** `src/motion/presets.ts` (engine-side, React-free) owns every timing: `EASE` maps the five protocol `EaseName`s to cubic-bezier curves; `ENTER_PRESETS` / `EMPHASIS_PRESETS` / `EXIT_PRESETS` cover each protocol enum value (tests read the enums themselves so the table cannot drift); `KINETIC_PRESETS` covers the text-level effects (split mode, per-unit duration, stagger, ease, reduced-motion behavior); `DEFAULT_TEXT_ENTER` maps the seven text variants to their §9.2 default entrances. `ORDER_STEP_MS = 120` is the sequence beat between different `order` values (same `order` plays together — engine-computed, never protocol data). Components and the driver never hardcode a duration.

**Tempo plumbing.** Scene tempo is theme `motion.speed` (M2 resolver output). `<Board>` provides it via `TempoContext`; `Animated` and the kinetic engine scale durations and order delays through `applyTempo(ms, speed) = ms / speed`. The kinetic presets' stagger steps stretch with tempo so slower moods stay weightier end-to-end.

**Kinetic vs container effects — strict ownership.** The seven kinetic effects (`words|chars|typewriter|slam|wipe|scribble|count-up`) belong to the text engine: the MotionDriver returns `null` for them so containers stay static (no double animation). All other `EnterEffect`s are container-level (`Animated` transforms/opacity). `TextBlockView` dispatch (§9.2): explicit kinetic `enter.effect` → `KineticText`; **no `enter` at all** → `DEFAULT_TEXT_ENTER[variant]` (kinetic by default; a plain render is the exception); container effects → plain text under the `Animated` wrapper. `enter.split` is honored as an override for splitting effects; `'lines'` falls back to the effect's native split until line splitting lands with styling (M3d/e).

**Splitting engine.** `react/kinetic/split.ts` — pure, lossless functions: whitespace runs become their own static units so `joinParts ∘ splitIntoParts = id` (pinned by tests). Inline marks are **never split**: plain-text runs split into animated units, marks render whole through `MarkRenderer` at their position; the wrapper carries `aria-label` with meta text (plain strings, `aria-label` accumulates literal strings via concatenation) and units are `aria-hidden`. Typewriter reveals by character count (marks appear once their slot is typed); count-up tweens the first number in the text with a cubic ease-out (falls back to a rise when no number); wipe is a clip-path sweep; scribble is an SVG stroke under the intact text (refined with hand-drawn primitives in M5; `draw`/`morph` container effects keep crossfade placeholders until M5 brings SVG paths).

**Reduced motion.** Every kinetic preset declares `reducedMotion: 'instant' | 'fade'`. 'instant' renders the plain, complete text (no splitting, no animation mounts); 'fade' applies a single 150 ms fade to the whole run. Content is never gated by animation — DOM text is complete and the wrapper `aria-label` always carries the full content (§9.3).

**Emphasis presentation.** The driver's `emphasis()` returns `{ className: 'dg-emphasis-<effect>', preset }`; visual treatment (CSS keyframes/class styling) lands with the M3d stylesheet, so the M3b contract is testable but the look is not yet styled.

## M3 — rulings (batch 3: theme visuals)

**Theme-transition knobs are variables, not JS tweens.** The resolved theme's `transition` (M2 resolver default 800 ms / 'smooth') is published on the board root as `--dg-theme-duration` / `--dg-theme-ease`; the M3d stylesheet consumes them (`transition: background-color …, color …, border-color …`) so theme changes tween without a JSON-custom-property tween loop, and a `prefers-reduced-motion` media query shortens them to near-instant. The ease value is allowlisted render-side against the five protocol names (defence in depth; the resolver already validates).

**Tempo helper.** `tempoOf(theme?)` is the single derivation of scene tempo (1 for unset/invalid); `<Board>` consumes it for `TempoContext`. Mood presets ship via `EXAMPLE_MOODS` (data, not code — registered by default in the registry, overridable), surfaces via `EXAMPLE_SURFACES` as `data-dg-surface` style hooks until the M3d stylesheet gives them texture/body treatments.

## M3 — rulings (review round 1: kinetic accessibility)

**Kinetic text keeps interactive marks in the accessibility tree (per-segment hiding).** The old structure hid the whole run under one `aria-hidden` wrapper with a string-parts-only label, so a `term` (`role="button"`) or `focusable` (`<button>`) inside animated text was a nameless, hidden, keyboard-focusable control. New contract:
- Plain-text segments split into animated units that live under a **per-segment** `aria-hidden` wrapper; marks render through `MarkRenderer` as LIVE siblings at their positions (never inside any `[aria-hidden]` subtree, therefore never split).
- The run wrapper carries `aria-label = metaText(content)` — the joined meta text of ALL segments (string parts as-is, marks by their `text`, math by `tex`). This removes the double-space artifact ('look at the  now' → 'look at the highlighted phrase now'). A `term` contributes its visible text to the run label; its definition arrives via the mark's own `aria-label` when it announces/focuses.
- **Whole-run effects that swap, clip, or progressively hide text degrade to a static render** when content carries an interactive mark: typewriter and wipe render plainly (no label, no hidden copy). `scribble` is exempt — it never alters text visibility; it now renders content live with only the decorative `svg` stroke `aria-hidden`, so scribble may host interactive marks.
- The count-up no-number fallback renders plainly (a container-style rise needs no hidden copy). Real count-up keeps `aria-hidden` animated digits + full-run `aria-label` (the final value), since animating text content is otherwise a screen-reader nothing-burger.
- Reduced-motion fade duration is the exported `REDUCED_FADE_MS` (150) from `motion/presets.ts` — the single timings table, not a literal in a component. Real-browser/screen-reader verification of this structure happens at the M3 showreel gate (§9.4).
