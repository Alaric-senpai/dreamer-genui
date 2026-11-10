import type { Registry } from '../registry';

export interface PromptGuideOptions {
  compact?: boolean;
  language?: string;
  /** Only include these registered types (by id). Unregistered ids are reported. */
  include?: string[];
  /** Sections or type ids to exclude: 'ops' | 'protocol' | 'examples' | <type id>. */
  exclude?: string[];
}

// Operations section (registry-independent)
const OPS_GUIDE = `## Operations

Reply format: { "v": 1, "ops": [...] }

- **append**: Add blocks to the board. Blocks appear in order. Use 'after' to insert after a specific node id.
- **attach**: Open a secondary explainer ON an existing node (max depth 2). The rest of the board dims (spotlight mode). Use 'placement' (right|left|above|below|overlay|inline), 'connector' (line|arrow|bracket|none), and 'target.annotate' (circle|underline|box|highlight|bracket|none). The built-in Return control closes the detour.
- **replace**: Start a new board. The old board is saved in history (max 50). Use 'title' to name the new topic.
- **update**: Merge props into an existing node (props are merged into the block).
- **remove**: Delete a node from the board.
- **theme**: Shift the board's mood or tokens mid-lesson ({ "op": "theme", "theme": { "mood": "…" }, "scope": "board" | "detour" }). Moods must be registered names; full theme guidance is documented separately. Use sparingly — only when the emotional register genuinely changes.
- **camera**: Ask for a virtual-camera move to a node ref or "overview" ({ "op": "camera", "to": "some-node", "zoom": 1.4 }). Presentation-level; the host may honour or ignore it.

Node ids must be unique across the board (including attached detour blocks).`;

// Protocol-wide sections that do not come from the registry
const PROTOCOL_GUIDE = `## Inline Marks

- **highlight** (text, color?): highlight text with color token (accent|info|success|warn|danger|muted|ink).
- **emphasis** (text): italic/bold emphasis.
- **term** (text, definition): term with inline definition tooltip.
- **focusable** (text, ref): clickable text that emits a 'focus' UIEvent with ref.
- **annotate** (text, kind, color?): circle|underline|box|bracket|strike.
- **math** (tex): inline math.

## Motion

Use 'enter.effect' on blocks: reveal|rise|pop|sweep|draw|stagger|none, plus text/kinetic effects typewriter|words|chars|slam|wipe|scribble|zoom|count-up|morph. Enter effects that split text accept 'split' (words|chars|lines). Set 'order' to group animations (same order = simultaneous). 'delay' and 'duration' are in ms. 'emphasis' (pulse|underline|glow|shake|bounce|wobble) plays after enter. 'exit' (fade|shrink|wipe-out|none).

Enter triggers (§6.2): by default nodes enter as soon as they arrive ('start'). Optionally set 'enter.trigger' to gate entrance — { "on": "cue", "id": "beat-2" } waits for the host to fire that cue, { "on": "after", "node": "id" } waits for another node, { "on": "event", "node": "ref", "event": "focus" | "select" | "answer" } waits for a student interaction. Marks (highlight/emphasis/term/focusable/annotate/math) may also carry 'enter' with a trigger — e.g. circle a phrase exactly when it is being discussed.

Text variants: 'hero' (large screen-owning statement — a few words), 'kicker' (small lead-in label), 'quote' (styled quotation). Use hero/kicker sparingly: one per screen at most.

Reduced motion: all effects fall back to instant/unanimated. Always show all content even without animation.

## Figures

- **diagram** (kind: tree|radial|flow|cycle): no coordinates. Label nodes with nodes[].id, nodes[].label. Connect with edges[]. Set 'focusable:true' to emit 'focus' on node click.
- **labeled** (pack, art): reference named parts by id (highlight and label by part id).
- **chart** (type: bar|line|pie|scatter): series[].data is number[] or {x, y}[].
- **lottie** (src, loop?): alt required.

## Idempotency

When streaming partial replies: include 'after' in append ops to maintain order. Partial blocks are resolved once complete. Never emit duplicate node ids on the same board.

## Pacing — write the board like narration

Write on the board only what you are currently talking about: one idea per beat. Attach a cue to each beat's entrance so it appears as it is spoken, e.g. "enter": { "effect": "words", "trigger": { "on": "cue", "id": "beat-3" } }. Keep cue ids stable and increasing within a lesson (beat-1, beat-2, …) — the host fires each cue as the narration reaches it, and content is NOT shown until its trigger fires. An 'after' chain pairs one entrance onto another; do not create loops.

## Events

The library emits: focus, select, answer, action (return|continue|hint|custom).
The host app handles correctness, grading, and routing.`;

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
 * Registry-aware: the per-type snippets come from the registered manifests
 * (built-ins and plugins alike), so a plugin's snippet or an asset pack's part
 * ids appear automatically. options.include filters the listed types;
 * options.exclude removes sections ('ops', 'protocol', 'examples') or type ids;
 * compact omits the protocol details and worked examples; language appends an
 * output-language instruction.
 */
export function getSystemPromptGuide(registry: Registry, options?: PromptGuideOptions): string {
  const excluded = new Set(options?.exclude ?? []);
  const parts: string[] = [];

  parts.push('# dreamer-genui Prompt Guide\n');
  parts.push('Reply format is JSON. Output only JSON matching this format.\n');

  if (!excluded.has('ops')) parts.push(OPS_GUIDE, '\n');
  if (!excluded.has('protocol')) parts.push(PROTOCOL_GUIDE, '\n');
  if (!excluded.has('theme')) parts.push(themeGuide(registry), '\n');

  // Registry-aware block-type snippets
  const include = options?.include?.length ? options.include : undefined;
  const caps = registry.getCapabilities();
  const missing = include ? include.filter(t => !caps.includes(t)) : [];
  const selected = include ? caps.filter(t => include.includes(t)) : caps;
  const remaining = selected.filter(t => !excluded.has(t));

  if (remaining.length) {
    parts.push('## Block Types\n');
    for (const t of remaining) {
      const guide = registry.getManifest(t)?.promptGuide;
      parts.push(`- **${t}**${guide ? `: ${guide}` : ''}\n`);
    }
  }

  if (missing.length > 0) {
    parts.push(`\nNote: requested types not registered: ${missing.join(', ')}.\n`);
  }

  if (!options?.compact && !excluded.has('examples')) {
    parts.push(WORKED_EXAMPLES);
  }

  if (options?.language) {
    parts.push(`Write all student-facing text in ${options.language}.`);
  }

  return parts.join('\n');
}
