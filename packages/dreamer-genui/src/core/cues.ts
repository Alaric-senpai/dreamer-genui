import type { BoardState } from './types';
import type { Block } from '../schema/blocks';
import type { Trigger } from '../schema/motion';
import type { UIEvent } from '../schema/events';

/**
 * Cue engine (§6.3, normative). Headless and pure: entry gates are DERIVED
 * from BoardState (firedCues / firedEvents / flushed) and the requested
 * pacing — no mutation of nodes, no animation timing. The React layer mounts
 * only nodes in `entered` (not-mounted-until-triggered, M3).
 *
 * Semantics implemented here:
 * - `start` / no trigger → entered as soon as the node is on the board.
 * - `cue` → entered iff the cue id was fired before or is fired now (race-safe).
 * - `after` → entered once the referenced node is entered; missing references
 *   are treated as satisfied (a removed node never blocks a chain).
 * - `event` → entered once a matching focus/select/answer has been observed.
 * - `flush` → satisfied gates for everything (`flushed` state flag); the flag
 *   is cleared by `replace` and restored through history by `back`.
 * - pacing "auto" → cue triggers ignored (play by order), for text-only hosts.
 */

export type Pacing = 'cued' | 'auto';

export interface EntryPlan {
  entered: string[];
  pending: string[];
  /** Cue ids referenced by at least one pending node and not yet fired. */
  pendingCues: string[];
}

/** Which block-level trigger gates a node (cue semantics only apply to blocks; mark-level triggers are renderer timing). */
function nodeTrigger(block: Block): Trigger | undefined {
  // Every built-in block type extends NodeBaseSchema, carrying optional `enter`.
  return (block as { enter?: { trigger?: Trigger } }).enter?.trigger;
}

/** Compute which nodes are entered vs pending for a board + pacing. */
export function computeEntryPlan(state: BoardState, pacing: Pacing = 'cued'): EntryPlan {
  const ids = Object.keys(state.nodes);
  if (ids.length === 0) return { entered: [], pending: [], pendingCues: [] };

  const entered = new Set<string>();
  const waitingAfter: string[] = [];

  if (state.flushed || pacing === 'auto') {
    return { entered: ids, pending: [], pendingCues: [] };
  }

  // Pass 1: satisfy everything but `after` chains.
  for (const id of ids) {
    const node = state.nodes[id]!;
    const trigger = nodeTrigger(node.block);
    if (!trigger || trigger.on === 'start') {
      entered.add(id);
    } else if (trigger.on === 'cue') {
      if (state.firedCues.includes(trigger.id)) entered.add(id);
    } else if (trigger.on === 'event') {
      if (state.firedEvents[eventKey(trigger.node, trigger.event)]) entered.add(id);
    } else {
      // after — resolved to fixpoint in pass 2
    }
  }
  for (const id of ids) {
    const t = nodeTrigger(state.nodes[id]!.block);
    if (t?.on === 'after') waitingAfter.push(id);
  }

  // Pass 2: resolve `after` chains. A physical cycle cannot survive the
  // validator (cyclic triggers are rewritten to start), but iterate a bounded
  // number of passes anyway so the engine is safe on ANY state.
  let changed = true;
  let guard = ids.length;
  while (changed && guard-- > 0) {
    changed = false;
    for (const id of waitingAfter) {
      if (entered.has(id)) continue;
      const t = nodeTrigger(state.nodes[id]!.block);
      if (!t || t.on !== 'after') continue;
      // satisfied when the target is entered OR no longer on the board
      if (state.nodes[t.node] === undefined || entered.has(t.node)) {
        entered.add(id);
        changed = true;
      }
    }
  }

  const pending: string[] = [];
  const pendingCues = new Set<string>();
  for (const id of ids) {
    if (entered.has(id)) continue;
    pending.push(id);
    const t = nodeTrigger(state.nodes[id]!.block);
    if (t?.on === 'cue' && !state.firedCues.includes(t.id)) pendingCues.add(t.id);
  }

  return { entered: [...entered], pending, pendingCues: [...pendingCues] };
}

/** Fire a cue id. Nodes already pending on it enter (race-safe if fired twice). */
export function fireCue(state: BoardState, cueId: string): BoardState {
  if (state.firedCues.includes(cueId)) return state;
  return { ...state, firedCues: [...state.firedCues, cueId] };
}

/** Every pending node enters immediately (skip control, §6.3 board.flush()). */
export function flushAll(state: BoardState): BoardState {
  if (state.flushed) return state;
  return { ...state, flushed: true };
}

/** Cue ids referenced by nodes, in document insertion order. */
export function collectCueIds(state: BoardState): string[] {
  const ids: string[] = [];
  for (const node of Object.values(state.nodes)) {
    const t = nodeTrigger(node.block);
    if (t?.on === 'cue' && !ids.includes(t.id)) ids.push(t.id);
  }
  return ids;
}

/**
 * Fire every cue up to and including `cueId` (document order), instantly —
 * "catch up to this point of the narration" (§6.3 board.seek()).
 */
export function seekTo(state: BoardState, cueId: string): BoardState {
  const order = collectCueIds(state);
  const idx = order.indexOf(cueId);
  const upto = idx === -1 ? [cueId] : order.slice(0, idx + 1);
  const fired = [...state.firedCues];
  for (const id of upto) if (!fired.includes(id)) fired.push(id);
  return { ...state, firedCues: fired };
}

/** `${nodeRef}:${eventType}` — the firedEvents key for an event trigger. */
export function eventKey(nodeRef: string, event: UIEvent extends { type: infer T } ? T : string): string {
  return `${nodeRef}:${event}`;
}

/**
 * Record a UIEvent so `event` triggers on it become satisfied. Both the node
 * id and the item ref are keyed, so a trigger can name either
 * ("card" or "card/item-1").
 */
export function signalEvent(state: BoardState, ev: UIEvent): BoardState {
  if (ev.type !== 'focus' && ev.type !== 'select' && ev.type !== 'answer') return state;
  const keys: string[] = [eventKey(ev.nodeId, ev.type)];
  if ('ref' in ev && ev.ref !== undefined) keys.push(eventKey(ev.ref, ev.type));
  let matched = false;
  const firedEvents = { ...state.firedEvents };
  for (const key of keys) {
    if (!firedEvents[key]) {
      firedEvents[key] = true;
      matched = true;
    }
  }
  if (!matched) return state;
  return { ...state, firedEvents };
}

/** Ids that entered between two plans, in next-plan order. */
export function newlyEntered(prev: EntryPlan, next: EntryPlan): string[] {
  const before = new Set(prev.entered);
  return next.entered.filter(id => !before.has(id));
}
