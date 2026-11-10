import type { LibraryError, BoardState } from './types';
import { createError } from './errors';
import { OpSchema } from '../schema/ops';
import type { Op } from '../schema/ops';
import type { Block } from '../schema/blocks';
import type { NodeId, NodeRef } from '../schema/common';

export interface ValidationResult {
  valid: boolean;
  error?: LibraryError;
  op?: Op;
  /** Non-fatal issues (e.g. cue-cycle rewritten to start) — applied, reported. */
  warnings?: LibraryError[];
}

/** Max detour nesting depth (0 = first detour, 1 = nested, 2 = second nested). */
export const MAX_DETOUR_DEPTH = 2;

/**
 * Resolve a NodeRef to a NodeId.
 *
 * NodeRef is either a plain node id or a `parentId/itemId` reference to an item
 * inside a node (e.g. `branches/botany`). Item contents are not modelled in the
 * board state (they live on the component in M3+), so an item ref resolves to
 * its parent node — and only if that parent actually exists, so a bogus parent
 * is rejected with `bad-target` instead of silently succeeding.
 */
export function resolveNodeRef(state: BoardState, ref: NodeRef): string | null {
  if (ref.includes('/')) {
    const parts = ref.split('/');
    const parent = parts[0];
    if (parent && !parent.includes('/') && parent in state.nodes) {
      return parent;
    }
    return null;
  }
  return ref in state.nodes ? ref : null;
}

/**
 * Check that every block id is unique: within the op itself, against existing
 * nodes, and against ids already used by open detour blocks.
 * AGENTS 6.1: "NodeId: short tutor-authored string, unique per board."
 */
function checkDuplicateIds(state: BoardState, blocks: readonly { id: string }[]): LibraryError | undefined {
  const seen = new Set<string>();
  for (const detour of state.detours) {
    for (const b of detour.blocks) seen.add(b.id);
  }
  for (const block of blocks) {
    if (block.id in state.nodes || seen.has(block.id)) {
      return createError('duplicate-id', `Duplicate node id: ${block.id}`, block.id);
    }
    seen.add(block.id);
  }
  return undefined;
}

/**
 * Validate a single op against the current board state.
 * Returns ValidationResult — if valid, pass through; if not, attach the error.
 * `after`-trigger cycles inside an op are non-fatal: affected triggers are
 * rewritten to `start` and a `cue-cycle` warning is attached (§6.3).
 */
export function validateOp(state: BoardState, rawOp: unknown): ValidationResult {
  // 1. Schema parse
  const parsed = OpSchema.safeParse(rawOp);
  if (!parsed.success) {
    return { valid: false, error: createError('invalid-node', parsed.error.message) };
  }
  const op = parsed.data as Op;

  switch (op.op) {
    case 'append': {
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'attach': {
      // Check target exists
      const targetId = resolveNodeRef(state, op.to);
      if (!targetId) {
        return { valid: false, error: createError('bad-target', `Target node not found: ${op.to}`, undefined, op.to) };
      }
      // Check depth
      if (state.detours.length >= MAX_DETOUR_DEPTH) {
        return { valid: false, error: createError('depth-exceeded', `Max detour depth (${MAX_DETOUR_DEPTH}) exceeded`, op.to) };
      }
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'replace': {
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'update': {
      if (!(op.id in state.nodes)) {
        return { valid: false, error: createError('invalid-node', `Node not found for update: ${op.id}`, op.id) };
      }
      return { valid: true, op };
    }

    case 'remove': {
      if (!(op.id in state.nodes)) {
        return { valid: false, error: createError('invalid-node', `Node not found for remove: ${op.id}`, op.id) };
      }
      return { valid: true, op };
    }

    // theme/camera ops are presentation-level (§6.8/§6.10); validity comes
    // from the schema parse above. Theme policy enforcement (allowlists,
    // contrast) lives in the theme resolver (M2 core).
    case 'theme':
    case 'camera':
      return { valid: true, op };
  }
}

/** Blocks from append/attach/replace ops — they all carry `blocks`. */
function opBlocks(op: Op): Block[] | undefined {
  return op.op === 'append' || op.op === 'attach' || op.op === 'replace' ? op.blocks : undefined;
}

/**
 * Detect `after`-trigger cycles among the incoming blocks (§6.3) and rewrite
 * the cyclic triggers to `start`, so those nodes enter immediately and the
 * op still applies. Returns the (possibly) rewritten op plus `cue-cycle`
 * warnings — one per affected node.
 */
function breakAfterCycles<T extends { blocks: Block[] }>(op: T): { op: T; warnings: LibraryError[] } {
  const warnings: LibraryError[] = [];

  // Collect after-references among the op's own blocks only (references into
  // existing state resolve through the entry plan and cannot cycle).
  const afterRefs = new Map<string, string>();
  for (const block of op.blocks) {
    const trigger = (block as { enter?: { trigger?: { on?: string; node?: string } } }).enter?.trigger;
    if (trigger && trigger.on === 'after' && typeof trigger.node === 'string') {
      afterRefs.set(block.id, trigger.node);
    }
  }
  if (afterRefs.size === 0) return { op, warnings };

  // For each starting node, walk the chain; if it returns to the start node,
  // every node on the cycle is broken out (trigger → start).
  const cyclic = new Set<string>();
  for (const start of afterRefs.keys()) {
    const path: string[] = [];
    let current: string | undefined = start;
    const seen = new Set<string>();
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      path.push(current);
      current = afterRefs.get(current);
    }
    if (current === start) {
      const cycleStart = path.indexOf(start);
      for (const id of path.slice(cycleStart)) cyclic.add(id);
    }
  }
  if (cyclic.size === 0) return { op, warnings };

  const blocks = op.blocks.map(block => {
    if (!cyclic.has(block.id)) return block;
    const b = block as Block & { enter?: { trigger?: unknown } };
    warnings.push(
      createError(
        'cue-cycle',
        `Node "${block.id}" participates in an after-trigger cycle; its trigger falls back to "start"`,
        block.id,
        block.type,
      ),
    );
    const enter = b.enter ? { ...b.enter, trigger: undefined } : b.enter;
    const next = { ...b };
    if (enter && 'trigger' in enter) {
      next.enter = enter as typeof b.enter;
    }
    return next;
  });

  return { op: { ...op, blocks }, warnings };
}
