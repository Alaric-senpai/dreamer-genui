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
 * NodeRef format: "nodeId" or "parentId/itemId" (for items inside a node).
 * For now, only simple "nodeId" format is supported.
 */
export function resolveNodeRef(state: BoardState, ref: NodeRef): string | null {
  // Simple case: ref is the node id
  if (ref.includes('/')) {
    // parentId/itemId format — treat itemId as the node id for now
    // Full support for parent/item refs is added in M4 when components exist
    const parts = ref.split('/');
    if (parts.length === 2) return parts[0] ?? null; // parent
    return null;
  }
  return ref in state.nodes ? ref : null;
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
      for (const block of op.blocks) {
        if (block.id in state.nodes) {
          return { valid: false, error: createError('duplicate-id', `Duplicate node id: ${block.id}`, block.id) };
        }
      }
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
      // Check for duplicate ids in the attach blocks
      for (const block of op.blocks) {
        if (block.id in state.nodes) {
          return { valid: false, error: createError('duplicate-id', `Duplicate node id: ${block.id}`, block.id) };
        }
      }
      return { valid: true, op };
    }

    case 'replace': {
      // No pre-existing state checks for replace
      for (const block of op.blocks) {
        if (block.id in state.nodes) {
          return { valid: false, error: createError('duplicate-id', `Duplicate node id: ${block.id}`, block.id) };
        }
      }
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
  }
}
