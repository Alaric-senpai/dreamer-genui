import { describe, expect, test, vi } from 'vitest';
import { AssessmentBlockSchema, type AssessmentBlock } from '../../packages/dreamer-genui/src/schema/assessment';
import {
  applyExamLocks,
  createAssessmentMachine,
  DEFAULT_EXAM_LOCKS,
  examLocksFor,
  feedbackAllowed,
  hintsAllowed,
  isOpLockedByExam,
  type Clock,
} from '../../packages/dreamer-genui/src/core/assessment';

/** Deterministic clock for timer tests. */
function fakeClock(start = 1000): Clock & { advance: (ms: number) => void } {
  let now = start;
  return { now: () => now, advance: ms => { now += ms; } };
}

const question = (id: string) => ({
  id,
  type: 'question' as const,
  kind: 'mcq' as const,
  prompt: [`Q ${id}`],
  options: [{ id: 'a', label: ['A'] }, { id: 'b', label: ['B'] }],
});

function block(overrides: Partial<AssessmentBlock> = {}): AssessmentBlock {
  const candidate = {
    id: 'as1',
    type: 'assessment' as const,
    mode: 'quiz' as const,
    sections: [{ id: 's1', questions: [question('q1'), question('q2'), question('q3')] }],
    ...overrides,
  };
  return AssessmentBlockSchema.parse(candidate) as AssessmentBlock;
}

describe('assessment state machine (§6.8)', () => {
  test('initial state selects the first question and visits it', () => {
    const machine = createAssessmentMachine({ block: block() });
    expect(machine.getState().currentQuestionId).toBe('q1');
    expect(machine.getState().visited).toEqual(['q1']);
    expect(machine.questions.map(q => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(machine.questions[1]).toMatchObject({ sectionId: 's1', index: 1, sectionIndex: 1 });
  });

  test('answer stores values verbatim; unknown ids are rejected', () => {
    const machine = createAssessmentMachine({ block: block() });
    expect(machine.answer('q1', 'a')).toBe(true);
    expect(machine.answer('nope', 'a')).toBe(false);
    expect(machine.getState().answers).toEqual({ q1: 'a' });
    expect(machine.answeredCount()).toBe(1);
  });

  test('answer after submit is rejected', () => {
    const machine = createAssessmentMachine({ block: block() });
    machine.submit();
    expect(machine.answer('q1', 'a')).toBe(false);
    expect(machine.isSubmitted()).toBe(true);
  });

  test('flagging respects allowFlag and toggles', () => {
    const machine = createAssessmentMachine({ block: block() });
    expect(machine.flag('q1')).toBe(true);
    expect(machine.flag('q2')).toBe(true);
    expect(machine.flaggedCount()).toBe(2);
    expect(machine.flag('q2', false)).toBe(true);
    expect(machine.getState().flags).toEqual(['q1']);

    const noFlag = createAssessmentMachine({ block: block({ allowFlag: false }) });
    expect(noFlag.flag('q1')).toBe(false);
  });

  test('free navigation allows jumping anywhere', () => {
    const machine = createAssessmentMachine({ block: block() });
    expect(machine.navigate('q3')).toBe(true);
    expect(machine.getState().currentQuestionId).toBe('q3');
    expect(machine.getState().visited).toEqual(['q1', 'q3']);
  });

  test('linear navigation blocks skipping ahead', () => {
    const machine = createAssessmentMachine({ block: block({ navigation: 'linear' }) });
    expect(machine.navigate('q3')).toBe(false);
    expect(machine.navigate('q2')).toBe(true);
    expect(machine.navigate('q3')).toBe(true);
  });

  test('locked-after-answer blocks leaving an unanswered question', () => {
    const machine = createAssessmentMachine({ block: block({ navigation: 'locked-after-answer' }) });
    expect(machine.navigate('q2')).toBe(false);
    machine.answer('q1', 'a');
    expect(machine.navigate('q2')).toBe(true);
  });

  test('countdown ticks with an injectable clock; warnings fire once, then timeout', () => {
    const clock = fakeClock();
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    const machine = createAssessmentMachine({
      block: block({ timer: { kind: 'countdown', seconds: 60, warnAtSeconds: [30, 10] } }),
      clock,
      onWarning,
      onTimeout,
    });

    machine.start();
    expect(machine.isRunning()).toBe(true);
    expect(machine.remainingMs()).toBe(60_000);

    clock.advance(31_000);
    expect(machine.tick()).toMatchObject({ warnings: [30], timedOut: false, remainingMs: 29_000 });
    expect(machine.tick()).toEqual({ warnings: [], timedOut: false, remainingMs: 29_000 });
    expect(onWarning).toHaveBeenCalledTimes(1);

    clock.advance(29_000);
    const result = machine.tick();
    expect(result.timedOut).toBe(true);
    expect(result.remainingMs).toBe(0);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(machine.getState().timerRemainingMs).toBe(0);
    expect(machine.isRunning()).toBe(false);
  });

  test('pause/resume and extendTime with the fake clock', () => {
    const clock = fakeClock();
    const machine = createAssessmentMachine({
      block: block({ timer: { kind: 'countdown', seconds: 60 } }),
      clock,
    });
    machine.start();
    clock.advance(10_000);
    machine.pause();
    expect(machine.remainingMs()).toBe(50_000);
    expect(machine.isRunning()).toBe(false);

    clock.advance(60_000); // paused time does not run out
    expect(machine.tick().timedOut).toBe(false);
    expect(machine.remainingMs()).toBe(50_000);

    machine.extendTime(30_000);
    expect(machine.remainingMs()).toBe(80_000);

    machine.resume();
    expect(machine.isRunning()).toBe(true);
    clock.advance(80_000);
    expect(machine.tick().timedOut).toBe(true);
  });

  test('restore (reload) resumes without replaying: state survives, timer continues from saved ms', () => {
    const machine = createAssessmentMachine({
      block: block({ mode: 'exam', timer: { kind: 'countdown', seconds: 120 } }),
      clock: fakeClock(),
    });
    machine.start();
    machine.answer('q1', 'a');
    machine.flag('q2');
    const saved = machine.snapshot();

    // "Reload": a fresh machine restored from the saved state.
    const reloaded = createAssessmentMachine({
      block: block({ mode: 'exam', timer: { kind: 'countdown', seconds: 120 } }),
      clock: fakeClock(),
      initialState: saved,
    });
    expect(reloaded.getState()).toEqual(saved);
    expect(reloaded.getState().answers).toEqual({ q1: 'a' });
    expect(reloaded.flaggedCount()).toBe(1);
    reloaded.start(); // idempotent when already started
    expect(reloaded.remainingMs()).toBe(120_000);
  });

  test('onChange fires for autosave on every mutation', () => {
    const onChange = vi.fn();
    const machine = createAssessmentMachine({ block: block(), onChange });
    machine.start();
    machine.answer('q1', 'a');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]?.[0]).toMatchObject({ answers: { q1: 'a' } });
  });

  test('mode transitions: exam -> review only after submit; practice toggles', () => {
    const exam = createAssessmentMachine({ block: block({ mode: 'exam' }) });
    expect(exam.setMode('review')).toBe(false);
    exam.submit();
    expect(exam.setMode('review')).toBe(true);

    const practice = createAssessmentMachine({ block: block({ mode: 'practice' }) });
    expect(practice.setMode('quiz')).toBe(true);
  });

  test('hints are practice-only; feedback is hidden in exam until review', () => {
    const practice = createAssessmentMachine({ block: block({ mode: 'practice' }) });
    expect(hintsAllowed('practice')).toBe(true);
    expect(practice.canHint()).toBe(true);

    const exam = createAssessmentMachine({ block: block({ mode: 'exam' }) });
    expect(exam.canHint()).toBe(false);
    expect(feedbackAllowed('exam')).toBe(false);
    expect(feedbackAllowed('practice')).toBe(true);
    expect(feedbackAllowed('quiz')).toBe(true);
    exam.submit();
    expect(exam.isExamActive()).toBe(false);
  });

  test('exam locks: camera/ambience/theme/layout/kinetic while exam is active', () => {
    const exam = createAssessmentMachine({ block: block({ mode: 'exam' }) });
    expect(exam.isExamActive()).toBe(true);

    const locks = examLocksFor([exam.getState()]);
    expect(locks).toEqual(DEFAULT_EXAM_LOCKS);

    exam.submit();
    expect(examLocksFor([exam.getState()]).camera).toBe(false);

    const cameraOp = { op: 'camera' as const, preset: 'closeup' as const };
    const themeOp = { op: 'theme' as const, theme: { mood: 'calm' }, scope: 'board' as const };
    const layoutOp = { op: 'layout' as const, layout: { kind: 'flow' as const } };
    const appendOp = { op: 'append' as const, blocks: [{ id: 't', type: 'text' as const, variant: 'body' as const, content: ['x'] }] };

    const activeLocks = examLocksFor([{ id: 'as1', mode: 'exam', answers: {}, flags: [], visited: [] } as never]);
    expect(isOpLockedByExam(cameraOp, activeLocks)).toBe(true);
    expect(isOpLockedByExam(themeOp, activeLocks)).toBe(true);
    expect(isOpLockedByExam(layoutOp, activeLocks)).toBe(true);
    expect(isOpLockedByExam(appendOp, activeLocks)).toBe(false);

    const result = applyExamLocks([cameraOp, appendOp, themeOp], activeLocks, 'queue');
    expect(result.accepted).toEqual([appendOp]);
    expect(result.queued.map(o => o.op)).toEqual(['camera', 'theme']);
    expect(result.rejected).toEqual([]);

    const rejected = applyExamLocks([cameraOp, appendOp], activeLocks, 'reject');
    expect(rejected.rejected).toEqual([cameraOp]);
    expect(rejected.accepted).toEqual([appendOp]);
  });
});
