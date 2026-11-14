import {
  AssessmentStateSchema,
  type AssessmentBlock,
  type AssessmentMode,
  type AssessmentState,
} from '../schema/assessment';
import type { Op } from '../schema/ops';

/**
 * Headless assessment state machine (§6.8). No React and no timer of its own:
 * the host ticks it and supplies the clock, which makes modes, navigation,
 * flagging, timer warnings and restore-after-reload fully testable.
 *
 * The library never grades. Answers are stored verbatim; correctness arrives
 * later through host `update` ops.
 */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface AssessmentQuestionInfo {
  id: string;
  sectionId: string;
  /** Index within the whole assessment, in section/question order. */
  index: number;
  /** Index within its section. */
  sectionIndex: number;
  marks?: number;
  kind: string;
}

export type AssessmentTimerKind = 'countdown' | 'elapsed';

export interface TickResult {
  warnings: number[];
  timedOut: boolean;
  remainingMs?: number;
}

export interface AssessmentMachineOptions {
  block: AssessmentBlock;
  clock?: Clock;
  /** Restore a persisted state (autosave / reload). */
  initialState?: AssessmentState;
  /** Called after every state change, for host autosave. */
  onChange?: (state: AssessmentState) => void;
  /** Called when the countdown crosses a warnAtSeconds threshold. */
  onWarning?: (secondsRemaining: number) => void;
  /** Called once when the countdown reaches zero. */
  onTimeout?: () => void;
}

export interface AssessmentMachine {
  readonly id: string;
  readonly block: AssessmentBlock;
  readonly questions: AssessmentQuestionInfo[];
  getState(): AssessmentState;
  start(): AssessmentState;
  snapshot(): AssessmentState;
  restore(state: AssessmentState): AssessmentState;
  setMode(mode: AssessmentMode): boolean;
  answer(questionId: string, value: unknown): boolean;
  flag(questionId: string, flagged?: boolean): boolean;
  navigate(questionId: string): boolean;
  submit(): AssessmentState;
  extendTime(ms: number): AssessmentState;
  pause(): AssessmentState;
  resume(): AssessmentState;
  tick(): TickResult;
  remainingMs(): number | undefined;
  isRunning(): boolean;
  isSubmitted(): boolean;
  isExamActive(): boolean;
  answeredCount(): number;
  flaggedCount(): number;
  canHint(): boolean;
}

function collectQuestions(block: AssessmentBlock): AssessmentQuestionInfo[] {
  const out: AssessmentQuestionInfo[] = [];
  let index = 0;
  for (const section of block.sections) {
    section.questions.forEach((question, sectionIndex) => {
      out.push({
        id: question.id,
        sectionId: section.id,
        index,
        sectionIndex,
        marks: question.marks,
        kind: question.kind,
      });
      index += 1;
    });
  }
  return out;
}

function cloneState(state: AssessmentState): AssessmentState {
  return {
    ...state,
    answers: { ...state.answers },
    flags: [...state.flags],
    visited: [...state.visited],
  };
}

function normalizeState(state: AssessmentState): AssessmentState {
  return cloneState(AssessmentStateSchema.parse(state));
}

/** Hints are a practice-only affordance (§6.8). */
export function hintsAllowed(mode: AssessmentMode): boolean {
  return mode === 'practice';
}

/** Feedback is hidden in exam mode until review (§6.8). */
export function feedbackAllowed(mode: AssessmentMode): boolean {
  return mode !== 'exam';
}

/** Exam mode is distraction-free until submit (§6.8). */
export function isExamMode(mode: AssessmentMode, submitted: boolean): boolean {
  return mode === 'exam' && !submitted;
}

export function createAssessmentMachine(options: AssessmentMachineOptions): AssessmentMachine {
  const clock = options.clock ?? systemClock;
  const block = options.block;
  const questions = collectQuestions(block);
  const questionById = new Map(questions.map(question => [question.id, question]));
  const firstQuestion = questions[0]?.id;
  const countdown = block.timer?.kind === 'countdown' ? block.timer : undefined;

  let state: AssessmentState;
  if (options.initialState) {
    state = normalizeState(options.initialState);
  } else {
    state = {
      id: block.id,
      mode: block.mode,
      answers: {},
      flags: [],
      visited: firstQuestion ? [firstQuestion] : [],
      currentQuestionId: firstQuestion,
      timerRemainingMs: countdown ? countdown.seconds * 1000 : undefined,
    };
  }
  if (state.currentQuestionId === undefined && firstQuestion) state.currentQuestionId = firstQuestion;

  let running = false;
  let deadline: number | undefined;
  let remaining = state.timerRemainingMs;
  let timeoutFired = false;
  const warningsFired = new Set<number>();

  const emit = () => options.onChange?.(cloneState(state));

  const update = (next: AssessmentState): AssessmentState => {
    state = next;
    emit();
    return cloneState(state);
  };

  const isSubmitted = () => state.submittedAt !== undefined;

  const remainingNow = (): number | undefined => {
    if (!countdown) return undefined;
    if (!running || deadline === undefined) return remaining;
    return Math.max(0, deadline - clock.now());
  };

  const startTimer = () => {
    if (!countdown || running || timeoutFired) return;
    if (remainsOrZero() === 0) {
      timeoutFired = true;
      return;
    }
    deadline = clock.now() + remainsOrZero();
    running = true;
  };

  const remainsOrZero = (): number => {
    if (remaining !== undefined) return remaining;
    return countdown ? countdown.seconds * 1000 : 0;
  };

  const machine: AssessmentMachine = {
    id: block.id,
    block,
    questions,

    getState: () => cloneState(state),
    snapshot: () => cloneState(state),

    start() {
      if (state.startedAt !== undefined) {
        startTimer();
        return cloneState(state);
      }
      const now = clock.now();
      if (countdown) remaining = countdown.seconds * 1000;
      state = {
        ...state,
        startedAt: now,
        timerRemainingMs: countdown ? remaining : undefined,
      };
      startTimer();
      return update(state);
    },

    restore(nextState) {
      state = normalizeState(nextState);
      running = false;
      deadline = undefined;
      remaining = state.timerRemainingMs ?? (countdown ? countdown.seconds * 1000 : undefined);
      timeoutFired = state.submittedAt !== undefined;
      warningsFired.clear();
      return cloneState(state);
    },

    setMode(mode) {
      if (mode === state.mode) return true;
      const submitted = isSubmitted();
      if (state.mode === 'review') return false;
      if (state.mode === 'exam') {
        if (mode === 'review') {
          if (!submitted) return false;
          running = false;
          update({ ...state, mode, timerRemainingMs: remainingNow() ?? state.timerRemainingMs });
          return true;
        }
        return false;
      }
      if (mode === 'review' && !submitted) return false;
      update({ ...state, mode });
      return true;
    },

    answer(questionId, value) {
      if (!questionById.has(questionId)) return false;
      if (isSubmitted()) return false;
      update({
        ...state,
        answers: { ...state.answers, [questionId]: value },
      });
      return true;
    },

    flag(questionId, flagged = true) {
      if (!questionById.has(questionId)) return false;
      if (block.allowFlag === false) return false;
      const flags = new Set(state.flags);
      if (flagged) flags.add(questionId);
      else flags.delete(questionId);
      update({ ...state, flags: [...flags] });
      return true;
    },

    navigate(questionId) {
      const target = questionById.get(questionId);
      if (!target) return false;
      const navigation = block.navigation ?? 'free';

      if (navigation === 'locked-after-answer' && state.currentQuestionId) {
        const current = state.currentQuestionId;
        if (current !== questionId && state.answers[current] === undefined) return false;
      }

      if (navigation === 'linear' && state.currentQuestionId) {
        const current = questionById.get(state.currentQuestionId);
        const furthestVisited = state.visited.reduce((max, id) => {
          const info = questionById.get(id);
          return info ? Math.max(max, info.index) : max;
        }, 0);
        if (current && target.index > furthestVisited + 1) return false;
      }

      const visited = state.visited.includes(questionId)
        ? state.visited
        : [...state.visited, questionId];
      update({ ...state, currentQuestionId: questionId, visited });
      return true;
    },

    submit() {
      if (isSubmitted()) return cloneState(state);
      const now = clock.now();
      running = false;
      const remainingAtSubmit = remainingNow();
      if (remainingAtSubmit !== undefined) remaining = remainingAtSubmit;
      return update({
        ...state,
        submittedAt: now,
        timerRemainingMs: remainingAtSubmit ?? state.timerRemainingMs,
      });
    },

    extendTime(ms) {
      if (!countdown || !Number.isFinite(ms) || ms <= 0) return cloneState(state);
      remaining = remainsOrZero() + ms;
      if (running && deadline !== undefined) deadline += ms;
      return update({ ...state, timerRemainingMs: remaining });
    },

    pause() {
      if (!countdown || !running) return cloneState(state);
      remaining = remainingNow() ?? remaining;
      running = false;
      deadline = undefined;
      return update({ ...state, timerRemainingMs: remaining });
    },

    resume() {
      if (!countdown || running || isSubmitted() || timeoutFired) return cloneState(state);
      startTimer();
      return cloneState(state);
    },

    tick() {
      if (!countdown || isSubmitted()) return { warnings: [], timedOut: false, remainingMs: remainingNow() };
      const ms = remainingNow() ?? 0;
      const warnings: number[] = [];
      const thresholds = [...(countdown.warnAtSeconds ?? [])].sort((a, b) => b - a);
      for (const seconds of thresholds) {
        if (ms <= seconds * 1000 && !warningsFired.has(seconds)) {
          warningsFired.add(seconds);
          warnings.push(seconds);
          options.onWarning?.(seconds);
        }
      }
      let timedOut = false;
      if (ms <= 0 && !timeoutFired) {
        timeoutFired = true;
        running = false;
        timedOut = true;
        remaining = 0;
        state = { ...state, timerRemainingMs: 0 };
        emit();
        options.onTimeout?.();
      }
      if (running && remaining !== ms) {
        remaining = ms;
        state = { ...state, timerRemainingMs: ms };
        emit();
      }
      return { warnings, timedOut, remainingMs: ms };
    },

    remainingMs: remainingNow,
    isRunning: () => running,
    isSubmitted,
    isExamActive: () => isExamMode(state.mode, isSubmitted()),
    answeredCount: () => Object.keys(state.answers).length,
    flaggedCount: () => state.flags.length,
    canHint: () => hintsAllowed(state.mode) && !isSubmitted(),
  };

  return machine;
}

// ---------------------------------------------------------------------------
// Exam-mode locks (§6.8)
// ---------------------------------------------------------------------------

export interface ExamLockPolicy {
  camera: boolean;
  ambience: boolean;
  theme: boolean;
  layout: boolean;
  kinetic: boolean;
}

export const DEFAULT_EXAM_LOCKS: ExamLockPolicy = {
  camera: true,
  ambience: true,
  theme: true,
  layout: true,
  kinetic: true,
};

/** Locks are active while any running assessment is in exam mode. */
export function examLocksFor(
  assessments: AssessmentState[],
  policy: Partial<ExamLockPolicy> = {},
): ExamLockPolicy {
  const active = assessments.some(a => isExamMode(a.mode, a.submittedAt !== undefined));
  if (!active) {
    return { camera: false, ambience: false, theme: false, layout: false, kinetic: false };
  }
  return { ...DEFAULT_EXAM_LOCKS, ...policy };
}

/** True when this op is blocked by an active exam lock. */
export function isOpLockedByExam(op: Op, locks: ExamLockPolicy): boolean {
  switch (op.op) {
    case 'camera':
      return locks.camera;
    case 'theme':
      return locks.theme || locks.ambience;
    case 'layout':
      return locks.layout;
    default:
      return false;
  }
}

export interface ExamLockResult {
  /** Ops safe to apply now. */
  accepted: Op[];
  /** Ops held back until submit (queue strategy). */
  queued: Op[];
  /** Ops rejected outright (reject strategy). */
  rejected: Op[];
}

/**
 * Apply exam locks to a batch of ops. The default queues presentation ops
 * until submit (§6.8); a host may choose to reject them instead.
 */
export function applyExamLocks(
  ops: Op[],
  locks: ExamLockPolicy,
  strategy: 'queue' | 'reject' = 'queue',
): ExamLockResult {
  const accepted: Op[] = [];
  const queued: Op[] = [];
  const rejected: Op[] = [];
  for (const op of ops) {
    if (!isOpLockedByExam(op, locks)) {
      accepted.push(op);
      continue;
    }
    if (strategy === 'queue') queued.push(op);
    else rejected.push(op);
  }
  return { accepted, queued, rejected };
}
