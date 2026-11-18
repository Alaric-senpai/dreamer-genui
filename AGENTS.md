# dreamer-genui: Coding Agent Brief

**Version 3.0: the final brief for the `dreamer-genui` 1.0.0 release (MIT licence).** Supersedes v2.2 and all earlier briefs. It merges everything agreed so far.

> Read this whole file before writing code. It is the source of truth for scope, protocol, architecture, extensibility, art direction, deliverables and working rules.
> **[AGENT DECIDES]**: pick a sensible default, record it in `DECISIONS.md`, continue.
> **[ASK]**: stop and ask the human before proceeding.
> **Every subject, mood, effect name, lesson topic or process used as an illustration in this file is an example.** The library must stay generic; nothing may be hard-coded to a subject, curriculum, mood list, exam board or product.

---

## 0. Status, release target and first actions

**Release target: `dreamer-genui` 1.0.0 on npm, MIT licence.** This file is the final brief for that release.

**Status (per the human):** M0 to M4b are **complete and approved**. Do not redo them. **Remaining milestones, in order: M4c, M4d, M5, M5b, M6a, M6b, M6c, M6d, M7, M8, M9** (section 14).

First actions:
1. Re-read this file completely.
2. Audit the existing code (the M0 to M4b output) against this brief and write `RECONCILE.md`: for each remaining milestone, list the existing modules affected, the intended change and the risks. The biggest areas: the protocol additions in 6.17 to 6.19, the effect and transition registries, the new SDK registries (voice, tutor, transition), the default plugin set, and the exports map. Get the human's approval **[ASK]** before starting M4c.
3. Record decisions in `DECISIONS.md` as you go; keep `AUDIT.md` and `RECONCILE.md` current.

### What this version adds to what is already built
| Area | Addition |
| :--- | :--- |
| Motion language | Upgrade driven by the **reference video** (section 18): scene transitions, text morph/assemble, tilt-rise, caret typewriter, motion blur, the **pointer**, orbit diagrams, grid scaffolds, glow, drift camera, cue `lead`. |
| UI kit | **shadcn-equivalent component set** (section 7.16): tutor-addressable components (card, alert, accordion, tabs, progress, counter, ...) and a host-only kit (dialog, sheet, form controls, ...). |
| Tutor connectors | **AI model connectors** (7.15): Vercel AI SDK, any OpenAI-compatible endpoint, or a custom API (such as the platform's own tutor API), plus an optional **server helper** that turns any model into a lesson endpoint. |
| Voice | **Narration protocol** (6.17) and the **Conductor** (7.14): the tutor's reply carries narration beats and ops; open-source in-browser voice engines are built in, with optional ElevenLabs and OpenAI-compatible providers; the voice's beats drive node cues. |
| Platform | Static render (`toMarkdown`/`toHTML`), offline lessons, captions, tap-to-hear read-aloud. |
| Release | **1.0.0 engineering** (7.18): MIT, licence audit, API report, provenance, release candidates. |
| Milestones | New **M4c** (motion), **M4d** (UI kit), **M6c** (tutor connectors), **M6d** (voice and Conductor), **M9** (release). |

---

## 1. Mission

Build **`dreamer-genui`**, a generic, **web-only** React / Next.js library that renders **tutor-authored JSON** as an animated, interactive "classroom blackboard" that **feels like a motion-graphic explainer video**, and reports the student's interactions back to the host as typed events. It must be **deeply extensible**: developers can add their own plugins, themes, moods, effects, layouts, question types and more, and replace or restyle any part of the UI.

The library is **generic**. It knows nothing about any specific LLM, tutor, curriculum, voice system, database, exam board or product. The first consumer is an AI tutoring app (JifunzeAI, Kenyan K-12), but nothing in `packages/` may reference it.

**The contract:** operations in, events out. Cues in, enter-notifications out.

```
Tutor (LLM) ── JSON ops ──▶ [validate] ──▶ [board state] ──▶ [render + animate]
     ▲                                          ▲                     │
     │                                host cues │ (e.g. narration     │
     │                               reaches a section)               │
     └──────────── next turn ◀── UIEvent (focus/select/answer/…) ◀────┘
```

### The experience to replicate
A teacher at a blackboard **narrating**, who writes or draws something **only when it becomes relevant**, with an explainer-video aesthetic:
- Text is **kinetic**: words and letters animate with purpose; key phrases are slammed, circled, underlined, highlighted.
- Illustrations, diagrams and **flowcharts draw themselves** in; **interactive 3D models** (for example an anatomical model from the platform's own model registry) can be rotated, labelled, dissected and questioned.
- A virtual **camera** pans, zooms and tilts to whatever is being discussed, and viewpoints on 3D models can be switched or orbited by the tutor or the student.
- The board **composes its layout** like a motion graphic: an explanation on one side and a question on the other (either way round), re-flowing smoothly when the lesson changes.
- The **mood follows the content**: the tutor can shift look and atmosphere (for example a grave, sombre register for a serious topic, a bright and playful one for a light topic; examples only).
- Parts of the explanation are **clickable**; clicking drives the lesson (attach an explainer, return, replace the board).
- During **tests**, the board becomes a calm, distraction-free assessment surface.
- **Voice-synced:** a narrator speaks beat by beat, and the board writes, draws, points and moves the camera exactly when the matching beat begins, like a teacher writing a topic down when it becomes relevant.
- **Bring your own everything:** the tutor/AI model (Vercel AI SDK, any OpenAI-compatible endpoint, or the platform's own API), the voice (open-source engines in the browser, or ElevenLabs and others), 3D models and assets all attach through connectors with one standard mapping.
- **A complete component set:** a shadcn-equivalent UI kit that the tutor can use inside lessons and developers can use in their own apps.

---

## 2. Principles

1. **Protocol-first.** One Zod schema is the single source of truth for renderer, validator, JSON Schema export and the tutor's prompt.
2. **Declarative intent.** The model says what, when, where and in what mood. The library owns geometry, layout, timing and animation. Never require coordinates from the model.
3. **Relevance-gated.** Content appears when its trigger fires, not when it arrives.
4. **Resilient.** Bad, unknown or unloaded nodes degrade to a fallback; they never blank or crash the board (per-node error boundaries).
5. **Safe.** No raw HTML, JS, CSS or class names from the model. Everything the model controls is validated data. Plugin code is trusted host code; the model can only *name* registered things.
6. **Light.** Runs well on low-end Android browsers. Heavy code loads lazily.
7. **Everything is customizable and pluggable.** Every visual and behavioral aspect is reachable through tokens, presets, slots, component replacement, plugins, middleware or headless hooks (section 8). Built-ins are built with the **same public APIs** third parties use.
8. **Delightful.** Catchy and engaging is a hard requirement with verification gates, not a nice-to-have.
9. **Integrity in assessment.** Answer keys never live on the client in exam mode; the library never grades by default.
10. **Connectors, not hard-wiring.** Anything external (assets, 3D models, the tutor/AI model, voice) is reached through connectors with one standard mapping; the library never assumes a backend, and the tutor never generates meshes, shaders or code.
11. **Local and private by default.** Voice runs on the device by default; remote audio, remote models and any network access require explicit host opt-in (the learners are minors).

---

## 3. Scope

### In v1
- Board ops: `append`, `attach`, `replace`, `update`, `remove`, `theme`, `camera`, **`layout`**; history stack; detour stack (max depth 2).
- **Triggers** on `enter`: `start`, `cue`, `after`, `event`.
- **Layout system** (section 6.4).
- Blocks: `text`, `figure`, `choices`, `steps`, `callout`, `group`, `table`, `math`, `code`, **`list`**, **`compare`**, **`question`**, **`flashcards`**, **`assessment`**.
- Inline marks: `highlight`, `emphasis`, `term`, `focusable`, `annotate`, `math`, **`blank`** (cloze).
- Figures: `image`, `icon`, `diagram` (`tree`, `radial`, `cycle`), **`flowchart`**, **`timeline`**, `labeled` (asset packs), `chart`, `lottie`, **`model3d`**, **`scene3d`**.
- Motion: expanded effect vocabulary, `order`, triggers, emphasis, exit, reduced motion; **full 2D camera** (pan, zoom, tilt/perspective, dolly, presets, guided paths, cue-triggered moves, optional user control).
- Theme engine: tokens, moods, tutor-driven theme changes, policy and contrast guardrails, **density**, transitions. Ambience layer.
- Styling: plain CSS and Tailwind, both first-class; component-level tokens.
- **Extensibility framework** (section 8) and the **default built-in catalogue** (section 9).
- **Assessment** (section 6.8): question kinds, modes, timer, navigator, local-first state.
- Persistence: snapshot / restore / ops-log replay.
- Streaming-tolerant rendering; thinking/idle states; asset resolver; i18n/RTL; SSR-safe.
- Generators: JSON Schema, `getSystemPromptGuide()` with profiles, `serializeBoard()`, `getCapabilities()`, **`getModelTools()` / `getModelContext()`** for the tutor.
- **3D figures and the Model Connector** (section 6.16): standard `ModelManifest`, host-supplied connectors (opt-in reference connectors: static, HTTP, cache), tutor-facing model tools, `defineModelConnector`.
- **Motion language upgrade** from the reference video (6.18): scene transitions, text morph, pointer, new effects, orbit layout, scaffolds, glow.
- **UI kit with shadcn parity** (7.16) and tutor-addressable components (6.5, 6.19).
- **Tutor connectors** (Vercel AI SDK, OpenAI-compatible, custom API) and the optional **server lesson handler** (7.15).
- **Voice and the Conductor** (7.14): narration beats, open-source in-browser engines, optional remote providers, captions, tap-to-hear.
- Static render (`toMarkdown`, `toHTML`), offline lessons (7.17), **1.0.0 release engineering** (7.18).
- Devtools overlay, testing utilities, plugin/theme starters, authoring guide.
- Storybook + Next.js playground with **one route per milestone** (mock tutor, mock narrator, exam simulator, mock model registry, showreel).

### Out of v1 (do not build)
- React Native / native.
- A chat UI. **The core never touches the network.** Network access exists only in opt-in subpaths (`connectors`, `tutor`, `server`, voice providers, voice-engine model loading) and only when the host configures them.
- **Grading** (the host/backend grades; see 6.8). Optional opt-in instant check for `practice` only.
- **Background music and sound effects** (no SFX/music playback). Speech (TTS and STT) is supported through the voice subsystem (7.14).
- Remote runtime plugin loading from URLs (plugin loaders are static `import()` only; plugins are bundled by the host).
- Explicit timeline authoring (only `enter` + `order` + triggers).
- Visual/WYSIWYG builder.
- Subject-specific modules in core (function plotting, number line, geometry, maps, periodic table, etc.): they are future **opt-in first-party plugins** (section 9.3).
- **AI-generated 3D meshes at runtime**; AR/VR; a physics engine; a 3D model authoring/editing tool; **hosting or storing models** (the platform's external model registry does that). The tutor only selects and directs registered models (or composes `scene3d` primitives).

### Optional, propose first [ASK]
- Equation-entry (math input) question kind.
- Word-level narration sync (beat-level first; same mechanism extends).
- Any first-party opt-in plugin from section 9.3.
- A model-preparation CLI (compress, validate, generate a manifest skeleton from glTF node names); data-driven 3D plugins (molecules, surfaces); a "reach this viewpoint" question kind; a shadcn-style "eject" CLI that copies component source into a host repo; a reference adapter for realtime speech-to-speech agents (the interface ships in 1.0, the reference adapter is optional); PDF/PNG export of boards.

---

## 4. Tech stack

| Concern | Choice |
| :--- | :--- |
| Language | TypeScript (strict) |
| Validation | Zod (source of truth; export JSON Schema) |
| UI | React 18/19, Next.js App Router compatible, SSR/hydration-safe |
| Animation (React layer, layout) | `motion` (`motion/react`), `LazyMotion` / `m`; shared-layout animation for the `layout` op |
| Animation (timelines, SVG draw-on, text splitting, camera, sequencing) | GSAP, **lazy-loaded**. Verify current GSAP licence terms; record in `DECISIONS.md`. |
| Placement | `@floating-ui/react` (or `/dom`) |
| Diagram layout | `d3-hierarchy` (tree, radial) + small in-repo cycle/timeline layout |
| Flowchart layout | Layered layout with decisions, branches and back-edges: **`dagre` or `elkjs` is likely warranted** as a lazy chunk. **[AGENT DECIDES]** and justify in `DECISIONS.md`. |
| Charts | `d3-scale` + `d3-shape`, plain SVG |
| 3D | `three` (tree-shaken imports) with `GLTFLoader`, Draco/Meshopt decoders and a KTX2 loader, **all in a lazy chunk**, behind a thin in-repo wrapper (named-part picking, isolate/explode/cutaway, tweened camera, HTML label overlay). **[AGENT DECIDES]** whether an alternative (for example `<model-viewer>`) fits better; justify against the needs in 6.16. Decoder files are bundled locally (no third-party CDN at runtime). |
| Model tooling | `@gltf-transform/*` in dev/CI only, for `dg:model-check` |
| Tutor/AI connectors | Optional peers: `ai` (Vercel AI SDK; verify the current major version's object-streaming APIs against its docs) and `openai` (or plain `fetch`) for any OpenAI-compatible endpoint. Structured output via JSON Schema derived from the protocol. |
| Voice | Browser Web Speech (default, zero download) plus opt-in open-source engines loaded lazily from a host-configured URL and cached: candidates to evaluate are **Piper** and **Kokoro** (TTS), **Whisper** (via `transformers.js`) or **Moonshine** (STT), **Silero VAD**, run through ONNX/WASM/WebGPU. Model weights are **never** in the npm package. Record licence, size, language coverage (**Kiswahili**) and real-time factor on low-end Android for each. |
| Voice providers (opt-in) | OpenAI-compatible TTS endpoint adapter and an ElevenLabs adapter (with alignment timestamps where available); `defineVoiceProvider` for anything else. API keys stay server-side. |
| Licence | **MIT** (`LICENSE`, SPDX `license` field); every dependency and bundled asset must be compatible and listed in `THIRD_PARTY_NOTICES.md`. |
| Math | KaTeX + `mhchem`, lazy, CSS bundled with the chunk |
| Lottie | Light player **without expression support**. **[AGENT DECIDES]** |
| Code highlighting | Lightweight, lazy. **[AGENT DECIDES]** |
| Icons | Default curated icon set (permissively licensed), lazy per icon, behind a pluggable `IconSet` registry. **[AGENT DECIDES]** source. |
| Headless primitives / UI kit | **Radix primitives** (recommended for shadcn parity and accessibility; deviate only with justification in `DECISIONS.md`). Lazy per component; the core board does not depend on the UI kit. |
| Drag and drop (ordering, matching, label-drag) | Lightweight, touch-first, keyboard-accessible; **[AGENT DECIDES]** (for example pointer events + own logic vs a small library). Lazy chunk inside `questions`. |
| Styling | Compiled plain CSS with `--dg-*` variables in `@layer dreamer-genui`; **Tailwind v4 primary** integration, v3 preset secondary. Library styles must **not** require Tailwind. |
| Optional peer | `tailwind-merge` |
| Monorepo / build | pnpm workspaces, `tsup`, Changesets |
| Tests | Vitest + Testing Library; Playwright for critical flows; axe |
| Docs / dev | Storybook, Next.js playground (Tailwind v4 host) |
| Browser support | **[AGENT DECIDES]** the `browserslist`; it must cover current Android Chrome, Samsung Internet and Safari iOS, last ~3 years; exclude Opera Mini. Record it. |
| Lint / format | ESLint, Prettier, `tsc --noEmit` in CI |

---

## 5. Repository layout

```
/
├─ packages/
│  ├─ dreamer-genui/
│  │  ├─ src/
│  │  │  ├─ schema/        # Zod schemas, types, JSON Schema export, prompt guide
│  │  │  ├─ core/          # registries, plugin SDK, validator, reducer, cue engine, theme resolver,
│  │  │  │                 # layout model, assessment state machine, middleware, persistence
│  │  │  ├─ react/         # <Board>, provider, hooks (headless + default), components, motion drivers, kinetic text
│  │  │  ├─ plugins/       # built-in plugins, ONE FOLDER EACH, using only the public SDK
│  │  │  │   ├─ math/ code/ table/ chart/ lottie/
│  │  │  │   ├─ diagrams/ labeled/ model3d/ scene3d/
│  │  │  │   ├─ questions/ assessment/
│  │  │  │   ├─ themes-default/ ambience-default/ motion-default/ layouts-default/ icons-default/
│  │  │  ├─ connectors/    # OPT-IN reference model connectors: static, http, cache wrapper
│  │  │  ├─ ui/            # UI kit (shadcn parity): tutor-addressable and host-only components
│  │  │  ├─ voice/         # Narrator, Listener, Conductor, captions, engines/, providers/ (opt-in subpaths)
│  │  │  ├─ tutor/         # Tutor connectors: http, AI SDK, OpenAI-compatible, custom
│  │  │  ├─ server/        # Optional server helpers: createLessonHandler, prompt assembly, validate/repair
│  │  │  ├─ packs/starter/ # example asset packs + a tiny demo 3D model (NOT registered by default)
│  │  │  ├─ testing/       # createTestBoard, FakeClock, FakeNarrator, conformance suite
│  │  │  └─ styles/        # compiled CSS (@layer dreamer-genui), tailwind.css bridge
│  │  └─ package.json      # subpath exports (below)
├─ templates/              # plugin-starter, theme-starter, mood-ambience-starter
├─ tools/                  # dg:model-check (and, if approved, a model-prep CLI)
├─ apps/
│  └─ playground/          # Next.js + Tailwind v4: ONE ROUTE PER MILESTONE (/m1 … /m9, see below), mock tutor, mock narrator, exam simulator, mock model registry (/api/mock-models), showreel
├─ fixtures/               # canonical example replies (JSON), valid and invalid
├─ docs/
│  ├─ reference/           # human-supplied visual references; re-read when it changes
│  ├─ showreel/            # captures + SELF_REVIEW.md
│  ├─ components/          # generated "Customization Surface" per component (see 8.5)
│  └─ authoring/           # plugin / theme / mood / effect / layout / question authoring guide
├─ AUDIT.md  RECONCILE.md  DECISIONS.md  README.md
```

### Package subpath exports
- `dreamer-genui`: React renderer, provider, hooks, default registry (all built-in plugins registered, lazily)
- `dreamer-genui/schema`: **server-safe, no React/DOM import**
- `dreamer-genui/core`: headless engine and **Plugin SDK** (`definePlugin`, `defineBlock`, ...)
- `dreamer-genui/plugins/*`: each built-in plugin, tree-shakeable, individually replaceable or removable
- `dreamer-genui/packs/*`: example asset packs (and the demo 3D model)
- `dreamer-genui/connectors`: **opt-in** reference model connectors
- `dreamer-genui/ui`: the UI kit (each component importable individually; tree-shakeable)
- `dreamer-genui/voice`: Narrator, Listener, Conductor, captions; `dreamer-genui/voice/engines/*` (Web Speech, open-source engines) and `dreamer-genui/voice/providers/*` (remote providers), each lazy
- `dreamer-genui/tutor`: tutor connectors (HTTP/custom API, AI SDK, OpenAI-compatible)
- `dreamer-genui/server`: optional server helpers (`createLessonHandler`)
- **Network access happens only in `connectors`, `tutor`, `server`, remote voice providers and voice-engine model loading, and only when the host configures it.** The core, schema, ui and renderer never fetch.
- `dreamer-genui/testing`: test utilities and plugin conformance suite
- `dreamer-genui/styles.css`, `dreamer-genui/tailwind.css` (v4 bridge), `dreamer-genui/tailwind-preset` (v3)

### Playground routes (v2.2): one route per milestone
The playground (`apps/playground`, Next.js) must expose **a dedicated route for every milestone** so the human can check each one working: `/` (index listing every route with its milestone status), `/m1`, `/m2`, `/m3`, `/m4`, `/m4b`, `/m4c`, `/m4d`, `/m5`, `/m5b`, `/m6a`, `/m6b`, `/m6c`, `/m6d`, `/m7`, `/m8`, `/m9`, plus `/showreel`.
Each milestone route contains: (1) a short description of what the milestone delivers; (2) live demos of **every acceptance criterion** using the fixtures (non-visual milestones show inspectors: `/m1` fixture validation results, JSON Schema and error codes; `/m2` reducer/cue/theme inspector, prompt-guide output per profile, snapshots); (3) an **acceptance checklist panel** mirroring the milestone's Accept list, with the agent's pass/fail notes and links to the relevant tests; (4) event, error and cue logs; (5) a fixture picker scoped to that milestone.
Earlier routes stay in place as **regression pages**. A milestone is not complete until its route works and its checklist is filled in. Gate material lives on `/m4c` (motion gate, side by side with the reference), `/m5b` (3D showcase), `/m6b` (exam run-through), `/m6d` (voice sync gate) and `/showreel`. `/m9` is the release checklist page.

---

## 6. Protocol (normative draft)

Implement as Zod schemas; derive TS types. If you find a flaw, propose the smallest fix and **record every deviation in `DECISIONS.md`**. New types marked **(v2.1)** are implemented in M4b or later; see section 14.

### 6.1 Envelope and operations

```ts
type Reply = { v: 1; ops: Op[]; narration?: Beat[]; meta?: Record<string, unknown> };   // a Reply is a LessonTurn (6.17)

type Op =
  | { op: "append"; blocks: Block[]; after?: NodeId; slot?: Slot }
  | { op: "attach"; to: NodeRef; blocks: Block[];
      placement?: "right" | "left" | "above" | "below" | "overlay" | "inline"; // default "inline"
      connector?: "line" | "arrow" | "bracket" | "none";
      target?: { annotate?: "circle" | "underline" | "box" | "highlight" | "bracket" | "none" };
      mode?: "inline" | "drawer" | "spotlight";                                // default "inline"
      theme?: ThemeSpec }
  | { op: "replace"; blocks: Block[]; title?: string; theme?: ThemeSpec; layout?: LayoutSpec; transition?: SceneTransition }   // layout (v2.1)
  | { op: "update"; id: NodeRef; props: Record<string, unknown>; transition?: "morph" | "fade" | "none" }
  | { op: "remove"; id: NodeId }
  | { op: "theme"; theme: ThemeSpec; scope?: "board" | "detour" }
  | { op: "camera"; to?: NodeRef | "overview"; preset?: "overview" | "closeup" | "wide" | "drift"; zoom?: number; tilt?: { x?: number; y?: number }; dolly?: "in" | "out" | number; duration?: number; ease?: EaseName; trigger?: Trigger; path?: CameraMove[] }   // full definition in 6.12
  | { op: "layout"; layout: LayoutSpec; transition?: { duration?: number; ease?: EaseName } }
  | { op: "pointer"; to: NodeRef | "hide"; style?: "dot" | "hand" | "arrow"; trigger?: Trigger; duration?: number; ease?: EaseName };   // virtual teacher's pointer (6.18)
```

- `NodeId`: short tutor-authored string, unique per board; duplicates rejected.
- `NodeRef`: a node id, or `parentId/itemId` for items inside a node.
- `attach`: opens an explainer **on** an existing node; the rest of the board dims; built-in **return** control; max depth 2 (`depth-exceeded`).
- `replace`: pushes the current board (including theme and layout) onto a **history stack**; `back()` restores it.
- Unknown op keys/fields are ignored with a warning, never fatal. Ops are passed through registered **middleware** (8.6) before the reducer.

### 6.2 Nodes, triggers and placement

```ts
type NodeBase = {
  id: NodeId;
  key?: string;                 // morph identity across updates and replaces (6.18)
  enter?: Enter;
  emphasis?: Emphasis;
  exit?: Exit;
  alt?: string;                 // plain-text fallback. REQUIRED for figure kinds and any plugin node.
  // placement (v2.1) — all optional, all token/enum based, never raw CSS
  slot?: Slot;                  // region in the current layout
  span?: 1 | 2 | 3 | 4 | "full";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  size?: "auto" | "sm" | "md" | "lg" | "fill";
  reserve?: boolean;            // reserve layout space before entering (default false)
};

type Slot = "left" | "right" | "top" | "bottom" | "center";

type Trigger =
  | { on: "start" }                                       // default
  | { on: "cue"; id: string; lead?: number }   // lead (ms): the visual starts earlier so it lands as the word is spoken
  | { on: "after"; node: NodeId }
  | { on: "event"; node: NodeRef; event: "focus" | "select" | "answer" };

type Enter = {
  effect: EnterEffect; order?: number; delay?: number; duration?: number;
  trigger?: Trigger; split?: "words" | "chars" | "lines";
  caret?: boolean;                  // typewriter caret
  blur?: boolean;                   // velocity-based motion blur on fast slides and pushes
};
```

Blocks are a **discriminated union on `type`** (registry-extensible: plugins add types), props flattened onto the node. Marks may carry `enter` with triggers. `left`/`right` are **logical** (mirror under RTL).

### 6.3 Cue semantics (normative)

The host narrates (or paces) however it likes; the library only understands **cue ids**.

- **Not mounted until entered.** A node whose trigger has not fired is not rendered at all (absent from DOM and accessibility tree; reserves space only with `reserve: true`).
- `board.cue(id)` fires a cue. Nodes sharing a cue id enter together by `order`.
- **Fired cues are remembered per board.** A cue that fires before its node arrives makes the node enter immediately on arrival.
- `replace` resets the fired-cue set; history snapshots keep theirs.
- `pacing`: `"cued"` (default when any node uses a cue) honours triggers; `"auto"` ignores cue triggers and plays by `order`; `"reading"` derives cue times from text length at a configurable reading speed (used when voice is off or fails, so cues still fire).
- `board.flush()` enters everything pending; `board.seek(cueId)` fires every cue up to and including `cueId`, instantly for earlier ones.
- `after` cycles are an `invalid-node` / `cue-cycle` error; affected nodes fall back to `start`.
- Notifications out: `onEnter(nodeId)`, `onEntered(nodeId)`, `onCue(cueId)`.
- The cue engine itself has no audio or timing source: cues come from the host or from the **Conductor** (7.14), which drives them from the voice audio clock.

### 6.4 Layout system (v2.1)

The tutor chooses from a small vocabulary; the library does the flex/grid. **Layout matters as much as motion**: it is how the board composes like a motion graphic (for example explanation on one side, question on the other).

```ts
type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type Ratio = "1:1" | "2:1" | "1:2" | "3:2" | "2:3";

type LayoutSpec =
  | { kind: "flow";  gap?: Gap; align?: "start" | "center" }                  // default: vertical flow
  | { kind: "split"; sides?: "left-right" | "right-left"; ratio?: Ratio; gap?: Gap;
      narrow?: "stack" | "tabs"; narrowOrder?: "left-first" | "right-first";
      pin?: "left" | "right" | "none" }                                       // sticky side on phones (e.g. keep a question visible)
  | { kind: "grid";  columns?: 2 | 3 | 4; gap?: Gap; narrowColumns?: 1 | 2 }
  | { kind: "stage"; regions?: ("top" | "left" | "center" | "right" | "bottom")[]; narrow?: "stack" };
```

- Nodes choose a **`slot`**; unslotted nodes flow into the layout's primary region. Slots a layout does not define fall back to the primary region (with a warning, never fatal).
- **`layout` op** changes the layout at any time; existing nodes **animate to their new positions** (shared-layout animation). Reduced motion: instant.
- `replace` may carry a `layout`; history snapshots store it.
- **`group` gets a real flex/grid vocabulary** (still token-based): `layout: "stack" | "row" | "grid"` shorthand plus `direction`, `wrap`, `align`, `justify`, `gap`, `columns`, `minItemWidth` (token, auto-fit), `ratio`, `reverseOnNarrow`.
- **Responsive and phone-first:** narrow viewports collapse `split`/`stage` to a stack in a defined order (or tabs); the tutor never needs to know screen size. Container-query based (the board's own width, not the window), so the board works in any host container.
- **Region-aware behavior:** each region recedes finished content independently; `attach` placement and the camera operate within regions; spotlight dims across regions.
- Layouts are a **registry** (`defineLayout`): hosts and plugins can add their own (8.2).

### 6.5 Blocks

| `type` | Key props |
| :--- | :--- |
| `text` | `variant: "body" \| "definition" \| "heading" \| "note" \| "hero" \| "kicker" \| "quote"`, `content: Inline[]` |
| `figure` | `figure: Figure`, `caption?: Inline[]` |
| `choices` | `prompt?`, `layout: "chips" \| "list" \| "grid"`, `intent: "navigate" \| "answer"`, `multi?`, `items: { id, label, caption?, icon?, ref? }[]` |
| `steps` | `reveal: "sequential" \| "all"`, `items: { id, title, content: Inline[]; enter? }[]` |
| `callout` | `tone: "info" \| "success" \| "warn" \| "danger"`, `title?`, `content: Inline[]` |
| `group` | flex/grid vocabulary (6.4), `blocks: Block[]` |
| `list` (v2.1) | `style: "bullet" \| "number" \| "check" \| "none"`, `items: { id?, content: Inline[]; enter? }[]` |
| `compare` (v2.1) | `columns: { id, title: Inline[], items: Inline[][] }[]`, `highlight?: { col?: string; row?: number }` |
| `table` | `columns`, `rows`, `highlight?` |
| `math` | `tex`, `display?` (supports `\ce{}`) |
| `code` | `lang`, `source` |
| `question` (v2.1) | see 6.8 |
| `flashcards` (v2.1) | `cards: { id, front: Inline[], back: Inline[] }[]`, `flip?: "tap" \| "auto"`, `rating?: boolean` |
| `assessment` (v2.1) | see 6.8 |
| `card` (v3) | `title?`, `description?`, `media?: Figure`, `blocks: Block[]`, `footer?: Block[]`, `variant?: "plain" \| "outlined" \| "elevated" \| "accent"`, `interactive?` (emits `select`) |
| `alert` (v3) | `tone`, `title?`, `content: Inline[]`, `icon?`, `dismissible?` (`callout` stays as the simple form) |
| `accordion` (v3) | `items: { id, title: Inline[], blocks: Block[]; open?: boolean }[]`, `multiple?`; toggling emits `action` |
| `collapsible` (v3) | `title: Inline[]`, `blocks: Block[]`, `open?` |
| `tabs` (v3) | `tabs: { id, label: Inline[], blocks: Block[] }[]`, `active?`; selecting emits `select` |
| `badge` (v3) | `text: Inline[]`, `tone?` |
| `progress` (v3) | `value?: number` (0 to 100), `label?`, `variant?: "bar" \| "ring" \| "pill"`; animated fill on enter |
| `counter` (v3) | `value: number`, `from?`, `format?: "number" \| "percent" \| "time" \| "currency"`, `label?`; count-up (for example a ticking timer) |
| `avatar` (v3) | `name?`, `src?: string \| { asset }`, `icon?`, `size?` |
| `separator` (v3) | `orientation?`, `label?` |
| `carousel` (v3) | `slides: { id, blocks: Block[] }[]`, `auto?`; selecting emits `select` |
| `kbd` (v3) | `keys: string[]` |

`hero` is a large, screen-owning statement (a few words); `kicker` a small lead-in; `quote` a styled quotation. The prompt guide tells the tutor to use them sparingly. Plugins add further block types (8).

### 6.6 Inline content and marks

```ts
type Inline = string | Mark;
type Mark =
  | { mark: "highlight"; text: Inline[] | string; color?: ColorToken } & MotionFields
  | { mark: "emphasis";  text: Inline[] | string } & MotionFields
  | { mark: "term";      text: string; definition: string; detail?: Inline[] }   // tooltip on hover/focus, tap on touch
  | { mark: "focusable"; text: Inline[] | string; ref: string } & MotionFields
  | { mark: "annotate";  text: Inline[] | string; kind: "circle" | "underline" | "box" | "bracket" | "strike"; color?: ColorToken } & MotionFields
  | { mark: "math";      tex: string }
  | { mark: "blank";     id: string; options?: string[]; width?: "sm" | "md" | "lg" };   // cloze; valid only inside cloze questions
```

`ColorToken` is a **theme token name** (`accent | info | success | warn | danger | muted | ink`), never a raw colour. Plugins may register additional marks. Every mark and text block may carry `key?: string`: keyed spans persist across a text `update` with `transition: "morph"` (6.18).

### 6.7 Figures

```ts
type Figure =
  | { kind: "image"; src: string | { asset: string }; alt: string }
  | { kind: "icon"; name: string; alt?: string }
  | { kind: "diagram"; layout: "tree" | "radial" | "orbit" | "cycle"; root?: string;                   // "flow" REMOVED in v2.1
      nodes: { id: string; label: Inline[] | string; icon?: string; note?: string; enter?: Enter }[];
      edges: { from: string; to: string; label?: string }[];
      reveal?: "sequential" | "all"; focusable?: boolean; alt: string }
  | { kind: "flowchart"; direction?: "down" | "right";                                        // (v2.1)
      nodes: { id: string; label: Inline[]; detail?: Inline[];
               shape?: "step" | "start" | "end" | "decision" | "io" | "substance" | "note";
               lane?: string; icon?: string; enter?: Enter }[];
      edges: { from: string; to: string; label?: Inline[];
               kind?: "flow" | "branch" | "recycle" | "optional" }[];
      inputs?:  { to: string; label: Inline[] }[];                                            // streams entering the process
      outputs?: { from: string; label: Inline[] }[];                                          // products/waste leaving
      lanes?: { id: string; label: string }[];
      numbered?: boolean; flow?: "pulse" | "none";
      narrow?: "stepper" | "compact";                                                         // phone behavior
      reveal?: "sequential" | "all"; focusable?: boolean; alt: string }
  | { kind: "timeline"; orientation?: "horizontal" | "vertical";                              // (v2.1)
      events: { id: string; when: string; label: Inline[]; detail?: Inline[]; enter?: Enter }[];
      focusable?: boolean; alt: string }
  | { kind: "labeled"; pack: string; art: string; highlight?: string[];
      labels?: { part: string; text: string }[]; alt: string }
  | { kind: "chart"; type: "bar" | "line" | "pie" | "scatter";
      series: { name: string; data: (number | { x: number | string; y: number })[] }[];
      xLabel?: string; yLabel?: string; alt: string }
  | { kind: "lottie"; src: string | { asset: string }; loop?: boolean; alt: string }
  | Model3D                                                                                   // (v2.2) see 6.16
  | Scene3D;                                                                                  // (v2.2) see 6.16
```

Rules:
- **No model-supplied coordinates.** Layout is computed. Labeled art references **named parts**.
- **Flowcharts** (example use: any multi-step process such as an industrial or chemical process, an algorithm, a procedure): labels are `Inline[]` so steps can contain formulas and marks; layered layout handles **decisions, labelled branches, loops and recycle streams** (back-edges routed cleanly, no overlapping lines); long labels wrap; `inputs`/`outputs` render as arrows entering/leaving; steps enter in order or on cues; edges draw on; optional flow pulses; steps are focusable (emits `focus` with `ref = flowchartId/nodeId`). On narrow screens `narrow: "stepper"` shows one step at a time with camera-follow (default for long processes), otherwise compact nodes.
- `alt` mandatory (except `icon`); it is the failure fallback. Charts/diagrams/flowcharts expose a text summary.
- Figures may reference assets via `{ asset: id }`, resolved by the host `resolveAsset` (7.6).
- Figure kinds are a **registry**: plugins add kinds (8).
- `model3d` / `scene3d`, the `ModelManifest` and the Model Connector contract are specified in **6.16**.

### 6.8 Questions and assessment (v2.1)

**Two layers:** the `questions` plugin (individual question widgets, usable anywhere in a lesson, for example a quick check or Socratic pause) and the `assessment` plugin (a shell around questions: modes, timer, navigator, submit, review).

```ts
type Question = NodeBase & {
  type: "question";
  prompt: Inline[];
  marks?: number;
  hints?: Inline[][];                       // hint ladder; revealed by "hint" action; disabled in exam mode
  status?: "pending" | "answered" | "correct" | "incorrect" | "partial" | "revealed" | "locked";
  feedback?: { message?: Inline[]; explanation?: Inline[]; awarded?: number; correct?: unknown };
} & QuestionKind;

type QuestionKind =
  | { kind: "mcq"; options: { id: string; label: Inline[] }[]; multi?: boolean; shuffle?: boolean }
  | { kind: "truefalse" }
  | { kind: "short"; placeholder?: string; maxLength?: number }
  | { kind: "numeric"; unit?: string; step?: number }
  | { kind: "cloze"; content: Inline[] }                              // contains {mark:"blank"} marks
  | { kind: "matching"; left: { id: string; label: Inline[] }[]; right: { id: string; label: Inline[] }[] }
  | { kind: "ordering"; items: { id: string; label: Inline[] }[] }
  | { kind: "hotspot"; figure: Figure }                               // tap a named part on a labeled figure
  | { kind: "labelDiagram"; figure: Figure; labels: { id: string; text: Inline[] }[] }   // drag labels onto parts
  | { kind: "extended"; minWords?: number; maxWords?: number };
```

Answer value per kind: `mcq` string or string[]; `truefalse` boolean; `short`/`extended` string; `numeric` number or string; `cloze` `Record<blankId, string>`; `matching` `Record<leftId, rightId>`; `ordering` `string[]`; `hotspot` part id; `labelDiagram` `Record<labelId, partId>`.

```ts
type Assessment = NodeBase & {
  type: "assessment";
  mode: "practice" | "quiz" | "exam" | "review";
  title?: Inline[]; instructions?: Inline[];
  timer?: { kind: "countdown"; seconds: number; warnAtSeconds?: number[] } | { kind: "elapsed" };
  sections: { id: string; title?: Inline[]; instructions?: Inline[]; questions: Question[] }[];
  navigation?: "free" | "linear" | "locked-after-answer";
  shuffle?: { questions?: boolean; options?: boolean; seed?: string };     // deterministic
  totalMarks?: number; allowFlag?: boolean; submit?: { confirm?: boolean };
  result?: { awarded?: number; total?: number; summary?: Inline[] };       // supplied via `update` in review mode
};
```

**Modes**

| Mode | Behavior |
| :--- | :--- |
| `practice` | Instant feedback, hints allowed, tutor active, narration/ambience allowed |
| `quiz` | Feedback after each question, no hints |
| `exam` | **No feedback until submit**; timer; navigator; flagging; **distraction-free enforced**; tutor silent |
| `review` | Post-exam walkthrough: correct/incorrect, explanations, marks (supplied by `update` ops from the host/backend) |

**Rules (normative)**
- **The library never grades by default.** Correctness, marks and explanations arrive through `update` ops (`status`, `feedback`, `result`) from the host/backend.
- **No answer keys on the client in exam mode.** The schema has no key field for `exam`/`quiz`. For **`practice` only**, an opt-in `key` prop may enable client-side instant check; the validator **rejects keys in `exam`/`quiz` payloads** (`key-in-exam`).
- **Distraction-free enforcement in `exam` mode:** camera off, ambience off, `theme`/`layout`/`camera` ops from outside the assessment **queued until submit** (or rejected per host config), cue triggers ignored (`pacing: "auto"`), kinetic effects downgraded to a calm preset, theme policy locked. Hosts may opt out per aspect, but the default is strict.
- **Local-first, serializable state:** `AssessmentState { id, mode, answers, flags, visited, currentQuestionId, timerRemainingMs, startedAt?, submittedAt? }`. Emitted via `onAssessmentState(state)` for autosave; restorable via `board.assessments.restore(id, state)`. Survives refresh/crash; tolerant of offline (the library queues nothing over the network; the host queues).
- **Timer** is a headless state machine with an **injectable clock** (fully testable); the host can `extendTime(id, ms)` (for example accommodations), `pause`, `resume`.
- **Navigator** (customizable part): answered / flagged / unvisited states; bottom sheet on phones; section grouping; marks per question and section.
- **Host API:** `board.assessments.get(id)` returns `{ start, submit, setMode, extendTime, pause, resume, snapshot, restore }`. Mode transitions: `practice|quiz|exam` can start; `exam` can only go to `review` via host after submit.
- **Flashcards** are study widgets: tap to flip; optional self-rating emits `answer` with `"knew" | "unsure" | "missed"`.
- Accessibility: all question kinds keyboard-operable (drag interactions have non-drag keyboard equivalents), screen-reader labelled, large touch targets (density tokens), time warnings announced politely.

### 6.9 Motion vocabulary

```ts
type EnterEffect =
  | "reveal" | "rise" | "pop" | "sweep" | "draw" | "stagger" | "none"
  | "typewriter" | "words" | "chars" | "slam" | "wipe" | "scribble"
  | "zoom" | "count-up" | "morph" | (string & {});          // plugins can register more (8.2)
type Emphasis = { effect: "pulse" | "glow" | "underline" | "shake" | "bounce" | "wobble" | (string & {}); order?: number; trigger?: Trigger };
type Exit = { effect: "fade" | "shrink" | "wipe-out" | "none" | (string & {}) };
type EaseName = "smooth" | "snappy" | "overshoot" | "anticipate" | "linear" | (string & {});
```

- Same `order` plays together; ascending groups; missing `order` = document order (within the same trigger).
- Effects are **named presets** in an **effect registry** (`defineEffect`), implemented behind a `MotionDriver` interface; the engine never leaks into the protocol. Motion handles React-level enter/exit/layout/dimming; GSAP handles text splitting, SVG draw-on, annotation strokes, camera and figure sequencing (lazy).
- Every effect defines duration, easing, stagger, overshoot and **reduced-motion behavior**. All presets live in one place (`motion-default` plugin) so they can be retuned in one edit, and hosts can supply **motion presets** (tempo + easing sets).

### 6.10 ThemeSpec (tutor-driven theme and mood)

```ts
type ThemeSpec = {
  mood?: string;                          // name of a REGISTERED mood
  intensity?: number;                     // 0..1
  tokens?: Partial<ThemeTokens>;          // advanced; policy-gated
  ambience?: string | { preset: string; intensity?: number };   // REGISTERED ambience
  surface?: string;                       // REGISTERED board surface
  motionPreset?: string;                  // REGISTERED motion preset (tempo + easing set)
  transition?: { duration?: number; ease?: EaseName };
};

type ThemeTokens = {
  color: { bg; surface; ink; muted; accent; info; success; warn; danger };
  font: { display; body; mono };
  radius: { sm; md; lg };
  space: { scale: number };
  motion: { speed: number; ease: EaseName };
  texture: { grain: number; vignette: number; glow: number };
  density: { scale: number; minTarget: number };     // (v2.1) type/space scale and minimum tap target px
  components?: Record<string, Record<string, string | number>>;   // (v2.1) component-level tokens, validated per component meta
};
```

- **Moods are data.** The library ships a few **example** presets (overridable/removable) and `defineMood`/`registerMood`. The prompt guide lists registered moods **with descriptions**. No code may branch on a specific mood name.
- **Two tiers:** `mood` (reliable, preferred) and `tokens` (advanced, policy-gated).
- **Host policy:** `themePolicy: "none" | "moods" | "moods+tokens"` (default `"moods"`) plus `allowedMoods`, `allowedFonts`, `allowedAmbience`, `allowedSurfaces`. Disallowed requests are ignored with `theme-rejected`.
- **Validation:** colours parsed (hex/hsl/oklch), no `url()`, no free-form CSS, fonts allowlisted, numbers clamped, component tokens validated against component metadata.
- **Contrast guardrail:** the resolver enforces minimum text contrast (WCAG AA 4.5:1 body / 3:1 large) by adjusting text colours and reports `onThemeAdjusted`.
- **Density** is a **host/user setting** (provider prop and a user-facing control), not normally tutor-controlled: for example `large` for early readers (big type, big targets), `compact` for older learners. Min tap target default 44 px.
- **Transitions:** theme changes tween (colours, font crossfade, ambience fade, tempo); never a hard cut. Reduced motion shortens to near-instant.
- **Scope:** `"board"` or `"detour"` (reverts on `return`). `back()` restores the previous board's theme.
- **Precedence (low to high):** library defaults < host CSS/Tailwind variables < host `theme` prop < tutor `ThemeSpec` (subject to policy and exam-mode locks).
- Emit `onThemeChange(resolvedSpec)` so hosts can react (for example start a soundscape). The library plays no audio on its own; speech is handled by the voice subsystem (7.14).

### 6.11 Ambience layer

- An **ambience preset** is a registered, lazy-loaded atmosphere rendered behind content (CSS and/or small canvas), via `defineAmbience`. The library ships a few simple **example** presets (suggested: `grain`, `vignette`, `dust`, `embers`, `fog`, `stars`, `flicker`, plus structural decor such as `blueprint-grid` and `rings`); hosts add more. All names are examples.
- Performance rules: capped particle counts, fixed frame budget, **paused when the tab is hidden or the board is off-screen**, a **lite mode** (auto-detected, overridable), **static under `prefers-reduced-motion`**, **off in exam mode**.
- Never reduces legibility; renders below content; the contrast guardrail accounts for it.

### 6.12 Camera

The 2D board camera is a real virtual camera, not only a push-in on entrance (extended in M4b).

```ts
type CameraMove = {
  to?: NodeRef | "overview";                          // what to frame
  preset?: "overview" | "closeup" | "wide" | "drift";
  zoom?: number;                                      // bounded, about 1x to 1.6x
  tilt?: { x?: number; y?: number };                  // degrees, clamped to about +/-15: perspective tilt of figure layers and the board backdrop
  dolly?: "in" | "out" | number;                      // depth move (perspective), bounded
  duration?: number; ease?: EaseName;
  trigger?: Trigger;                                  // cue-synced camera moves
};
// op forms: { op: "camera" } & CameraMove   |   { op: "camera"; path: CameraMove[] }   // guided path, each step may carry its own trigger
```

- `camera` prop: `"auto"` (follows the node entering/emphasised) or `"off"`. `cameraControls` prop: `"none"` (default) or `"pinch-pan"`: **optional user control** (pinch-zoom, drag-pan) with a visible **reset view** control; user input temporarily overrides the auto-camera and is released on the next tutor move or on reset.
- Tilt/perspective applies to **figure layers and the backdrop only**; text blocks stay flat and readable.
- Never makes content unreadable, hides controls or traps scroll; zoom, tilt and dolly are bounded; reduced motion becomes scroll-into-view; off in exam mode; works inside layout regions.
- Viewpoints on **3D models** are separate: the model has its own camera (6.16) with its own bounds.

### 6.13 Events (library to host)

```ts
type UIEvent =
  | { type: "focus";  nodeId: string; ref?: string; label?: string }
  | { type: "select"; nodeId: string; ref?: string; label?: string }
  | { type: "answer"; nodeId: string; value: AnswerValue;
      meta?: { timeMs?: number; attempt?: number; assessmentId?: string; questionId?: string } }
  | { type: "action"; nodeId?: string; action: "return" | "continue" | "hint" | "view" | (string & {}); detail?: Record<string, unknown> }
  | { type: "assessment"; assessmentId: string;
      action: "start" | "submit" | "flag" | "unflag" | "navigate" | "pause" | "resume" | "warn" | "timeout";
      questionId?: string; state?: AssessmentState };
```

Delivered through `onEvent` (and filtered by event middleware, 8.6). The library never decides correctness and never makes network calls on its own (only host-configured connectors do). Tapping a part of a 3D model emits `focus` with `ref = "<figureId>/<partId>"`; student view changes emit `{ type: "action", action: "view" }` only when `emitViewEvents` is enabled (off by default, throttled). Plugins may define additional namespaced event types (`vendor:event`).

### 6.14 Errors

`onError({ code, nodeId?, type?, detail })` with codes: `invalid-node`, `unknown-type`, `load-failed`, `duplicate-id`, `bad-target`, `depth-exceeded`, `version-mismatch`, `theme-rejected`, `cue-cycle`, `layout-invalid`, `assessment-invalid`, `key-in-exam`, `plugin-conflict`, `plugin-incompatible`, `middleware-error`, `model-not-found`, `model-load-failed`, `unknown-part`, `unknown-view`, `webgl-unavailable`, `connector-error`, `model-budget-exceeded`, `cue-orphan`, `turn-invalid`, `tutor-connector-error`, `voice-error`, `voice-unsupported`, `transition-unknown`. Every error yields a graceful fallback (per-node error boundary); nothing throws into the host.

### 6.15 Fixtures (create under `/fixtures`; subjects are illustrative only)

Valid: `define-term.json`, `attach-explainer.json`, `replace-new-topic.json`, `cued-narration.json`, `theme-mood-shift.json`, `replace-with-theme.json`, `camera-moves.json`, **`split-explanation-question.json`** (explanation left, question right), **`split-reversed.json`**, **`layout-change-animated.json`** (single column becomes split when a question appears), **`group-flex-grid.json`**, **`process-flowchart.json`** (steps, a decision, a recycle loop, inputs/outputs), `diagram-radial.json`, `diagram-cycle.json`, `timeline.json`, `compare.json`, `list.json`, `labeled-art.json`, `chart-bar.json`, `math-chem.json`, `lottie-basic.json`, `streaming-partial.json`, `cue-before-node.json`, **`question-kinds.json`** (one of each kind), **`assessment-practice.json`**, **`assessment-exam.json`**, **`assessment-review.json`**, `flashcards.json`, **`camera-tilt-path.json`**, **`model3d-basic.json`**, **`model3d-tour.json`** (cue-driven views, highlights, isolate, labels), **`model3d-hotspot-question.json`**, **`model3d-label-question.json`**, **`scene3d-solids.json`**, **`lesson-turn-narration.json`** (beats plus cued ops), **`text-morph.json`**, **`scene-transitions.json`**, **`pointer-tour.json`**, **`ui-kit-blocks.json`**, **`reference-saas-explainer.json`** (replicates the reference scenes).
Invalid: duplicate id, unknown type, depth exceeded, cue cycle, disallowed mood, unreadable palette (contrast-adjusted), **bad slot**, **key in exam payload**, **blank outside cloze**, **flowchart with dangling edge**, **plugin type name collision**, **unknown part**, **unknown view**, **model not found**, **model over budget**, **malformed model manifest**, **orphan cue**, **duplicate beat id**, **unknown transition**, **malformed lesson turn**.

### 6.16 3D figures, the model manifest and the Model Connector (v2.2)

**Principle:** the tutor **directs** 3D scenes; it never **generates** meshes, shaders or code. The platform stores its own vetted models in an **external model registry**; the library reaches it through a host-supplied **Model Connector**. Retrieval differs per host; **the mapping (the `ModelManifest` and the figure directives) is always the same.** (Illustrative example throughout: an anatomical model with named parts. Nothing here is specific to any subject.)

```ts
type PartId = string;

type Model3D = {
  kind: "model3d";
  model: string;                                          // model id, or "connectorId:modelId"
  view?: ViewRef;                                         // initial viewpoint
  show?: { parts?: PartId[]; groups?: string[] };         // visibility; omitted = everything
  highlight?: PartId[];                                   // accent-highlighted parts
  dim?: PartId[] | "others";                              // de-emphasised parts
  isolate?: PartId[];                                     // only these visible
  explode?: number;                                       // 0..1 separation of parts
  cutaway?: string;                                       // named cutaway from the manifest
  animation?: { id: string; loop?: boolean; speed?: number };   // named clip from the manifest
  flow?: { path: string; pulse?: boolean };               // trace a named path through the model
  labels?: { part: PartId; text: Inline[]; enter?: Enter }[];   // text overlays pinned to parts
  tour?: TourStep[];                                      // cue-driven sequence of directives
  controls?: "orbit" | "views" | "both" | "none";         // student control (default "both")
  interactive?: boolean;                                  // tapping parts emits `focus` (default true)
  autoRotate?: boolean;                                   // default false; off under reduced motion
  alt: string;
};

type ViewRef =
  | "front" | "back" | "left" | "right" | "top" | "bottom" | "iso"
  | { view: string }                                      // named view from the manifest
  | { focus: PartId; distance?: "near" | "mid" | "far"; from?: "front" | "back" | "left" | "right" | "top" | "bottom" };

type TourStep = Partial<Omit<Model3D, "kind" | "model" | "tour" | "alt">>
  & { trigger?: Trigger; duration?: number; ease?: EaseName };

type Scene3D = {                                          // procedural scenes from a safe vocabulary; no model-supplied code
  kind: "scene3d";
  objects: { id: string;
             shape: "sphere" | "cylinder" | "cone" | "torus" | "box" | "plane" | "arrow" | "ring" | "tube";
             size?: "xs" | "sm" | "md" | "lg" | "xl"; color?: ColorToken; label?: Inline[];
             place?: { relativeTo?: string; dir?: "left" | "right" | "above" | "below" | "front" | "behind"; gap?: Gap };
             at?: [number, number, number];               // abstract units, clamped; discouraged in favour of place/arrange
             points?: [number, number, number][];         // for "tube", max 16 points
             animate?: { effect: "spin" | "orbit" | "bob" | "pulse"; speed?: number; around?: string } }[];
  arrange?: { kind: "row" | "ring" | "grid" | "stack" | "orbit"; of: string[]; spacing?: Gap }[];
  view?: ViewRef; tour?: TourStep[]; controls?: "orbit" | "views" | "both" | "none"; interactive?: boolean;
  alt: string;                                            // limits: max 64 objects
};
```

Directives that name an unknown part, view, path, cutaway or animation are **ignored with `unknown-part` / `unknown-view` (or the matching error)**; the rest of the figure still renders.

**The standard mapping: `ModelManifest`** (every connector must yield this shape, validated with Zod):

```ts
type AssetRef = string | { connectorAsset: string };      // opaque to the library; resolved by the connector

type ModelManifest = {
  id: string; version: string; title: string; description?: string; tags?: string[]; locale?: string;
  license?: { name: string; attribution?: string; url?: string };    // attribution is rendered in the figure caption when present
  conventions: { upAxis: "y"; frontAxis: "+z"; unit: "m" | "normalized" };
  assets: { model: AssetRef; poster?: AssetRef; lods?: { maxTriangles: number; asset: AssetRef }[];
            sizeBytes?: number; triangles?: number };
  parts: Record<PartId, { label: string; nodes: string[];          // nodes = glTF node/mesh names
                          group?: string; description?: string; anchor?: [number, number, number] }>;
  groups?: Record<string, { label: string; parts: PartId[] }>;     // layers
  views?: Record<string, { label: string; position: [number, number, number]; target: [number, number, number]; fov?: number }>;
  animations?: Record<string, { label: string; clip: string; loop?: boolean }>;
  paths?: Record<string, { label: string; points: [number, number, number][]; parts?: PartId[] }>;
  cutaways?: Record<string, { label: string; plane: { normal: [number, number, number]; offset: number } }>;
  explode?: Record<PartId, [number, number, number]>;              // optional authored vectors (else computed from part centroids)
};
```

**The Model Connector** (host-supplied; defined with `defineModelConnector`):

```ts
interface ModelConnector {
  id: string;
  getManifest(modelId: string, ctx: ConnectorContext): Promise<unknown>;   // raw backend shape or already a ModelManifest
  getAsset(modelId: string, ref: AssetRef, ctx: ConnectorContext): Promise<string | ArrayBuffer | Blob>;  // URL preferred
  search?(query: ModelQuery, ctx: ConnectorContext): Promise<ModelSummary[]>;   // discovery, for tutor tools and host retrieval
  getVersion?(modelId: string, ctx: ConnectorContext): Promise<string>;         // cache validation
  prefetch?(modelIds: string[], ctx: ConnectorContext): Promise<void>;
  map?(raw: unknown): ModelManifest;                                            // adapter from the platform's own shape to the standard manifest
}
type ModelQuery = { text?: string; tags?: string[]; limit?: number };
type ModelSummary = { id: string; title: string; tags?: string[]; description?: string;
                      parts: { id: string; label: string; group?: string }[];
                      views?: string[]; animations?: string[]; paths?: string[]; cutaways?: string[] };
type ConnectorContext = { signal: AbortSignal; locale?: string; user?: unknown };
```

Rules:
- **The host chooses retrieval** (REST, GraphQL, signed object-storage URLs, CDN, IndexedDB, bundled files...). Whatever the backend, `getManifest` output goes through `map` (if provided) and is **validated against `ModelManifest`**; invalid manifests yield `connector-error`. **The tutor and the library see identical mappings for every connector.**
- **Reference connectors** live in `dreamer-genui/connectors` (opt-in): `createStaticModelConnector(manifests, assetResolver)`, `createHttpModelConnector({ baseUrl, endpoints, headers | getHeaders, map, assetUrl })` (JSON + URL/signed-URL assets, retry on expired signed URLs), `withModelCache(connector)` (Cache API/IndexedDB, version validation, size cap, offline-capable), `withPrefetch(connector)`. They are the **only** library code allowed to make network requests, and only when the host instantiates them. `defineModelPack` is sugar for a static connector over bundled models.
- **Multiple connectors** may be registered (`registry.use(connector)`); ids resolve in priority order, or explicitly as `"connectorId:modelId"`.
- **Security:** `allowedOrigins` for asset URLs; connector credentials never reach the tutor or the prompt; budgets from the manifest are enforced (`model-budget-exceeded`); responses validated with Zod; signed-URL expiry handled; document the required CSP directives (`connect-src`, `img-src`, `worker-src`).
- **Resolution flow:** node enters, the resolver asks the connector for the manifest (cached), validates directives against it (`unknown-part`, `unknown-view`), shows the manifest `poster` immediately, lazy-loads the 3D chunk and the model asset, fades the model in with its `enter` effect, then applies directives. Any failure falls back to the poster/`alt` and calls `onError`.
- **Tutor access ("request and return"):**
  1. `getModelTools(registry)` returns framework-agnostic tool definitions (name, description, Zod/JSON-Schema input, executor bound to the registered connectors): `find_models({ text?, tags?, limit? })` returns compact `ModelSummary[]` (ids, titles, **part ids and labels**, views, animations, paths, cutaways) and `get_model({ id })` returns one. Only these summaries go to the tutor; **heavy assets never do**.
  2. Alternatively the host's own retrieval step (for example a retrieval agent, or a knowledge graph that stores a model id per concept) injects summaries into the tutor's context via `getModelContext(summaries)`.
  The prompt guide tells the tutor to reference models **only** by ids from these tools/context, **never invent model, part, view, animation or path ids**, prefer `view`/`highlight`/`isolate`/`labels` directives to describing structure in prose, and use `tour` steps with cues so the 3D view follows the narration.
- `serializeBoard` lists models in use (id, current view, highlighted/isolated parts). `model3d` and `scene3d` are advertised in the prompt guide, JSON Schema and capabilities **only when at least one connector is registered** (`scene3d` needs none).

**3D runtime rules**
- **Lightweight:** Draco/Meshopt geometry and KTX2 textures; configurable budgets enforced from the manifest (defaults: model asset <= ~2 MB, <= ~50k triangles, textures <= 2k px on mobile); `lods` chosen by device capability.
- **Render on demand**, not a continuous loop: frames only while the camera, a tween, an animation or an interaction is active. Pixel ratio capped (about 2). Pause when off-screen or the tab is hidden. At most **1 to 2 live 3D figures** at once (browsers limit WebGL contexts); older ones freeze to a snapshot image and reactivate on focus/tap. Dispose GPU resources on unmount.
- **Fallbacks:** no WebGL or load failure shows the manifest poster (or a static render) plus `alt` and the accessible parts list (`webgl-unavailable`).
- **Looks:** lighting and materials come from theme tokens; transparent background by default; highlight uses the accent token, dimmed parts use reduced opacity/desaturation; optional soft shadows; never the default grey viewer look.
- **Student controls (touch-first):** one-finger orbit, two-finger pinch/pan, limited polar/zoom bounds; keyboard (arrows orbit, +/- zoom, R or Esc reset); a **views bar** (front/back/left/right/top/bottom/iso plus manifest views) and a reset control. All of these are customizable parts.
- **Tutor-directed camera:** view presets and `focus` moves are tweened with `ease`; `tour` steps fire on their triggers (cues). Reduced motion snaps instead of tweening and disables auto-rotate.
- **Interaction:** tapping a part emits `focus` (`ref = "<figureId>/<partId>"`); hover/long-press shows its label; `highlight`/`dim`/`isolate`/`explode`/`cutaway` changes are tweened; `labels` are DOM overlays anchored to part anchors (occlusion-aware fade), themed and accessible; `flow` animates a pulse along a named path; `animation` plays manifest clips.
- **Questions:** `hotspot` (tap a part) and `labelDiagram` (drag labels onto parts with raycast hit-testing; keyboard equivalent through the parts list) accept `model3d` figures. Answers are part ids; **no answer keys on the client in exam mode** (6.8).
- **Accessibility:** `alt`, an accessible **parts list** (listbox) mirroring the model (selecting a part equals tapping it), keyboard orbit, real-text labels.
- `scene3d` shares the runtime and controls; enforce its limits; no model-supplied code of any kind.
- Everything is overridable: replace the `model3d` renderer via `defineFigure`, supply connectors via `defineModelConnector`, restyle or replace the views bar, labels and controls through parts and tokens.

### 6.17 Lesson turn, narration beats and cue timing (v3)

A **LessonTurn** is the `Reply` envelope from 6.1: the tutor's single, structured answer carrying **narration beats** and **ops** together. Because one model writes both, what is said and what is written on the board are coordinated by construction. (Board text stays short and punchy; narration stays conversational; they are linked by **cues**, never by text matching.)

```ts
type Beat = {
  id: string;                    // unique within the turn; referenced by cue triggers
  text: string;                  // spoken-style text; may contain inline cue markers such as [[cue:w1]]
  lang?: string;                 // BCP-47 (for example "en", "sw")
  voice?: string;                // a registered voice/profile name (provider-defined)
  style?: string;                // delivery hint (for example "calm", "excited", "serious"); providers map or ignore
  pauseAfterMs?: number;
};

type StudentTurn = {             // what the host sends to the tutor for each student action
  v: 1;
  input: { kind: "text" | "voice" | "event"; text?: string; event?: UIEvent; lang?: string; confidence?: number };
  board: BoardOutline;                                   // serializeBoard(state)
  capabilities: Capabilities;                            // getCapabilities(registry)
  narration?: { spokenUpTo?: string; interrupted?: boolean };   // what the student actually heard
  models?: ModelSummary[];                               // optional, host-injected (6.16)
  assessment?: { id: string; mode: string; answered: number; flagged: number };
  locale?: string;
};
```

Rules:
- **Beat ids are cue ids.** A node with `trigger: { on: "cue", id: "b1", lead: 200 }` enters when beat `b1` starts, minus `lead` ms. Inline markers `[[cue:id]]` fire at their position (word-level when the engine provides timing, otherwise estimated); markers are stripped before synthesis. Beat and marker ids are unique per turn.
- **Streaming:** beats and ops arrive incrementally. A beat becomes speakable as soon as its text is complete; the Conductor does not wait for the whole turn.
- **Timing modes** (the Conductor picks the best available and reports it):

| Mode | Source | Precision |
| :--- | :--- | :--- |
| Beat-level (**guaranteed baseline**) | One synthesis per beat; the cue fires at the beat's start on the audio clock | Per sentence; works with every engine |
| Provider-aligned | Word/character timestamps or SSML marks | Word-level; only on some engines |
| Engine events | Browser speech boundary events | Word-ish, inconsistent across devices |
| Estimated | Audio duration known; inline cues spread by text position | Approximate |
| Reading-speed | No audio (`pacing: "reading"`) | Approximate |

- **Safety nets:** a cue that references no beat in the turn raises `cue-orphan` (warning) and the node enters at turn end; when the turn's last beat ends, all still-pending cued nodes enter (and after `maxWaitMs`), so content can never stay hidden.
- Captions derive from beats (with word highlighting when timings exist).
- **Exam mode:** narration is ignored unless `readAloud` is enabled for question prompts (accessibility).
- The prompt guide (section 10) instructs the tutor on all of this.

### 6.18 Motion language additions from the reference (v3)

Derived from the reference video (section 18). All names are presets in registries (`defineEffect`, `defineTransition`, ...), overridable.

```ts
type SceneTransition = {
  kind: "cut" | "fade" | "wipe" | "push" | "iris" | "morph" | (string & {});
  duration?: number; ease?: EaseName;
  direction?: "left" | "right" | "up" | "down";
  origin?: NodeRef | "center";        // for iris: where the circle opens from
  theme?: ThemeSpec;                  // applied at the midpoint (for example a dark scene flipping to a light one)
};
```
- **Scene transitions** on `replace`: default `fade`; `cut` is allowed but rare (the reference uses motion, not cuts, for most scene changes); in **exam mode** only `cut`/`fade` are allowed. `morph` matches nodes and spans with the same `key` between the old and new board and animates them (shared-layout style) while everything else cross-fades.
- **Text morph and assemble:** a text `update` with `transition: "morph"` animates keyed spans from their old positions/styles to the new ones; the `assemble` effect makes letters or words converge into place around persistent accent letters (for example a short acronym that expands into its full phrase while the accent letters stay highlighted).
- **New effects:** `tilt-rise` (rises in with a perspective tilt), `assemble`, `iris` (circular mask reveal; also usable as a node enter), typewriter `caret`, and `blur` (velocity-based motion blur on fast slides/pushes; use a cheap approximation and disable on low-end devices).
- **The pointer** (`{ op: "pointer", to, style, trigger }`): a virtual teacher's pointer (dot, hand or arrow) that travels with an eased path to a node and can "tap" it with a ripple, synced to a cue. One pointer per board; `to: "hide"` removes it; styling from tokens; under reduced motion it becomes a highlight ring at the target (no travel); disabled in exam mode.
- **`orbit` diagram layout:** concentric rings with nodes placed on orbits (HUD/solar-system style); rings draw on, nodes pop in on cue.
- **Scaffolds and decor:** structural ambience presets such as `blueprint-grid` (thin guide lines that draw across the board and give `stage`/`grid` regions visible structure, with elements popping in at intersections) and `rings`.
- **Glow:** `texture.glow` token (bloom-like halo on accent elements) for night/HUD moods.
- **Camera `drift`:** a slow continuous push-in on an otherwise static composition.
- **Typography and palette defaults:** heavy geometric sans for headlines, thin or light italic for secondary labels (strong weight contrast); example moods `night` (deep navy with a cyan/blue accent) and `paper` (light grey with a blue accent); flipping between them at scene transitions.
- **Accent-word system:** one accent colour per scene; accent spans animate differently from body text (pop or colour-flip) and persist across morphs.
- **Pacing guidance** (also in the prompt guide): one idea per scene, roughly 4 to 6 seconds of narration per scene, transitions by motion, hard cuts rare.

### 6.19 Tutor-addressable UI kit components (v3)

The blocks `card`, `alert`, `accordion`, `collapsible`, `tabs`, `badge`, `progress`, `avatar`, `separator`, `carousel`, `counter`, `kbd` (6.5) and the richer `term` mark are the tutor-addressable subset of the UI kit (7.16). Shared rules: they nest `blocks`, support `enter`/triggers/`slot`, use the board's motion presets, and are **tap-first** (hover behaviours become tap or long-press on touch). Events: accordion/collapsible toggles emit `{ type: "action", action: "toggle", detail: { open } }`; `tabs` and `carousel` emit `select` with the item `ref`; an `interactive` card emits `select`. Each meets the Customization Surface contract (8.5).

---

## 7. Core behaviors

### 7.1 Board state and reducer
- `BoardState`: `{ id, title?, nodes, detours, theme, layout, firedCues, assessments, history }`; **fully JSON-serializable**.
- Reducer is **pure and deterministic**: `(state, op) => state`. Exhaustive tests.
- Detour closing via the return control emits `{ type: "action", action: "return", nodeId }`.

### 7.2 Streaming
- Accept partial replies (for example Vercel AI SDK `useObject` / `streamObject`). Applying the same partial repeatedly is **idempotent**.
- A node becomes eligible to enter **when complete** and its trigger has fired. Skeletons only where layout needs them.
- `board.applyPartial(partial)`, `board.applyFinal(reply)`.

### 7.3 Persistence and replay (v2.1)
- `board.snapshot()` returns a versioned, JSON-serializable `BoardSnapshot` (state + fired cues + assessment states); `board.restore(snapshot)` rehydrates without replaying entrance animations (content appears in its final settled state, reduced-motion style), then continues normally.
- `board.exportOps()` returns an **ops log** (ops + cue timeline with relative timestamps); `replay(log, { speed })` re-runs a lesson. Used for resume, debugging and demos.
- Snapshots and logs carry the schema `v`; provide `migrate()` hooks for older versions.

### 7.4 Registry, resolver and plugins
- See section 8 for the full framework. Resolver per node: look up (host overrides first), validate, load the implementation (start loading as soon as the type appears in a stream), render once loaded and triggered, play `enter` after load.
- Unknown/invalid/failed: render the `alt`/fallback and call `onError`. **Each node has its own error boundary.**

### 7.5 Status, loading and empty states (v2.1)
- `<Board status="idle" | "thinking" | "listening" | "speaking" />` shows an unobtrusive, **fully customizable** state indicator so the board never looks dead while the tutor or voice model is working.
- Defined, customizable **empty state** (nothing on the board yet), **loading** state (lazy plugin loading) and **error/fallback** state.

### 7.6 Assets, performance and long lessons (v2.1)
- `resolveAsset(id) => string | Promise<string>` provider callback (with caching) for `{ asset: id }` references.
- **Mounted-node cap** (`maxMountedNodes`, configurable): older, finished content beyond the cap is **archived** into a compact collapsed summary that the user can expand; state is unaffected.
- Animate transform/opacity; avoid layout thrash; shared-layout animations only on layout changes; offscreen figure/ambience pausing.

### 7.7 Attachment layout
- Collision-aware placement; on narrow viewports `left`/`right`/`overlay` fall back to `below`/`inline`.
- `connector` is an SVG path with draw-on; `target.annotate` uses the same hand-drawn stroke primitives as the inline `annotate` mark.
- Default presentation: **inline expansion with the rest of the board dimmed**.

### 7.8 Styling architecture (Tailwind and plain CSS, both first-class)
- The library's own styling is **compiled plain CSS** with `--dg-*` variables in `@layer dreamer-genui` at low specificity; hosts need **no** Tailwind content/`@source` setup.
- **Everything visual is a variable**, including **component-level tokens** `--dg-<component>-<token>`; the ThemeSpec resolver writes to the board root scope.
- **Tailwind v4 bridge** (`dreamer-genui/tailwind.css`) maps `--dg-*` to the host's theme variables (`--color-*`, `--font-*`, `--radius-*`, spacing) with fallbacks so the board adopts the host's global Tailwind config automatically; **v3 preset** provides the same.
- **Slot-level overrides:** every component exposes named parts/slots; `classNames` accept Tailwind strings (merged with `tailwind-merge` if installed). Plain CSS users target stable class names and `data-*` hooks (`data-dg-part`, `data-dg-state`, `data-dg-variant`, `data-dg-mood`).
- **Dark mode** follows the host strategy (media, `.dark`, `data-theme`); `colorScheme: "auto" | "light" | "dark"`.
- The tutor never supplies class names or CSS. Tailwind and plain CSS can be used together in any combination.
- **CSP-friendly:** no inline `eval`/`new Function`; dynamic styling via CSS variables and classes; support a style `nonce` where inline styles are unavoidable.

### 7.9 Accessibility
- Real `<button>`s for interactive marks/items; accessible names; unentered nodes are absent from the accessibility tree.
- Focus management for detours; `return` restores focus; a polite live region announces newly entered content.
- `alt` on all figures; charts/diagrams/flowcharts expose text summaries; **all drag interactions have keyboard equivalents**.
- Reduced motion honoured everywhere (effects, ambience, camera, layout re-flow); theme changes preserve contrast; visible "skip" control (`flush`).
- Touch targets respect `density.minTarget`.

### 7.10 Security
- No `dangerouslySetInnerHTML` with model content. Asset-pack SVG sanitized. Lottie without expressions. KaTeX `trust: false`.
- Validate everything; enforce configurable limits (nodes per board, text length, diagram/flowchart size, ambience intensity, assessment size).
- Theme/ambience/mood/font/slot/layout inputs validated against registries and allowlists; model strings are never interpolated into CSS or used to load code.
- **Plugins are trusted, host-bundled code.** The model can only reference registered names.
- **Model connectors:** manifests and assets are untrusted data until validated; enforce `allowedOrigins`, budgets and CSP; connector credentials never enter prompts, events or snapshots; the tutor only ever receives compact `ModelSummary` data.
- **Tutor and voice connectors:** credentials stay server-side (the client takes endpoints or short-lived tokens from the host); student text and `serializeBoard` content are **untrusted data** to the tutor (delimited, never treated as instructions); the server helper validates every op and enforces limits; remote audio is off by default (`allowRemoteAudio`), audio is not retained by default, and microphone use always follows an explicit user gesture and permission flow.

### 7.11 Internationalization and direction (v2.1)
- All built-in UI strings come from a **strings registry** (`defineStrings`), overridable per locale; Kiswahili and English ready, any locale addable.
- `dir="rtl"` supported (`left`/`right` slots mirror); text-splitting effects handle non-Latin scripts (grapheme-safe).
- Number/date formatting via `Intl`, locale from the provider.

### 7.12 SSR and hydration (v2.1)
- Initial board state may be rendered on the server; **no entrance animations during SSR/hydration**; content is hydration-safe (stable ids via `useId`, no random values in render); client-only features (ambience, camera, drivers) mount after hydration.
- Correct `"use client"` boundaries; `schema` and `core` import safely in server code.

### 7.13 Devtools (v2.1)
- Dev-only overlay (tree-shaken from production): node tree with trigger state, cue timeline and fired cues, resolved theme and contrast adjustments, layout regions, registry contents, plugin load status, performance counters, ops/events/errors log, snapshot export. Pluggable (plugins can add panels).

### 7.14 Voice, narration and the Conductor (v3)

**Goal:** the voice narrator and the board stay in lockstep, while the **tutor stays an API** and the **voice stays on the frontend**. The meeting point is the **Conductor**, a client-side orchestrator inside the library (`dreamer-genui/voice`). It has no opinion about which tutor or which voice you use.

```
Student (tap-to-talk or typing)
  → Listener (speech-to-text) → text
  → host tutor connector (7.15: your API, or any model)  ← StudentTurn (with serializeBoard + spokenUpTo)
  → LessonTurn stream { narration: Beat[], ops: Op[] }
  → Conductor: speaks Beat 1 as soon as it is complete, prefetches the next beats,
               fires board.cue(beatId) on the audio clock (minus `lead`) → nodes enter, pointer moves, camera moves
  → student interrupts or taps a node → Conductor stops audio, sends the event plus `spokenUpTo` and `interrupted` to the tutor
```

**Parts** (all exported from `dreamer-genui/voice`, all customizable and replaceable): `Narrator` (plays beats through a TTS provider), `Listener` (STT plus optional VAD), `Conductor` (`useConductor`), `<VoiceControls>` (mic button, mute, speed, captions toggle, skip), `<Captions>` (synced, word highlighting when timings exist), `<SpeakButton>` and the `speakable` node prop (**tap-to-hear** on any text node, with word highlighting).

```ts
interface TtsProvider {
  id: string;
  capabilities: { wordTimings?: boolean; marks?: boolean; streaming?: boolean; languages?: string[] };
  synthesize(beat: PreparedBeat, ctx: VoiceContext): Promise<SynthResult>;
  warmup?(): Promise<void>; cancel?(): void; dispose?(): void;
}
type SynthResult = { audio: AudioBuffer | Blob | string | ReadableStream; durationMs?: number;
                     timings?: { word: string; startMs: number; endMs: number }[];
                     marks?: { id: string; atMs: number }[] };
interface SttProvider { id: string; start(ctx: VoiceContext): AsyncIterable<SttEvent>; stop(): void }   // partial/final transcripts, language, confidence
interface VadProvider { id: string; start(ctx: VoiceContext): AsyncIterable<"speech-start" | "speech-end">; stop(): void }
// defineVoiceProvider({ tts?, stt?, vad?, realtime? }) registers any of these.
```

**Engines built in (opt-in subpaths, lazy):**
1. **Web Speech** (default first fallback; zero download; quality and language coverage vary by device).
2. **Open-source in-browser engines:** at least one open-source TTS, one open-source STT and a VAD must ship in 1.0 (candidates in section 4; the agent decides and justifies). Weights load from a **host-configured `modelBaseUrl`**, are cached (Cache API), and are fetched only after a **size/consent prompt**. A device probe picks the engine chain (for example `["piper", "web-speech"]`) and falls back automatically; the last fallback is captions with reading-speed pacing.
3. **Remote providers (opt-in):** an OpenAI-compatible TTS adapter (many self-hosted open-source servers expose that API) and an ElevenLabs adapter (use alignment timestamps when available). Credentials come from the host (`getToken()` or a proxy endpoint), never from the browser bundle. `defineVoiceProvider` supports any other provider.
4. **Realtime speech-to-speech agents:** a `RealtimeVoiceAdapter` **interface** (their transcript or tool-call events become cues and student turns) is defined and documented in 1.0; a reference adapter is optional **[ASK]**.

**Conductor behavior (normative):**
- **Latency:** speak the first beat as soon as it is complete; keep a small prefetch window (for example 2 beats) of synthesized audio.
- **Scheduling:** cues are scheduled from the **audio clock** (Web Audio time or media `currentTime`), not timers; each cue is fired `lead` ms early; documented accuracy target: beat-level cue error well under ~100 ms for local engines.
- **Interruption (barge-in):** `interrupt()` stops audio and discards queued beats; the next `StudentTurn` carries `spokenUpTo` (last beat heard) and `interrupted: true`, and `serializeBoard` includes `spokenUpTo` and pending cues, so the tutor knows what the student actually heard.
- **Controls:** pause/resume, replay beat, skip (flush), speed (about 0.75x to 1.5x), captions on/off.
- **Turn-taking:** `"push-to-talk"` (default; hands-free is unsuitable for young learners), `"vad"` (hands-free with VAD, echo cancellation requested from the browser), or `"off"`. Barge-in during speech is off by default unless a headset is likely.
- **Autoplay and permissions:** audio starts only after a user gesture (a "Start lesson" gesture primes the audio context); microphone permission-denied and unsupported-browser states have defined, customizable UX.
- **Degradation chain:** preferred engine, then another engine, then Web Speech, then captions with `pacing: "reading"`; STT failure falls back to text input. Voice failure never breaks the lesson.
- **Languages:** `Beat.lang` selects a voice per beat; engines declare their languages; unsupported languages degrade per the chain (record per-engine **Kiswahili** behavior in `DECISIONS.md` and the docs).
- **Privacy (default-deny):** `privacy: { allowRemoteAudio: false, retainAudio: false }`; local engines keep audio on the device; enabling remote providers requires an explicit setting and is surfaced in the voice controls.
- **Exam mode:** silent, except optional `readAloud` of question prompts.
- **Callbacks:** `onBeatStart`, `onBeatEnd`, `onWord`, `onUserSpeech`, `onVoiceError`, `onVoiceModeChange`.
- **Testing:** `dreamer-genui/testing` provides `FakeVoice` (scripted timings) and the existing `FakeNarrator`, so cue timelines are testable without audio.

### 7.15 Tutor connectors and the server helper (v3)

The board works with any tutor. The host chooses one of two ways, and **the board cannot tell which**: both produce the same `LessonTurn` stream.

**A. "Bring a model" (general case):** use any model through the **Vercel AI SDK** or **any OpenAI-compatible endpoint**.
**B. "Bring a tutor":** the platform already has its own tutor API (for example JifunzeAI's multi-agent backend); a custom connector maps its request/response to `StudentTurn` and `LessonTurn`.

```ts
interface TutorConnector {
  id: string;
  turn(input: StudentTurn, ctx: { signal: AbortSignal }): AsyncIterable<Partial<LessonTurn>>;   // streams partial turns
  capabilities?: { streaming: boolean; structuredOutput: boolean };
}
// defineTutorConnector({...}) registers one; the Conductor and useBoard consume it.
```

Client-side adapters in `dreamer-genui/tutor` (opt-in; the only code here that performs network requests):
1. `createHttpTutorConnector({ endpoint, headers | getHeaders, toRequest?, fromResponse? })`: POSTs a `StudentTurn` and reads a streamed response (SSE or newline-delimited JSON). **`toRequest` / `fromResponse` map a platform's existing API shape to the standard `StudentTurn` / `LessonTurn`**, so a platform tutor API keeps its own contract and the mapping is the only integration work.
2. `createAiSdkTutorConnector(...)`: consumes AI SDK object streams (server `streamObject`, client `useObject` or a fetch stream). The agent verifies the current AI SDK APIs and records the supported major versions.
3. `createOpenAICompatibleTutorConnector(...)`: talks to any OpenAI-compatible chat endpoint with JSON-schema structured output or tool calling; in browsers it requires a proxy or short-lived token (no keys in the client).

**Server helper** (`dreamer-genui/server`, optional): `createLessonHandler({ model | aiSdkModel | openAICompatible, registry, profile, tools?, system?, limits?, onTrace? })` returns a web-standard `(Request) => Response` streaming handler usable in a Next.js route handler. It:
- builds the system prompt with `getSystemPromptGuide({ profile })`, injects `serializeBoard`, capabilities, `spokenUpTo` and model context, and exposes `getModelTools` for tool calling;
- requests output against the `LessonTurn` JSON Schema, **streams partial turns**, and **validates every op with Zod**, dropping or repairing invalid ops (one bounded retry with error feedback), enforcing limits (ops, nodes, text length, narration length);
- treats student text and board content as untrusted (delimited, no instruction following), never echoes secrets, reads credentials from server environment only, and exposes trace hooks (for example to an observability platform).

**Evaluation harness:** `dg:tutor-eval` runs a set of prompts against any connector/model and reports validity (schema compliance, orphan cues, duplicate ids, missing `alt`, unreadable themes), so developers can check whether a model is good enough before shipping.

### 7.16 UI kit with shadcn parity (v3)

- **Goal:** the board consumer gets **its own versions of the components in shadcn/ui** (parity of capability, not pixel identity), usable inside lessons (tutor-addressable subset, 6.19) and in the host app (everything).
- **Inventory:** at build time the agent inventories the **current shadcn/ui component list from its documentation** and records, in `docs/components/PARITY.md`, each shadcn component with its board counterpart and status: tutor-addressable, host-only, or not applicable with a reason (for example Chart is covered by the `chart` figure, Data Table by `table`).
- **Tutor-addressable subset (protocol blocks):** Card, Alert, Accordion, Collapsible, Tabs, Badge, Progress, Avatar, Separator, Carousel, Kbd, plus `counter` and the `term` tooltip/hover card. Interactive sliders and toggles may be offered as question inputs when useful.
- **Host-only kit:** Button, Input, Textarea, Select, Checkbox, Radio group, Switch, Slider, Label, Form, Dialog, Alert dialog, Sheet, Drawer, Popover, Dropdown and Context menus, Command/Combobox, Navigation menu, Menubar, Breadcrumb, Pagination, Calendar/Date picker, Resizable, Scroll area, Sidebar, Toast, Spinner, Empty, Input OTP, Toggle and Toggle group, Aspect ratio, Typography, and the rest of the inventory.
- **Board-flavoured:** token-themed (no Tailwind dependency), mood-aware, **density-aware** (big targets for young learners), spring-animated with the board's motion presets, **tap-first** (hover becomes tap or long-press), RTL-safe, i18n strings from the strings registry, and compliant with the **Customization Surface contract** (8.5): parts, tokens, `classNames`, replaceable.
- **Distribution:** shipped in the package as tree-shakeable subpath exports of `dreamer-genui/ui` (importing one component must not pull in others). A shadcn-style eject CLI is optional **[ASK]**.
- **Quality:** each component has a story (including mood/density/RTL variants), keyboard and screen-reader tests, and size recorded in the budget report. The tutor-addressable ones are registered by the default `ui-kit` plugin.

### 7.17 Static render, offline lessons and notes (v3)
- `toMarkdown(state)` and `toHTML(state)` produce a static, motion-free rendering of a board (lesson notes, SSR/SEO, accessibility fallback, copy/share). PDF/PNG export is optional and host-side.
- **Offline:** prefetch of lesson assets, 3D models and voice engines through the connectors; `snapshot` / `exportOps` / `replay` enable resuming and replaying lessons offline; docs include a service-worker recipe; storage quota errors are handled gracefully.

### 7.18 Release engineering and licensing for 1.0.0 (v3)
- **Licence: MIT** (`LICENSE`, SPDX `license` in `package.json`). `THIRD_PARTY_NOTICES.md` lists every runtime dependency, bundled font/icon/asset and the demo model; GSAP's terms are verified; voice-engine and model-weight licences are documented even though weights are not bundled. CI fails on an incompatible or unlisted licence.
- **npm:** package name `dreamer-genui`, public access. The agent verifies the name is available when preparing the first release candidate **[ASK]** if it is not. `files` whitelist, `exports` map (section 5), ESM first with CJS where feasible, `"sideEffects"` declared for CSS, `"use client"` handled in the build, types and source maps, `engines`, peer dependencies (React 18/19) and optional peers (`ai`, `openai`, `tailwind-merge`), size-limit checks per subpath.
- **Provenance and CI:** publish from CI with npm provenance (trusted publishing); lint, typecheck, unit, e2e, axe, size, licence and build-matrix jobs.
- **Semver and stability:** 1.0.0 freezes the public API and protocol `v: 1`. Additions only in minors; deprecations announced with `migrate()` support; an **API report** (for example api-extractor) is checked in and diffed in CI; Changesets drive the changelog.
- **Release flow:** `1.0.0-rc.N` published on the `next` dist-tag; fix cycle; final `1.0.0` on `latest`. The human approves and triggers the final publish **[ASK]**.
- **Repository and docs:** README, hosted Storybook and playground, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and PR templates, compatibility matrix (React 18/19; Next 14 to 16; webpack and Turbopack; plain Vite).

---

## 8. Extensibility framework (a core feature, not an afterthought)

**Requirement:** every single aspect of the UI must be customizable, extensible and replaceable. Built-in plugins are built using only the same public SDK that third parties use (dogfooding); the CI forbids built-ins from importing private internals.

### 8.1 The customization ladder (least to most effort)

| Level | Mechanism | Example |
| :--- | :--- | :--- |
| 1 | **Tokens / ThemeSpec / moods / density** | Rebrand colours, fonts, tempo |
| 2 | **Presets** (themes, moods, motion presets, layouts, surfaces, ambience) | Ship a "vintage" mood pack |
| 3 | **Slots and styling** (`classNames`, `styles`, `data-*`, component tokens) | Tailwind classes on the navigator |
| 4 | **Slot/part replacement** (`components` prop) | Swap just the question card's header |
| 5 | **Type replacement** via the registry | Replace the whole `text` renderer or `flowchart` renderer |
| 6 | **New types via plugins** (blocks, marks, figures, question kinds, effects, layouts, icon sets, etc.) | Add a `poll` block |
| 7 | **Headless mode** (state + hooks only, bring your own rendering) | Fully custom board UI |

### 8.2 Registries (each with a `define*` helper)

| Registry | Helper | What it extends |
| :--- | :--- | :--- |
| blocks | `defineBlock` | New block types (schema, component, parts, prompt guide, fallback) |
| marks | `defineMark` | New inline marks |
| figures | `defineFigure` | New figure kinds |
| questions | `defineQuestion` | New question kinds (schema, widget, answer type, a11y) |
| effects | `defineEffect` | Enter/emphasis/exit effects with drivers (`motion`, `gsap`, `css`) + reduced-motion behavior |
| layouts | `defineLayout` | Board layouts and their regions |
| moods | `defineMood` | Named moods with description (feeds the prompt guide) |
| ambience | `defineAmbience` | Background atmospheres |
| surfaces | `defineSurface` | Board backgrounds/materials |
| themes | `defineTheme` | Complete theme presets (tokens + component tokens) |
| motion presets | `defineMotionPreset` | Tempo and easing sets |
| icon sets | `defineIconSet` | Icon sources |
| asset packs | `defineAssetPack` | Illustrations with named parts |
| model connectors | `defineModelConnector` | Retrieval of 3D models and manifests from an external registry (REST, signed URLs, CDN, IndexedDB, bundled files...), always mapped to the standard `ModelManifest` |
| model packs | `defineModelPack` | Sugar for a static connector over bundled models |
| 3D primitives | `definePrimitive` | Extra `scene3d` primitives |
| tutor connectors | `defineTutorConnector` | Where lesson turns come from: AI SDK, OpenAI-compatible, or a custom/platform API, always mapped to `StudentTurn` / `LessonTurn` |
| voice providers | `defineVoiceProvider` | TTS, STT, VAD and realtime adapters (open-source engines, remote providers) |
| transitions | `defineTransition` | Scene transitions (cut, fade, wipe, push, iris, morph, custom) |
| strings | `defineStrings` | i18n bundles |
| renderers | `defineRenderer` | Text/markdown/inline renderers |
| middleware | `defineMiddleware` | Ops/events/theme/node interceptors (8.6) |
| profiles | `defineProfile` | Prompt-guide capability profiles (9.4) |
| devtools panels | `defineDevtoolsPanel` | Devtools extensions |

### 8.3 Plugin definition

```ts
export default definePlugin({
  name: "acme:poll-pack",            // third-party names MUST be namespaced "vendor:name"; core names are reserved
  version: "1.0.0",
  engine: "^1.0.0",                  // compatible dreamer-genui range; mismatch => plugin-incompatible
  requires: ["math"],                // optional dependency on other plugins
  provides: {
    blocks:  { "acme:poll":     defineBlock({ schema, load: () => import("./Poll"), parts: [...], promptGuide, fallback }) },
    effects: { "acme:spin-in":  defineEffect({ drivers: { motion, gsap }, reducedMotion: "fade" }) },
    moods:   { "acme:vintage":  defineMood({ description, tokens, ambience: "grain" }) },
    layouts: { "acme:triptych": defineLayout({ regions: [...], component: () => import("./Triptych") }) },
  },
  install(ctx) { /* optional: register middleware, devtools panels, listeners */ },
});
```

- **Manifest vs implementation:** the manifest (schemas, names, descriptions, prompt snippets, metadata) is tiny and always loaded; implementations are lazy (`load: () => import(...)`, static imports only).
- API: `registry.use(plugin)`, `registry.override(kind, name, impl)`, `registry.disable(name)`, `registry.enable(name)`, `registry.list()`, `registry.get(kind, name)`.
- Plugins are **separately publishable npm packages** with `dreamer-genui` as a peer dependency.

### 8.4 Conflicts, namespacing and priority
- Core/built-in names are reserved; third-party names must be `vendor:name`.
- A duplicate registration without `override: true` is a `plugin-conflict` (dev: throw at registration; prod: warn and keep the first).
- **Priority:** host `override` > later plugin with `override: true` > earlier plugin > built-in. Deterministic and logged in devtools.
- Disabled plugins are invisible to the tutor (excluded from prompt guide, JSON Schema and capabilities).

### 8.5 Component anatomy contract ("Customization Surface")
Every built-in component (and every plugin component, by convention) must:
1. Export **metadata**: `{ name, parts: string[], tokens: string[], variants: string[], dataAttrs: string[], events: string[], effects: string[] }`.
2. Render each part with `data-dg-part="<part>"` and a stable class `dg-<component>-<part>`.
3. Style **only** through `--dg-*` variables, including component tokens `--dg-<component>-<token>`; no hard-coded colours, fonts, radii or durations.
4. Accept `classNames` (per part), `styles` (per part, token-safe), and be replaceable through `components={{ ... }}` with an override signature `({ node, parts, state, emit, theme, renderDefault, children }) => ReactNode`.
5. Be usable with **its own tokens only** (no hidden coupling to other components' CSS).

CI generates `docs/components/<name>.md` from the metadata and **fails if any built-in lacks metadata, uses non-token styling, or cannot be fully replaced** (an automated test enumerates every part and overrides it).

**Everything customizable includes (non-exhaustive):** colours, fonts, spacing, radii, density, tempo, easing, every effect, every layout, board surfaces, ambience, icons, all UI strings, text/markdown rendering, every block/mark/figure/question renderer, board chrome (controls, thinking indicator, skip button, progress, navigator, timer), empty/loading/error states, a11y labels, event/ops/theme middleware, prompt-guide text per type and per profile, schema limits, devtools panels.

### 8.6 Middleware
`defineMiddleware({ name, priority, onOp?, onEvent?, onThemeResolve?, onNodeResolve? })`:
- `onOp(op, ctx) => op | op[] | null` can transform, expand or drop ops before the reducer (for example rewrite, enforce house rules, analytics).
- `onEvent(event, ctx) => event | null` can enrich or suppress events before `onEvent` reaches the host.
- `onThemeResolve(spec, ctx)` can adjust or veto a theme.
- `onNodeResolve(node, ctx)` can swap a node's type or props (for example localise).
- Ordering by `priority`; errors are isolated (`middleware-error`) and never break the board; fully testable via `createTestBoard`.

### 8.7 Headless mode
Hooks only, no default rendering, for fully custom UIs: `useBoardStore()`, `useNode(id)`, `useNodeEnter(id)`, `useCue()`, `useTheme()`, `useLayout()`, `useAssessment(id)`, `useRegistry()`, `useBoardStatus()`. A headless-only entry point `dreamer-genui/core` + hooks must work without importing any default component or CSS.

### 8.8 Theme, mood and preset authoring
- `defineTheme`, `defineMood`, `defineAmbience`, `defineSurface`, `defineMotionPreset` with schema-validated shapes; contrast linting runs at registration (`dg:theme-lint`) and reports unreadable combinations.
- `templates/theme-starter` and `templates/mood-ambience-starter` scaffold complete working examples.

### 8.9 Authoring tooling
- `dreamer-genui/testing`: `createTestBoard()`, `FakeClock`, `FakeNarrator` (scripted cue timeline), fixture validators, and a **plugin conformance suite** `runPluginConformance(plugin)` that checks: manifest validity, namespacing, engine range, prompt-guide presence, lazy loading, fallback rendering, override behavior, reduced-motion behavior, accessibility smoke test (axe), and token-only styling.
- `templates/plugin-starter` (block + effect + mood example), with its own tests and README.
- `docs/authoring/`: step-by-step recipes (custom block, mark, figure, question kind, effect, layout, mood + ambience, theme, asset pack, middleware, strings/locale, devtools panel, headless integration).
- A `pnpm dg:plugin-check <path>` script wrapping the conformance suite.

---

## 9. Default built-in plugins (readily available, zero setup)

All built-ins use the plugin framework, are **registered by default**, and **load lazily** (shipped by default does not mean loaded by default). Hosts can disable or override any of them. The tutor is told only about enabled ones.

### 9.1 Always present (core, not plugins)
Text and marks, `choices`, `steps`, `callout`, `group`, `list`, `figure` shell, layout engine (`flow`, `split`, `grid`, `stage`), board chrome, theme engine, cue engine, status/empty/loading/error states.

### 9.2 Default plugins

| Plugin id | Provides |
| :--- | :--- |
| `math` | `math` block, inline `math` mark (KaTeX + mhchem for chemical equations) |
| `code` | `code` block (lazy highlighter) |
| `table` | `table` block (with row/column highlight, focusable cells) |
| `chart` | `chart` figure (bar, line, pie, scatter) |
| `lottie` | `lottie` figure (expression-free) |
| `diagrams` | `diagram` (tree, radial, cycle), `flowchart`, `timeline`, `compare` block |
| `labeled` | `labeled` figure runtime: asset-pack loader, part highlighting, hotspots |
| `model3d` | `model3d` figure runtime (lazy `three` chunk): part picking, views, labels, isolate/explode/cutaway, animations, flow paths, tours; 3D support for `hotspot`/`labelDiagram`. **Requires a host-configured Model Connector**; without one it is registered but not advertised to the tutor. |
| `scene3d` | `scene3d` figure: procedural primitives, `place`/`arrange`, simple animations (shares the 3D runtime) |
| `questions` | `question` block (mcq, truefalse, short, numeric, cloze, matching, ordering, hotspot, labelDiagram, extended), `flashcards`, `blank` mark |
| `assessment` | `assessment` block and shell: modes, timer, navigator, flagging, submit, review, local-first state |
| `themes-default` | Example moods, surfaces, themes (light, dark, chalkboard-style blackboard) |
| `ambience-default` | Example ambience and structural decor presets (atmospheric and structural: grain, vignette, `blueprint-grid`, `rings`, ...) |
| `motion-default` | All effect presets + motion presets (single tuning location) |
| `layouts-default` | Layout kinds `flow`, `split`, `grid`, `stage` as registered layouts |
| `icons-default` | Curated default icon set |
| `ui-kit` | The tutor-addressable UI kit blocks (`card`, `alert`, `accordion`, `collapsible`, `tabs`, `badge`, `progress`, `counter`, `avatar`, `separator`, `carousel`, `kbd`) and the `term` tooltip/hover card |
| `transitions-default` | Example scene transitions (`cut`, `fade`, `wipe`, `push`, `iris`, `morph`) |

### 9.3 First-party but opt-in (not default, not in v1 scope)
Candidates, each a separate plugin the host enables explicitly (**[ASK]** before building any): function plotting, number line, geometry canvas, maps, periodic table, data-driven 3D (molecules, surfaces, orbits). Starter asset packs and a tiny **demo 3D model** (served by a static connector) live in `packs/starter`, are **registered only in the playground**, and are never part of the core. Real 3D models live in the platform's external model registry.

### 9.4 Capability profiles (prompt-size control)
`getSystemPromptGuide({ profile })` with built-in profiles: **`lesson`** (everything except the `assessment` shell; `model3d` only when a model connector is registered), **`assessment`** (assessment/questions plus minimal content), **`minimal`** (text, marks, choices, layout basics). Hosts define their own with `defineProfile`. Each plugin's `promptGuide` is `{ summary, rules, examples }`, and the host can override any entry (`guideOverrides`).

### 9.5 Opt-in subpaths (not plugins)
`dreamer-genui/ui` (host-only components), `dreamer-genui/voice` (+ `engines/*`, `providers/*`), `dreamer-genui/tutor`, `dreamer-genui/server`, `dreamer-genui/connectors`. They are separate entry points so the core stays small; none is loaded unless imported, and every network-capable one requires explicit host configuration.

---

## 10. Generators (for the tutor and the host)

1. `schemaToJsonSchema(options?)`: registry-aware JSON Schema (includes plugin types, registered moods, ambience, surfaces, layouts, effects as enums); targets the full **`LessonTurn`** (narration plus ops) and respects profiles and disabled plugins.
2. `getSystemPromptGuide(options)`: compact prompt section teaching the reply format; **registry-aware** and profile-aware; options `profile`, `include`, `exclude`, `compact`, `language`, `guideOverrides`. It must instruct the tutor to:
   - write on the board **only what it is currently talking about**, one idea per beat, with a cue per narration beat;
   - keep board text short; use `hero`/`kicker` sparingly;
   - **choose a layout deliberately** (for example `split` to show an explanation beside a question, switching with a `layout` op when a question appears) and use `slot`;
   - use a `flowchart` for processes (with decisions, loops, inputs/outputs) and the right figure for the content;
   - use `model3d` for 3D objects **only with ids returned by the model tools/context** (never invent model, part, view or path ids), directing `view`, `highlight`, `isolate`, `labels` and a cue-driven `tour`; use `camera` moves (pan, zoom, tilt, paths) with cues for the 2D board;
   - **write narration beats and cue the board to them:** each beat is one or two spoken sentences; every board element carries a cue for the beat that introduces it (with a small `lead`); board text stays short while narration stays conversational; only use cue ids that are beat ids; leave nothing uncued;
   - direct attention with `pointer` and `camera` moves on cues; change scenes with `replace` plus a `transition` (use `cut` rarely); one idea per scene (about 4 to 6 seconds of narration); one accent word/colour per scene;
   - use `morph`/`assemble` to turn a phrase into its expansion; use UI-kit blocks (`card`, `accordion`, `tabs`, `progress`, `counter`, ...) when the content calls for them;
   - use `attach` for detours, `replace` for topic changes, `append` to continue;
   - **change theme/mood only when the emotional register genuinely changes**; prefer `mood` over raw `tokens`; never request unreadable palettes;
   - include `alt` for every figure and plugin node;
   - **never include answer keys in assessment payloads**; stay silent during exam mode.
3. `serializeBoard(state)`: compact outline for the tutor each turn: board id/title, node ids/types/labels (including `parent/item` ids), **entered vs pending**, open detours, current layout, mood/theme summary, **assessment state summary (mode, answered/flagged counts)**, history titles, **models in use (id, view, highlighted/isolated parts)**, **narration state (`spokenUpTo`, pending cues)**.
4. `getCapabilities(registry)`: supported types, kinds, effects, moods, ambience, surfaces, layouts, question kinds, 3D/connector support.
5. `getModelTools(registry)`: tool definitions (`find_models`, `get_model`) bound to the registered connectors, in a framework-agnostic shape (Zod/JSON Schema input plus executor) usable with the Vercel AI SDK or any tool-calling setup. The library never calls an LLM itself.
6. `getModelContext(summaries)`: formats `ModelSummary[]` for injection into the tutor's context.

All of these work **without React**.

---

## 11. Art & Motion Direction (the quality bar)

**The board is not a UI. It is a motion graphic.** A column of cards with uniform fades is a failure regardless of protocol correctness. The visual target is the **reference video analysed in section 18**; follow it together with this direction.

### 11.1 Principles
1. **Kinetic typography is the core.** Words/letters animate with intent: staggered reveals, springy overshoot on emphasised words, slams for punchlines, typewriter for quiet moments, count-up for numbers.
2. **Beats, not pages.** Single-idea beats: *enter, hold, de-emphasise*. Discussed content recedes so the current idea owns the focal point.
3. **One focal point at a time.** Avoid competing motion unless choreographed.
4. **The camera moves.** Push-ins and pans, not mere scrolling.
5. **Composition.** Use layout deliberately: `split` pairs an explanation with a question or figure; layout changes animate (re-flow), they never jump. Generous space, clear hierarchy.
6. **Weight and physics.** Intentional easing set; anticipation and overshoot where apt; staggers around 30-80 ms; nothing linear except deliberate typewriter/ticker effects.
7. **Bold, limited visual language.** High contrast, big type-scale contrast, restrained palette per mood, shape and icon accents, hand-drawn annotations. **No default card/panel stacking, no dashboard drop-shadows.**
8. **Flowcharts and diagrams perform.** Steps enter in sequence, edges draw on, loops animate, the active step is highlighted, the camera follows; they are never static images of boxes. **3D models belong to the motion graphic too**: transparent or themed backgrounds, accent highlights with dimmed surroundings, eased camera moves between views, labels that animate in on cue, a gentle idle motion where apt; never the default grey viewer look.
9. **Atmosphere.** Mood and ambience make each lesson feel different.
10. **Rhythm.** Fast reveals for lists, slow weighty reveals for serious points; `motion.speed` (set by mood) scales tempo.
11. **Mobile-first.** Design for **portrait phones** first, then scale up; layouts re-flow, text stays large.
12. **Assessment is calm.** Exam mode is quiet, legible and focused: no atmosphere, no camera, minimal motion; clear typography, strong contrast, generous touch targets.
13. **Voice-synced.** Visuals land on the narrator's beats (cue `lead`), after the sentence that motivates them begins and never after it has finished; with no voice, reading-speed pacing keeps the same rhythm. The library exposes `onEnter`/`onCue`/`onThemeChange` and the Conductor callbacks for hosts.
14. **Text transforms, it does not just appear.** Phrases assemble, morph and expand (accent letters persist while the rest assembles around them); typewriter with caret for plain statements; heavy geometric headlines against thin italic secondary labels.
15. **Scenes are single-idea beats joined by motion.** Iris, push, wipe and morph transitions carry the viewer between scenes; hard cuts are rare; dark and light scenes may flip at a transition (mood change at the midpoint).
16. **Scaffolds and HUD energy.** Thin grid lines that draw across the board, concentric rings with orbiting badges, glow on accent elements, UI-style cards sliding in with motion blur, progress pills and ticking counters, all used with purpose.
17. **The pointer leads the eye.** A dot (or hand/arrow) travels to what is being discussed on cue, like a teacher's pointer.
18. **One accent colour per scene,** limited palette (example moods: deep navy with a cyan/blue accent; light grey with a blue accent).

### 11.2 Required behaviors
- Text blocks default to a **kinetic entrance** per variant (`hero`: `slam`/`chars` with overshoot; `body`: `words` stagger; `kicker`: `wipe`; numbers: `count-up`). A plain fade is the exception.
- Emphasis marks animate **on cue**; annotation strokes draw themselves.
- Previously-entered content **recedes** when new content takes focus (per region; configurable).
- Figures **draw in**; theme/mood and layout changes are **transitions**.
- The default theme, surface and layout must already look good with **zero** configuration.

### 11.3 "Catchy and engaging" checklist (self-grade against this)
- [ ] First visible text motion begins within ~300 ms of its trigger.
- [ ] Hero text has a satisfying entrance (overshoot/slam), not a fade.
- [ ] At least 4 clearly different effects are used in the showreel, each for a reason.
- [ ] Every moment has exactly one focal point; receding content is visibly de-emphasised.
- [ ] The camera moves at least twice and never harms legibility.
- [ ] Two contrasting moods (for example one light/playful, one dark/serious; examples only) look **dramatically** different, including ambience and tempo.
- [ ] A `split` layout (explanation beside a question) looks composed and re-flows smoothly into and out of a single column.
- [ ] A process flowchart with a decision and a loop draws in sequentially, legibly, on a phone.
- [ ] The 2D camera pans, zooms and tilts with cue-synced moves and a guided path; tilt never makes text hard to read.
- [ ] A 3D model loads with a poster placeholder, enters smoothly, follows a cue-driven tour (view changes, highlight, isolate, labels) and can be orbited on a phone at a steady frame rate.
- [ ] Annotation strokes feel hand-drawn.
- [ ] 60 fps on a CPU-throttled mid-range profile; no jank in entrances, camera moves or layout re-flow.
- [ ] Text keeps AA contrast under every shipped mood.
- [ ] Exam mode looks calm and focused.
- [ ] Reduced-motion mode delivers all content calmly and instantly.
- [ ] A short phrase can morph/assemble into its expansion with persistent accent letters (reference scene 1).
- [ ] A `replace` with an `iris`, `push` or `morph` transition (and a mood flip at the midpoint) reads as a scene change, not a jump.
- [ ] The pointer travels to a node on cue and taps it; under reduced motion it degrades to a ring.
- [ ] With real narration (or the mock narrator), visuals land on the spoken word within the documented cue-lead tolerance.
- [ ] The reference sequence can be replicated with protocol ops only, with no one-off code (fixture `reference-saas-explainer.json`).

### 11.4 Showreel and layout gates
- **Showreel** (playground): every enter effect, kinetic text variants, annotations, a diagram and a flowchart drawing in, camera moves, cue-driven entrance (mock narrator), `attach`/`return`, a mood shift between contrasting themes, each ambience preset, **layout changes**, **camera pan/tilt/path moves**, **a 3D model tour**, and an exam-mode screen. Save captures to `docs/showreel/`; self-grade in `docs/showreel/SELF_REVIEW.md` honestly.
- Gates (each **[ASK]**, stop and wait for human approval): **M4c Motion gate** (side-by-side capture against the reference video), **M5b 3D showcase**, **M6b Exam run-through**, **M6d Voice sync gate** (a lesson narrated by a real engine with cues landing on the spoken beats). The earlier M3 showreel and M4b layout gates have passed.

---

## 12. React API (target shape)

```tsx
const registry = createRegistry();            // all default plugins registered (lazy)
registry.use(myModelConnector);              // external 3D model registry via a host-supplied connector (6.16)
registry.use(myPlugin);                       // add your own
registry.disable("lottie");                   // or remove built-ins

<DreamerProvider
  registry={registry}
  theme={hostTheme}                           // optional host ThemeSpec
  themePolicy="moods"                         // "none" | "moods" | "moods+tokens"
  colorScheme="auto"
  density="comfortable"                       // "compact" | "comfortable" | "large"
  locale="en" dir="ltr"
  resolveAsset={(id) => assetUrl(id)}
  components={{ /* slot/part/type overrides */ }}
  middleware={[ /* defineMiddleware(...) */ ]}
>
  <Board
    store={board}
    status="idle"                             // "idle" | "thinking" | "listening" | "speaking"
    pacing="cued"                             // "cued" | "auto"
    cameraControls="none"                     // "none" | "pinch-pan" (optional user control, with reset)
    camera="auto"                             // "auto" | "off"
    ambience="auto"                           // "auto" | "off" | "lite"
    maxMountedNodes={80}
    classNames={{ root: "...", text: "..." }}
    onEvent={(e) => sendToTutor(e)}
    onError={(err) => report(err)}
    onEnter={(id) => {}} onCue={(id) => {}}
    onThemeChange={(spec) => {}}
    onAssessmentState={(s) => save(s)}
  />
</DreamerProvider>

const board = useBoard();   // { state, applyFinal, applyPartial, cue, flush, seek, back, reset,
                            //   snapshot, restore, exportOps, replay, assessments }
```

`useBoard` works with streamed partials and plain replies. A `<BoardControls>` component (skip, replay beat, back, progress dots) is optional and fully customizable.

```tsx
// Wiring the tutor, the voice and the board (see 7.14 and 7.15)
const conductor = useConductor({
  board,
  tutor: createHttpTutorConnector({ endpoint: "/api/tutor" }),   // or createAiSdkTutorConnector(...), createOpenAICompatibleTutorConnector(...), or your own
  voice: {
    tts: ["piper", "web-speech"], stt: "whisper-tiny", vad: "silero",          // engine chain with automatic fallback (names are examples)
    modelBaseUrl: "/voice-models",                                              // weights hosted by you, cached after a consent prompt
    turnTaking: "push-to-talk",
    privacy: { allowRemoteAudio: false, retainAudio: false },
  },
});
<VoiceControls conductor={conductor} /> <Captions conductor={conductor} />

// Server (optional): any model becomes a lesson endpoint
export const POST = createLessonHandler({ model, registry, profile: "lesson" });
```

---

## 13. Quality bars

- TypeScript strict; no `any` in the public API; TSDoc on every public export.
- **Bundle budget (initial targets, revisit with data):** core + React renderer, excluding lazy chunks, <= ~45 KB gzipped. KaTeX, Lottie, GSAP, **three.js and the 3D runtime**, flowchart layout, ambience runtime, drag-and-drop, code highlighting, chart code and each plugin are **separate lazy chunks**. CI size check.
- Performance: transform/opacity animation; no layout thrash; CPU-throttled test profile; ambience frame budget and lite mode; mounted-node cap works; **3D budgets** (render on demand, pixel-ratio cap, 1 to 2 live 3D figures, model size/triangle budgets enforced).
- **Tests:** reducer, validator, resolver, cue engine (race, flush, seek, cycles), theme resolver (policy, contrast, scoping, precedence, exam locks), **layout model and responsive collapse**, **flowchart layout (loops, decisions, long labels, narrow stepper)**, **assessment state machine (modes, timer with fake clock, navigation, flags, lock, restore after reload, keys rejected in exam)**, **persistence/replay round-trips**, **camera moves (pan, tilt, path, cue-triggered, user control and reset)**, **model manifest validation and connector contract tests (mock registry, signed-URL expiry, caching, offline)**, **3D directive validation (`unknown-part`, `unknown-view`), picking and part-id answers, WebGL-unavailable fallback**, middleware ordering and isolation, prompt-guide/profile snapshots, SSR/hydration tests, **plugin conformance suite run against every built-in plugin**, **customization-surface test for every built-in component**. Visual regression for key moods and layouts in Storybook (**[AGENT DECIDES]** tooling).
- Determinism: same ops + same cue sequence produce the same state and animation order.
- Headless entry point works without default components or CSS.
- **Voice and cues:** Conductor tests with `FakeVoice` (beat-level, aligned, estimated and reading-speed modes), cue `lead` accuracy on the audio clock, interruption and `spokenUpTo`, the degradation chain, autoplay/permission flows, privacy defaults (no remote audio unless allowed).
- **Connectors:** contract tests for every tutor connector (identical `LessonTurn` stream), the `fromResponse` mapping path for a custom API, server-handler validation/repair/limits and injection-defence tests, `dg:tutor-eval` against a mock model.
- **UI kit:** parity document complete; keyboard/screen-reader/axe checks per component; tree-shaking test (one component import does not pull others); per-subpath size budgets (`ui`, `voice`, `tutor`, `server`).
- **Release gates in CI:** licence audit, API-report diff, size limits, build matrix, provenance.

---

## 14. Milestones and acceptance criteria

Work in order; commit per milestone. **Completed (do not redo): M0 to M4b. Remaining: M4c, M4d, M5, M5b, M6a, M6b, M6c, M6d, M7, M8, M9.**

**Every milestone has its own playground route** (section 5): `/m1` to `/m9`, including `/m4b`, `/m4c`, `/m4d`, `/m5b`, `/m6a`, `/m6b`, `/m6c`, `/m6d`. Each milestone's Accept list implicitly includes: its route exists, demos every criterion and has its acceptance checklist filled in.

### M0: Audit and remediation plan (done)
### M1: Protocol (done)
### M2: Core (done)
### M3: Renderer, theming, styling, kinetic text, showreel gate (done and approved)

*(Their original acceptance criteria stand. Any v2.1 changes to their areas are made in M4b, not retroactively.)*

### M4: Blackboard behavior, camera, ambience (done)
- `attach` (placements, connectors, annotate, spotlight dimming, return, focus management); `replace` + history `back()` (with theme restore); receding of finished content; auto-scroll; streaming partials; **camera** (auto + op); **ambience layer** with example presets, lite mode, pause rules; tutor-driven `theme` op end to end.
- **Accept:** `attach-explainer.json`, `theme-mood-shift.json`, `camera-moves.json`, `streaming-partial.json` work end to end; narrow-viewport fallback; ambience pauses when hidden and is static under reduced motion; detour-scoped theme reverts on return.
- Routes `/m1` to `/m4` and the `/` index exist (verify during `RECONCILE.md`; backfill any that are missing).

### M4b: Retrofit and foundations (done)
Layout system, assessment state machine, plugin SDK and registries, persistence/replay, component anatomy refactor, extended 2D camera, model-connector contracts, density, i18n/RTL, SSR safety, devtools. **Complete and approved. Do not redo.**

### M4c: Motion language upgrade (from the reference video)
Begin only after the `RECONCILE.md` approval **[ASK]**. Route: `/m4c`.

**A. Protocol additions (schemas, types, JSON Schema, fixtures; log in `DECISIONS.md`):** `Beat`, `LessonTurn`, `StudentTurn` (6.17); `SceneTransition` and `replace.transition`; `update.transition`; `key` on nodes/marks; `pointer` op; cue `lead`; new effects (`tilt-rise`, `assemble`, `iris`), `caret`, `blur`; `orbit` diagram layout; `texture.glow`; camera `drift`; new error codes; the new fixtures (`text-morph.json`, `scene-transitions.json`, `pointer-tour.json`, `reference-saas-explainer.json`, `lesson-turn-narration.json` and the invalid ones). Update JSON Schema, prompt guide and `serializeBoard` (`spokenUpTo`, pending cues).

**B. Implementation:**
- Scene **transitions** (`cut`, `fade`, `wipe`, `push`, `iris`, `morph`) via a `defineTransition` registry and the `transitions-default` plugin, including the mid-transition theme flip; exam-mode restrictions.
- **Text morph/assemble** with keyed spans (shared-layout style for text; grapheme-safe), typewriter caret, `tilt-rise`, `iris` enter, velocity-based `blur` (cheap approximation, disabled on low-end devices).
- The **pointer** (dot/hand/arrow, eased travel, tap ripple, reduced-motion ring, exam-mode off).
- **`orbit`** diagram layout; structural decor presets (`blueprint-grid`, `rings`) in `ambience-default`; **glow** token and example `night`/`paper` moods; camera `drift`; default type scale with strong weight contrast.
- Cue **`lead`** support in the cue engine; `pacing: "reading"`.
- Study the reference (section 18), measure and record lead/duration/easing/stagger values in `DECISIONS.md`, and set defaults in `motion-default`.
- **Showreel v2:** rebuild the showreel to replicate the reference's five scenes using **protocol ops only**, driven by the mock narrator's cue timeline.

**Accept:** `reference-saas-explainer.json` replicates the reference sequence with no one-off code; every new effect/transition/pointer behaviour has a fixture and a Storybook story; transitions flip the mood at the midpoint; reduced motion degrades everything calmly; exam mode forces `cut`/`fade` and disables the pointer; 60 fps on the throttled profile; all items in the 11.3 checklist pass. **Motion gate [ASK]:** side-by-side capture against the reference at `docs/showreel/`, self-graded; STOP for human approval.

### M4d: UI kit (shadcn parity)
Route: `/m4d`. Implements 7.16 and 6.19.
- Inventory the current shadcn/ui list and write `docs/components/PARITY.md`.
- Build the **host-only kit** and the **tutor-addressable blocks** (registered by the default `ui-kit` plugin) on Radix primitives, with the Customization Surface contract, tokens, density, RTL, tap-first behaviour, board motion presets, and `term` tooltip/hover card.
- Add `counter` and `progress` (animated, cue-driven).
- **Accept:** `PARITY.md` complete; every tutor-addressable component renders from `ui-kit-blocks.json` with `enter` triggers and emits its events; hover behaviours work by tap on touch; every component is themable and replaceable (the customization-surface test passes); keyboard/screen-reader/axe checks pass; importing one component does not pull in others; `ui` is not in the core bundle; sizes recorded.

### M5: Figures
- `icon`, `image`, `diagram` (tree, radial, orbit, cycle; sequential reveal; focusable nodes), **`flowchart`** (shapes, decisions, labelled branches, loops/recycle, inputs/outputs, lanes, numbering, flow pulses, stepper/compact narrow modes, lazy layout chunk), **`timeline`**, `compare` block, `labeled` with asset packs, annotation primitives (hand-drawn strokes), asset resolver integration, lazy GSAP chunk.
- **Accept:** every layout/kind renders from fixtures; `process-flowchart.json` draws in sequentially with a decision and a recycle loop, legibly on a phone, with focusable steps emitting `focus`; GSAP, ambience and flowchart-layout code are not in the initial bundle; every figure shows `alt` when forced to fail; figures respect their layout region.

### M5b: 3D figures and the Model Connector
- **`model3d` plugin:** lazy `three` chunk with loaders and locally bundled decoders; manifest-driven part picking; directives (`view`, `show`, `highlight`, `dim`, `isolate`, `explode`, `cutaway`, `animation`, `flow`, `labels`, `tour`); student controls (orbit/pinch/pan/keyboard, views bar, reset); tweened camera; token-driven theming; poster placeholder; render on demand; context management (1 to 2 live figures, snapshot freezing); LODs; disposal; WebGL fallback; accessible parts list.
- **`scene3d` plugin:** procedural primitives, `place`/`arrange`, simple animations, limits.
- **Model connector runtime:** the resolution flow in 6.16, validation, `allowedOrigins`, budgets; **reference connectors** in `dreamer-genui/connectors` (`createStaticModelConnector`, `createHttpModelConnector`, `withModelCache`, `withPrefetch`); `getModelTools` / `getModelContext` completed; `serializeBoard` lists models in use; prompt-guide additions; 3D events (`focus` with part refs, optional `view` events).
- `dg:model-check <glb> <manifest>`: verifies the named parts exist, budgets, conventions and manifest schema. **[ASK]** before building a model-preparation CLI.
- Playground: a **mock model registry** (`/api/mock-models`) serving a tiny demo model and manifest through the HTTP connector, plus a connector switcher (static, HTTP, cached/offline).
- **Route:** `/m5b`.
- **Accept:** `model3d-basic.json` and `model3d-tour.json` load through both the static and the HTTP mock connectors with **identical mapping**; the poster shows first; the tour changes views, highlights, isolates and labels in sync with mock-narrator cues; tapping a part emits `focus` with `ref = figureId/partId`; unknown part/view/model produce `unknown-part` / `unknown-view` / `model-not-found` with graceful fallback; WebGL-unavailable fallback shows poster plus parts list; a cached model works offline after first load; three.js is **not** in the initial bundle; no frames render when idle; orbit stays smooth on a CPU-throttled profile; `scene3d-solids.json` renders; conformance suite passes.
- **3D showcase gate [ASK]:** a tour demo (using the demo model; the human supplies real models through their registry later) on `/m5b`, with captures; **STOP for human approval.**

### M6a: Content built-ins
- `math` (KaTeX + mhchem, block and inline), `chart`, `table`, `lottie`, `code`; all as default plugins (lazy), built only with the public SDK.
- **Accept:** fixtures render; unregistering/disabling a built-in yields a graceful `unknown-type` fallback and removes it from the prompt guide; overriding via the registry works; they respect the active theme, mood and density; conformance suite passes for each.

### M6b: Questions and assessment
- Built on the UI kit (M4d: cards, tabs, progress, sheet, tooltip) and the board's motion language.
- **`questions` plugin:** all question kinds (mcq, truefalse, short, numeric, cloze, matching, ordering, hotspot, labelDiagram, extended), `flashcards`, `blank` mark, hint ladder, `status`/`feedback` states with animated reactions, keyboard-accessible drag equivalents; **`hotspot` and `labelDiagram` work with `model3d` figures** (raycast picking, part-id answers, accessible parts list).
- **`assessment` plugin:** shell UI (title, instructions, timer, navigator with answered/flagged/unvisited, section grouping, marks, flag, submit with confirm), modes (`practice`, `quiz`, `exam`, `review`), review mode driven by `update` ops, local-first autosave/restore, host API, distraction-free enforcement, `onAssessmentState`.
- **Accept:** `question-kinds.json`, `assessment-practice.json`, `assessment-exam.json`, `assessment-review.json` work end to end; timer survives reload; answers autosave and restore; a key in an exam payload is rejected; no feedback is visible in exam mode until review; every question kind is fully keyboard and screen-reader operable; 3D hotspot and label-drag questions work with part ids; conformance suite passes.
- **Exam run-through gate [ASK]:** a playground exam simulator (silent mock tutor, timer, navigation, flagging, submit, review) with captures; **STOP for human approval.**

### M6c: Tutor connectors and the server helper
Route: `/m6c`. Implements 7.15.
- `TutorConnector` interface and `defineTutorConnector`; `createHttpTutorConnector` (with `toRequest`/`fromResponse` mapping for custom/platform APIs), `createAiSdkTutorConnector`, `createOpenAICompatibleTutorConnector`; `dreamer-genui/server` with `createLessonHandler` (prompt assembly, structured output against the `LessonTurn` schema, streaming, per-op validation and repair, limits, tools, injection defence, trace hooks); `dg:tutor-eval`.
- Playground: mock tutor endpoints for each connector type, including a **legacy-shaped API** mapped through `fromResponse` (the "bring a tutor" path) and a "bring a model" path through the server helper with a mock model.
- **Accept:** the same fixtures stream through all three connectors with identical results; invalid ops are repaired or dropped with a report; the handler works in a Next.js route; credentials never reach the client; injection tests pass; the eval harness runs against a mock model and reports validity rates; network code exists only in the opt-in subpaths.

### M6d: Voice and the Conductor
Route: `/m6d`. Implements 7.14 and 6.17.
- `Narrator`, `Listener`, `Conductor`/`useConductor`, `<VoiceControls>`, `<Captions>`, `<SpeakButton>` and `speakable`; the engines (Web Speech default; **at least one open-source TTS, one open-source STT and a VAD**), the OpenAI-compatible TTS and ElevenLabs providers, `defineVoiceProvider`, the `RealtimeVoiceAdapter` interface, device probing and fallback chain, consent/size prompts and caching, privacy config, `FakeVoice`.
- **Accept:** with `lesson-turn-narration.json` and a real local engine, nodes enter within the documented cue-lead tolerance of the audio clock; the first beat is spoken before the whole reply has streamed; barge-in works and the next `StudentTurn` carries `spokenUpTo`/`interrupted`; the fallback chain works (engine unavailable, then Web Speech, then reading-speed captions); remote audio is blocked unless allowed; mic-denied and autoplay flows work; per-engine Kiswahili behaviour documented; weights are not in the npm package; bundle budgets hold; exam mode is silent. **Voice sync gate [ASK]:** a capture of a narrated lesson with cues landing on the spoken beats; STOP for human approval.

### M7: Playground, tooling and docs
- Playground: **the `/` index and a polished route for every milestone with consistent checklist panels** (including `/m4c`, `/m4d`, `/m6c`, `/m6d`, `/m9`), JSON editor to live board, fixture picker, theme/mood/ambience/layout/density switchers, mock tutor, **mock narrator** (cue timeline UI), exam simulator, event/error/cue logs, Showreel and Layout showcase.
- `<BoardControls>` (skip, replay beat, back, progress dots, customizable); finalized devtools overlay with plugin panels; **testing utilities and conformance suite** published; `templates/` (plugin, theme, mood+ambience starters); `pnpm dg:plugin-check`.
- Storybook story per component and per fixture (including mood, layout and density variants).
- README and `docs/authoring/`: quick start, concepts, cue/trigger guide, layout guide, theming and mood guide, Tailwind and plain-CSS guide, schema reference, **plugin authoring guide with every recipe in 8.9**, customization ladder guide, headless guide, assessment guide, persistence/replay guide, **3D authoring guide (preparing models: named parts, budgets, manifest) and connector authoring guide (writing a `ModelConnector` for your own registry, mapping to `ModelManifest`, caching/offline, security)**, tutor integration guide (prompt guide + profiles, `serializeBoard`, event loop, narrator adapter pattern, Vercel AI SDK).
- **Accept:** a new developer can follow the docs alone to render a fixture, theme it with Tailwind, add a custom mood, effect, layout and block via a plugin, run the conformance suite, and wire a cue source.

### M8: Hardening
- Accessibility audit (axe plus manual screen-reader and keyboard passes on key flows, including exam mode); performance pass on a throttled low-end profile (**including 3D memory and WebGL-context behavior, and voice-engine load time and real-time factor on low-end Android**); privacy review (audio handling, consent flows, data retention); bundle audit against budgets; SSR/RSC and browser-matrix testing; security review (sanitization, CSP, limits, plugin boundaries); API freeze and docs for stability guarantees; `migrate()` coverage. (Packaging, licences and publishing are M9.)
- **Accept:** CI green on all budgets and audits; a clean-room install in a fresh Next.js app (Tailwind and non-Tailwind variants) works from the README alone; every budget and audit passes.

### M9: Release candidate and 1.0.0 publish
Route: `/m9` (release checklist page). Implements 7.18.
- Licence files and `THIRD_PARTY_NOTICES.md`; API report; exports map, build outputs and size limits; provenance-enabled CI; hosted Storybook/playground; compatibility matrix run; `SECURITY.md`, `CONTRIBUTING.md`, issue templates; changelog.
- Publish `1.0.0-rc.1` to the `next` tag, run a clean-room install test in a fresh Next.js app (Tailwind and non-Tailwind variants) and a plain Vite app, fix issues, iterate `rc.N`.
- **Accept:** all CI gates green; clean-room installs work from the README alone; the API report is frozen; the checklist on `/m9` is complete. **The human approves the final publish of `1.0.0` to `latest` [ASK].**

---

## 15. Working agreement

1. Follow milestones in order; show a short plan before each. **Do not redo completed milestones.**
2. Do **not** change the protocol silently; propose, apply the smallest fix, log in `DECISIONS.md` with the reason.
3. **[ASK]** before: starting M4c (after `RECONCILE.md`), each gate (**Motion gate M4c, 3D showcase M5b, Exam run-through M6b, Voice sync gate M6d**), the final `1.0.0` publish, anything in "Optional, propose first", any opt-in first-party plugin, a model-preparation CLI, an eject CLI, a realtime speech-to-speech reference adapter, and anything outside v1 scope.
4. Keep the library **generic**. No tutor-, curriculum-, exam-board-, voice-vendor- or product-specific code or strings in `packages/`. Example moods/subjects/processes live in presets, fixtures and docs, never in logic.
5. **Dogfood the SDK.** Built-in plugins may only use the public plugin APIs; CI enforces this.
6. **Every new component ships with its Customization Surface** (8.5), tests, a Storybook story and docs.
7. Keep the `schema` package free of React and DOM imports.
8. When ambiguous, pick the simplest option that preserves extensibility, record it, keep moving, but **never trade away the Art & Motion Direction (section 11) or the customization requirements (section 8) for simplicity**.
9. **The core never touches the network.** Network access exists only in the opt-in subpaths (`connectors`, `tutor`, `server`, remote voice providers, voice-engine model loading) and only when the host configures it. **No analytics or telemetry, ever.** Audio is processed locally by default; remote audio requires explicit opt-in.
10. **Every milestone ships its own playground route** with demos and an acceptance checklist; a milestone is not done until its route works.
11. **The tutor never generates 3D meshes, shaders or code**; it only selects and directs models registered in the external model registry, or composes `scene3d` primitives.
12. **MIT licence.** Every dependency and bundled asset must be compatible and recorded in `THIRD_PARTY_NOTICES.md`; **no model weights in the package**.
13. **Release discipline:** 1.0.0 freezes the public API and protocol `v: 1`; breaking changes need a deliberate decision, never an incidental edit.

## 16. Decisions the agent must make and record in `DECISIONS.md`

confirm Radix for the UI kit (or justify an alternative); Lottie player and how expressions are disabled; code highlighter and default languages; **flowchart layout engine (dagre vs elk vs custom) and why**; drag-and-drop approach; icon set source and licence; GSAP licence check; browserslist; bundle budget thresholds after first measurement; ambience implementation per preset and lite-mode detection; visual regression tooling; how `components` override typing is expressed; middleware ordering rules; ops-log and snapshot formats; three.js vs alternatives, decoder hosting, label overlay and occlusion approach, picking method, WebGL-context strategy, connector caching strategy and manifest versioning, `scene3d` arrangement presets; any token or effect-preset renames; Playwright scope; **voice engines to ship (which open-source TTS/STT/VAD, with licences, download sizes, Kiswahili coverage), model-weight hosting and caching, AI SDK major-version compatibility, structured-output strategy for OpenAI-compatible models (JSON schema vs tool calling), server repair/retry policy, shadcn inventory snapshot, morph/blur/pointer implementation approaches, cue-lead defaults measured from the reference, release tooling.**

## 17. Background (context only)

The first consumer is JifunzeAI, a Kenyan K-12 tutor. A Tutor AI emits these ops from a system prompt produced by `getSystemPromptGuide()`. The **Conductor** (7.14) connects the tutor API and the voice: the tutor's single reply carries narration beats and ops; the Conductor speaks beat by beat and fires `board.cue(beatId)` as each begins, so board elements enter only when relevant, like a teacher writing a topic down when it becomes relevant. The tutor is reached either through the general "bring a model" path (Vercel AI SDK or any OpenAI-compatible endpoint, optionally via the server helper) or through the platform's own tutor API via a custom connector; the board cannot tell which. The host sends `serializeBoard()` and capabilities each turn and forwards `UIEvent`s as the student's next input. The tutor may change the board's mood (for example a sombre register for a grave topic) and layout (for example an explanation beside a question) alongside the lesson content. During tests the host switches an `assessment` to `exam` mode: the tutor goes silent, the board goes calm, and grading happens on the host/backend. The platform keeps its own 3D models in an external model registry (for example an anatomical heart model); the host implements a `ModelConnector` for it, the tutor finds models through model tools (or host retrieval) and directs them with views, highlights, labels and cue-driven tours, and the student can orbit, tap parts and answer hotspot or label questions on them. None of this is encoded in the library; it renders what the ops describe and reports what the student does.

## 18. Visual reference (analysed; the visual target)

The human supplied a reference explainer video: place it at `docs/reference/` (filename `_How_to_Create_a_SaaS_Explainer_Ad_in_After_Effects_Full_tutorial_From_Scratch_3.mp4`; 24.4 s, 1080x1920 portrait, 30 fps, **with a voice narrator**). **Study the video yourself**: extract frames (for example with `ffmpeg`, 1 to 4 frames per second, plus denser sampling around transitions), and transcribe the narration with an offline speech-to-text tool so you can measure how each visual lands relative to the spoken words. Record in `DECISIONS.md` the typical **lead** between a word and its visual, entrance durations, easing feel and stagger values you measure, and set defaults in `motion-default` accordingly.

Scene breakdown (from the brief author's frame sampling; **verify against the video**):
1. **0 to ~4 s, dark navy:** a question ("What does SaaS mean?") rises in with a 3D tilt, the accent word in blue; it breaks into letters that travel and become the full phrase, with the accent letters persisting while the other words assemble around them.
2. **~4 to 9 s:** a thin italic label top-left; thin grid lines draw across the frame; a blue tile pops in at an intersection with a cluster of icons popping in staggered; browser-style UI cards slide across with motion blur; a pill progress bar fills with a label.
3. **~9.8 s hard cut** to a light-grey scene: a bold blue headline typed with a caret. **~11.7 s hard cut** to a dark neon HUD scene: a large eye icon with side panels and widgets, slow push-in, glow.
4. **~15 to 19 s:** concentric rings expand around a ticking counter, with small icon badges orbiting on the rings, glow.
5. **~20 to 24 s:** a circular iris reveal from dark to white with a blue word; then on light grey the words appear one by one while a small black dot travels to lead the eye; fade to black.

Observations: only three hard cuts; almost everything else is joined by motion (mask reveals, push-ins, morphs); each scene carries one idea for about 4 to 5 seconds; the audio is continuous narration until a final fade; type is a heavy geometric sans with thin italic secondary labels; palette flips between dark navy with a cyan/blue accent and light grey with a blue accent.

How this maps to the board: sections 6.17 (narration and cues), 6.18 (transitions, morph, pointer, effects, decor, glow), 11 (art direction), and milestone **M4c** (motion gate). The reference is the visual target; sections 11 and 6.18 are the floor. All text, topics and brands in the video are illustrative only; replicate the **behaviour and feel**, not the content.
