/**
 * Playground-only playback planning for the `/app` route.
 *
 * The library renders every entered node at once; this route needs a smaller
 * "active region" so a long lesson cannot overflow the screen. A `Beat` is one
 * visual op (plus any pending non-visual ops such as `theme` or `layout`) that
 * the page applies and shows together. Earlier beats stay in board state but
 * are hidden from the live viewport until the user steps back.
 *
 * Nothing here belongs in the library: it is a host-side presentation choice.
 */
import type { Reply } from 'dreamer-genui';
import type { Block, Inline, Op } from 'dreamer-genui/schema';

export type Beat = {
  /** Ops applied when this beat is reached. */
  ops: Op[];
  /** Board nodes this beat reveals. Empty for meta-only beats. */
  nodeIds: string[];
  /** Cue ids referenced by this beat's ops. */
  cueIds: string[];
  /** Short human label for the page control. */
  label: string;
};

type CueTarget = { on?: unknown; id?: unknown };

function pushCue(trigger: CueTarget | undefined, out: string[]): void {
  if (trigger && trigger.on === 'cue' && typeof trigger.id === 'string' && trigger.id.trim()) {
    out.push(trigger.id.trim());
  }
}

function collectCues(value: unknown, out: string[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectCues(item, out);
    return;
  }

  const record = value as Record<string, unknown>;
  const enter = record.enter as Record<string, unknown> | undefined;
  if (enter) pushCue(enter.trigger as CueTarget | undefined, out);
  // Camera moves carry their trigger directly (including every step of `path`).
  pushCue(record.trigger as CueTarget | undefined, out);

  for (const key of Object.keys(record)) {
    const child = record[key];
    if (child && typeof child === 'object') collectCues(child, out);
  }
}

/** Every cue id referenced by these ops, in first-seen order. */
export function cueIdsOf(ops: readonly Op[]): string[] {
  const cues: string[] = [];
  for (const op of ops) collectCues(op, cues);
  return Array.from(new Set(cues));
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tex === 'string') return record.tex;
    if (record.text !== undefined) return textOf(record.text);
  }
  return '';
}

function clip(text: string, max = 72): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function inline(value: Inline[] | undefined): string {
  return textOf(value ?? []);
}

/** A short label for a block, used by the page control. */
export function labelOfBlock(block: Block): string {
  switch (block.type) {
    case 'text':
      return inline(block.content);
    case 'question':
      return inline(block.prompt);
    case 'choices':
      return inline(block.prompt) || 'Choices';
    case 'figure': {
      const alt = 'alt' in block.figure && typeof block.figure.alt === 'string' ? block.figure.alt : '';
      return `${block.figure.kind}${alt ? `: ${alt}` : ''}`;
    }
    case 'callout':
      return block.title || inline(block.content);
    case 'steps':
      return block.items[0]?.title || 'Steps';
    case 'list':
      return inline(block.items[0]?.content) || 'List';
    case 'compare':
      return inline(block.columns[0]?.title) || 'Comparison';
    case 'assessment':
      return inline(block.title) || `Assessment (${block.mode})`;
    case 'flashcards':
      return 'Flashcards';
    case 'table':
      return 'Table';
    case 'math':
      return block.tex;
    case 'code':
      return `${block.lang} code`;
    case 'group':
      return block.blocks[0] ? labelOfBlock(block.blocks[0] as Block) || 'Group' : 'Group';
    default:
      return (block as { type?: string }).type ?? 'Block';
  }
}

function labelOfOp(op: Op): string {
  switch (op.op) {
    case 'append':
      return op.blocks.length === 1
        ? clip(labelOfBlock(op.blocks[0] as Block))
        : clip(`${op.blocks.length} blocks — ${labelOfBlock(op.blocks[0] as Block)}`);
    case 'attach':
      return clip(
        `Detour: ${
          op.blocks.length === 1 ? labelOfBlock(op.blocks[0] as Block) : `${op.blocks.length} blocks`
        }`
      );
    case 'replace':
      return clip(
        op.title ||
          (op.blocks.length === 1
            ? `New board: ${labelOfBlock(op.blocks[0] as Block)}`
            : `New board — ${op.blocks.length} blocks`)
      );
    case 'theme':
      return op.theme.mood ? `Mood: ${op.theme.mood}` : 'Theme';
    case 'layout':
      return `Layout: ${op.layout.kind}`;
    case 'camera':
      return op.path?.length ? `Camera path (${op.path.length})` : 'Camera';
    case 'update':
      return 'Update';
    case 'remove':
      return 'Remove';
    default:
      return 'Board update';
  }
}

function nodeIdsOf(op: Op): string[] {
  switch (op.op) {
    case 'append':
    case 'replace':
      return op.blocks.map((block) => block.id);
    case 'attach': {
      const target = op.to.split('/')[0]?.trim();
      return [
        ...(target ? [target] : []),
        ...op.blocks.map((block) => block.id),
      ];
    }
    default:
      return [];
  }
}

function isVisual(op: Op): op is Extract<Op, { op: 'append' | 'attach' | 'replace' }> {
  return op.op === 'append' || op.op === 'attach' || op.op === 'replace';
}

function visualPieces(op: Extract<Op, { op: 'append' | 'attach' | 'replace' }>): Beat[] {
  // An attached explainer is one surface: reveal all of its blocks together.
  if (op.op === 'attach') {
    return [
      {
        ops: [op],
        nodeIds: nodeIdsOf(op),
        cueIds: cueIdsOf([op]),
        label: labelOfOp(op),
      },
    ];
  }

  const pieces: Beat[] = [];
  let previousId: string | undefined;
  op.blocks.forEach((block, index) => {
    let piece: Op;
    if (index === 0) {
      piece = { ...op, blocks: [block] };
    } else {
      piece = {
        op: 'append',
        blocks: [block],
        ...(previousId ? { after: previousId } : {}),
        ...('slot' in op && op.slot ? { slot: op.slot } : {}),
      };
    }
    previousId = block.id;
    pieces.push({
      ops: [piece],
      nodeIds: [block.id],
      cueIds: cueIdsOf([piece]),
      label:
        index === 0 && op.op === 'replace'
          ? clip(op.title || labelOfBlock(block))
          : labelOfBlock(block),
    });
  });
  return pieces;
}

/**
 * Group a reply into beats: one per top-level block (so a multi-block append
 * still pages one idea at a time), with pending non-visual ops (`theme`,
 * `layout`, `camera`, `update`, `remove`) carried onto the next beat.
 */
export function planBeats(reply: Reply): Beat[] {
  const beats: Beat[] = [];
  let pending: Op[] = [];

  for (const op of reply.ops) {
    if (isVisual(op) && op.blocks.length > 0) {
      const pieces = visualPieces(op);
      const first = pieces[0];
      if (first) {
        first.ops = [...pending, ...first.ops];
        first.cueIds = cueIdsOf(first.ops);
        pending = [];
      }
      beats.push(...pieces);
    } else {
      pending.push(op);
    }
  }

  if (pending.length > 0) {
    const last = beats[beats.length - 1];
    if (last) {
      // A trailing theme/layout/camera belongs with the page it affects.
      last.ops = [...last.ops, ...pending];
      last.cueIds = cueIdsOf(last.ops);
    } else {
      const tail = pending[pending.length - 1] as Op;
      beats.push({
        ops: pending,
        nodeIds: [],
        cueIds: cueIdsOf(pending),
        label: labelOfOp(tail),
      });
    }
  }

  return beats;
}
