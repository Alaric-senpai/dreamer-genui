import { createRegistry, type Registry } from '../registry';

export interface PromptGuideOptions {
  compact?: boolean;
  language?: string;
  include?: string[];
  exclude?: string[];
}

// Built-in prompt guide text (not loaded from registry — filled in progressively)
const OPS_GUIDE = `## Operations

Reply format: { "v": 1, "ops": [...] }

- **append**: Add blocks to the board. Blocks appear in order. Use 'after' to insert after a specific node id.
- **attach**: Open a secondary explainer ON an existing node (max depth 2). The rest of the board dims (spotlight mode). Use 'placement' (right|left|above|below|overlay|inline), 'connector' (line|arrow|bracket|none), and 'target.annotate' (circle|underline|box|highlight|bracket|none). The built-in Return control closes the detour.
- **replace**: Start a new board. The old board is saved in history (max 50). Use 'title' to name the new topic.
- **update**: Merge props into an existing node (props are merged into the block).
- **remove**: Delete a node from the board.

## Block Types

- **text** (variant: body|definition|heading|note): content is Inline[].
- **figure** (figure.kind: image|icon|diagram|labeled|chart|lottie): alt is required.
- **choices** (intent: navigate|answer, layout: chips|list|grid): items have id, label, ref.
- **steps** (reveal: sequential|all): items have id, title, content: Inline[].
- **callout** (tone: info|success|warn|danger): content: Inline[].
- **group** (layout: stack|row|grid): contains nested blocks: Block[].
- **table**: columns: {id, label}[], rows: Record<string, Inline[]>[].
- **math**: tex is a KaTeX string (use \\ce{} for chemistry).
- **code** (lang, source): code block.

## Inline Marks

- **highlight** (text, color?): highlight text with color token (accent|info|success|warn|danger|muted).
- **emphasis** (text): italic/bold emphasis.
- **term** (text, definition): term with inline definition tooltip.
- **focusable** (text, ref): clickable text that emits a 'focus' UIEvent with ref.
- **annotate** (text, kind, color?): circle|underline|box|bracket|strike.
- **math** (tex): inline math.

## Motion

Use 'enter.effect' on blocks: reveal|rise|pop|sweep|draw|stagger|none. Set 'order' to group animations (same order = simultaneous). 'delay' and 'duration' are in ms. 'emphasis' (pulse|underline|glow) plays after enter. 'exit' (fade|shrink|none).

Reduced motion: all effects fall back to instant/unanimated. Always show all content even without animation.

## Figures

- **diagram** (kind: tree|radial|flow|cycle): no coordinates. Label nodes with nodes[].id, nodes[].label. Connect with edges[]. Set 'focusable:true' to emit 'focus' on node click.
- **labeled** (pack, art): reference named parts by id (highlight and label by part id).
- **chart** (type: bar|line|pie|scatter): series[].data is number[] or {x, y}[].
- **lottie** (src, loop?): alt required.

## Idempotency

When streaming partial replies: include 'after' in append ops to maintain order. Partial blocks are resolved once complete. Never emit duplicate node ids on the same board.

## Events

The library emits: focus, select, answer, action (return|continue|hint|custom).
The host app handles correctness, grading, and routing.`;

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

export function getSystemPromptGuide(registry: Registry, options?: PromptGuideOptions): string {
  const parts: string[] = [];

  // Header
  parts.push('# dreamer-genui Prompt Guide\n');
  parts.push('Reply format is JSON. Output only JSON matching this format.\n');

  // Ops guide (always included unless explicitly excluded)
  const excluded = new Set(options?.exclude ?? []);
  if (!excluded.has('ops')) {
    parts.push(OPS_GUIDE);
  }

  // Include only specific blocks if specified
  if (options?.include?.length) {
    const cap = registry.getCapabilities();
    const missing = options.include.filter(t => !cap.includes(t));
    if (missing.length) {
      parts.push(`\n## Available Types\n${cap.map(t => `- ${t}`).join('\n')}\n`);
    }
  }

  // Append capabilities from registry
  const caps = registry.getCapabilities();
  parts.push(`\n## Available Block Types\n${caps.map(t => `- ${t}`).join('\n')}\n`);

  // Worked examples (unless compact)
  if (!options?.compact) {
    parts.push(WORKED_EXAMPLES);
  }

  return parts.join('\n');
}
