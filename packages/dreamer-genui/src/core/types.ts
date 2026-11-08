import type { Op } from '../schema/ops';
import type { Block } from '../schema/blocks';
import type { UIEvent } from '../schema/events';
import type { ErrorCode } from '../schema/errors';

// Node: a block on the board with runtime state
export interface Node {
  id: string;
  block: Block;
  state: 'loading' | 'complete' | 'error';
  altText?: string;
}

// ResolvedNode: result of resolving a block type against the registry
export interface ResolvedNode {
  valid: boolean;
  manifest?: import('./registry').TypeManifest;
  loader?: () => unknown;
  error?: LibraryError;
}

// Detour: an attached explainer on top of a target node
export interface Detour {
  id: string;
  targetNodeId: string;   // resolved NodeId of the target (parent for parent/item refs)
  targetRef?: string;     // original NodeRef as authored (e.g. "branches/botany")
  blocks: Block[];        // blocks shown in the detour
  openAt: number;         // 0 = first detour, 1 = nested; capped by MAX_DETOUR_DEPTH (2)
}

// BoardSnapshot: immutable snapshot of the board before a replace
export interface BoardSnapshot {
  id: string;
  title?: string;
  nodes: Record<string, Node>;
}

// BoardState: the full runtime board
export interface BoardState {
  id: string;
  title?: string;
  nodes: Record<string, Node>;   // ordered by insertion (Object key order preserved)
  history: BoardSnapshot[];     // max 50 entries
  detours: Detour[];            // max 2 entries (depth 0 and 1)
}

// ResolvedOp: result of applying a single op
export interface ResolvedOp {
  op: Op;
  status: 'applied' | 'error';
  error?: LibraryError;
}

// LibraryError: error emitted by the library (not a crash)
export interface LibraryError {
  code: ErrorCode;
  nodeId?: string;
  type?: string;
  detail?: string;
}

// PartialReply: used during streaming — may have incomplete ops
export interface PartialReply {
  v: 1;
  ops: (Op | PartialOp)[];
}

export interface PartialOp {
  op: string;        // discriminant present
  // other fields may be incomplete / partial
  [key: string]: unknown;
}
