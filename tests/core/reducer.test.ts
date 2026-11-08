import { describe, expect, test } from 'vitest';
import { boardReducer, back, createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';

const SAMPLE_BLOCK = { id: 'n1', type: 'text' as const, variant: 'body' as const, content: ['hello'] };
const BLOCK2 = { id: 'n2', type: 'text' as const, variant: 'body' as const, content: ['world'] };

function mkState(nodes = [SAMPLE_BLOCK]): BoardState {
  const state = createBoard('test-board');
  for (const b of nodes) {
    state.nodes[b.id] = { id: b.id, block: b, state: 'complete' };
  }
  return state;
}

describe('boardReducer', () => {
  test('append adds block to empty state', () => {
    const s = mkState([]);
    const next = boardReducer(s, { op: 'append', blocks: [SAMPLE_BLOCK] });
    expect(next.nodes['n1']).toBeDefined();
    expect(next.nodes['n1']?.block.id).toBe('n1');
  });

  test('append appends after existing nodes', () => {
    const s = mkState();
    const next = boardReducer(s, { op: 'append', blocks: [BLOCK2] });
    expect(next.nodes['n2']).toBeDefined();
    expect(next.nodes['n1']).toBeDefined();
  });

  test('append with after= positions correctly', () => {
    const s = mkState([SAMPLE_BLOCK, BLOCK2]);
    const BLOCK3 = { id: 'n3', type: 'text' as const, variant: 'body' as const, content: ['new'] };
    const next = boardReducer(s, { op: 'append', blocks: [BLOCK3], after: 'n1' });
    const keys = Object.keys(next.nodes);
    const n1Idx = keys.indexOf('n1');
    const n3Idx = keys.indexOf('n3');
    expect(n3Idx).toBe(n1Idx + 1);
  });

  test('replace pushes history and resets nodes', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const BLOCK_R = { id: 'r1', type: 'text' as const, variant: 'heading' as const, content: ['Replaced'] };
    const next = boardReducer(s, { op: 'replace', blocks: [BLOCK_R], title: 'New Topic' });
    expect(next.nodes['r1']).toBeDefined();
    expect(next.nodes['n1']).toBeUndefined();
    expect(next.title).toBe('New Topic');
    expect(next.history.length).toBe(1);
  });

  test('replace clears detours', () => {
    const s = mkState([SAMPLE_BLOCK]);
    (s as any).detours = [{ id: 'd1', targetNodeId: 'n1', blocks: [BLOCK2], openAt: 0 }];
    const BLOCK_R = { id: 'r1', type: 'text' as const, variant: 'body' as const, content: ['Replaced'] };
    const next = boardReducer(s, { op: 'replace', blocks: [BLOCK_R] });
    expect(next.detours).toHaveLength(0);
  });

  test('update merges props into existing node', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const next = boardReducer(s, { op: 'update', id: 'n1', props: { variant: 'heading' } });
    expect(next.nodes['n1']?.block.variant).toBe('heading');
    expect(next.nodes['n1']?.block.content).toEqual(['hello']); // original preserved
  });

  test('remove deletes node', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const next = boardReducer(s, { op: 'remove', id: 'n1' });
    expect(next.nodes['n1']).toBeUndefined();
  });

  test('attach creates detour', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const BLOCK_ATT = { id: 'a1', type: 'text' as const, variant: 'body' as const, content: ['Attached'] };
    const next = boardReducer(s, { op: 'attach', to: 'n1', blocks: [BLOCK_ATT], placement: 'right', connector: 'none', mode: 'inline' });
    expect(next.detours).toHaveLength(1);
    expect(next.detours[0]?.targetNodeId).toBe('n1');
  });

  test('returns new state object (immutable)', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const next = boardReducer(s, { op: 'append', blocks: [BLOCK2] });
    expect(next).not.toBe(s);
    expect(s.nodes['n2']).toBeUndefined(); // original unchanged
  });

  test('back pops history', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const afterReplace = boardReducer(s, { op: 'replace', blocks: [BLOCK2] });
    expect(afterReplace.history.length).toBe(1);
    const restored = back(afterReplace);
    expect(restored.nodes['n1']).toBeDefined();
    expect(restored.history.length).toBe(0);
  });

  test('back with no history returns same state', () => {
    const s = mkState([SAMPLE_BLOCK]);
    const result = back(s);
    expect(result.nodes['n1']).toBeDefined();
  });

  test('back with empty history is a no-op (detours preserved)', () => {
    const s = createBoard();
    s.nodes['n1'] = { id: 'n1', block: SAMPLE_BLOCK, state: 'complete' };
    s.detours = [{ id: 'd1', targetNodeId: 'n1', blocks: [BLOCK2], openAt: 0 }];
    const result = back(s);
    expect(result.detours).toHaveLength(1); // nothing to pop — state unchanged
    expect(result.nodes['n1']).toBeDefined();
  });
});
