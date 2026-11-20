import { describe, expect, test, vi } from 'vitest';
import { BoardResolver } from '../../packages/dreamer-genui/src/core/resolver';
import { createRegistry } from '../../packages/dreamer-genui/src/core';
import { defineMiddleware, definePlugin } from '../../packages/dreamer-genui/src/core/plugin';
import {
  createBoardSnapshot,
  createOpsLog,
  OPS_LOG_VERSION,
  replayLog,
  replayTimeline,
  restoreBoardSnapshot,
  migrateSnapshot,
  SNAPSHOT_VERSION,
  appendOp,
  appendCue,
} from '../../packages/dreamer-genui/src/core/persistence';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';
import type { Op } from '../../packages/dreamer-genui/src/schema/ops';
import type { Clock } from '../../packages/dreamer-genui/src/core/assessment';

const textOp = (id: string): Op => ({
  op: 'append',
  blocks: [{ id, type: 'text', variant: 'body', content: [`content of ${id}`] }],
});

/** Deterministic clock for ops-log timestamps. */
function fakeClock(start = 1000): Clock & { advance: (ms: number) => void } {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => { now += ms; },
  };
}

function buildPopulatedBoard() {
  const clock = { now: vi.fn().mockReturnValue(1000) } as unknown as Clock;
  const resolver = new BoardResolver({ clock });
  resolver.applyFinal({ v: 1, ops: [textOp('t1'), { op: 'append', blocks: [{ id: 'h1', type: 'text', variant: 'hero', content: ['Hello'] }], after: 't1' }] });
  resolver.cue('beat-1');
  return resolver;
}

describe('persistence: snapshots (§7.3)', () => {
  test('snapshot/restore round-trips the full board state', () => {
    const resolver = buildPopulatedBoard();
    const snapshot = resolver.snapshot();
    expect(snapshot.v).toBe(SNAPSHOT_VERSION);
    expect(() => JSON.parse(JSON.stringify(snapshot))).not.toThrow();

    const target = new BoardResolver();
    const restored = target.restore(snapshot);
    expect(restored.nodes).toEqual(resolver.getState().nodes);
    expect(restored.firedCues).toEqual(['beat-1']);
    expect(restored.theme).toEqual(resolver.getState().theme);
    expect(restored.layout).toEqual(resolver.getState().layout);
  });

  test('restore is JSON-serializable end to end', () => {
    const resolver = buildPopulatedBoard();
    const rehydrated = JSON.parse(JSON.stringify(resolver.snapshot()));
    const restored = new BoardResolver().restore(rehydrated);
    expect(Object.keys(restored.nodes)).toEqual(['t1', 'h1']);
  });

  test('invalid and future versions are rejected', () => {
    const state = createBoard();
    state.nodes['x'] = { id: 'x', block: { id: 'x', type: 'text', variant: 'body', content: ['x'] }, state: 'complete' };

    // With SNAPSHOT_VERSION = 1 there are no older versions yet; the migration
    // hooks are exercised once a version bump lands. Version guards still hold:
    expect(() => restoreBoardSnapshot({ v: 0, state } as never)).toThrow(/Invalid snapshot version/);
    expect(() => restoreBoardSnapshot({ v: SNAPSHOT_VERSION + 5, state } as never)).toThrow(
      /newer than this library supports/,
    );
    expect(migrateSnapshot({ v: SNAPSHOT_VERSION, state })).toMatchObject({ v: SNAPSHOT_VERSION });
  });
});

describe('persistence: ops log and replay (§7.3)', () => {
  test('exportOps captures ops, cues and flush; replay reproduces the same state', () => {
    const clock = fakeClock();
    const resolver = new BoardResolver({ clock });
    resolver.applyFinal({ v: 1, ops: [textOp('t1'), textOp('t2')] });
    resolver.cue('beat-1');
    resolver.flush();

    const log = resolver.exportOps();
    expect(log.v).toBe(OPS_LOG_VERSION);
    const kinds = log.entries.map(e => e.type);
    expect(kinds).toContain('op');
    expect(kinds).toContain('cue');
    expect(kinds).toContain('flush');

    // Rehydrate across JSON (resume after reload).
    const revived = JSON.parse(JSON.stringify(log)) as typeof log;
    const replayed = new BoardResolver().replay(revived);
    expect(Object.keys(replayed.nodes)).toEqual(['t1', 't2']);
    expect(replayed.firedCues).toEqual(['beat-1']);
    expect(replayed.flushed).toBe(true);
  });

  test('back and detour-return entries replay', () => {
    const clock = fakeClock();
    const resolver = new BoardResolver({ clock });
    resolver.applyFinal({ v: 1, ops: [textOp('t1')] });
    resolver.applyFinal({
      v: 1,
      ops: [{ op: 'replace', blocks: [{ id: 't2', type: 'text', variant: 'body', content: ['replaced'] }] }],
    });
    resolver.back();
    const log = resolver.exportOps();
    expect(log.entries.some(e => e.type === 'back')).toBe(true);
    expect(new BoardResolver().replay(JSON.parse(JSON.stringify(log))).nodes['t1']).toBeDefined();
  });

  test('replayLog accepts a base state and a migrate hook; timeline honours speed', () => {
    const base = createBoard();
    base.nodes['seed'] = { id: 'seed', block: { id: 'seed', type: 'text', variant: 'body', content: ['seed'] }, state: 'complete' };
    const log = createOpsLog(0);
    appendOp(log, textOp('a'), 100);
    appendCue(log, 'c1', 200);

    const replayed = replayLog(log, { base });
    expect(Object.keys(replayed.nodes)).toEqual(['seed', 'a']);
    expect(replayed.firedCues).toEqual(['c1']);

    const timeline = replayTimeline(log, 2);
    expect(timeline.map(step => step.at)).toEqual([50, 100]);
  });

  test('assessment states are recorded in the log and restored by replay', () => {
    const clock = fakeClock();
    const resolver = new BoardResolver({
      clock,
      registry: createRegistry({ plugins: { assessment: true } }),
    });
    const assessmentOp: Op = {
      op: 'append',
      blocks: [{
        id: 'as1', type: 'assessment', mode: 'practice',
        sections: [{ id: 's1', questions: [{ id: 'q1', type: 'question', kind: 'mcq', prompt: ['?'], options: [{ id: 'a', label: ['A'] }] }] }],
      }],
    };
    resolver.applyFinal({ v: 1, ops: [assessmentOp] });

    const machine = resolver.assessments.get('as1');
    expect(machine).toBeDefined();
    machine!.answer('q1', 'a');

    // onChange wrote state into board state and the log.
    expect(resolver.getState().assessments['as1']?.answers).toEqual({ q1: 'a' });
    const log = resolver.exportOps();
    expect(log.entries.some(e => e.type === 'assessment')).toBe(true);

    const replayed = new BoardResolver().replay(JSON.parse(JSON.stringify(log)));
    expect(replayed.assessments['as1']?.answers).toEqual({ q1: 'a' });
  });
});

describe('resolver: middleware integration (§8.6)', () => {
  test('options middleware transforms ops before the reducer', () => {
    const resolver = new BoardResolver({
      middleware: [defineMiddleware({ name: 'rewrite', onOp: op => (op.op === 'append' && op.blocks[0]?.id === 'a' ? { ...op, blocks: [{ ...op.blocks[0]!, id: 'rewritten' }] } : op) })],
    });
    resolver.applyFinal({ v: 1, ops: [textOp('a')] });
    expect(resolver.getState().nodes['rewritten']).toBeDefined();
    expect(resolver.getState().nodes['a']).toBeUndefined();
  });

  test('registry-registered middleware (from a plugin) flows into the resolver', () => {
    const registry = createRegistryWithMiddleware();
    const resolver = new BoardResolver({ registry });
    resolver.applyFinal({ v: 1, ops: [textOp('keep')] });
    // The plugin middleware rewrites every appended id.
    expect(resolver.getState().nodes['mw-keep']).toBeDefined();
    expect(resolver.getState().nodes['keep']).toBeUndefined();
  });

  test('a throwing middleware is isolated; the op still applies', () => {
    const errors: unknown[] = [];
    const resolver = new BoardResolver({
      middleware: [defineMiddleware({ name: 'broken', onOp: () => { throw new Error('boom'); } })],
      onError: e => errors.push(e),
    });
    resolver.applyFinal({ v: 1, ops: [textOp('t1')] });
    expect(resolver.getState().nodes['t1']).toBeDefined();
    expect(errors.some(e => (e as { code: string }).code === 'middleware-error')).toBe(true);
  });
});

function createRegistryWithMiddleware() {
  const registry = createRegistry({ strictPlugins: false });
  registry.use(definePlugin({
    name: 'acme:mw',
    version: '1.0.0',
    provides: {
      middleware: {
        'acme:rewriter': defineMiddleware({
          name: 'acme:rewriter',
          onOp: op => (op.op === 'append' ? { ...op, blocks: op.blocks.map(b => ({ ...b, id: `mw-${b.id}` })) } : op),
        }),
      },
    },
  }), { builtin: true });
  return registry;
}
