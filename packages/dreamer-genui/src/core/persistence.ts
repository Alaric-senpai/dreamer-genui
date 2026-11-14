import type { BoardState } from './types';
import type { Op } from '../schema/ops';
import type { AssessmentState } from '../schema/assessment';
import { boardReducer, back as reduceBack, closeDetour as reduceCloseDetour, createBoard, setAssessmentState } from './reducer';

/**
 * Persistence and replay (§7.3). Snapshots and ops logs are versioned,
 * JSON-serializable data; the library never touches storage itself.
 */

export const SNAPSHOT_VERSION = 1;
export const OPS_LOG_VERSION = 1;

export interface BoardSnapshotFile {
  v: number;
  state: BoardState;
}

export type SnapshotMigration = (state: unknown, fromVersion: number) => unknown;
export type SnapshotMigrations = Record<number, SnapshotMigration>;

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON for values structuredClone rejects (never
      // expected for board state, which is JSON-serializable by contract).
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Create a versioned, JSON-serializable board snapshot. */
export function createBoardSnapshot(state: BoardState): BoardSnapshotFile {
  return { v: SNAPSHOT_VERSION, state: clone(state) };
}

/**
 * Rehydrate a snapshot. Migrations run for every version step from the
 * snapshot's version up to `SNAPSHOT_VERSION`. Unknown future versions throw a
 * descriptive error rather than silently corrupting the board.
 */
export function restoreBoardSnapshot(
  snapshot: BoardSnapshotFile,
  migrations: SnapshotMigrations = {},
): BoardState {
  const version = snapshot.v;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid snapshot version: ${String(snapshot.v)}`);
  }
  if (version > SNAPSHOT_VERSION) {
    throw new Error(
      `Snapshot version ${version} is newer than this library supports (${SNAPSHOT_VERSION})`,
    );
  }
  let state: unknown = clone(snapshot.state);
  for (let from = version; from < SNAPSHOT_VERSION; from += 1) {
    const migration = migrations[from];
    if (!migration) continue;
    state = migration(state, from);
  }
  return ensureBoardShape(state);
}

/** Apply the migration chain without restoring, for diagnostics and tests. */
export function migrateSnapshot(
  snapshot: BoardSnapshotFile,
  migrations: SnapshotMigrations = {},
): BoardSnapshotFile {
  return { v: SNAPSHOT_VERSION, state: restoreBoardSnapshot(snapshot, migrations) };
}

/** Fill fields introduced by later versions so old snapshots still load. */
function ensureBoardShape(value: unknown): BoardState {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Snapshot state is not an object');
  }
  const candidate = value as Partial<BoardState>;
  if (typeof candidate.id !== 'string' || typeof candidate.nodes !== 'object' || candidate.nodes === null) {
    throw new Error('Snapshot state is missing board id or nodes');
  }
  return {
    ...(candidate as BoardState),
    history: candidate.history ?? [],
    detours: candidate.detours ?? [],
    layout: candidate.layout ?? { kind: 'flow' },
    assessments: candidate.assessments ?? {},
    firedCues: candidate.firedCues ?? [],
    firedEvents: candidate.firedEvents ?? {},
    flushed: candidate.flushed ?? false,
  };
}

// ---------------------------------------------------------------------------
// Ops log
// ---------------------------------------------------------------------------

export interface OpsLogEntryBase {
  /** Milliseconds since `startedAt` (the log's relative timeline). */
  t: number;
}

export type OpsLogEntry = OpsLogEntryBase &
  (
    | { type: 'op'; op: Op }
    | { type: 'cue'; id: string }
    | { type: 'flush' }
    | { type: 'back' }
    | { type: 'detour-return' }
    | { type: 'assessment'; assessmentId: string; state: AssessmentState }
  );

export interface OpsLog {
  v: number;
  /** Epoch ms of the first entry (0 when the host does not supply a clock). */
  startedAt: number;
  entries: OpsLogEntry[];
}

export function createOpsLog(startedAt = 0): OpsLog {
  return { v: OPS_LOG_VERSION, startedAt, entries: [] };
}

function append(log: OpsLog, entry: OpsLogEntry): OpsLog {
  log.entries.push(entry);
  return log;
}

/** Append one op; timestamp is relative to the log's `startedAt`. */
export function appendOp(log: OpsLog, op: Op, at: number): OpsLog {
  return append(log, { t: Math.max(0, at - log.startedAt), type: 'op', op });
}

export function appendCue(log: OpsLog, id: string, at: number): OpsLog {
  return append(log, { t: Math.max(0, at - log.startedAt), type: 'cue', id });
}

export function appendFlush(log: OpsLog, at: number): OpsLog {
  return append(log, { t: Math.max(0, at - log.startedAt), type: 'flush' });
}

export function appendBack(log: OpsLog, at: number): OpsLog {
  return append(log, { t: Math.max(0, at - log.startedAt), type: 'back' });
}

export function appendDetourReturn(log: OpsLog, at: number): OpsLog {
  return append(log, { t: Math.max(0, at - log.startedAt), type: 'detour-return' });
}

export function appendAssessmentState(
  log: OpsLog,
  assessmentId: string,
  state: AssessmentState,
  at: number,
): OpsLog {
  return append(log, {
    t: Math.max(0, at - log.startedAt),
    type: 'assessment',
    assessmentId,
    state: clone(state),
  });
}

/**
 * Replay an ops log synchronously into a board state. Used for resume,
 * debugging and demos; a host that wants the original pacing can use
 * `replayTimeline` and apply entries on its own clock.
 */
export function replayLog(
  log: OpsLog,
  options: { base?: BoardState; migrate?: (log: OpsLog) => OpsLog } = {},
): BoardState {
  const effective = options.migrate ? options.migrate(log) : log;
  let state = options.base ? clone(options.base) : createBoard();
  const entries = [...effective.entries].sort((a, b) => a.t - b.t);
  for (const entry of entries) {
    switch (entry.type) {
      case 'op':
        state = boardReducer(state, entry.op);
        break;
      case 'cue':
        if (!state.firedCues.includes(entry.id)) {
          state = { ...state, firedCues: [...state.firedCues, entry.id] };
        }
        break;
      case 'flush':
        state = { ...state, flushed: true };
        break;
      case 'back':
        state = reduceBack(state);
        break;
      case 'detour-return':
        state = reduceCloseDetour(state);
        break;
      case 'assessment':
        state = setAssessmentState(state, entry.assessmentId, entry.state);
        break;
    }
  }
  return state;
}

/** Timeline steps for host-driven replay. `speed` 2 = twice as fast. */
export function replayTimeline(log: OpsLog, speed = 1): Array<{ at: number; entry: OpsLogEntry }> {
  const factor = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return [...log.entries]
    .sort((a, b) => a.t - b.t)
    .map(entry => ({ at: entry.t / factor, entry }));
}
