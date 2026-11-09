# dreamer-genui: Coding Agent Brief

**Version 2.** Supersedes v1 (`DREAMER_GENUI_BRIEF.md`). A v3 will follow once the human supplies reference material for the visual direction (see section 16).

> Read this whole file before writing code. It is the source of truth for scope, protocol, architecture, art direction, deliverables and working rules.
> **[AGENT DECIDES]** means: pick a sensible default, record it in `DECISIONS.md`, continue.
> **[ASK]** means: stop and ask the human before proceeding.
> **Every subject, mood, effect name or lesson topic used as an illustration in this file is an example.** The library must stay generic; nothing may be hard-coded to a subject, curriculum, mood list or product.

---

## 0. First action: audit the existing build

An initial build already exists and was judged **not visually appealing**: it did not feel like a motion-graphic explainer. Before writing new code:

1. Re-read this file completely.
2. Audit the current code against it. Write `AUDIT.md` listing, per section of this file: what exists, what is missing, what is wrong.
3. Propose a remediation plan ordered by the milestones in section 12. Do not rewrite working, correct protocol/core code for the sake of it; **do** rework anything that produces flat, card-based, uniformly-fading UI.
4. Wait for the human's go-ahead on the plan **[ASK]**, then proceed.

### Summary of what changed from v1
| Area | Change |
| :--- | :--- |
| Entrance | Nodes and marks now have **triggers** (cue-based entrance, e.g. when narration reaches a section). Nothing appears until its trigger fires. |
| Theming | The **tutor can set mood and theme** at runtime (new `theme` op, `theme` on `replace`), with an **ambience layer**. Theming is now a first-class, deep system. |
| Styling | First-class **Tailwind** integration **and** plain CSS; the board adapts to the host's global Tailwind config. |
| Motion | New **Art & Motion Direction** section: kinetic typography, beats, camera, expanded effect vocabulary, showreel gate. |
| Protocol | New: `Trigger`, `theme` op, `camera` op, `ThemeSpec`, `hero`/`kicker`/`quote` text variants, expanded effects. |

---

## 1. Mission

Build **`dreamer-genui`**, a generic, **web-only** React / Next.js library that renders **tutor-authored JSON** as an animated, interactive "classroom blackboard" that **feels like a motion-graphic explainer video**, and reports the student's interactions back to the host as typed events.

The library is **generic**. It knows nothing about any specific LLM, tutor, curriculum, voice system, database or product. The first consumer is an AI tutoring app (JifunzeAI, Kenyan K-12), but nothing in `packages/` may reference it.

**The contract:** operations in, events out. Cues in, enter-notifications out.

```
Tutor (LLM) ── JSON ops ──▶ [validate] ──▶ [board state] ──▶ [render + animate]
     ▲                                          ▲                     │
     │                                host cues │ (e.g. narration     │
     │                               reaches a section)               │
     └──────────── next turn ◀── UIEvent (focus/select/answer…) ◀─────┘
```

### The experience to replicate
A teacher at a blackboard **narrating**, who writes or draws something **only when it becomes relevant**, and an explainer-video aesthetic around it:
- Text is **kinetic**: words and letters animate in with purpose, key phrases are slammed, circled, underlined, highlighted.
- Illustrations and diagrams **draw themselves** in.
- A virtual **camera** moves to whatever is being discussed.
- The **mood of the board follows the content**: the tutor can shift the look and atmosphere (for example, a serious or eerie register for a grim topic, a bright and playful one for a light topic). These are examples; moods are data, not code.
- Parts of the explanation are **clickable**; clicking drives the lesson (attach an explainer, return, or replace the board).

---

## 2. Principles

1. **Protocol-first.** One Zod schema is the single source of truth for the renderer, validator, JSON Schema export and the tutor's prompt.
2. **Declarative intent.** The model says what, when and in what mood. The library owns geometry, layout, timing and animation. Never require coordinates from the model.
3. **Relevance-gated.** Content appears when its trigger fires, not when it arrives.
4. **Resilient.** Bad, unknown or unloaded nodes degrade to a fallback; they never blank or crash the board.
5. **Safe.** No raw HTML, JS, CSS or class names from the model. Everything the model controls is validated data.
6. **Light.** Must run well on low-end Android browsers. Heavy code loads lazily.
7. **Themable and pluggable.** Every default is overridable. Built-ins use the same extension mechanism as third parties.
8. **Delightful.** Catchy and engaging is a hard requirement, with a verification gate (section 9 and M3), not a nice-to-have.

---

## 3. Scope

### In v1
- Board ops: `append`, `attach`, `replace`, `update`, `remove`, **`theme`**, **`camera`**; history stack for `replace`; detour stack (max depth 2) for `attach`.
- **Triggers** on `enter`: `start`, `cue`, `after`, `event`.
- Blocks: `text`, `figure`, `choices`, `steps`, `callout`, `group`, `table`, `math`, `code`.
- Inline marks: `highlight`, `emphasis`, `term`, `focusable`, `annotate`, `math`.
- Figures: `image`, `icon`, `diagram` (`tree`, `radial`, `flow`, `cycle`), `labeled` (asset packs), `chart`, `lottie`.
- Motion: expanded effect vocabulary, `order`, triggers, emphasis, exit, camera, reduced-motion support.
- **Theme engine**: tokens, moods, tutor-driven theme changes, policy and contrast guardrails, smooth transitions.
- **Ambience layer**: lightweight background atmosphere presets, lazy-loaded.
- **Styling**: plain CSS and Tailwind, both first-class.
- Plugin system (manifest + lazy loader), asset packs, built-ins (`math`, `chart`, `table`, `lottie`, `code`) shipped and lazy.
- Streaming-tolerant rendering.
- Generators: JSON Schema, `getSystemPromptGuide()`, `serializeBoard()`, `getCapabilities()`.
- Storybook + Next.js playground with a mocked tutor, a mocked narrator (cue emitter) and a showreel.

### Out of v1 (do not build)
- React Native / native.
- Chat UI, LLM calls, networking, data fetching, grading.
- **Audio of any kind** (no TTS, no sound playback). The library may *emit* events a host can use for sound; it never plays audio.
- Remote runtime plugin loading from URLs (loaders are static `import()` only).
- Explicit timeline authoring (only `enter` + `order` + triggers).
- Visual/WYSIWYG builder.

### Optional, propose first [ASK]
- Function plotting and number line figures.
- A small free-text `input` block.
- Word-level narration sync (beat-level cues come first; the same mechanism extends to word level).

---

## 4. Tech stack

| Concern | Choice |
| :--- | :--- |
| Language | TypeScript (strict) |
| Validation | Zod (source of truth; export JSON Schema) |
| UI | React 18/19, Next.js App Router compatible |
| Animation (React layer) | `motion` (`motion/react`), `LazyMotion` / `m` to keep the base small |
| Animation (timelines, SVG draw-on, text splitting, camera, sequencing) | GSAP, **lazy-loaded**. Verify current GSAP licence terms before adding; record the result in `DECISIONS.md`. |
| Placement | `@floating-ui/react` (or `@floating-ui/dom`) |
| Diagram layout | `d3-hierarchy` plus a small in-repo flow/cycle layout. **[AGENT DECIDES]** if `dagre` is needed; default no. |
| Charts | `d3-scale` + `d3-shape`, plain SVG |
| Math | KaTeX + `mhchem`, lazy, CSS bundled with the chunk |
| Lottie | Light player **without expression support** (evaluate `@lottiefiles/dotlottie-web` vs `lottie-web` light). **[AGENT DECIDES]** |
| Code highlighting | Lightweight, lazy. **[AGENT DECIDES]** |
| Headless primitives | **[AGENT DECIDES]**: Radix vs React Aria vs neither; prefer the smaller footprint |
| Styling | Compiled plain CSS with `--dg-*` variables in a CSS `@layer`; **Tailwind v4 as the primary integration target**, v3 preset as secondary. The library's own styles must **not** require Tailwind. |
| Optional peer | `tailwind-merge` (used for class merging if present) |
| Monorepo / build | pnpm workspaces, `tsup`, Changesets |
| Tests | Vitest + Testing Library; Playwright for critical playground flows |
| Docs / dev | Storybook, Next.js playground (with Tailwind v4 host config) |
| Lint / format | ESLint, Prettier, `tsc --noEmit` in CI |

---

## 5. Repository layout

```
/
├─ packages/
│  └─ dreamer-genui/
│     ├─ src/
│     │  ├─ schema/        # Zod schemas, types, JSON Schema export, prompt guide
│     │  ├─ core/          # registry, validator, board reducer, cue engine, theme resolver, events
│     │  ├─ react/         # <Board>, provider, hooks, default components, motion drivers, kinetic text
│     │  ├─ builtins/      # math, chart, table, lottie, code (each lazy)
│     │  ├─ figures/       # diagram layouts, labeled/asset-pack, annotations
│     │  ├─ theme/         # tokens, moods, presets, contrast, tailwind bridge
│     │  ├─ ambience/      # ambience presets + runtime (lazy)
│     │  └─ styles/        # compiled CSS (@layer dreamer-genui), tailwind.css bridge
│     └─ package.json      # subpath exports (below)
├─ apps/
│  └─ playground/          # Next.js + Tailwind v4: JSON editor, mock tutor, mock narrator, showreel
├─ fixtures/               # canonical example replies (JSON)
├─ docs/reference/         # human-supplied visual references (videos, frames). Re-read when it changes.
├─ AUDIT.md
├─ DECISIONS.md
└─ README.md
```

### Package subpath exports
- `dreamer-genui`: React renderer, provider, hooks, default registry
- `dreamer-genui/schema`: **server-safe, no React/DOM import**
- `dreamer-genui/core`: headless engine
- `dreamer-genui/builtins/*`: tree-shakeable, individually replaceable
- `dreamer-genui/themes/*`: theme/mood presets
- `dreamer-genui/styles.css`: compiled base styles
- `dreamer-genui/tailwind.css`: Tailwind v4 bridge (maps host theme variables to `--dg-*`)
- `dreamer-genui/tailwind-preset`: Tailwind v3 preset (secondary)

---

## 6. Protocol (normative draft)

Implement as Zod schemas; derive TS types. If you find a flaw, propose the smallest fix and **record every deviation in `DECISIONS.md`**.

### 6.1 Envelope and operations

```ts
type Reply = { v: 1; ops: Op[] };

type Op =
  | { op: "append"; blocks: Block[]; after?: NodeId }
  | { op: "attach"; to: NodeRef; blocks: Block[];
      placement?: "right" | "left" | "above" | "below" | "overlay" | "inline"; // default "inline"
      connector?: "line" | "arrow" | "bracket" | "none";
      target?: { annotate?: "circle" | "underline" | "box" | "highlight" | "bracket" | "none" };
      mode?: "inline" | "drawer" | "spotlight";                                // default "inline"
      theme?: ThemeSpec }                                                       // optional, scoped to the detour
  | { op: "replace"; blocks: Block[]; title?: string; theme?: ThemeSpec }
  | { op: "update"; id: NodeId; props: Record<string, unknown> }
  | { op: "remove"; id: NodeId }
  | { op: "theme"; theme: ThemeSpec; scope?: "board" | "detour" }               // default "board"
  | { op: "camera"; to: NodeRef | "overview"; zoom?: number; duration?: number; ease?: EaseName };
```

- `NodeId`: short tutor-authored string, unique per board; duplicates rejected.
- `NodeRef`: a node id, or `parentId/itemId` for items inside a node.
- `attach`: opens an explainer **on** an existing node; the rest of the board dims; built-in **return** control; max depth 2 (`depth-exceeded` otherwise).
- `replace`: pushes the current board (including its theme) onto a **history stack**; `back()` restores board and theme.
- Unknown op keys/fields are ignored with a warning, never fatal.

### 6.2 Nodes and triggers

```ts
type NodeBase = {
  id: NodeId;
  enter?: Enter;
  emphasis?: Emphasis;
  exit?: Exit;
  alt?: string;   // plain-text fallback. REQUIRED for figure kinds and any non-core/plugin node.
};

type Trigger =
  | { on: "start" }                                                 // default: plays by `order` as soon as it can
  | { on: "cue"; id: string }                                       // waits for host: board.cue("beat-2")
  | { on: "after"; node: NodeId }                                   // plays when another node finishes entering
  | { on: "event"; node: NodeRef; event: "focus" | "select" | "answer" };

type Enter = {
  effect: EnterEffect;
  order?: number;
  delay?: number;
  duration?: number;
  trigger?: Trigger;                // default { on: "start" }
  split?: "words" | "chars" | "lines";   // for text effects
};
```

Blocks are a **discriminated union on `type`**, props flattened onto the node. Marks (inline) may also carry `enter` (with triggers), enabling "circle this phrase when the narrator says it".

### 6.3 Cue semantics (normative)

The host narrates (or paces) however it likes; the library only understands **cue ids**.

- **Not mounted until entered.** A node whose trigger has not fired is **not rendered at all** (not hidden, not in the accessibility tree, not reserving visible layout unless `reserve: true` is requested). This is the "teacher writes it only when relevant" behavior.
- `board.cue(id)` fires a cue. Multiple nodes may share a cue id; they then enter together by `order`.
- **Fired cues are remembered per board.** If a cue fires **before** its node arrives (streaming race), the node enters immediately upon arrival.
- `replace` resets the fired-cue set for the new board (history snapshots keep theirs).
- `pacing` prop on `<Board>`:
  - `"cued"` (default when any node uses a cue trigger): honour triggers.
  - `"auto"`: ignore cue triggers; play by `order` with natural pacing (text-only mode, or when there is no narrator).
- `board.flush()`: immediately enter everything pending (skip/fast-forward; also used when the user taps to skip). `board.seek(cueId)`: fire every cue up to and including `cueId`, instantly, without animation for earlier ones.
- `after` chains resolve cycles defensively: a cycle is an `invalid-node` error and those nodes fall back to `start`.
- Notifications out: `onEnter(nodeId)`, `onEntered(nodeId)`, `onCue(cueId)` (for host sync, sound, analytics).
- **No audio and no timing source inside the library.** The mock narrator in the playground simply calls `board.cue()` on a schedule to demonstrate.

### 6.4 Blocks

| `type` | Key props |
| :--- | :--- |
| `text` | `variant: "body" \| "definition" \| "heading" \| "note" \| "hero" \| "kicker" \| "quote"`, `content: Inline[]` |
| `figure` | `figure: Figure`, `caption?: Inline[]` |
| `choices` | `prompt?: Inline[]`, `layout: "chips" \| "list" \| "grid"`, `intent: "navigate" \| "answer"`, `multi?: boolean`, `items: { id, label, caption?, icon?, ref? }[]` |
| `steps` | `reveal: "sequential" \| "all"`, `items: { id, title, content: Inline[] }[]` (each item may carry its own `enter`/trigger) |
| `callout` | `tone: "info" \| "success" \| "warn" \| "danger"`, `title?`, `content: Inline[]` |
| `group` | `layout: "stack" \| "row" \| "grid"`, `blocks: Block[]` |
| `table` | `columns`, `rows`, `highlight?` |
| `math` | `tex: string`, `display?: boolean` (supports `\ce{}`) |
| `code` | `lang: string`, `source: string` |

`hero` is a large, screen-owning statement (a few words). `kicker` is a small lead-in label. `quote` is a styled quotation. The prompt guide tells the tutor to use them sparingly and keep them short.

### 6.5 Inline content and marks

```ts
type Inline = string | Mark;
type Mark =
  | { mark: "highlight"; text: Inline[] | string; color?: ColorToken } & MotionFields
  | { mark: "emphasis";  text: Inline[] | string } & MotionFields
  | { mark: "term";      text: string; definition: string }
  | { mark: "focusable"; text: Inline[] | string; ref: string } & MotionFields
  | { mark: "annotate";  text: Inline[] | string; kind: "circle" | "underline" | "box" | "bracket" | "strike"; color?: ColorToken } & MotionFields
  | { mark: "math";      tex: string };
```

`ColorToken` is a **theme token name** (`accent | info | success | warn | danger | muted | ink`), never a raw colour.

### 6.6 Figures

```ts
type Figure =
  | { kind: "image"; src: string | { asset: string }; alt: string }
  | { kind: "icon"; name: string; alt?: string }
  | { kind: "diagram"; layout: "tree" | "radial" | "flow" | "cycle"; direction?: "down" | "right";
      root?: string;
      nodes: { id: string; label: string; icon?: string; note?: string; enter?: Enter }[];
      edges: { from: string; to: string; label?: string }[];
      reveal?: "sequential" | "all"; focusable?: boolean; alt: string }
  | { kind: "labeled"; pack: string; art: string; highlight?: string[];
      labels?: { part: string; text: string }[]; alt: string }
  | { kind: "chart"; type: "bar" | "line" | "pie" | "scatter";
      series: { name: string; data: (number | { x: number | string; y: number })[] }[];
      xLabel?: string; yLabel?: string; alt: string }
  | { kind: "lottie"; src: string | { asset: string }; loop?: boolean; alt: string };
```

No model-supplied coordinates. Labeled illustrations reference **named parts**. `alt` mandatory (except `icon`) and used as the failure fallback.

### 6.7 Motion vocabulary

```ts
type EnterEffect =
  | "reveal" | "rise" | "pop" | "sweep" | "draw" | "stagger" | "none"
  | "typewriter" | "words" | "chars" | "slam" | "wipe" | "scribble"
  | "zoom" | "count-up" | "morph";
type Emphasis = { effect: "pulse" | "glow" | "underline" | "shake" | "bounce" | "wobble"; order?: number; trigger?: Trigger };
type Exit = { effect: "fade" | "shrink" | "wipe-out" | "none" };
type EaseName = "smooth" | "snappy" | "overshoot" | "anticipate" | "linear";
```

- Same `order` plays together; ascending groups; missing `order` = document order (within the same trigger).
- Effects are **named presets** implemented behind a `MotionDriver` interface. The engine (Motion vs GSAP) never leaks into the protocol. Motion handles React-level enter/exit, layout and dimming; GSAP handles text splitting, SVG draw-on, annotation strokes, camera and figure sequencing, loaded lazily.
- Every effect has a `prefers-reduced-motion` fallback (instant or simple fade) that still delivers all content and interactions.
- Presets must define: duration, easing, stagger, overshoot, and reduced-motion behavior. Keep them in one table (`motion/presets.ts`) so they can be tuned in one place.

### 6.8 ThemeSpec (tutor-driven theme and mood)

```ts
type ThemeSpec = {
  mood?: string;                       // name of a REGISTERED mood preset (examples only: "calm", "solemn", "playful", "eerie")
  intensity?: number;                  // 0..1, how strongly the mood is applied (default 1)
  tokens?: Partial<ThemeTokens>;       // advanced: tutor sets tokens directly (subject to policy)
  ambience?: string | { preset: string; intensity?: number };  // name of a REGISTERED ambience preset
  surface?: string;                    // name of a REGISTERED board surface (examples: "chalkboard", "paper", "flat")
  transition?: { duration?: number; ease?: EaseName };
};

type ThemeTokens = {
  color: { bg; surface; ink; muted; accent; info; success; warn; danger };   // validated colours
  font: { display; body; mono };                                              // allowlisted families only
  radius: { sm; md; lg };
  space: { scale: number };
  motion: { speed: number; ease: EaseName };       // global tempo multiplier (e.g. slower and weightier for a solemn mood)
  texture: { grain: number; vignette: number };    // 0..1
};
```

- **Moods are data.** The library ships a small set of example presets (all overridable/removable) and a `registerMood(name, { description, tokens, ambience?, surface? })` API. The prompt guide lists the registered moods **with their descriptions**, so the tutor knows what each is for. Nothing in code may branch on a specific mood name.
- **Two tiers:** `mood` (reliable, preferred) and `tokens` (advanced, policy-gated).
- **Host policy:** `themePolicy: "none" | "moods" | "moods+tokens"` (default `"moods"`), plus `allowedMoods`, `allowedFonts`, `allowedAmbience`. Disallowed requests are ignored with a warning, never fatal.
- **Validation:** colours parsed (hex/hsl/oklch), no `url()`, no free-form CSS strings, fonts from an allowlist, numbers clamped.
- **Contrast guardrail:** the resolver **enforces minimum text contrast** (WCAG AA, 4.5:1 body / 3:1 large text) by adjusting `ink`/`muted`/accent text colours when a requested palette would be unreadable. Record when it adjusts (`onThemeAdjusted`).
- **Transitions:** theme changes tween (colours, fonts crossfade, ambience fades) over `transition.duration` (default ~800 ms); never a hard cut. Reduced motion shortens to near-instant.
- **Scope:** `scope: "board"` themes the whole board; `"detour"` themes only the open explainer and reverts on `return`. `replace` may carry a theme; `back()` restores the previous board's theme.
- **Precedence (lowest to highest):** library defaults < host CSS/Tailwind variables < host `theme` prop on `<DreamerProvider>` < tutor `ThemeSpec` (subject to policy).
- Emit `onThemeChange(resolvedSpec)` so a host can react (for example to play a soundscape). The library itself plays no audio.

### 6.9 Ambience layer

- An **ambience preset** is a registered, lazy-loaded background atmosphere rendered behind the board content (CSS and/or a small canvas). Presets are data + implementation behind a registry, exactly like other plugins. The library ships a few simple examples (suggested: `grain`, `vignette`, `dust`, `embers`, `fog`, `stars`, `flicker`) and the host can add more. All names are examples.
- Hard performance rules: capped particle counts, fixed frame budget, **paused when the tab is hidden or the board is off-screen**, a "lite" mode for low-end devices (auto-detected via hardware concurrency / frame-time probe, overridable by host), **static under `prefers-reduced-motion`**.
- Ambience never reduces legibility: it renders below content, and the contrast guardrail accounts for it.
- Ambience can be driven by mood, by `ThemeSpec.ambience`, or set directly by the host.

### 6.10 Camera

- The board root can apply a **virtual camera** (transform-based pan/zoom) to bring the active node into focus, like an explainer's push-in.
- `camera` prop on `<Board>`: `"auto"` (default; follows the node currently entering/emphasised), `"off"`.
- `{ op: "camera", to, zoom?, duration?, ease? }` is an explicit move; `to: "overview"` returns to the full board.
- Camera moves must never make content unreadable, hide controls, or trap scroll. Under reduced motion, replace with a plain scroll-into-view. Keep zoom bounded (e.g. 1x to 1.6x).

### 6.11 Events (library to host)

```ts
type UIEvent =
  | { type: "focus";  nodeId: string; ref?: string; label?: string }
  | { type: "select"; nodeId: string; ref?: string; label?: string }
  | { type: "answer"; nodeId: string; value: string | string[] }
  | { type: "action"; nodeId?: string; action: "return" | "continue" | "hint" | (string & {}) };
```

Delivered through `onEvent`. The library never decides correctness and never makes network calls.

### 6.12 Errors

`onError({ code, nodeId?, type?, detail })` with codes: `invalid-node`, `unknown-type`, `load-failed`, `duplicate-id`, `bad-target`, `depth-exceeded`, `version-mismatch`, `theme-rejected`, `cue-cycle`. Every error produces a graceful fallback; nothing throws into the host.

### 6.13 Fixtures (create under `/fixtures`)

Valid: `define-term.json` (text with highlight + choices with navigate refs), `attach-explainer.json` (right placement, arrow connector, circle annotation), `replace-new-topic.json`, `cued-narration.json` (nodes with cue triggers across several beats), `theme-mood-shift.json` (a `theme` op mid-lesson), `replace-with-theme.json`, `camera-moves.json`, `diagram-radial.json`, `labeled-art.json`, `chart-bar.json`, `math-chem.json`, `lottie-basic.json`, `streaming-partial.json`, `cue-before-node.json` (race).
Invalid: duplicate id, unknown type, depth exceeded, cue cycle, disallowed mood, unreadable palette (contrast-adjusted).

*(Subjects inside fixtures are illustrative only.)*

---

## 7. Core behaviors

### 7.1 Board state and reducer
- `BoardState`: `{ id, title?, nodes, detours, theme, firedCues, history }`.
- The reducer is **pure and deterministic**: `(state, op) => state`. Exhaustive unit tests.
- Detour closing via the built-in return control emits `{ type: "action", action: "return", nodeId }`.

### 7.2 Streaming
- Accept partial replies (e.g. Vercel AI SDK `useObject`/`streamObject`). Applying the same partial repeatedly is **idempotent**.
- A node becomes eligible to enter **when complete** and its trigger has fired. Incomplete-but-triggered nodes show a lightweight skeleton only if layout needs it; otherwise nothing.
- `board.applyPartial(partial)`, `board.applyFinal(reply)`.

### 7.3 Registry and plugins
- Registry maps `type` to `{ schema, load, fallback?, promptGuide }`. **Manifest** (schema + prompt snippet) always loaded; **implementation** lazy.
- Resolver: look up, validate, begin loading as soon as the type appears in a stream, render when loaded and triggered, play `enter` after load.
- Unknown/invalid/failed: render `alt` text fallback and call `onError`.
- Built-ins use exactly this mechanism and are registered by default but **loaded lazily**.
- Moods, ambience presets, surfaces, asset packs and figure kinds are all registry entries (plugins can contribute them).
- Loaders must be static `import()`.

### 7.4 Asset packs
- A pack is `{ id, arts: { [artId]: { svg, parts: { [partId]: { label, description? } } } } }`; SVG sanitized at registration; `labeled` figures highlight/label by part id; the manifest feeds the prompt guide. Ship a small starter pack (suggested: `cell`, `heart`, `flower`).

### 7.5 Attachment layout
- Collision-aware placement; on narrow viewports `left`/`right`/`overlay` fall back to `below`/`inline` automatically.
- `connector` is an SVG path with draw-on; `target.annotate` uses the same hand-drawn stroke primitives as the inline `annotate` mark.
- Default presentation: **inline expansion with the rest of the board dimmed**.

### 7.6 Styling architecture (Tailwind and plain CSS, both first-class)

- **The library's own styling is compiled plain CSS** with `--dg-*` variables, wrapped in `@layer dreamer-genui` at low specificity, so host utilities and overrides win. Hosts **do not need to add the library to Tailwind's content/`@source` configuration**.
- **Everything visual is a `--dg-*` variable** (colour roles, fonts, radii, spacing, motion tempo, texture). The ThemeSpec resolver writes to these variables on the board root, scoped to it.
- **Tailwind v4 bridge** (`dreamer-genui/tailwind.css`): a documented, importable stylesheet that maps `--dg-*` to the host's Tailwind theme variables (`--color-*`, `--font-*`, `--radius-*`, spacing), with sensible fallbacks, so the board **adopts the host's global Tailwind config automatically**. Hosts can remap any token. A **v3 preset** provides the same mapping for `tailwind.config`.
- **Slot-level overrides:** every component exposes named slots; `classNames` props accept Tailwind class strings (merged with `tailwind-merge` when installed, plain join otherwise). Plain CSS users target stable class names/`data-*` hooks.
- **State via `data-*` attributes** so Tailwind data-variants and plain CSS both work: for example `data-dg-state="entering|visible|dimmed"`, `data-dg-mood`, `data-dg-variant`.
- **Dark mode:** follow the host's strategy (media query, `.dark` class, or `data-theme`); `colorScheme: "auto" | "light" | "dark"` on the provider.
- **The tutor never supplies class names or CSS.** Tailwind's compiler cannot see model output; the tutor controls the look only through validated moods/tokens/ambience.
- Support **both together**: Tailwind variables for the global theme, plain CSS for one-off overrides, in any combination.

### 7.7 Accessibility
- Real `<button>`s for interactive marks/items; accessible names.
- **Unentered nodes are absent from the accessibility tree** (they are not mounted).
- Focus management for detours; `return` restores focus to the originating target.
- A polite live region announces newly entered content.
- `alt` on all figures; charts/diagrams expose text summaries.
- Reduced motion honoured everywhere (including ambience and camera). Theme changes must preserve contrast (see 6.8).
- Full keyboard operability; `board.flush()` is available via a visible "skip" control.

### 7.8 Security
- No `dangerouslySetInnerHTML` with model content. Asset-pack SVG sanitized. Lottie without expression evaluation. KaTeX `trust: false`.
- Validate everything; enforce configurable limits (max nodes per board, text length, diagram size, ambience intensity).
- Theme/ambience/mood/font inputs validated against registries and allowlists; never interpolate model strings into CSS.

---

## 8. Generators (for the tutor and the host)

1. `schemaToJsonSchema(options?)`: registry-aware JSON Schema (includes plugin types, registered moods, ambience and surface names as enums).
2. `getSystemPromptGuide(options)`: compact prompt section teaching the reply format. It must also instruct the tutor to:
   - **write on the board only what it is currently talking about**, one idea per beat, attaching a cue to each narration beat so content enters when that part is spoken;
   - keep board text short and punchy; use `hero`/`kicker` sparingly for the one key idea;
   - choose figures/effects that match the explanation (draw a diagram while describing structure);
   - **change the theme only when the emotional register genuinely changes**, prefer `mood` over raw `tokens`, and never request unreadable palettes;
   - use `attach` for detours, `replace` for topic changes, `append` for continuing the same line;
   - include `alt` for every figure and plugin node.
   It is **registry-aware** (built-ins, plugins, asset-pack parts, moods **with descriptions**, ambience presets), with options `include`, `exclude`, `compact`, `language`, and 2-4 short worked examples drawn from `/fixtures`.
3. `serializeBoard(state)`: compact outline for the tutor each turn: board id/title, node ids/types/labels (including `parent/item` ids), which nodes have **entered vs are pending**, open detours, current mood/theme summary, history titles.
4. `getCapabilities(registry)`: supported types, kinds, effects, moods, ambience and surfaces.

All four work **without React** (importable from `dreamer-genui/schema` or `/core`).

---

## 9. Art & Motion Direction (this is the quality bar)

**The board is not a UI. It is a motion graphic.** The first build failed this test. A column of cards with uniform fades is a failure regardless of how correct the protocol is. Reference material for the exact look will be supplied (section 16); until then, follow this direction.

### 9.1 Principles
1. **Kinetic typography is the core.** Text is the main actor. Words and letters animate with intent: staggered word/char reveals, springy overshoot on emphasised words, slams for punchlines, typewriter for quiet moments, count-up for numbers.
2. **Beats, not pages.** A scene is a sequence of single-idea beats: *enter, hold, de-emphasise*. Content that has been discussed recedes (smaller, dimmer, or moves aside) so the current idea owns the focal point.
3. **One focal point at a time.** At any moment there is one obvious thing to look at. Avoid simultaneous competing motion unless deliberately choreographed.
4. **The camera moves.** Push-ins, pans and subtle zooms bring attention to the active element instead of mere scrolling.
5. **Weight and physics.** Use an intentional easing set (smooth, snappy, overshoot, anticipate). Entrances use anticipation and overshoot where appropriate; staggers around 30-80 ms; nothing moves linearly except deliberate typewriter/ticker effects.
6. **Bold, limited visual language.** High contrast, generous space, big type scale contrast (hero vs body), a restrained palette per mood, shape and icon accents, drawn annotations (circles, underlines, scribbles). **No default card/panel stacking, no drop-shadow dashboards.**
7. **Atmosphere.** Mood and ambience (6.8, 6.9) make each lesson feel different; the board should *feel* the subject.
8. **Rhythm.** Pacing varies: fast reveals for lists, slow weighty reveals for serious points. The global `motion.speed` token (set by mood) scales tempo.
9. **Mobile-first.** Design primarily for **portrait phone screens**, then scale up to wide layouts. Text must stay big and readable on a phone; layouts re-flow, they don't shrink.
10. **Sound-ready, silent.** Emit `onEnter`/`onCue`/`onThemeChange` so a host can sync sound; the library itself is silent.

### 9.2 Required behaviors
- Text blocks default to a **kinetic entrance** appropriate to their variant (`hero`: `slam`/`chars` with overshoot; `body`: `words` stagger; `kicker`: `wipe`; numbers: `count-up`). A plain fade is the exception, not the default.
- Emphasis marks animate **on cue** (highlight sweeps, annotation strokes draw themselves, key words pulse once).
- Previously-entered content **recedes** when new content takes focus (configurable; off for reference-style boards).
- Figures **draw in** (strokes, node-by-node), they do not just appear.
- Theme/mood changes are **transitions** (colour tween, ambience fade, tempo shift), never abrupt.
- The default board surface and default theme must already look good with **zero** configuration.

### 9.3 Definition of "catchy and engaging" (checklist the agent must self-grade against)
- [ ] First visible text motion begins within ~300 ms of its trigger.
- [ ] Hero text has a clear, satisfying entrance (overshoot/slam), not a fade.
- [ ] At least 4 clearly different effects are used in the showreel scene, each for a reason.
- [ ] Every moment has exactly one focal point; receding content is visibly de-emphasised.
- [ ] The camera moves at least twice in the showreel and never harms legibility.
- [ ] Two contrasting moods (for example one light/playful, one dark/serious; examples only) look **dramatically** different, including ambience and tempo.
- [ ] Sequenced annotation strokes (circle/underline) feel hand-drawn.
- [ ] 60 fps on a CPU-throttled mid-range profile; no jank during entrances or camera moves.
- [ ] Text remains AA-contrast under every shipped mood.
- [ ] Reduced-motion mode delivers all content calmly and instantly.

### 9.4 Showreel gate
- Build a **Showreel** story/page in the playground that demonstrates: every enter effect, kinetic text variants, annotations, a diagram drawing in, camera moves, cue-driven entrance (mock narrator), `attach`/`return`, a mood shift between two contrasting themes, and each shipped ambience preset.
- Capture short screen recordings or GIFs and save them to `docs/showreel/`.
- Self-grade against 9.3 and write the result to `docs/showreel/SELF_REVIEW.md` (be honest; list failures).
- **Stop at the end of M3 [ASK] and wait for human approval of the showreel before continuing.** Do not proceed to later milestones until approved.

---

## 10. React API (target shape)

```tsx
const registry = createRegistry({ plugins: [...builtins] });   // built-ins, moods, ambience, surfaces included by default

<DreamerProvider
  registry={registry}
  theme={hostTheme}                       // optional host ThemeSpec (precedence above)
  themePolicy="moods"                     // "none" | "moods" | "moods+tokens"
  colorScheme="auto"
>
  <Board
    store={board}
    pacing="cued"                         // "cued" | "auto"
    camera="auto"                         // "auto" | "off"
    ambience="auto"                       // "auto" | "off" | "lite"
    classNames={{ root: "...", text: "..." }}   // Tailwind strings welcome
    onEvent={(e) => sendToTutor(e)}
    onError={(err) => report(err)}
    onEnter={(id) => {}}
    onCue={(id) => {}}
    onThemeChange={(spec) => {}}
  />
</DreamerProvider>

const board = useBoard();   // { state, applyFinal, applyPartial, cue, flush, seek, back, reset }
```

`useBoard` works with streamed partials and plain non-streamed replies.

---

## 11. Quality bars

- TypeScript strict; no `any` in the public API; TSDoc on every public export.
- **Bundle budget (initial targets, revisit with data):** core + React renderer, excluding lazy chunks, <= ~45 KB gzipped. KaTeX, Lottie, GSAP, ambience runtime, code highlighting and chart code are **separate lazy chunks**. CI size check.
- Performance: animate transform/opacity; no layout thrash; test on CPU-throttled profiles; ambience has a frame budget and a lite mode.
- Tests: reducer, validator, resolver, **cue engine** (including race, flush, seek, cycles), **theme resolver** (policy, contrast adjustment, scoping, precedence), prompt-guide generation. Component tests for interactive elements. Visual regression for key moods in Storybook (**[AGENT DECIDES]** tooling).
- Determinism: same ops + same cue sequence produce the same state and animation order.

---

## 12. Milestones and acceptance criteria

Work in order; commit per milestone; do not start a milestone until the previous passes. **M0 comes first.**

### M0: Audit and remediation plan
- `AUDIT.md` and a remediation plan. **Accept:** human approves the plan **[ASK]**.

### M1: Protocol
- Zod schemas for all of section 6 (including `Trigger`, `ThemeSpec`, `theme` and `camera` ops, expanded effects, text variants); JSON Schema export; all fixtures (valid and invalid); versioning policy.
- **Accept:** `pnpm test` passes; invalid fixtures produce the right error codes; the schema package imports with no React/DOM present.

### M2: Core
- Registry (manifest/loader; moods, ambience, surfaces as registry entries); validator; resolver; pure reducer with history, detours, theme and fired cues; **cue engine** (`cue`, `flush`, `seek`, `pacing`, race handling); **theme resolver** (policy, validation, contrast guardrail, precedence, scoping); event bus; `serializeBoard`; `getSystemPromptGuide`; `getCapabilities`.
- **Accept:** exhaustive reducer/cue/theme tests; cue-before-node race passes; unreadable palette is auto-corrected; disallowed mood ignored with `theme-rejected`; prompt guide snapshot test; idempotent partial application.

### M3: Renderer, theming, styling, kinetic text (and the showreel gate)
- `DreamerProvider`, `Board`, `useBoard`; default components (`text` incl. `hero`/`kicker`/`quote`, `choices`, `callout`, `steps`, `group`, marks); **kinetic text engine** (words/chars/lines splitting, slam, typewriter, wipe, count-up, scribble); Motion driver + lazy GSAP driver; reduced-motion fallbacks; **theme system** (tokens, example moods, surfaces, transitions); **Tailwind v4 bridge, v3 preset, plain-CSS path**, slot `classNames`, `data-*` state hooks; not-mounted-until-triggered behavior.
- Playground app configured with **Tailwind v4 and a custom global theme**, plus a plain-CSS-only host sample.
- **Accept:** the board adopts the playground's Tailwind theme with no extra config beyond importing the bridge; a Tailwind `classNames` override and a plain-CSS override both work; a mock narrator drives `cued-narration.json` with nodes appearing only on their cues; `flush`/`seek` work; axe checks pass; reduced motion delivers everything. **Then the Showreel gate (9.4). STOP for human approval [ASK].**

### M4: Blackboard behavior, camera, ambience
- `attach` (placements, connectors, annotate, spotlight dimming, return, focus management); `replace` + history `back()` (with theme restore); receding of finished content; auto-scroll behavior; streaming partials; **camera** (auto + op); **ambience layer** with example presets, lite mode, pause rules; tutor-driven `theme` op end to end.
- **Accept:** `attach-explainer.json`, `theme-mood-shift.json`, `camera-moves.json`, `streaming-partial.json` work end to end; narrow-viewport fallback works; ambience pauses when hidden and is static under reduced motion; detour-scoped theme reverts on return.

### M5: Figures
- `icon`, `image`, `diagram` (all layouts, sequential reveal, focusable nodes), `labeled` with asset packs and the starter pack, annotation primitives (hand-drawn strokes), lazy GSAP chunk.
- **Accept:** each layout renders from fixtures; GSAP/ambience not in the initial bundle (verified); every figure shows `alt` when forced to fail.

### M6: Built-ins
- `math` (KaTeX + mhchem, block and inline), `chart`, `table`, `lottie` (expression-free), `code`; all registered by default, all lazy.
- **Accept:** fixtures render; unregistering a built-in gives graceful `unknown-type` fallback; overriding via the registry works; the prompt guide lists them automatically; they respect the active theme and mood.

### M7: Playground and docs
- Playground: JSON editor to live board, fixture picker, theme/mood switcher, ambience switcher, mock tutor, **mock narrator** (cue timeline UI), event/error/cue logs, the Showreel.
- Storybook story per component and per fixture (including mood variants).
- README: quick start, concept guide, **cue/trigger guide**, **theming and mood guide**, **Tailwind and plain-CSS guide**, schema reference, plugin guide (including writing a mood, an ambience preset and an asset pack), tutor integration guide (prompt guide, `serializeBoard`, event loop, narrator adapter pattern with the Vercel AI SDK).
- **Accept:** a new developer can install, render a fixture, theme it with Tailwind, register a custom mood and ambience preset, and wire a cue source by following the README alone.

---

## 13. Working agreement

1. Follow milestones in order; show a short plan before each.
2. Do **not** change the protocol silently; propose, apply the smallest fix, log in `DECISIONS.md` with the reason.
3. **[ASK]** before anything in "Optional, propose first", anything outside v1 scope, and at the M0 and M3 gates.
4. Keep the library generic. No tutor-, curriculum-, voice-vendor- or product-specific code or strings in `packages/`. Example moods/subjects are examples and must live in presets/fixtures/docs, never in logic.
5. Keep the schema package free of React and DOM imports.
6. When something is ambiguous, pick the simplest option that preserves extensibility, record it, keep moving, but **never trade away the Art & Motion Direction (section 9) for simplicity**.
7. No network calls, analytics or telemetry inside the library. No audio.

## 14. Decisions the agent must make and record in `DECISIONS.md`

Radix vs React Aria (or neither); Lottie player and how expressions are disabled; code highlighter and default languages; whether `dagre` is warranted (default no); GSAP licence check result; bundle budget thresholds after first measurement; ambience implementation (CSS vs canvas per preset) and lite-mode detection; visual regression tooling; any token or effect-preset renames.

## 15. Background (context only)

The first consumer is JifunzeAI, a Kenyan K-12 tutor. A Tutor AI emits these ops from a system prompt produced by `getSystemPromptGuide()`. A voice model narrates; the host adapter calls `board.cue(id)` as narration reaches each section so board elements enter only when relevant, like a teacher writing a topic down when it becomes relevant. The host sends `serializeBoard()` and capabilities to the Tutor each turn and forwards `UIEvent`s as the student's next input. The tutor may change the board's mood (for example a sombre register for a grave topic) alongside the lesson content. None of this is encoded in the library; it only renders what the ops describe and reports what the student does.

## 16. Pending: visual reference (v3)

The human will add a reference explainer video (and/or frames) under `docs/reference/` and a v3 of this file will follow. **When `docs/reference/` contains material, re-read this file and study the references before continuing, then adjust section 9 (and effect presets, type scale, palette defaults, pacing) to match what you observe.** Treat the references as the visual target; treat section 9 as the floor until then. Until references exist, do not stall: build to section 9 and keep all effect presets, type scale, easing and tempo values centralised so they can be retuned quickly.
