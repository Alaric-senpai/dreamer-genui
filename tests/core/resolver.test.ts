import { describe, expect, test } from 'vitest';
import { BoardResolver } from '../../packages/dreamer-genui/src/core/resolver';

const ATTACH_DEFAULTS = { placement: 'inline', connector: 'none', mode: 'inline' } as const;

describe('BoardResolver', () => {
  test('applyOps appends blocks', () => {
    const resolver = new BoardResolver();
    const reply = {
      v: 1 as const,
      ops: [
        { op: 'append' as const, blocks: [{ id: 'n1', type: 'text' as const, variant: 'body' as const, content: ['Hello'] }] },
      ],
    };
    const results = resolver.applyOps(reply);
    expect(results[0]?.status).toBe('applied');
    expect(resolver.getState().nodes['n1']).toBeDefined();
  });

  test('applyOps rejects duplicate id and emits error', () => {
    const resolver = new BoardResolver();
    const errorEvents: unknown[] = [];
    resolver.errors.subscribe(e => errorEvents.push(e));

    const mk = () => ({ v: 1 as const, ops: [{ op: 'append' as const, blocks: [{ id: 'n1', type: 'text' as const, variant: 'body' as const, content: [] }] }] });
    resolver.applyOps(mk());
    const results = resolver.applyOps(mk());
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.error?.code).toBe('duplicate-id');
    expect(errorEvents).toHaveLength(1);
  });

  test('applyOps bad-target emits error', () => {
    const resolver = new BoardResolver();
    const errors: unknown[] = [];
    resolver.errors.subscribe(e => errors.push(e));
    const results = resolver.applyOps({
      v: 1,
      ops: [{ op: 'attach', to: 'ghost', blocks: [{ id: 'd1', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS }],
    });
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.error?.code).toBe('bad-target');
    expect(errors).toHaveLength(1);
  });

  test('applyOps depth-exceeded emits error', () => {
    // r2 fills the board to depth 2 (MAX): three attaches on the same target
    const r2 = new BoardResolver();
    r2.applyPartial({
      v: 1,
      ops: [
        { op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] },
        { op: 'attach', to: 'n1', blocks: [{ id: 'd1', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS },
        { op: 'attach', to: 'n1', blocks: [{ id: 'd2', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS },
      ],
    });
    const results = r2.applyOps({
      v: 1,
      ops: [{ op: 'attach', to: 'n1', blocks: [{ id: 'd3', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS }],
    });
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.error?.code).toBe('depth-exceeded');
  });

  test('back restores previous state', () => {
    const resolver = new BoardResolver();
    resolver.applyOps({ v: 1, ops: [{ op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] }] });
    resolver.applyOps({ v: 1, ops: [{ op: 'replace', title: 'Topic 2', blocks: [{ id: 'n2', type: 'text', variant: 'body', content: [] }] }] });

    expect(resolver.getState().nodes['n2']).toBeDefined();
    resolver.back();
    expect(resolver.getState().nodes['n1']).toBeDefined();
    expect(resolver.getState().nodes['n2']).toBeUndefined();
  });

  test('reset clears state', () => {
    const resolver = new BoardResolver();
    resolver.applyOps({ v: 1, ops: [{ op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] }] });
    resolver.reset();
    expect(resolver.getState().nodes['n1']).toBeUndefined();
  });

  test('applyPartial is idempotent — same partial applied twice produces same state', () => {
    const resolver = new BoardResolver();
    const partial = {
      v: 1 as const,
      ops: [
        { op: 'append' as const, blocks: [{ id: 'n1', type: 'text' as const, variant: 'body' as const, content: ['Hello'] }] },
      ],
    };
    resolver.applyPartial(partial);
    const nodeCountAfterFirst = Object.keys(resolver.getState().nodes).length;
    resolver.applyPartial(partial);
    const nodeCountAfterSecond = Object.keys(resolver.getState().nodes).length;
    expect(nodeCountAfterSecond).toBe(nodeCountAfterFirst);
    expect(nodeCountAfterSecond).toBe(1);
  });

  test('applyFinal after the same partial applies cleanly — no duplicate-id storm', () => {
    const resolver = new BoardResolver();
    const errors: unknown[] = [];
    resolver.errors.subscribe(e => errors.push(e));
    const reply = { v: 1 as const, ops: [{ op: 'append' as const, blocks: [{ id: 'n1', type: 'text' as const, variant: 'body' as const, content: [] }] }] };
    const partialResults = resolver.applyPartial(reply);
    expect(partialResults.every(r => r.status === 'applied')).toBe(true);
    const finalResults = resolver.applyFinal(reply); // same reply + ledger-aware → skip, no re-apply
    expect(finalResults.every(r => r.status === 'applied')).toBe(true);
    expect(errors).toHaveLength(0); // no duplicate-id emissions
    expect(resolver.getState().nodes['n1']).toBeDefined();
  });

  test('applyFinal retries a failed partial op', () => {
    const resolver = new BoardResolver();
    // partial: attach before target exists → fails, not ledger-recorded
    resolver.applyPartial({
      v: 1,
      ops: [{ op: 'attach', to: 'n1', blocks: [{ id: 'd1', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS }],
    });
    const final = resolver.applyFinal({
      v: 1,
      ops: [
        { op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: [] }] },
        { op: 'attach', to: 'n1', blocks: [{ id: 'd1', type: 'text', variant: 'body', content: [] }], ...ATTACH_DEFAULTS },
      ],
    });
    expect(final[0]?.status).toBe('applied');
    expect(final[1]?.status).toBe('applied'); // retried at final
    expect(resolver.getState().detours).toHaveLength(1);
  });

  test('unknown block type surfaces as unknown-type through the resolver', () => {
    const resolver = new BoardResolver();
    const results = resolver.applyOps({
      v: 1,
      ops: [{ op: 'append', blocks: [{ id: 'x1', type: 'made-up-widget' } as unknown as never] }],
    });
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.error?.code).toBe('unknown-type');
    expect(results[0]?.error?.type).toBe('made-up-widget');
  });

  test('getState returns defined state with id', () => {
    const resolver = new BoardResolver();
    expect(resolver.getState().id).toBeDefined();
  });
});
