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

