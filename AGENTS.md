# dreamer-genui: Coding Agent Brief

> Read this whole file before writing code. It is the source of truth for scope, protocol, architecture, deliverables and working rules. Where something is marked **[AGENT DECIDES]**, pick a sensible default, record it in `DECISIONS.md`, and continue. Where something is marked **[ASK]**, stop and ask the human before proceeding.

---

## 1. Mission

Build **`dreamer-genui`**, a generic, **web-only** React / Next.js library that renders **tutor-authored JSON** as an animated, interactive "classroom blackboard" explanation, and reports the student's interactions back to the host as typed events.

The library is **generic**. It knows nothing about any specific LLM, tutor, curriculum, database or product. The first consumer is an AI tutoring app (JifunzeAI, Kenyan K-12), but nothing in the library may reference it.

**The contract:** operations in, events out.

```
Tutor (LLM) ── JSON ops ──▶ [validate] ──▶ [board state] ──▶ [render + animate]
     ▲                                                            │
     └──────────── next turn ◀── UIEvent (focus/select/answer…) ◀─┘
```

### The experience to replicate
A motion-graphics explainer / teacher at a blackboard:
- The tutor explains a concept (e.g. "Define biology → *Biology is the study of living things*"). Key phrases are **highlighted, circled or underlined** as they animate in, in a deliberate order.
- Illustrations and diagrams **draw themselves** in.
- Parts of the explanation are **clickable** (e.g. a list of the branches of biology). Clicking one emits an event; the tutor responds by **attaching an explainer** to that item, then the student returns to the original topic, or the tutor **replaces** the board when the topic changes.

---

## 2. Principles

1. **Protocol-first.** One Zod schema is the single source of truth for the renderer, the validator, the JSON Schema export and the tutor's prompt.
2. **Declarative intent.** The model says *what* and *in what order*. The library owns geometry, layout and animation. Models are bad at coordinates; never require them.
3. **Resilient.** A bad, unknown or unloaded node degrades to a fallback. It must never blank or crash the board.
4. **Safe.** No raw HTML, JS or CSS from the model. Sanitize anything that renders as markup.
5. **Light.** Must run well on low-end Android browsers. Heavy code loads lazily.
6. **Pluggable and themable.** Every default is overridable. Built-ins use the same extension mechanism as third parties.

---

## 3. Scope

### In v1
- Board operations: `append`, `attach`, `replace`, `update`, `remove`; history stack for `replace`; detour stack (max depth 2) for `attach`.
- Blocks: `text`, `figure`, `choices`, `steps`, `callout`, `group`, `table`, `math`, `code`.
- Inline marks: `highlight`, `emphasis`, `term`, `focusable`, `annotate` (circle, underline, box, bracket, strike), `math`.
- Figures: `image`, `icon`, `diagram` (layouts: `tree`, `radial`, `flow`, `cycle`), `labeled` (illustration with named parts via **asset packs**), `chart` (bar, line, pie, scatter), `lottie`.
- Motion: per-node `enter` with `order`; `emphasis`; `exit`; reduced-motion support.
- Attachment placement, connectors and target annotation.
- Theming (CSS-variable tokens), customization (slots, overrides), plugin system (manifest + lazy loader).
- Streaming-tolerant rendering of partial replies.
- Generators: JSON Schema export, `getSystemPromptGuide()`, `serializeBoard()`.
- Storybook + a Next.js playground with a mocked tutor.

### Out of v1 (do not build)
- React Native / native.
- Chat UI, LLM calls, networking, data fetching, grading/answer-checking (the host decides correctness).
- Remote runtime plugin loading from URLs (loaders are static `import()` only).
- Explicit timeline authoring (only `enter` + `order`).
- Visual/WYSIWYG builder.

### Optional, propose first [ASK]
- Function plotting and number line figures.
- A small free-text `input` block for Socratic answers.

---

## 4. Tech stack

| Concern | Choice |
| :--- | :--- |
| Language | TypeScript (strict) |
| Validation | Zod (schemas are the source of truth; export JSON Schema) |
| UI | React 18/19, Next.js App Router compatible |
| Animation (React layer) | `motion` (`motion/react`), use `LazyMotion` / `m` to keep the base small |
| Animation (timelines, SVG draw-on, sequencing in figures) | GSAP, **lazy-loaded** only when a scene needs it. Verify current GSAP licence terms before adding and note the result in `DECISIONS.md`. |
| Placement | `@floating-ui/react` (or `@floating-ui/dom`) |
| Diagram layout | `d3-hierarchy` (tree, radial) plus a small in-repo flow/cycle layout. **[AGENT DECIDES]** if `dagre` is truly needed; default is no. |
| Charts | `d3-scale` + `d3-shape` rendering plain SVG (no chart framework) |
| Math | KaTeX with the `mhchem` extension (chemical equations), lazy-loaded, CSS bundled with the chunk |
| Lottie | A light player **without expression support** (evaluate `@lottiefiles/dotlottie-web` vs `lottie-web` light build). **[AGENT DECIDES]**, record why. |
| Code highlighting | Lightweight, lazy, few languages by default. **[AGENT DECIDES]** (e.g. `shiki` with lazy grammars vs a core highlighter). |
| Headless primitives | **[AGENT DECIDES]**: Radix vs React Aria for focus/keyboard behavior; prefer the smaller footprint. |
| Monorepo / build | pnpm workspaces, `tsup`, Changesets |
| Tests | Vitest + Testing Library; Playwright for a few critical flows in the playground |
| Docs / dev | Storybook, Next.js playground app |
| Lint / format | ESLint, Prettier, `tsc --noEmit` in CI |

---

## 5. Repository layout

```
/
├─ packages/
│  └─ dreamer-genui/
│     ├─ src/
│     │  ├─ schema/        # Zod schemas, types, JSON Schema export, prompt guide
│     │  ├─ core/          # registry, validator, board reducer, events, serialize
│     │  ├─ react/         # <Board>, provider, hooks, default components, motion drivers
│     │  ├─ builtins/      # math, chart, table, lottie, code (each lazy)
│     │  ├─ figures/       # diagram layouts, labeled/asset-pack, annotations
│     │  └─ theme/         # tokens, default themes (light, dark, blackboard)
│     └─ package.json      # subpath exports (below)
├─ apps/
│  └─ playground/          # Next.js app: JSON editor → live board, mocked tutor
├─ fixtures/               # canonical example replies (JSON) used by tests + Storybook
├─ DECISIONS.md
└─ README.md
```

### Package subpath exports
- `dreamer-genui` : React renderer, provider, hooks, default registry
- `dreamer-genui/schema` : **server-safe, no React import**. Schemas, types, JSON Schema, prompt guide
- `dreamer-genui/core` : headless engine
- `dreamer-genui/builtins/*` : individual built-ins (tree-shakeable, individually replaceable)
- `dreamer-genui/themes/*` : theme presets and CSS

---

## 6. Protocol (normative draft)

Implement these as Zod schemas, derive the TypeScript types from them. Adjust details if you find a flaw, but **record every deviation in `DECISIONS.md`**.

### 6.1 Envelope and operations

```ts
type Reply = { v: 1; ops: Op[] };

type Op =
  | { op: "append"; blocks: Block[]; after?: NodeId }
  | { op: "attach"; to: NodeRef; blocks: Block[];
      placement?: "right" | "left" | "above" | "below" | "overlay" | "inline"; // default "inline"
      connector?: "line" | "arrow" | "bracket" | "none";
      target?: { annotate?: "circle" | "underline" | "box" | "highlight" | "bracket" | "none" };
      mode?: "inline" | "drawer" | "spotlight" }                               // default "inline"
  | { op: "replace"; blocks: Block[]; title?: string }
  | { op: "update"; id: NodeId; props: Record<string, unknown> }               // validated per node type
  | { op: "remove"; id: NodeId };
```

- `NodeId`: short tutor-authored string, **unique per board**. Reject duplicates with an error.
- `NodeRef`: a node id, or `parentId/itemId` for items inside a node (e.g. `branches/botany`).
- `append`: adds to the end of the board (or after `after`).
- `attach`: opens an explainer **on** an existing node. The rest of the board dims (spotlight). The explainer has a built-in **return** control. Max nesting depth 2; deeper attaches are rejected with `depth-exceeded`.
- `replace`: starts a new board; the old board is **pushed onto a history stack**, not destroyed (supports "back to previous topic").

### 6.2 Nodes (common fields)

```ts
type NodeBase = {
  id: NodeId;
  enter?: Enter;
  emphasis?: Emphasis;
  exit?: Exit;
  alt?: string;          // plain-text fallback. REQUIRED for figure kinds and any non-core/plugin node.
};
```

Blocks are a **discriminated union on `type`** with props flattened onto the node.

### 6.3 Blocks

| `type` | Key props |
| :--- | :--- |
| `text` | `variant: "body" \| "definition" \| "heading" \| "note"`, `content: Inline[]` |
| `figure` | `figure: Figure`, `caption?: Inline[]` |
| `choices` | `prompt?: Inline[]`, `layout: "chips" \| "list" \| "grid"`, `intent: "navigate" \| "answer"`, `multi?: boolean`, `items: { id, label, caption?, icon?, ref? }[]` |
| `steps` | `reveal: "sequential" \| "all"`, `items: { id, title, content: Inline[] }[]` |
| `callout` | `tone: "info" \| "success" \| "warn" \| "danger"`, `title?`, `content: Inline[]` |
| `group` | `layout: "stack" \| "row" \| "grid"`, `blocks: Block[]` |
| `table` | `columns: { id, label }[]`, `rows: Record<string, Inline[]>[]`, `highlight?: { rows?: number[]; cols?: string[] }` |
| `math` | `tex: string`, `display?: boolean` (supports `\ce{}` via mhchem) |
| `code` | `lang: string`, `source: string` |

### 6.4 Inline content and marks

```ts
type Inline = string | Mark;
type Mark =
  | { mark: "highlight"; text: Inline[] | string; color?: ColorToken } & MotionFields
  | { mark: "emphasis";  text: Inline[] | string } & MotionFields
  | { mark: "term";      text: string; definition: string }
  | { mark: "focusable"; text: Inline[] | string; ref: string } & MotionFields   // clickable, emits `focus`
  | { mark: "annotate";  text: Inline[] | string; kind: "circle" | "underline" | "box" | "bracket" | "strike"; color?: ColorToken } & MotionFields
  | { mark: "math";      tex: string };
```

`ColorToken` is a **theme token name** (`accent | info | success | warn | danger | muted`), never a raw colour.

### 6.5 Figures

```ts
type Figure =
  | { kind: "image"; src: string | { asset: string }; alt: string }
  | { kind: "icon"; name: string; alt?: string }
  | { kind: "diagram"; layout: "tree" | "radial" | "flow" | "cycle"; direction?: "down" | "right";
      root?: string;
      nodes: { id: string; label: string; icon?: string; note?: string }[];
      edges: { from: string; to: string; label?: string }[];
      reveal?: "sequential" | "all"; focusable?: boolean; alt: string }
  | { kind: "labeled"; pack: string; art: string;            // asset pack + illustration id
      highlight?: string[];                                  // named part ids
      labels?: { part: string; text: string }[]; alt: string }
  | { kind: "chart"; type: "bar" | "line" | "pie" | "scatter";
      series: { name: string; data: (number | { x: number | string; y: number })[] }[];
      xLabel?: string; yLabel?: string; alt: string }
  | { kind: "lottie"; src: string | { asset: string }; loop?: boolean; alt: string };
```

Rules:
- **No coordinates from the model.** Diagram layout is computed by the library. Labeled illustrations reference **named parts**, never x/y.
- Diagram nodes are individually focusable when `focusable: true` (emit `focus` with `ref = diagramId/nodeId`).
- `alt` is mandatory (except `icon`) and is the fallback when rendering fails.

### 6.6 Motion

```ts
type Enter = { effect: "reveal" | "rise" | "pop" | "sweep" | "draw" | "stagger" | "none";
               order?: number; delay?: number; duration?: number };
type Emphasis = { effect: "pulse" | "underline" | "glow"; order?: number };
type Exit = { effect: "fade" | "shrink" | "none" };
```

- Same `order` plays **together**; groups play in ascending `order`; missing `order` means document order.
- Effects are **named presets**; the schema never contains raw animation parameters beyond `delay`/`duration`.
- Implement effects behind a `MotionDriver` interface so the engine (Motion vs GSAP) never leaks into the protocol:
  - Motion drives React-level enter/exit, layout shifts, dimming, detour expansion.
  - GSAP drives SVG draw-on, annotation strokes, sequenced figure internals, and is loaded lazily.
- Every effect has a `prefers-reduced-motion` fallback (instant or simple fade). Reduced motion must still deliver all content and all interactions.

### 6.7 Events (library → host)

```ts
type UIEvent =
  | { type: "focus";  nodeId: string; ref?: string; label?: string }    // focusable mark, diagram node
  | { type: "select"; nodeId: string; ref?: string; label?: string }    // choices, intent "navigate"
  | { type: "answer"; nodeId: string; value: string | string[] }        // choices, intent "answer"
  | { type: "action"; nodeId?: string; action: "return" | "continue" | "hint" | (string & {}) };
```

Delivered through `onEvent`. The library **never** decides correctness and **never** calls a network.

### 6.8 Errors (library → host)

`onError({ code, nodeId?, type?, detail })` with codes: `invalid-node`, `unknown-type`, `load-failed`, `duplicate-id`, `bad-target`, `depth-exceeded`, `version-mismatch`. Each error produces a visible, graceful fallback (render `alt`/text or a neutral placeholder), never an exception into the host.

### 6.9 Example fixtures (create these as JSON under `/fixtures`)

1. `define-biology.json`: a `text` definition with a `highlight` on "living things" and a `choices` list of branches (`intent: "navigate"`, with refs).
2. `attach-botany.json`: an `attach` to `branches/botany` with `placement: "right"`, `connector: "arrow"`, `target.annotate: "circle"`.
3. `replace-new-topic.json`: a `replace` op.
4. `diagram-radial.json`, `labeled-cell.json`, `chart-bar.json`, `math-chem.json`, `lottie-basic.json`, `streaming-partial.json`, plus invalid fixtures (duplicate id, unknown type, depth exceeded).

---

## 7. Core behaviors

### 7.1 Board state and reducer
- `BoardState`: `{ id, title?, nodes (ordered tree), detours: Detour[], history: BoardSnapshot[] }`.
- The reducer is **pure and deterministic**: `(state, op) => state`. It is the heart of the library and needs exhaustive unit tests.
- `attach` creates a detour linked to the target; opening one while another is open nests (depth ≤ 2).
- The built-in **return** control closes the top detour, restores the dimmed board and emits `{ type: "action", action: "return", nodeId: <detour target> }`.
- `replace` pushes the current board onto `history`; expose `back()` to pop.

### 7.2 Streaming
- Accept **partial replies** (e.g. from the Vercel AI SDK `useObject`/`streamObject`). Applying the same partial repeatedly must be **idempotent** (key by op index + node id).
- A node animates in **when it is complete**, not while partial; show a lightweight skeleton for incomplete nodes.
- Provide `board.applyPartial(partial)` and `board.applyFinal(reply)`.

### 7.3 Resolver, registry and plugins
- A **registry** maps `type` → `{ schema, load: () => Promise<Component> | Component, fallback?, promptGuide }`.
- A **plugin** is `{ name, version, types: Record<string, TypeManifest> }`. The **manifest** (schema + prompt snippet) is tiny and always loaded; the **implementation** is lazy.
- Resolver steps per node: look up type, validate against its schema, load the implementation (start loading as soon as the type appears in a stream, not when the node completes), render. Show a skeleton while loading; play `enter` after load.
- Unknown type, invalid props or failed load: render the fallback (`alt` text) and call `onError`.
- **Built-ins use exactly this mechanism** (dogfooding): `math`, `chart`, `table`, `lottie`, `code` are registered by default but **loaded lazily**. Shipped by default does not mean loaded by default.
- Hosts can override any built-in via the registry. Loaders must be static `import()` calls (Next.js bundler requirement).

### 7.4 Asset packs
- An asset pack is a plugin type: `{ id, arts: { [artId]: { svg: string, parts: { [partId]: { label, description? } } } } }`.
- SVGs are sanitized at registration. Named parts correspond to element ids. `labeled` figures highlight/label **by part id**.
- The pack manifest (art ids + part ids) is injected into the prompt guide so the tutor can only reference parts that exist.
- Ship a small starter pack as examples (suggested: `cell`, `heart`, `flower`); keep them simple and clearly structured. Real curriculum art will be added later by the human.

### 7.5 Attachment layout
- Placement uses collision-aware positioning. On narrow viewports, `left`/`right`/`overlay` **automatically fall back** to `below`/`inline`. The tutor must never need to know the screen size.
- `connector` is an SVG path drawn from target to attachment with a draw-on animation.
- `target.annotate` draws a hand-drawn-style stroke around the target (the same primitives used by the inline `annotate` mark).
- Default presentation: **inline expansion with the rest of the board dimmed**.

### 7.6 Blackboard feel
- New blocks auto-scroll into view (respect user scroll: don't yank if the user scrolled away; show a "new content" affordance instead).
- Older blocks fade slightly relative to the active area.
- Ship a `blackboard` theme (chalk-style) alongside `light` and `dark`.

### 7.7 Theming and customization
- **Tokens** as CSS variables: colour roles, font families and scale, radius, spacing, motion durations and easings. Theme = object of tokens. Runtime swap; dark mode via both `prefers-color-scheme` and an explicit setting.
- Works with plain CSS; Tailwind-friendly but **not required**.
- Three customization levels: (1) token overrides, (2) per-component `classNames` / slots, (3) replace a component via the registry.
- All built-in UI strings (e.g. "Return", "Hint") overridable for i18n.

### 7.8 Accessibility
- `focusable` marks and choice items are real `<button>`s with accessible names.
- Focus management: opening a detour moves focus into it; `return` restores focus to the originating target.
- Live region announces newly appended content politely.
- `alt` on all figures; charts and diagrams expose a text summary.
- Full keyboard operability; reduced motion honored.

### 7.9 Security
- Never use `dangerouslySetInnerHTML` with model-supplied content. SVG from asset packs sanitized at registration. Lottie player with no expression evaluation. KaTeX with `trust: false`.
- Validate **everything** with the schema before rendering; enforce limits (max nodes per board, max text length, max diagram nodes). Make the limits configurable.

---

## 8. Generators (for the tutor and the host)

1. **`schemaToJsonSchema(options?)`**: JSON Schema derived from Zod, registry-aware (includes plugin types), for structured-output / tool-call schemas.
2. **`getSystemPromptGuide(options)`**: returns a compact prompt section that teaches the tutor the reply format:
   - the envelope and ops, when to use `append` vs `attach` vs `replace`;
   - available block types, marks, figures and motion rules (`order`);
   - **registry-aware**: includes manifests' prompt snippets for built-ins, plugins and asset packs (including part ids);
   - 2-4 short worked examples drawn from `/fixtures`;
   - options: `include`, `exclude`, `compact: boolean`, `language`.
3. **`serializeBoard(state)`**: compact outline for the tutor's context each turn: board id/title, node ids, types and labels (including `parent/item` ids), open detours, history titles. The model can only reference ids it knows exist.
4. **`getCapabilities(registry)`**: list of supported types/kinds the host can send to the tutor.

All four must work **without importing React** (server-safe, from `dreamer-genui/schema` or `/core`).

---

## 9. React API (target shape)

```tsx
const registry = createRegistry({ plugins: [...builtins] });   // built-ins included by default

<DreamerProvider registry={registry} theme="blackboard">
  <Board
    store={board}                    // from useBoard()
    onEvent={(e) => sendToTutor(e)}  // UIEvent
    onError={(err) => report(err)}
  />
</DreamerProvider>

const board = useBoard();            // { state, applyFinal, applyPartial, back, reset }
```

`useBoard` must be usable with streamed partials and also with plain non-streamed replies.

---

## 10. Deliverables and acceptance criteria

Work **milestone by milestone**. Do not start a milestone until the previous one's acceptance criteria pass. Commit per milestone with a clear message.

### M1: Protocol
- Zod schemas for everything in section 6; inferred TS types; JSON Schema export.
- All fixtures from 6.9 (valid and invalid) with a test that validates each as expected.
- `v` versioning policy documented in `README`/`DECISIONS.md`.
- **Accept:** `pnpm test` passes; invalid fixtures yield the expected error codes; schema package imports with no React present.

### M2: Core
- Registry with manifest/loader split; validator; resolver logic (headless); pure board reducer with history + detour stacks; event bus; `serializeBoard`; `getSystemPromptGuide`; `getCapabilities`.
- **Accept:** reducer unit tests cover every op and every error path (duplicate id, bad target, depth > 2, replace/back); prompt guide snapshot test; idempotent partial application test.

### M3: Renderer
- `DreamerProvider`, `Board`, `useBoard`; default components for `text`, `choices`, `callout`, `steps`, `group`, marks (`highlight`, `emphasis`, `term`, `focusable`); theme system with `light` and `dark`; Motion-based driver with reduced-motion fallbacks.
- **Accept:** playground renders `define-biology.json`; clicking a `choices` item fires `select`; keyboard operable; axe checks pass in Storybook; reduced-motion renders everything instantly.

### M4: Blackboard behavior
- `attach` with placements, connectors, `target.annotate`, spotlight dimming, return control, focus management; `replace` + history `back()`; auto-scroll behavior; streaming partial rendering with skeletons; `blackboard` theme.
- **Accept:** `attach-botany.json` works end to end including narrow-viewport fallback; detour depth cap enforced; `streaming-partial.json` shows progressive rendering without flicker or duplicate animations.

### M5: Figures
- `icon`, `image`, `diagram` (all four layouts with sequential reveal and focusable nodes), `labeled` with asset-pack support and the starter pack, annotation primitives, lazy GSAP chunk.
- **Accept:** each layout renders from fixtures; GSAP is not in the initial bundle (verify with a bundle analysis); every figure shows `alt` as fallback when forced to fail.

### M6: Built-ins
- `math` (KaTeX + mhchem, block and inline), `chart` (bar/line/pie/scatter via d3 + SVG), `table`, `lottie` (expression-free), `code`. All registered by default, all lazy.
- **Accept:** `math-chem.json`, `chart-bar.json`, `lottie-basic.json` render; unregistering a built-in makes it fall back gracefully with `unknown-type`; overriding a built-in via the registry works; prompt guide lists them automatically.

### M7: Playground and docs
- Next.js playground: JSON editor ⇄ live board, fixture picker, theme switcher, event log, error log, a **mock tutor** that replies to events with canned ops (so the "click branch → attach → return → replace" loop can be demoed).
- Storybook story for every component and every fixture.
- README with quick start, concept guide, schema reference, theming guide, plugin guide (including writing an asset pack), and the tutor integration guide (prompt guide + serializeBoard + event loop with the Vercel AI SDK).
- **Accept:** a new developer can install, render a fixture, theme it and register a custom plugin by following the README alone.

---

## 11. Quality bars

- **TypeScript strict**, no `any` in public API.
- **Bundle budget (initial targets, revisit with data):** core + React renderer, excluding lazy chunks, ≤ ~45 KB gzipped. KaTeX, Lottie, GSAP, code highlighting and chart code must all be **separate lazy chunks**. Add a size check script and fail CI on regressions beyond an agreed threshold.
- **Performance:** no layout thrash during entrance sequences; animate transform/opacity where possible; keep scenes smooth on a low-end Android phone (test with CPU throttling in the playground).
- **Test coverage:** reducer, validator, resolver and prompt-guide generation must be thoroughly tested; component tests for each interactive element.
- **Determinism:** same ops produce the same board state and the same animation order.
- **Docs:** every public export has TSDoc.

---

## 12. Working agreement

1. Follow milestones in order. Show a short plan before each milestone.
2. Do **not** change the protocol silently. If you find a flaw, propose the change, apply the smallest fix, and log it in `DECISIONS.md` with the reason.
3. **[ASK]** before adding anything from "Optional, propose first" or anything outside the v1 scope.
4. Keep the library generic. No tutor-, curriculum- or product-specific code or strings in `packages/`. Product-specific behavior belongs in the playground or in the host app.
5. Prefer small, well-named modules; keep the schema package free of React and DOM imports.
6. When something is ambiguous, pick the simplest option that preserves extensibility, record it, and keep moving.
7. Never add network calls, analytics or telemetry to the library.

---

## 13. Decisions the agent must make and record

Record each choice with a one-paragraph rationale in `DECISIONS.md`:
- Radix vs React Aria (or neither) for headless primitives.
- Lottie player choice and how expressions are disabled.
- Code highlighter choice and default languages.
- Whether `dagre` is warranted (default: no).
- GSAP licence check result.
- Exact bundle budget thresholds after the first measurement.
- Naming of tokens and effect presets if any need to change.

---

## 14. Background (for context only)
The first consumer is JifunzeAI, a Kenyan K-12 tutor whose Tutor AI emits these ops from a system prompt generated by `getSystemPromptGuide()`. The host app sends `serializeBoard()` and capabilities to the Tutor each turn and forwards `UIEvent`s as the student's next input. Typical flow: the tutor defines a concept with highlighted phrases and a list of related topics → the student taps one → the tutor `attach`es an explainer to it → the student returns → eventually the tutor `replace`s the board when the topic changes. None of this is encoded in the library; it only renders what the ops describe.
