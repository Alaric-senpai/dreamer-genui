import { describe, expect, test } from 'vitest';
import { BoardResolver } from '../../packages/dreamer-genui/src/core/resolver';
import { boardReducer, createBoard, closeDetour } from '../../packages/dreamer-genui/src/core/reducer';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';
import type { AttachOp } from '../../packages/dreamer-genui/src/schema/ops';

function text(id: string): { id: string; type: 'text'; variant: 'body'; content: string[] } {
  return { id, type: 'text', variant: 'body', content: [id] };
}

function boardWithNode(): BoardState {
  return boardReducer(createBoard('b1'), { op: 'append', blocks: [text('n1')] });
}

const ATTACH_DEFAULTS = { placement: 'inline', connector: 'none', mode: 'inline' } as const;

/** Attach ops without presentation fields rely on schema defaults at runtime. */
function attach(to: string, blocks: AttachOp['blocks'], extra: Partial<AttachOp> = {}): AttachOp {
  return { op: 'attach', to, blocks, ...extra } as AttachOp;
}

describe('M4 detour presentation', () => {
  test('attach stores placement, connector, mode and target annotation', () => {
    const next = boardReducer(boardWithNode(), {
      op: 'attach',
      to: 'n1',
      blocks: [text('d1')],
      placement: 'right',
      connector: 'arrow',
      mode: 'spotlight',
      target: { annotate: 'circle' },
    });
    const detour = next.detours[0];
    expect(detour?.placement).toBe('right');
    expect(detour?.connector).toBe('arrow');
    expect(detour?.mode).toBe('spotlight');
    expect(detour?.targetAnnotate).toBe('circle');
  });

  test('omitted presentation fields default to inline/none/inline', () => {
    const next = boardReducer(boardWithNode(), attach('n1', [text('d1')]));
    const detour = next.detours[0];
    expect(detour?.placement).toBe('inline');
    expect(detour?.connector).toBe('none');
    expect(detour?.mode).toBe('inline');
  });

  test('closeDetour pops only the top detour and is a no-op on an empty stack', () => {
    let state = boardWithNode();
    state = boardReducer(state, { op: 'attach', to: 'n1', blocks: [text('d1')], ...ATTACH_DEFAULTS });
    state = boardReducer(state, { op: 'attach', to: 'n1', blocks: [text('d2')], ...ATTACH_DEFAULTS });
    expect(state.detours.map((d) => d.id)).toEqual(['d1', 'd2']);

    const one = closeDetour(state);
    expect(one.detours.map((d) => d.id)).toEqual(['d1']);
    const none = closeDetour(one);
    expect(none.detours).toHaveLength(0);
    expect(closeDetour(none)).toBe(none);
  });
});

describe('M4 resolver: detour-scoped theme reverts on return', () => {
  test('attach theme lives on the detour and the board theme is untouched', () => {
    const resolver = new BoardResolver();
    resolver.applyOps({ v: 1, ops: [{ op: 'append', blocks: [text('n1')] }] });
    resolver.applyOps({
      v: 1,
      ops: [{ op: 'attach', to: 'n1', theme: { mood: 'solemn' }, blocks: [text('d1')] }],
    });

    const open = resolver.getState();
    expect(open.theme).toBeUndefined();
    expect(open.detours[0]?.theme?.mood).toBe('solemn');

    resolver.closeDetour();
    const closed = resolver.getState();
    expect(closed.detours).toHaveLength(0);
    expect(closed.theme).toBeUndefined();
  });

  test('a detour-scoped theme op reverts while an earlier board theme survives', () => {
    const resolver = new BoardResolver();
    resolver.applyOps({ v: 1, ops: [{ op: 'append', blocks: [text('n1')] }] });
    resolver.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'calm' }, scope: 'board' }] });
    resolver.applyOps({ v: 1, ops: [{ op: 'attach', to: 'n1', blocks: [text('d1')] }] });
    resolver.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'eerie' }, scope: 'detour' }] });

    expect(resolver.getState().theme?.mood).toBe('calm');
    expect(resolver.getState().detours[0]?.theme?.mood).toBe('eerie');

    resolver.closeDetour();
    expect(resolver.getState().theme?.mood).toBe('calm');
  });
});

describe('M4 resolver: camera bus', () => {
  test('a camera op emits a validated move and never enters board state', () => {
    const resolver = new BoardResolver();
    resolver.applyOps({ v: 1, ops: [{ op: 'append', blocks: [text('n1')] }] });
    const moves: unknown[] = [];
    resolver.cameraBus.subscribe((move) => moves.push(move));

    const before = resolver.getState();
    const results = resolver.applyOps({
      v: 1,
      ops: [{ op: 'camera', to: 'n1', zoom: 1.35, duration: 1200, ease: 'snappy' }],
    });
    const after = resolver.getState();

    expect(results[0]?.status).toBe('applied');
    expect(moves).toEqual([{ to: 'n1', zoom: 1.35, duration: 1200, ease: 'snappy' }]);
    expect(after.nodes).toBe(before.nodes);
    expect('camera' in after).toBe(false);
  });

  test('overview camera moves are forwarded unchanged', () => {
    const resolver = new BoardResolver();
    const moves: unknown[] = [];
    resolver.cameraBus.subscribe((move) => moves.push(move));
    resolver.applyOps({ v: 1, ops: [{ op: 'camera', to: 'overview' }] });
    expect(moves).toEqual([{ to: 'overview', zoom: undefined, duration: undefined, ease: undefined }]);
  });
});
