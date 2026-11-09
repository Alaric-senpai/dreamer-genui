import type { LibraryError, BoardState } from './types';
import { createError } from './errors';
import { OpSchema } from '../schema/ops';
import type { Op } from '../schema/ops';
import type { NodeId, NodeRef } from '../schema/common';

export interface ValidationResult {
  valid: boolean;
  error?: LibraryError;
  op?: Op;
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
      return { valid: true, op };
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
      return { valid: true, op };
    }

    case 'replace': {
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      return { valid: true, op };
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
