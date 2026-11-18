/**
 * Playground-only reply plumbing for the live `/app` route.
 *
 * The library protocol is strict, but a live model sometimes drifts: it wraps
 * JSON in prose, uses effect or shape synonyms, or emits blocks directly in
 * `ops`. These helpers keep the demo alive without weakening
 * `dreamer-genui/schema`; none of this is part of the published library.
 */
import type { Reply } from 'dreamer-genui';
import type { Block } from 'dreamer-genui/schema';
import { OpSchema } from 'dreamer-genui/schema';

/**
 * Validate one repaired block. `BlockSchema` is a recursive union, so the
 * bundled declaration types it loosely; going through an append op gives the
 * same validation with a fully typed result.
 */
function isBlock(value: unknown): value is Block {
  return OpSchema.safeParse({ op: 'append', blocks: [value] }).success;
}

/** Remove inline reasoning tags some models emit (MiniMax M2.7 does). */
export function tidy(text: string): string {
  let out = text.replace(/<think[\s\S]*?<\/think>/gi, '');
  const open = out.search(/<think\b/i);
  if (open !== -1) out = out.slice(0, open);
  out = out.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  return out;
}

/** Remove a trailing comma before a closing bracket, ignoring whitespace. */
function dropTrailingComma(out: string[]): void {
  let index = out.length - 1;
  while (index >= 0 && /\s/.test(out[index] as string)) index -= 1;
  if (index >= 0 && out[index] === ',') out.splice(index, 1);
}

/**
 * Repair the two JSON mistakes live models make most often: unquoted object
 * keys (`definition":"…"`) and trailing commas. Strings are left untouched,
 * so inline content that merely looks like JSON cannot be corrupted.
 */
export function repairJsonSyntax(text: string): string {
  const out: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (inString) {
      out.push(char);
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out.push(char);
      continue;
    }
    if (char === '}' || char === ']') {
      dropTrailingComma(out);
      out.push(char);
      continue;
    }
    if (char === '{' || char === ',') {
      out.push(char);
      let next = i + 1;
      while (next < text.length && /\s/.test(text[next] as string)) next += 1;
      if (next < text.length && /[A-Za-z_$]/.test(text[next] as string)) {
        let end = next + 1;
        while (end < text.length && /[\w$-]/.test(text[end] as string)) end += 1;
        let colon = end;
        while (colon < text.length && /\s/.test(text[colon] as string)) colon += 1;
        if (text[colon] === ':') {
          // Preserve the whitespace between the brace/comma and the key.
          out.push(text.slice(i + 1, next), '"', text.slice(next, end), '"');
          i = end - 1;
        }
      }
      continue;
    }
    out.push(char);
  }

  return out.join('');
}

/** Parse strict JSON first, then retry after the common live-model repairs. */
function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(repairJsonSyntax(text));
  }
}

/** Pull every complete top-level op object out of a partially streamed `ops` array. */
export function extractOps(text: string): unknown[] {
  const opsKey = text.search(/"ops"\s*:/);
  if (opsKey === -1) return [];
  const arrayStart = text.indexOf('[', opsKey);
  if (arrayStart === -1) return [];

  const ops: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        try {
          ops.push(parseJsonLoose(text.slice(start, i + 1)));
        } catch {
          // Not complete yet — wait for more chunks.
        }
        start = -1;
      }
      continue;
    }
    if (char === ']' && depth === 0) break;
  }
  return ops;
}

const ENTER_EFFECT_ALIASES: Record<string, string> = {
  fade: 'reveal',
  'fade-in': 'reveal',
  fadeIn: 'reveal',
  appear: 'reveal',
  'slide-in': 'rise',
  'slide-up': 'rise',
  slide: 'rise',
  'zoom-in': 'zoom',
  grow: 'pop',
  'pop-in': 'pop',
};

/** Models sometimes use exit effects (fade) for entrances; map known aliases. */
function repairEffects(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) repairEffects(item);
    return;
  }
  const record = value as Record<string, unknown>;
  const enter = record.enter;
  if (enter && typeof enter === 'object') {
    const enterRecord = enter as Record<string, unknown>;
    const effect = enterRecord.effect;
    if (typeof effect === 'string' && ENTER_EFFECT_ALIASES[effect]) {
      enterRecord.effect = ENTER_EFFECT_ALIASES[effect];
    }
  }
  for (const key of ['blocks', 'items', 'sections', 'questions', 'cards']) {
    if (Array.isArray(record[key])) repairEffects(record[key]);
  }
}

/** Counters surfaced in the playground chat when a reply needed repairs. */
export type PlaygroundRepairStats = { droppedOps: number; salvagedBlocks: number };

/** Common standalone models have no schema vocabulary; map their labels to Inline[]. */
function asInlineArray(value: unknown): unknown {
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  if (value && typeof value === 'object' && !Array.isArray(value)) return [value];
  return value;
}

/** Flowchart shape synonyms models invent → the registered shape enum (§6.7). */
const FLOWCHART_SHAPE_ALIASES: Record<string, string> = {
  input: 'io',
  inputs: 'io',
  data: 'io',
  output: 'io',
  outputs: 'io',
  process: 'step',
  action: 'step',
  operation: 'step',
  procedure: 'step',
  box: 'step',
  rectangle: 'step',
  task: 'step',
  question: 'decision',
  condition: 'decision',
  branch: 'decision',
  diamond: 'decision',
  terminator: 'start',
  begin: 'start',
  finish: 'end',
  stop: 'end',
  substance: 'substance',
  note: 'note',
  annotation: 'note',
};

/** Edge kind synonyms; unknown kinds are dropped so the edge still draws as flow. */
const FLOWCHART_EDGE_ALIASES: Record<string, string> = {
  normal: 'flow',
  main: 'flow',
  arrow: 'flow',
  loop: 'recycle',
  back: 'recycle',
  repeat: 'recycle',
  conditional: 'branch',
  condition: 'branch',
  decision: 'branch',
  alternate: 'optional',
  dashed: 'optional',
};

/**
 * Playground-only figure tolerance: models often send bare strings where the
 * schema wants Inline[] and invented shape names such as "process". Normalise
 * the figure so the block survives; the library schema stays strict.
 */
function repairFigureBlock(record: Record<string, unknown>): void {
  if (record.type !== 'figure') return;
  const figure = record.figure;
  if (!figure || typeof figure !== 'object' || Array.isArray(figure)) return;
  const fig = figure as Record<string, unknown>;
  if (typeof fig.alt !== 'string' || fig.alt.trim() === '') fig.alt = 'Figure';

  if (fig.kind === 'flowchart') {
    const nodeIds = new Set<string>();
    if (Array.isArray(fig.nodes)) {
      for (const node of fig.nodes) {
        if (!node || typeof node !== 'object') continue;
        const n = node as Record<string, unknown>;
        if (typeof n.id === 'string') nodeIds.add(n.id);
        if (n.label !== undefined) n.label = asInlineArray(n.label);
        if (n.detail !== undefined) n.detail = asInlineArray(n.detail);
        if (typeof n.shape === 'string') {
          n.shape = FLOWCHART_SHAPE_ALIASES[n.shape.toLowerCase()] ?? 'step';
        } else if (n.shape !== undefined) {
          delete n.shape;
        }
      }
    }
    if (Array.isArray(fig.edges)) {
      fig.edges = fig.edges.filter((edge) => {
        if (!edge || typeof edge !== 'object') return false;
        const e = edge as Record<string, unknown>;
        if (typeof e.from !== 'string' || typeof e.to !== 'string') return false;
        // Dangling edges would be rejected by validation and cannot render.
        if (nodeIds.size > 0 && (!nodeIds.has(e.from) || !nodeIds.has(e.to))) return false;
        if (e.label !== undefined) e.label = asInlineArray(e.label);
        if (typeof e.kind === 'string') {
          const kind = FLOWCHART_EDGE_ALIASES[e.kind.toLowerCase()] ?? e.kind.toLowerCase();
          if (['flow', 'branch', 'recycle', 'optional'].includes(kind)) e.kind = kind;
          else delete e.kind;
        }
        return true;
      });
    }
    for (const key of ['inputs', 'outputs'] as const) {
      if (!Array.isArray(fig[key])) continue;
      for (const item of fig[key] as unknown[]) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const entry = item as Record<string, unknown>;
          if (entry.label !== undefined) entry.label = asInlineArray(entry.label);
        }
      }
    }
  }

  if (fig.kind === 'timeline' && Array.isArray(fig.events)) {
    for (const event of fig.events) {
      if (!event || typeof event !== 'object') continue;
      const e = event as Record<string, unknown>;
      if (e.label !== undefined) e.label = asInlineArray(e.label);
      if (e.detail !== undefined) e.detail = asInlineArray(e.detail);
    }
  }
}

/**
 * Playground-only tolerance: drop blocks the library schema cannot render
 * (for example a figure missing its figure object) instead of failing the
 * whole turn. The library itself stays strict; this keeps the live demo alive.
 */
export function repairOp(value: unknown): unknown {
  repairEffects(value);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  repairFigureBlock(record);
  if (!Array.isArray(record.blocks)) return value;
  record.blocks = record.blocks
    .map((block) => {
      repairEffects(block);
      if (block && typeof block === 'object') {
        const blockRecord = block as Record<string, unknown>;
        repairFigureBlock(blockRecord);
        if (Array.isArray(blockRecord.blocks)) {
          blockRecord.blocks = blockRecord.blocks
            .map(repairOp)
            .filter((child) => isBlock(child));
        }
      }
      return block;
    })
    .filter((block) => isBlock(block));
  return value;
}

export function repairReply(value: unknown, stats?: PlaygroundRepairStats): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.ops)) {
    // Drop entries that are not recognised ops at all (models occasionally
    // leak diagram nodes or prose objects into the array). Append/attach/
    // replace ops with zero surviving blocks are still valid and preserved.
    const kept: unknown[] = [];
    const looseBlocks: unknown[] = [];
    const flushLoose = () => {
      if (looseBlocks.length === 0) return;
      kept.push({ op: 'append', blocks: looseBlocks.splice(0) });
    };
    for (const entry of record.ops) {
      const repaired = repairOp(entry);
      if (OpSchema.safeParse(repaired).success) {
        flushLoose();
        kept.push(repaired);
        continue;
      }
      // Models sometimes place a block directly in `ops` (forgetting the
      // append wrapper). Salvage it rather than losing the content.
      const asBlock = repaired;
      if (
        asBlock &&
        typeof asBlock === 'object' &&
        typeof (asBlock as Record<string, unknown>).type === 'string' &&
        isBlock(asBlock)
      ) {
        if (stats) stats.salvagedBlocks += 1;
        looseBlocks.push(asBlock);
      } else if (stats) {
        stats.droppedOps += 1;
      }
    }
    flushLoose();
    record.ops = kept;
  }
  return value;
}

/** Ops from a scanned reply after playground repairs and schema filtering. */
export function repairedOps(value: unknown): Reply['ops'] {
  const repaired = repairReply(value);
  const record = repaired as Record<string, unknown>;
  return (Array.isArray(record?.ops) ? record.ops : []) as Reply['ops'];
}

/**
 * Find the first balanced `{...}` object that carries a `"v":1` reply and an
 * `ops` array. Models sometimes append prose or a second object after the
 * reply, so slicing from the first `{` to the last `}` is not safe.
 */
export function extractReplyObject(text: string): { value: unknown; jsonText: string } | null {
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char !== '{') continue;

    // Balanced scan from this top-level object.
    let depth = 0;
    let innerString = false;
    let innerEscape = false;
    for (let j = i; j < text.length; j += 1) {
      const next = text[j];
      if (innerString) {
        if (innerEscape) innerEscape = false;
        else if (next === '\\') innerEscape = true;
        else if (next === '"') innerString = false;
        continue;
      }
      if (next === '"') {
        innerString = true;
        continue;
      }
      if (next === '{') depth += 1;
      else if (next === '}') {
        depth -= 1;
        if (depth === 0) {
          const jsonText = text.slice(i, j + 1);
          try {
            const value = parseJsonLoose(jsonText) as unknown;
            if (
              value &&
              typeof value === 'object' &&
              (value as Record<string, unknown>).v === 1 &&
              Array.isArray((value as Record<string, unknown>).ops)
            ) {
              return { value, jsonText };
            }
          } catch {
            // Not valid JSON on its own — keep scanning for the real reply.
          }
          i = j; // Continue after this object.
          break;
        }
      }
    }
  }
  return null;
}
