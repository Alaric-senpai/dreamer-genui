import type { BoardState, BoardSnapshot, Node } from './types';
import type { Op, AppendOp, AttachOp, ReplaceOp, UpdateOp, RemoveOp } from '../schema/ops';
import type { Block } from '../schema/blocks';

const MAX_HISTORY = 50;

function makeNode(block: Block): Node {
  return { id: block.id, block, state: 'complete' };
}

function snapshot(state: BoardState): BoardSnapshot {
  return { id: state.id, title: state.title, nodes: { ...state.nodes } };
}

// --- Apply helpers ---

function applyAppend(state: BoardState, op: AppendOp): BoardState {
  if (op.after === undefined || !(op.after in state.nodes)) {
    // Append at end
    const newNodes = { ...state.nodes };
    for (const block of op.blocks) {
      newNodes[block.id] = makeNode(block);
    }
    return { ...state, nodes: newNodes };
  }

  // Insert in position after the 'after' node
  const existing = { ...state.nodes };
  for (const block of op.blocks) {
    existing[block.id] = makeNode(block);
  }
  const orderedIds = Object.keys(state.nodes);
  const afterIdx = orderedIds.indexOf(op.after);
  const newOrdered = [
    ...orderedIds.slice(0, afterIdx + 1),
    ...op.blocks.map(b => b.id),
    ...orderedIds.slice(afterIdx + 1),
  ];
  const finalNodes: Record<string, Node> = {};
  for (const id of newOrdered) {
    const node = existing[id];
    if (node) finalNodes[id] = node;
  }
  // Keep any nodes not in the ordered list (detour blocks etc.)
  for (const [id, node] of Object.entries(existing)) {
    if (!(id in finalNodes)) finalNodes[id] = node;
  }
  return { ...state, nodes: finalNodes };
}

function applyAttach(state: BoardState, op: AttachOp): BoardState {
  const targetId = op.to.split('/')[0] ?? op.to;
  const detourDepth = state.detours.length;
  const newDetour = {
    id: op.blocks[0]?.id ?? `detour-${detourDepth}`,
    targetNodeId: targetId,
    targetRef: op.to, // full parent/item ref, preserved for the M4 return control
    blocks: op.blocks,
    openAt: detourDepth,
  };
  return { ...state, detours: [...state.detours, newDetour] };
}

function applyReplace(state: BoardState, op: ReplaceOp): BoardState {
  const prev = snapshot(state);
  const history = [...state.history, prev].slice(-MAX_HISTORY);
  const newNodes: Record<string, Node> = {};
  for (const block of op.blocks) {
    newNodes[block.id] = makeNode(block);
  }
  const replaced: BoardState = { ...state, nodes: newNodes, history, detours: [] };
  if (op.title !== undefined) replaced.title = op.title;
  return replaced;
}

function applyUpdate(state: BoardState, op: UpdateOp): BoardState {
  const existing = state.nodes[op.id];
  if (!existing) return state;
  // id and type are identity fields — never allow an update to override them
  // (that would desynchronize the node key from block.id and break the
  // discriminated union). Per-type validation of the remaining props is
  // deferred to M3 (registry-driven).
  const { id: _id, type: _type, ...rest } = op.props;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [op.id]: {
        ...existing,
        block: { ...existing.block, ...rest } as Block,
      },
    },
  };
}

function applyRemove(state: BoardState, op: RemoveOp): BoardState {
  const { [op.id]: _removed, ...remainingNodes } = state.nodes;
  // Drop detours whose target was removed — they would point at a dead node.
  const detours = state.detours.filter(d => d.targetNodeId !== op.id);
  return { ...state, nodes: remainingNodes, detours };
}

/**
 * Pure board reducer: (state, op) => state.
 * No side effects. Returns a new state object.
 */
export function boardReducer(state: BoardState, op: Op): BoardState {
  switch (op.op) {
    case 'append': return applyAppend(state, op);
    case 'attach': return applyAttach(state, op);
    case 'replace': return applyReplace(state, op);
    case 'update': return applyUpdate(state, op);
    case 'remove': return applyRemove(state, op);
  }
}

/** Pop the most recent history snapshot and restore as current state. */
export function back(state: BoardState): BoardState {
  if (state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  return {
    id: last.id,
    title: last.title,
    nodes: last.nodes,
    history: state.history.slice(0, -1),
    detours: [], // back clears detours
  };
}

/** Create an empty initial board state. */
export function createBoard(id?: string): BoardState {
  return {
    id: id ?? 'board',
    title: undefined,
    nodes: {},
    history: [],
    detours: [],
  };
}
