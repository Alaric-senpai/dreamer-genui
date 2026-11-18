import type { ProfileDefinition } from '../plugin';
import type { Registry } from '../registry';
import { profileBlockTypes, resolveProfile } from '../profiles';

export interface PromptGuideOptions {
  compact?: boolean;
  language?: string;
  /** Only include these registered types (by id). Unregistered ids are reported. */
  include?: string[];
  /** Sections or type ids to exclude: 'ops' | 'protocol' | 'layout' | 'theme' | 'models' | 'examples' | <type id>. */
  exclude?: string[];
  /** Capability profile name (§9.4) or an inline definition. */
  profile?: string | ProfileDefinition;
  /** Replace a section ('ops'|'protocol'|'layout'|'theme'|'models'|'examples') or one block type's snippet. */
  guideOverrides?: Record<string, string>;
}

// Operations section (registry-independent)
const OPS_GUIDE = `## Operations

Reply format: { "v": 1, "ops": [...] }

- **append**: Add blocks to the board. Blocks appear in order. Use 'after' to insert after a specific node id.
- **attach**: Open a secondary explainer ON an existing node (max depth 2). The rest of the board dims (spotlight mode). Use 'placement' (right|left|above|below|overlay|inline), 'connector' (line|arrow|bracket|none), and 'target.annotate' (circle|underline|box|highlight|bracket|none). The built-in Return control closes the detour.
- **replace**: Start a new board. The old board is saved in history (max 50). Use 'title' to name the new topic.
- **update**: Merge props into an existing node (props are merged into the block).
- **remove**: Delete a node from the board.
- **layout**: Change the board's composition ({ "op": "layout", "layout": { "kind": "split", "ratio": "2:1" } }). Existing content animates to its new positions; it never re-enters. Use it deliberately — for example flow → split when a question appears beside an explanation.
- **theme**: Shift the board's mood or tokens mid-lesson ({ "op": "theme", "theme": { "mood": "…" }, "scope": "board" | "detour" }). Moods must be registered names; full theme guidance is documented separately. Use sparingly — only when the emotional register genuinely changes.
- **camera**: Ask for a virtual-camera move to a node ref or "overview" ({ "op": "camera", "to": "some-node", "zoom": 1.4, "tilt": { "y": 8 }, "dolly": "in" }). A guided sequence is { "op": "camera", "path": [ {...}, {...} ] }; each move may carry a cue trigger so the camera follows narration. Presentation-level and bounded: the host may honour or ignore it, and text stays flat and readable.
- **pointer**: Point at something ({ "op": "pointer", "to": "some-node", "style": "dot" }). Only one pointer exists per board; send { "op": "pointer", "to": "hide" } to dismiss it. Use it when narration directs attention to a specific part of the screen.
- **replace.transition**: Choose how a new scene arrives ({ "kind": "fade" | "cut" | "wipe" | "push" | "iris" | "morph" }). Default is a calm fade; "morph" pairs nodes by their "key" so matching content moves into its new place. Set "theme" on the transition when the mood should change at the cut.
- **update.transition**: "morph" lets keyed text flow to its new wording; "fade" crossfades; "none" swaps instantly.

Node ids must be unique across the board (including attached detour blocks).`;

// Protocol-wide sections that do not come from the registry
const PROTOCOL_GUIDE = `## Inline Marks

- **highlight** (text, color?): highlight text with color token (accent|info|success|warn|danger|muted|ink).
- **emphasis** (text): italic/bold emphasis.
- **term** (text, definition): term with inline definition tooltip.
- **focusable** (text, ref): clickable text that emits a 'focus' UIEvent with ref.
- **annotate** (text, kind, color?): circle|underline|box|bracket|strike.
- **math** (tex): inline math.
- **blank** (id, options?): a cloze gap; valid only inside a cloze question.

## Motion

Use 'enter.effect' on blocks: reveal|rise|tilt-rise|pop|sweep|draw|stagger|none, plus text/kinetic effects typewriter|words|chars|slam|wipe|scribble|zoom|count-up|morph|assemble|iris. Enter effects that split text accept 'split' (words|chars|lines). 'assemble' builds words from scattered pieces; 'iris' opens the block through a circular mask; 'tilt-rise' lifts it from a slight perspective. Typewriter accepts 'caret:true' to show a blinking caret; 'blur:true' adds a cheap motion blur where the device can afford it. Set 'order' to group animations (same order = simultaneous). 'delay' and 'duration' are in ms. 'emphasis' (pulse|underline|glow|shake|bounce|wobble) plays after enter. 'exit' (fade|shrink|wipe-out|none).

Keyed motion: give a node or mark a stable 'key'. On 'update' with { "transition": "morph" }, content with the same key flows to its new wording instead of re-entering; use 'assemble' when a line is built word by word.

Enter triggers (§6.2): by default nodes enter as soon as they arrive ('start'). Optionally set 'enter.trigger' to gate entrance — { "on": "cue", "id": "beat-2", "lead": 180 } waits for that cue (lead in ms, optional), { "on": "after", "node": "id" } waits for another node, { "on": "event", "node": "ref", "event": "focus" | "select" | "answer" } waits for a student interaction. Marks (highlight/emphasis/term/focusable/annotate/math) may also carry 'enter' with a trigger — e.g. circle a phrase exactly when it is being discussed.

Text variants: 'hero' (large screen-owning statement — a few words), 'kicker' (small lead-in label), 'quote' (styled quotation). Use hero/kicker sparingly: one per screen at most.

Reduced motion: all effects fall back to instant/unanimated. Always show all content even without animation.

## Figures

- **diagram** (kind: tree|radial|cycle|orbit): no coordinates. Label nodes with nodes[].id, nodes[].label. Connect with edges[]. Use 'orbit' for a centre-and-satellites composition. Set 'focusable:true' to emit 'focus' on node click.
- **flowchart** (nodes/edges with decisions, branches, loops, inputs/outputs): use for multi-step processes. Node shapes: step|start|end|decision|io|substance|note. Labels are inline arrays, e.g. ['Brine + NH₃']. Set 'flow:"pulse"' to animate the path.
- **timeline** (events with when/label): for chronological sequences.
- **labeled** (pack, art): reference named parts by id (highlight and label by part id).
- **chart** (type: bar|line|pie|scatter): series[].data is number[] or {x, y}[].
- **lottie** (src, loop?): alt required.
- **scene3d** (objects): procedural shapes from a safe vocabulary; use 'place'/'arrange' rather than raw coordinates. No model registry needed.

## Idempotency

When streaming partial replies: include 'after' in append ops to maintain order. Partial blocks are resolved once complete. Never emit duplicate node ids on the same board.

## Pacing — write the board like narration

Write on the board only what you are currently talking about: one idea per beat. Return 'narration' as an ordered list of beats, each with a unique id and its spoken text; a beat's id is also the cue id its nodes wait for. Optionally mark a point inside a beat with [[cue:some-id]] to fire another cue mid-sentence (for example another line appears as an aside). Put 'enter': { "effect": "words", "trigger": { "on": "cue", "id": "beat-3" } } on the content for beat-3. 'enter.trigger.lead' (ms) lets a node arrive slightly before its cue, useful with voice. Keep cue ids stable and increasing within a lesson (beat-1, beat-2, …). Content is NOT shown until its trigger fires.

The host may pace cues itself, let the library derive them from text length ('pacing': 'reading'), or drive them from the voice conductor. Writes with no matching cue are reported as 'cue-orphan' and entered at the end of the turn, so every enter trigger should correspond to a beat or inline marker. An 'after' chain pairs one entrance onto another; do not create loops.

## Events

The library emits: focus, select, answer, action (return|continue|hint|view|custom), assessment.
The host app handles correctness, grading, and routing.`;

const LAYOUT_GUIDE = `## Layout

Choose the composition deliberately; the library owns the geometry. Send a 'layout' op at any time and existing content animates to its new positions (instant under reduced motion).

- **flow** (default): a vertical column for one idea at a time.
- **split**: two regions ('left'/'right', or 'right-left' to mirror). Use it to pair an explanation with a question or a figure — for example a question enters on the right while the context stays on the left.
- **grid**: 2–4 columns for parallel items.
- **stage**: named regions (top|left|center|right|bottom) for composed scenes.

Place a node with 'slot' (left|right|top|bottom|center); unslotted nodes flow into the layout's primary region, and slots a layout does not define fall back to it. Layout options are token names only: 'gap' (none|xs|sm|md|lg|xl), split 'ratio' (1:1|2:1|1:2|3:2|2:3), 'narrow' (stack|tabs), 'narrowOrder', 'pin' (keep one side visible on phones), grid 'columns'/'narrowColumns', stage 'regions'. Never describe screen sizes — the board re-flows by its own container width.

Keep the same node ids across a layout change so content animates rather than re-entering.`;

const MODELS_GUIDE = `## 3D Models

'model3d' figures direct a model that lives in the host's external registry; the library never generates meshes, shaders or code.

- Use ONLY model, part, view, animation, path and cutaway ids returned by the model tools ('find_models', 'get_model') or supplied in the host's model context. Never invent ids.
- Direct the model instead of describing its structure in prose: 'view', 'highlight', 'dim', 'isolate', 'explode', 'cutaway', 'labels', 'flow' and 'animation'.
- Use 'tour' steps with cue triggers so view changes, highlights and labels follow the narration.
- Tapping a part emits 'focus' with ref "<figureId>/<partId>".
- Always include 'alt'; the poster/alt is the fallback when 3D is unavailable.`;

/** Registry-aware mood/ambience/surface section (§6.8): moods listed WITH their descriptions. */
function themeGuide(registry: Registry): string {
  const moods = registry.listMoods();
  const lines: string[] = ['## Mood & Theme', ''];
  lines.push('Change the board\'s mood only when the emotional register of the lesson genuinely changes — prefer "mood" over raw "tokens", and never request unreadable colour combinations.');
  lines.push('');
  if (moods.length) {
    lines.push('Registered moods (use the name exactly as listed):');
    for (const m of moods) lines.push(`- **${m.name}**: ${m.description}`);
  } else {
    lines.push('No moods are registered on this host; do not send theme ops.');
  }
  const ambience = registry.listAmbience();
  if (ambience.length) lines.push(`Ambience presets: ${ambience.map(a => a.name).join('|')}.`);
  const surfaces = registry.listSurfaces();
  if (surfaces.length) lines.push(`Surfaces: ${surfaces.map(s => s.name).join('|')}.`);
  lines.push('Raw "tokens" may be unavailable depending on host policy; if a theme request is rejected, simply continue without it.');
  return lines.join('\n');
}

const WORKED_EXAMPLES = `
## Worked Examples

### Example 1: Define a concept
{ "v": 1, "ops": [
  { "op": "append", "blocks": [
    { "id": "def1", "type": "text", "variant": "definition",
      "content": ["Biology is the study of ", { "mark": "highlight", "text": "living things" }] }
  ] }
] }

### Example 2: Attach an explainer
{ "v": 1, "ops": [
  { "op": "attach", "to": "branches/botany", "blocks": [
    { "id": "botany-detail", "type": "text", "variant": "body", "content": ["Botany studies plants."] }
  ], "placement": "right", "connector": "arrow", "target": { "annotate": "circle" } }
] }

### Example 3: Replace with new topic
{ "v": 1, "ops": [
  { "op": "replace", "title": "Photosynthesis", "blocks": [
    { "id": "photo1", "type": "math", "tex": "\\\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}", "display": true }
  ] }
] }
`;

/**
 * Build the tutor-facing prompt guide.
 *
 * Registry- and profile-aware: the per-type snippets come from the registered
 * manifests (built-ins and plugins alike), so a plugin's snippet or an asset
 * pack's part ids appear automatically. `profile` selects a capability profile
 * (§9.4) and `include`/`exclude` filter types and sections. `guideOverrides`
 * replaces a section or one type's snippet. `compact` omits protocol details
 * and worked examples; `language` appends an output-language instruction.
 *
 * `model3d` is omitted entirely unless at least one model connector is
 * registered (§6.16); `scene3d` needs no registry.
 */
export function getSystemPromptGuide(registry: Registry, options?: PromptGuideOptions): string {
  const excluded = new Set(options?.exclude ?? []);
  const overrides = options?.guideOverrides ?? {};
  const { name: profileName, definition: profile } = resolveProfile(registry, options?.profile);
  const compact = options?.compact ?? profile.compact ?? false;
  const hasConnectors = registry.listModelConnectors().length > 0;

  const parts: string[] = [];
  parts.push('# dreamer-genui Prompt Guide\n');
  parts.push(`Reply format is JSON. Output only JSON matching this format.${profileName !== 'custom' ? ` Profile: ${profileName}.` : ''}\n`);

  if (!excluded.has('ops')) parts.push(overrides.ops ?? OPS_GUIDE, '\n');
  if (!excluded.has('protocol')) parts.push(overrides.protocol ?? PROTOCOL_GUIDE, '\n');
  if (!excluded.has('layout')) parts.push(overrides.layout ?? LAYOUT_GUIDE, '\n');
  if (!excluded.has('theme')) parts.push(overrides.theme ?? themeGuide(registry), '\n');
  if (hasConnectors && !excluded.has('models')) parts.push(overrides.models ?? MODELS_GUIDE, '\n');

  // Registry-aware block-type snippets, filtered by the active profile.
  const include = options?.include?.length ? options.include : undefined;
  const caps = registry.getCapabilities();
  const missing = include ? include.filter(t => !caps.includes(t)) : [];
  const profileTypes = profileBlockTypes(registry, profile);
  let selected = include ? profileTypes.filter(t => include.includes(t)) : profileTypes;
  if (!hasConnectors) selected = selected.filter(t => t !== 'model3d');
  const remaining = selected.filter(t => !excluded.has(t));

  if (remaining.length) {
    parts.push('## Block Types\n');
    for (const t of remaining) {
      const guide = overrides[t] ?? registry.getManifest(t)?.promptGuide;
      parts.push(`- **${t}**${guide ? `: ${guide}` : ''}\n`);
    }
  }

  if (missing.length > 0) {
    parts.push(`\nNote: requested types not registered: ${missing.join(', ')}.\n`);
  }

  if (!compact && !excluded.has('examples')) {
    parts.push(overrides.examples ?? WORKED_EXAMPLES);
  }

  if (options?.language) {
    parts.push(`Write all student-facing text in ${options.language}.`);
  }

  return parts.join('\n');
}
