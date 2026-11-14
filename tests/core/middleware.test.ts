import { describe, expect, test, vi } from 'vitest';
import { createMiddlewarePipeline, sortMiddleware } from '../../packages/dreamer-genui/src/core/middleware';
import { defineMiddleware, definePlugin } from '../../packages/dreamer-genui/src/core/plugin';
import { createRegistry, type Registry } from '../../packages/dreamer-genui/src/core';
import type { Op } from '../../packages/dreamer-genui/src/schema/ops';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';

const registry: Registry = createRegistry();
const opts = { registry };

const appendOp = (id: string): Op => ({ op: 'append', blocks: [{ id, type: 'text', variant: 'body', content: ['x'] }] });

describe('middleware pipeline (§8.6)', () => {
  test('runs in ascending priority order, registration order on ties', () => {
    const calls: string[] = [];
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({ name: 'b', priority: 200, onOp: op => { calls.push('b'); return op; } }),
      defineMiddleware({ name: 'a', priority: 50, onOp: op => { calls.push('a'); return op; } }),
      defineMiddleware({ name: 'c', onOp: op => { calls.push('c'); return op; } }),
    ], opts);
    expect(pipeline.middleware.map(m => m.name)).toEqual(['a', 'c', 'b']);
    pipeline.applyOpsSync([appendOp('x')]);
    expect(calls).toEqual(['a', 'c', 'b']);
  });

  test('sortMiddleware accepts plugin-tagged entries', () => {
    const sorted = sortMiddleware([
      { plugin: 'p1', priority: 10, value: defineMiddleware({ name: 'slow', priority: 100 }) },
      { plugin: 'p2', value: defineMiddleware({ name: 'fast', priority: 1 }) },
    ]);
    expect(sorted.map(m => m.name)).toEqual(['fast', 'slow']);
  });

  test('onOp can transform, expand and drop ops', () => {
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({
        name: 'm',
        onOp: op => (op.op === 'append' && op.blocks[0]?.id === 'drop-me' ? null : op),
      }),
      defineMiddleware({
        name: 'expand',
        onOp: op => (op.op === 'append' && op.blocks[0]?.id === 'expand-me' ? [op, appendOp('extra')] : op),
      }),
    ], opts);

    expect(pipeline.applyOpsSync([appendOp('drop-me')])).toEqual([]);
    const expanded = pipeline.applyOpsSync([appendOp('expand-me')]);
    expect(expanded.map(op => (op as unknown as { blocks: [{ id: string }] }).blocks[0].id)).toEqual(['expand-me', 'extra']);
  });

  test('onEvent enriches or suppresses events', () => {
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({
        name: 'tag',
        onEvent: event => (event.type === 'focus' ? { ...event, label: 'tagged' } : event),
      }),
      defineMiddleware({
        name: 'quiet',
        onEvent: event => (event.type === 'select' ? null : event),
      }),
    ], opts);
    const focus: UIEvent = { type: 'focus', nodeId: 'n1' };
    expect(pipeline.applyEventSync(focus)).toEqual({ type: 'focus', nodeId: 'n1', label: 'tagged' });
    expect(pipeline.applyEventSync({ type: 'select', nodeId: 'n1' })).toBeNull();
  });

  test('errors are isolated as middleware-error; the op passes through', () => {
    const errors: unknown[] = [];
    const onError = vi.fn();
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({ name: 'broken', onOp: () => { throw new Error('boom'); } }),
    ], { ...opts, onError: e => { errors.push(e); onError(e); } });

    const ops = pipeline.applyOpsSync([appendOp('keep')]);
    expect(ops).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'middleware-error' });
    expect(String((errors[0] as { detail?: string }).detail)).toContain('boom');
    expect(onError).toHaveBeenCalled();
  });

  test('a throwing event middleware does not break the chain', () => {
    const seen: UIEvent[] = [];
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({ name: 'broken', onEvent: () => { throw new Error('x'); } }),
      defineMiddleware({ name: 'after', onEvent: event => { seen.push(event); return event; } }),
    ], opts);
    expect(pipeline.applyEventSync({ type: 'focus', nodeId: 'n' })).toEqual({ type: 'focus', nodeId: 'n' });
    expect(seen).toHaveLength(1);
  });

  test('async hooks are skipped by the sync variants and reported', () => {
    const errors: unknown[] = [];
    const pipeline = createMiddlewarePipeline([
      defineMiddleware({ name: 'async-mw', priority: 1, onOp: async op => op }),
      defineMiddleware({ name: 'sync-mw', priority: 2, onOp: op => op }),
    ], { ...opts, onError: e => errors.push(e) });
    const ops = pipeline.applyOpsSync([appendOp('x')]);
    expect(ops).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect((errors[0] as { detail?: string }).detail).toContain('async onOp');
  });

  test('registry-registered middleware flows into the resolver (§8.6)', () => {
    const registryWithMw = createRegistry({ strictPlugins: false });
    registryWithMw.use(definePlugin({
      name: 'acme:mw',
      version: '1.0.0',
      provides: {
        middleware: {
          'acme:annotate': defineMiddleware({
            name: 'acme:annotate',
            onOp: op => (op.op === 'theme' ? op : op),
          }),
        },
      },
    }), { builtin: true });
    expect(registryWithMw.listMiddleware().map(m => m.name)).toEqual(['acme:annotate']);
  });
});
