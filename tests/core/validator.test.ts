import { describe, expect, test } from 'vitest';
import { validateOp, resolveNodeRef } from '../../packages/dreamer-genui/src/core/validator';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';

function mkState(ids = ['n1']): BoardState {
  const s = createBoard('test');
  for (const id of ids) {
    s.nodes[id] = { id, block: { id, type: 'text', variant: 'body', content: ['x'] }, state: 'complete' };
  }
  return s;
}

describe('validateOp', () => {
  test('valid append passes', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'append', blocks: [{ id: 'n2', type: 'text', variant: 'body', content: [] }] });
    expect(result.valid).toBe(true);
  });

  test('duplicate id rejects with duplicate-id', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('duplicate-id');
    expect(result.error?.nodeId).toBe('n1');
  });

  test('attach to non-existent target rejects with bad-target', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'attach', to: 'does-not-exist', blocks: [] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('bad-target');
  });

  test('attach at max depth (2) rejects with depth-exceeded', () => {
    const s = mkState(['n1']);
    (s as any).detours = [
      { id: 'd0', targetNodeId: 'n1', blocks: [], openAt: 0 },
      { id: 'd1', targetNodeId: 'n1', blocks: [], openAt: 1 },
    ];
    const result = validateOp(s, { op: 'attach', to: 'n1', blocks: [] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('depth-exceeded');
  });

  test('attach at depth 1 (less than max) passes', () => {
    const s = mkState(['n1']);
    (s as any).detours = [{ id: 'd0', targetNodeId: 'n1', blocks: [], openAt: 0 }];
    const result = validateOp(s, { op: 'attach', to: 'n1', blocks: [] });
    expect(result.valid).toBe(true);
  });

  test('update non-existent node rejects with invalid-node', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'update', id: 'ghost', props: {} });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('remove non-existent node rejects with invalid-node', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'remove', id: 'ghost' });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('invalid op schema rejects', () => {
    const s = mkState();
    const result = validateOp(s, { op: 'fly', blocks: [] } as any);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('duplicate id in replace rejects', () => {
    const s = mkState(['n1']);
    const result = validateOp(s, { op: 'replace', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('duplicate-id');
  });
});

describe('resolveNodeRef', () => {
  test('resolves simple node id', () => {
    const s = mkState(['n1', 'n2']);
    expect(resolveNodeRef(s, 'n1')).toBe('n1');
    expect(resolveNodeRef(s, 'n2')).toBe('n2');
  });

  test('returns null for non-existent ref', () => {
    const s = mkState(['n1']);
    expect(resolveNodeRef(s, 'ghost')).toBeNull();
  });

  test('resolves parentId/itemId format when the parent exists', () => {
    const s = mkState(['n1', 'branches']);
    expect(resolveNodeRef(s, 'branches/botany')).toBe('branches');
  });

  test('parent/item ref with unknown parent is null (bad-target path)', () => {
    const s = mkState(['n1']);
    expect(resolveNodeRef(s, 'ghost/item')).toBeNull();
  });

  test('attach with parent/item ref to unknown parent rejects with bad-target', () => {
    const s = mkState(['n1']);
    const result = validateOp(s, {
      op: 'attach', to: 'ghost/item', blocks: [{ id: 'd1', type: 'text', variant: 'body', content: [] }],
      placement: 'inline', connector: 'none', mode: 'inline',
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('bad-target');
  });

  test('two blocks with the same id inside one append op reject', () => {
    const s = mkState();
    const block = { id: 'x', type: 'text', variant: 'body', content: [] };
    const result = validateOp(s, { op: 'append', blocks: [block, { ...block }] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('duplicate-id');
  });

  test('append cannot reuse an id already used by an open detour block', () => {
    const s = mkState(['n1']);
    s.detours = [{ id: 'd0', targetNodeId: 'n1', blocks: [{ id: 'detour-x', type: 'text', variant: 'body', content: [] }], openAt: 0, placement: 'inline', connector: 'none', mode: 'inline' }];
    const result = validateOp(s, { op: 'append', blocks: [{ id: 'detour-x', type: 'text', variant: 'body', content: [] }] });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('duplicate-id');
  });
});
