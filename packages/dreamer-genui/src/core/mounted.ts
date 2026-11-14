import type { BoardState } from './types';

/**
 * Mounted-node cap (§7.6). Long lessons archive older, already-entered content
 * into a collapsed summary; board state is unaffected. The renderer consumes
 * this plan, so the policy is pure and testable.
 */

export interface MountedNodeOptions {
  /** Maximum live DOM nodes; defaults to 80. */
  maxMountedNodes?: number;
  /** Node ids that have entered (from the entry plan). */
  entered: string[];
  /** Nodes that must stay mounted (open detour targets, focused nodes). */
  protectedIds?: string[];
}

export interface MountedNodePlan {
  /** Node ids rendered live, in board order. */
  mounted: string[];
  /** Older finished nodes collapsed into the archive summary, in board order. */
  archived: string[];
}

export const DEFAULT_MAX_MOUNTED_NODES = 80;

/**
 * Keep the most recently entered nodes mounted. Nodes that have not entered
 * are absent from both lists (they are gated by cues and cost no DOM).
 */
export function computeMountedNodes(
  state: BoardState,
  options: MountedNodeOptions,
): MountedNodePlan {
  const max = Math.max(1, Math.floor(options.maxMountedNodes ?? DEFAULT_MAX_MOUNTED_NODES));
  const enteredSet = new Set(options.entered);
  const protectedSet = new Set(options.protectedIds ?? []);
  const enteredInBoardOrder = Object.keys(state.nodes).filter(id => enteredSet.has(id));

  if (enteredInBoardOrder.length <= max) {
    return { mounted: enteredInBoardOrder, archived: [] };
  }

  const splitAt = enteredInBoardOrder.length - max;
  const older = enteredInBoardOrder.slice(0, splitAt);
  const recent = enteredInBoardOrder.slice(splitAt);
  const archived = older.filter(id => !protectedSet.has(id));
  const mounted = [...older.filter(id => protectedSet.has(id)), ...recent];
  return { mounted, archived };
}
