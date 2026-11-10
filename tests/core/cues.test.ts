// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import {
  computeEntryPlan,
  fireCue,
  flushAll,
  seekTo,
  collectCueIds,
  signalEvent,
  eventKey,
  newlyEntered,
} from '../../packages/dreamer-genui/src/core/cues';
import { createBoard, boardReducer } from '../../packages/dreamer-genui/src/core/reducer';
import type { Block } from '../../packages/dreamer-genui/src/schema/blocks';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';

function textBlock(id: string, trigger?: unknown): Block {
  return {
    id,
    type: 'text',
    variant: 'body',
    content: [id],
    ...(trigger !== undefined ? { enter: trigger as object } : {}),
  } as Block;
}

function withNodes(blocks: Block[], state: BoardState = createBoard()): BoardState {
  return boardReducer(state, { op: 'append', blocks });
}

describe('computeEntryPlan — triggers (§6.3)', () => {
  test('start-trigger nodes are entered immediately', () => {
    const state = withNodes([textBlock('a')], createBoard());
    const plan = computeEntryPlan(state);
    expect(plan.entered).toEqual(['a']);
    expect(plan.pending).toEqual([]);
  });

  test('nodes with no enter.cue default to start', () => {
    const state = withNodes([textBlock('a'), textBlock('b', { effect: 'reveal', trigger: { on: 'start' } })], createBoard());
    expect(computeEntryPlan(state).entered).toEqual(['a', 'b']);
  });

  test('cue-trigger nodes stay pending until the cue fires (pacing "cued")', () => {
    const state = withNodes([textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } })], createBoard());
    let plan = computeEntryPlan(state);
    expect(plan.entered).toEqual([]);
    expect(plan.pending).toEqual(['a']);

    const fired = fireCue(state, 'beat-1');
    plan = computeEntryPlan(fired);
    expect(plan.entered).toEqual(['a']);
    expect(state.firedCues).toEqual([]); // pure: original untouched
    expect(fired.firedCues).toEqual(['beat-1']);
  });

  test('in pacing "auto" cue triggers are ignored (play by order)', () => {
    const state = withNodes([textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } })], createBoard());
    const plan = computeEntryPlan(state, 'auto');
    expect(plan.entered).toEqual(['a']);
  });

  test('cue-before-node race: a node arriving after its cue fired enters immediately (§6.3)', () => {
    let state = createBoard();
    state = fireCue(state, 'late-beat');
    state = withNodes([textBlock('late', { effect: 'words', trigger: { on: 'cue', id: 'late-beat' } })], state);
    const plan = computeEntryPlan(state);
    expect(plan.entered).toEqual(['late']);
  });

  test('after-chain: second node enters only after the first is entered', () => {
    // Gate the chain head behind a cue so the chain visibly holds.
    let state = withNodes([textBlock('a', { effect: 'wipe', trigger: { on: 'cue', id: 'beat-1' } })], createBoard());
    state = withNodes([textBlock('b', { effect: 'wipe', trigger: { on: 'after', node: 'a' } })], state);
    state = withNodes([textBlock('c', { effect: 'wipe', trigger: { on: 'after', node: 'b' } })], state);

    let plan = computeEntryPlan(state);
    expect(plan.entered).toEqual([]);
    expect(plan.pending).toEqual(['a', 'b', 'c']);

    // Firing the head cue cascades down the whole chain.
    state = fireCue(state, 'beat-1');
    plan = computeEntryPlan(state);
    expect(plan.entered).toEqual(['a', 'b', 'c']);
    expect(plan.pending).toEqual([]);
  });

  test('after referencing a removed/missing node is treated as satisfied', () => {
    const state = withNodes([textBlock('b', { effect: 'wipe', trigger: { on: 'after', node: 'ghost' } })], createBoard());
    expect(computeEntryPlan(state).entered).toEqual(['b']);
  });

  test('event-trigger stays pending until signalEvent records the interaction', () => {
    let state = withNodes([textBlock('b', { effect: 'pop', trigger: { on: 'event', node: 'card', event: 'select' } })], createBoard());
    let plan = computeEntryPlan(state);
    expect(plan.pending).toContain('b');

    state = signalEvent(state, { nodeId: 'card', ref: 'card/item-1', type: 'select' });
    plan = computeEntryPlan(state);
    expect(plan.entered).toContain('b');
    expect(state.firedEvents[eventKey('card', 'select')]).toBe(true);
    // ref key recorded too
    expect(state.firedEvents[eventKey('card/item-1', 'select')]).toBe(true);
  });

  test('flush enters everything pending', () => {
    let state = withNodes(
      [
        textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'x' } }),
        textBlock('b', { effect: 'pop', trigger: { on: 'event', node: 'q', event: 'focus' } }),
      ],
      createBoard(),
    );
    expect(computeEntryPlan(state).pending).toEqual(['a', 'b']);
    state = flushAll(state);
    expect(computeEntryPlan(state).pending).toEqual([]);
    expect(computeEntryPlan(state).entered).toEqual(['a', 'b']);
  });

  test('seek fires every cue up to and including the target, in document order', () => {
    let state = withNodes(
      [
        textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } }),
        textBlock('b', { effect: 'words', trigger: { on: 'cue', id: 'beat-2' } }),
        textBlock('c', { effect: 'words', trigger: { on: 'cue', id: 'beat-3' } }),
      ],
      createBoard(),
    );
    expect(collectCueIds(state)).toEqual(['beat-1', 'beat-2', 'beat-3']);
    state = seekTo(state, 'beat-2');
    expect(state.firedCues).toEqual(['beat-1', 'beat-2']);
    expect(computeEntryPlan(state).entered).toEqual(['a', 'b']);
    expect(computeEntryPlan(state).pending).toEqual(['c']);
  });

  test('seek with an unknown cue id fires just that cue', () => {
    let state = withNodes([textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } })], createBoard());
    state = seekTo(state, 'beat-9');
    expect(state.firedCues).toEqual(['beat-9']);
    expect(computeEntryPlan(state).pending).toEqual(['a']);
  });

  test('firing the same cue twice does not duplicate it', () => {
    let state = createBoard();
    state = fireCue(state, 'b1');
    state = fireCue(state, 'b1');
    expect(state.firedCues).toEqual(['b1']);
  });
});

describe('newlyEntered — diff helper', () => {
  test('returns ids in the next plan that were not present before', () => {
    const prev = { entered: ['a'], pending: ['b', 'c'], pendingCues: [] };
    const next = { entered: ['a', 'b', 'c'], pending: [], pendingCues: [] };
    expect(newlyEntered(prev, next)).toEqual(['b', 'c']);
  });
});
