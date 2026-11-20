import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'vitest';
import { BoardResolver } from '../../packages/dreamer-genui/src/core/resolver';
import { createRegistry } from '../../packages/dreamer-genui/src/core';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';
import type { CameraOp } from '../../packages/dreamer-genui/src/schema/ops';

const FIXTURE_DIR = new URL('../../fixtures', import.meta.url).pathname;
const examFixture = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'assessment-exam.json'), 'utf-8'),
) as ReplyLike;

const splitLayout = { op: 'layout' as const, layout: { kind: 'split' as const } };

function examResolver(strategy: 'queue' | 'reject' = 'queue') {
  const resolver = new BoardResolver({
    examLockStrategy: strategy,
    // Assessment ships as an opt-in plugin (§9.2), disabled by default.
    registry: createRegistry({ plugins: { assessment: true } }),
  });
  resolver.applyFinal(examFixture);
  const machine = resolver.assessments.get('exam-paper');
  if (!machine) throw new Error('missing exam machine');
  machine.start();
  return { resolver, machine };
}

describe('M4b exam enforcement (§6.8)', () => {
  test('queues presentation ops until the exam is submitted, then applies them', () => {
    const { resolver, machine } = examResolver();
    expect(resolver.getState().layout.kind).toBe('flow');

    resolver.applyFinal({ v: 1, ops: [splitLayout] });
    expect(resolver.getState().layout.kind).toBe('flow');

    machine.submit();
    expect(resolver.getState().layout.kind).toBe('split');
    expect(resolver.getState().assessments['exam-paper']?.submittedAt).toBeDefined();
  });

  test('the reject strategy drops locked ops permanently', () => {
    const { resolver, machine } = examResolver('reject');
    resolver.applyFinal({ v: 1, ops: [splitLayout] });
    expect(resolver.getState().layout.kind).toBe('flow');

    machine.submit();
    expect(resolver.getState().layout.kind).toBe('flow');
  });

  test('camera moves are silent during an exam and released on submit', () => {
    const { resolver, machine } = examResolver();
    const moves: CameraOp[] = [];
    resolver.cameraBus.subscribe((move) => moves.push(move));

    resolver.applyFinal({
      v: 1,
      ops: [{ op: 'camera', to: 'exam-paper', preset: 'closeup', tilt: { y: 6 } }],
    });
    expect(moves).toHaveLength(0);

    machine.submit();
    expect(moves).toHaveLength(1);
    expect(moves[0]?.preset).toBe('closeup');
    expect(moves[0]?.tilt?.y).toBe(6);
  });

  test('restoring a submitted state releases queued ops', () => {
    const { resolver, machine } = examResolver();
    resolver.applyFinal({ v: 1, ops: [splitLayout] });
    expect(resolver.getState().layout.kind).toBe('flow');

    resolver.assessments.restore('exam-paper', {
      ...machine.snapshot(),
      submittedAt: 1,
    });
    expect(resolver.getState().layout.kind).toBe('split');
    expect(resolver.getState().assessments['exam-paper']?.submittedAt).toBe(1);
  });

  test('different lock policies can leave selected aspects unlocked', () => {
    const resolver = new BoardResolver({ examLocks: { layout: false } });
    resolver.applyFinal(examFixture);
    resolver.assessments.get('exam-paper')?.start();

    resolver.applyFinal({ v: 1, ops: [splitLayout] });
    // Layout is opted out, so the re-flow applies even mid-exam.
    expect(resolver.getState().layout.kind).toBe('split');
  });
});
