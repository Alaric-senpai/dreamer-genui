import { createError } from './errors';
import { EventBus } from './events';
import type { ResolvedOp, LibraryError, BoardState, CameraMove } from './types';
import type { LayoutTransition } from '../schema/layout';
import type { UIEvent } from '../schema/events';
import { validateOp } from './validator';
import { boardReducer, back as reduceBack, createBoard, applyResolvedTheme, closeDetour as reduceCloseDetour, setAssessmentState } from './reducer';
import type { Registry } from './registry';
import { createRegistry } from './registry';
import { createThemeResolver, type ThemeContext, type ThemePolicy, type ResolvedTheme } from './theme';
import { computeEntryPlan, fireCue, flushAll, seekTo, signalEvent, newlyEntered, type EntryPlan, type Pacing } from './cues';
import {
  createAssessmentMachine,
  systemClock,
  type AssessmentMachine,
  type Clock,
} from './assessment';
import {
  appendAssessmentState,
  appendBack,
  appendCue,
  appendDetourReturn,
  appendFlush,
  appendOp,
  createBoardSnapshot,
  createOpsLog,
  replayLog,
  restoreBoardSnapshot,
  type BoardSnapshotFile,
  type OpsLog,
  type SnapshotMigrations,
} from './persistence';
import { createMiddlewarePipeline, type MiddlewarePipeline } from './middleware';
import type { MiddlewareDefinition } from './plugin';
import type { AssessmentBlock, AssessmentState } from '../schema/assessment';

import type { Op } from '../schema/ops';

export interface ResolverOptions {
  /** Registry used to resolve block types. Defaults to a fresh built-ins registry. */
  registry?: Registry;
  /** Called for errors (validation, unknown type...). Also routed to errorBus. */
  onError?: (err: LibraryError) => void;
  /** Theme policy + allowlists + optional host baseline (§6.8). */
  theme?: Partial<ThemeContext>;
  /** Extra op/event/theme middleware (§8.6), in addition to registered ones. */
  middleware?: MiddlewareDefinition[];
  /** Locale/direction forwarded to middleware context. */
  locale?: string;
  dir?: 'ltr' | 'rtl';
  /** Clock for ops-log timestamps and assessment timers (injectable in tests). */
  clock?: Clock;
}

/** Host API for assessment state machines (§6.8). */
export interface BoardAssessments {
  /** Get (or lazily create) the machine for an assessment node id. */
  get(id: string): AssessmentMachine | undefined;
  /** Current persisted state for an assessment id. */
  snapshot(id: string): AssessmentState | undefined;
  /** Restore an autosaved state (reload/crash recovery). */
  restore(id: string, state: AssessmentState): AssessmentState | undefined;
  /** Assessment node ids on the board. */
  list(): string[];
}

/** The loose wire shape accepted by apply* — anything Zod can parse as a Reply. */
export interface ReplyLike {
  v?: number;
  ops: readonly unknown[];
}

/**
 * Headless board resolver: validates ops against the current state,
 * applies them through the pure reducer, and emits errors.
 *
 * Owns the cue-engine entry plan: after every state change it diffs the
 * entered set and emits `onEnter(nodeId)` on the enter bus; `cue()`/`flush()`/
 * `seek()` drive the fired-cue set; UIEvents satisfy event triggers.
 *
 * Streaming-tolerant: `applyPartial` is idempotent — the same partial
 * applied twice keyed by op index + op content produces no duplicate effects.
 */
export class BoardResolver {
  private state: BoardState;
  private registry: Registry;
  private appliedKeys = new Set<string>();
  private readonly resolveTheme: (spec: import('../schema/theme').ThemeSpec) => ReturnType<ReturnType<typeof createThemeResolver>>;
  private readonly _events: EventBus<UIEvent>;
  private readonly _errors: EventBus<LibraryError>;
  private readonly _cueBus: EventBus<string>;
  private readonly _enterBus: EventBus<string>;
  private readonly _themeChangeBus: EventBus<ResolvedTheme>;
  private readonly _cameraBus: EventBus<CameraMove>;
  private readonly _layoutBus: EventBus<LayoutTransition>;
  private entryPlan: EntryPlan = { entered: [], pending: [], pendingCues: [] };
  private readonly onError?: (err: LibraryError) => void;
  private readonly pipeline?: MiddlewarePipeline;
  private readonly clock: Clock;
  private opsLog: OpsLog;
  private readonly machines = new Map<string, AssessmentMachine>();

  constructor(options: ResolverOptions = {}) {
    this.registry = options.registry ?? createRegistry({ onError: options.onError });
    this.onError = options.onError;
    this.clock = options.clock ?? systemClock;
    this.opsLog = createOpsLog(this.clock.now());
    const registeredMiddleware = this.registry.listMiddleware();
    const extraMiddleware = options.middleware ?? [];
    if (registeredMiddleware.length > 0 || extraMiddleware.length > 0) {
      this.pipeline = createMiddlewarePipeline([...registeredMiddleware, ...extraMiddleware], {
        registry: this.registry,
        locale: options.locale ?? 'en',
        dir: options.dir ?? 'ltr',
        onError: err => this.reportError(err),
      });
    }
    const themeContext: ThemeContext = {
      policy: options.theme?.policy ?? ('moods' as ThemePolicy),
      allowedMoods: options.theme?.allowedMoods,
      allowedAmbience: options.theme?.allowedAmbience,
      allowedFonts: options.theme?.allowedFonts,
      baseline: options.theme?.baseline,
      onThemeAdjusted: options.theme?.onThemeAdjusted,
    };
    this.resolveTheme = createThemeResolver(this.registry, themeContext);
    this._events = new EventBus<UIEvent>();
    this._errors = new EventBus<LibraryError>();
    this._cueBus = new EventBus<string>();
    this._enterBus = new EventBus<string>();
    this._themeChangeBus = new EventBus<ResolvedTheme>();
    this._cameraBus = new EventBus<CameraMove>();
    this._layoutBus = new EventBus<LayoutTransition>();
    this.state = createBoard();
    // UIEvents from rendered components satisfy event triggers (§6.2).
    this._events.subscribe(ev => this.signalEvent(ev));
  }

  /** Event bus emitting schema UIEvents. */
  get events(): EventBus<UIEvent> {
    return this._events;
  }

  /** Error bus emitting LibraryErrors { code, nodeId?, type?, detail? }. */
  get errors(): EventBus<LibraryError> {
    return this._errors;
  }

  /** Cue bus: fires whenever board.cue(id) is called (host sync, §6.3). */
  get cueBus(): EventBus<string> {
    return this._cueBus;
  }

  /** Enter bus: emits node ids as their entry gate opens (§6.3 onEnter). */
  get enterBus(): EventBus<string> {
    return this._enterBus;
  }

  /** Theme-change bus: emits the resolved theme whenever it changes (§6.8). */
  get themeChangeBus(): EventBus<ResolvedTheme> {
    return this._themeChangeBus;
  }

  /** Camera bus: validated explicit camera ops, presentation-only (§6.10). */
  get cameraBus(): EventBus<CameraMove> {
    return this._cameraBus;
  }

  /** Layout-op bus: the renderer animates the re-flow with these knobs (§6.4). */
  get layoutBus(): EventBus<LayoutTransition> {
    return this._layoutBus;
  }

  /** Current (immutable) board state. */
  getState(): BoardState {
    return this.state;
  }

  /** Host API for assessment state machines (§6.8). */
  get assessments(): BoardAssessments {
    return {
      get: id => this.machineFor(id),
      snapshot: id => this.machineFor(id)?.snapshot(),
      restore: (id, state) => this.machineFor(id)?.restore(state),
      list: () =>
        Object.entries(this.state.nodes)
          .filter(([, node]) => node.block.type === 'assessment')
          .map(([id]) => id),
    };
  }

  /** Versioned, JSON-serializable snapshot of the full board (§7.3). */
  snapshot(): BoardSnapshotFile {
    return createBoardSnapshot(this.state);
  }

  /** Rehydrate a snapshot without replaying entrances (§7.3). */
  restore(snapshot: BoardSnapshotFile, migrations?: SnapshotMigrations): BoardState {
    this.state = restoreBoardSnapshot(snapshot, migrations);
    this.appliedKeys.clear();
    this.machines.clear();
    this.refreshEntry(true);
    return this.state;
  }

  /** Ops log with relative timestamps for replay/resume and demos (§7.3). */
  exportOps(): OpsLog {
    return JSON.parse(JSON.stringify(this.opsLog)) as OpsLog;
  }

  /** Replay an ops log synchronously into a settled board state (§7.3). */
  replay(
    log: OpsLog,
    options: { base?: BoardState; migrate?: (log: OpsLog) => OpsLog } = {},
  ): BoardState {
    this.state = replayLog(log, options);
    this.appliedKeys.clear();
    this.machines.clear();
    this.refreshEntry(true);
    return this.state;
  }

  /** Current entry plan (entered/pending/pending-cues) for the given pacing. */
  getEntry(pacing: Pacing = 'cued'): EntryPlan {
    return computeEntryPlan(this.state, pacing);
  }

  /**
   * Apply the final, complete Reply after a streaming session.
   *
   * Ledger-aware: ops that were already applied via `applyPartial` (same
   * index + same content) are skipped, so the canonical flow
   * `partials → final` never produces duplicate nodes or duplicate-id errors.
   * Ops that FAILED in a partial are retried here (the ledger key was never
   * added), which covers ops that only become valid once earlier ops applied.
   * The ledger is cleared afterwards.
   */
  applyFinal(reply: ReplyLike): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    reply.ops.forEach((rawOp, i) => {
      const key = `${i}:${hashOp(rawOp)}`;
      if (this.appliedKeys.has(key)) {
        results.push({ op: rawOp as Op, status: 'applied' });
        return;
      }
      const applied = this.validateApply(rawOp);
      results.push(applied);
      this.appliedKeys.add(key); // safe: after this the ledger is cleared anyway
    });
    this.appliedKeys.clear();
    return results;
  }

  /**
   * Apply a partial Reply during streaming.
   * Idempotent: applying the same ops array twice produces no duplicate nodes
   * (each entry keyed by "index:contentHash").
   * An op that FAILS validation is NOT recorded in the ledger and is retried
   * on the next partial (or the final reply) — correct for streaming, where an
   * attach may reference a target that only exists once an earlier op applies.
   */
  applyPartial(reply: ReplyLike): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    reply.ops.forEach((rawOp, i) => {
      const key = `${i}:${hashOp(rawOp)}`;
      if (this.appliedKeys.has(key)) {
        results.push({ op: rawOp as Op, status: 'applied' });
        return;
      }
      const applied = this.validateApply(rawOp);
      if (applied.status === 'applied') this.appliedKeys.add(key);
      results.push(applied);
    });
    return results;
  }

  /** Apply a full Reply without consulting or clearing the streaming ledger. */
  applyOps(reply: ReplyLike): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    for (const rawOp of reply.ops) {
      results.push(this.validateApply(rawOp));
    }
    return results;
  }

  /** Pop the most recent history snapshot ("back to previous topic"). */
  back(): BoardState {
    this.state = reduceBack(this.state);
    this.machines.clear();
    appendBack(this.opsLog, this.clock.now());
    this.refreshEntry();
    return this.state;
  }

  /** Close the top detour (built-in return control). The detour theme reverts with it. */
  closeDetour(): BoardState {
    this.state = reduceCloseDetour(this.state);
    appendDetourReturn(this.opsLog, this.clock.now());
    this.refreshEntry();
    return this.state;
  }

  /** Reset to an empty board. */
  reset(): void {
    this.state = createBoard();
    this.appliedKeys.clear();
    this.machines.clear();
    this.opsLog = createOpsLog(this.clock.now());
    this.refreshEntry(true);
  }

  /** Fire a narration cue (§6.3): nodes waiting on it enter. */
  cue(cueId: string): void {
    this._cueBus.emit(cueId);
    this.state = fireCue(this.state, cueId);
    appendCue(this.opsLog, cueId, this.clock.now());
    this.refreshEntry();
  }

  /** Skip control: everything pending enters immediately. */
  flush(): void {
    this.state = flushAll(this.state);
    appendFlush(this.opsLog, this.clock.now());
    this.refreshEntry();
  }

  /** Fire every cue up to and including cueId (document order), instantly. */
  seek(cueId: string): void {
    const before = new Set(this.state.firedCues);
    this.state = seekTo(this.state, cueId);
    for (const fired of this.state.firedCues) {
      if (!before.has(fired)) appendCue(this.opsLog, fired, this.clock.now());
    }
    this.refreshEntry();
  }

  /** Record a UIEvent for event-trigger gates (wired from the events bus). */
  signalEvent(ev: UIEvent): void {
    const next = signalEvent(this.state, ev);
    if (next !== this.state) {
      this.state = next;
      this.refreshEntry();
    }
  }

  /** Recompute the entry plan; emit onEnter for newly entered nodes. */
  private refreshEntry(silent = false): void {
    const next = computeEntryPlan(this.state);
    if (!silent) {
      for (const id of newlyEntered(this.entryPlan, next)) {
        this._enterBus.emit(id);
      }
    }
    this.entryPlan = next;
  }

  /** Lazily create and cache the machine for an assessment node. */
  private machineFor(id: string): AssessmentMachine | undefined {
    const cached = this.machines.get(id);
    if (cached) return cached;
    const block = this.state.nodes[id]?.block;
    if (!block || block.type !== 'assessment') return undefined;
    const machine = createAssessmentMachine({
      block: block as AssessmentBlock,
      clock: this.clock,
      initialState: this.state.assessments[id],
      onChange: state => {
        this.state = setAssessmentState(this.state, id, state);
        appendAssessmentState(this.opsLog, id, state, this.clock.now());
        this.refreshEntry();
      },
    });
    this.machines.set(id, machine);
    return machine;
  }

  private reportError(err: LibraryError): void {
    this._errors.emit(err);
    this.onError?.(err);
  }

  private validateApply(rawOp: unknown): ResolvedOp {
    if (!this.pipeline) return this.applySingle(rawOp);
    const ops = this.pipeline.applyOpsSync([rawOp as Op]);
    if (ops.length === 0) return { op: rawOp as Op, status: 'applied' };
    let first: ResolvedOp | undefined;
    for (const op of ops) {
      const result = this.applySingle(op);
      first ??= result;
    }
    return first ?? { op: rawOp as Op, status: 'applied' };
  }

  private applySingle(rawOp: unknown): ResolvedOp {
    // Registry precheck BEFORE the schema parse: an unknown block type must
    // surface as `unknown-type`, not as a generic Zod `invalid-node`. (Per-node
    // full registry resolution — schema-per-type, loader kickoff, skeletons —
    // is wired in M3; see DECISIONS.md M2 ruling on the registry/resolver split.)
    const unknownType = this.precheckBlockTypes(rawOp);
    if (unknownType) {
      this.reportError(unknownType);
      return { op: rawOp as Op, status: 'error', error: unknownType };
    }
    const validated = validateOp(this.state, rawOp);
    if (validated.valid && validated.op) {
      for (const warning of validated.warnings ?? []) {
        this.reportError(warning);
      }
      this.state = boardReducer(this.state, validated.op);
      appendOp(this.opsLog, validated.op, this.clock.now());
      if (validated.op.op === 'replace') this.machines.clear();
      if (validated.op.op === 'remove') this.machines.delete(validated.op.id);
      this.applyThemeSide(validated.op);
      if (validated.op.op === 'camera') {
        // Presentation-only (§6.10): validated here, executed by the renderer.
        this._cameraBus.emit({
          to: validated.op.to ?? 'overview',
          zoom: validated.op.zoom,
          duration: validated.op.duration,
          ease: validated.op.ease,
        });
      }
      if (validated.op.op === 'layout') {
        // The renderer animates the re-flow (§6.4); the op's transition knobs
        // travel with the event so the reducer state stays pure protocol data.
        this._layoutBus.emit(validated.op.transition ?? {});
      }
      const result: ResolvedOp = { op: validated.op, status: 'applied' };
      if (validated.warnings?.length) result.error = validated.warnings[0];
      this.refreshEntry();
      return result;
    }
    const err = validated.error ?? createError('invalid-node', 'Validation failed');
    this.reportError(err);
    return { op: rawOp as Op, status: 'error', error: err };
  }

  /**
   * Theme parts of applied ops: `theme` ops and `theme` on attach/replace go
   * through policy resolution here (the pure reducer only sees ResolvedTheme).
   * Rejections keep the previous theme and surface as warnings.
   */
  private applyThemeSide(op: Op): ResolvedTheme | undefined {
    const rawSpec =
      op.op === 'theme' ? op.theme :
      op.op === 'replace' ? op.theme :
      op.op === 'attach' ? op.theme :
      undefined;
    if (!rawSpec) return undefined;
    const spec = (this.pipeline ? this.pipeline.applyThemeSync(rawSpec) : rawSpec) as typeof rawSpec;

    const resolution = this.resolveTheme(spec);
    for (const warning of resolution.warnings) {
      this.reportError(warning);
    }
    if (!resolution.theme) return undefined;

    // §6.1: theme on an `attach` op is scoped to the detour (reverts on
    // return); theme ops carry their own scope; replace themes the new board.
    const scope =
      op.op === 'theme' ? ((op.scope ?? 'board') as 'board' | 'detour') :
      op.op === 'attach' ? 'detour' :
      'board';
    this.state = applyResolvedTheme(this.state, resolution.theme, scope);
    if (scope === 'board') this._themeChangeBus.emit(resolution.theme);
    return resolution.theme;
  }

  private precheckBlockTypes(rawOp: unknown): LibraryError | undefined {
    if (typeof rawOp !== 'object' || rawOp === null) return undefined;
    const blocks = (rawOp as { blocks?: unknown }).blocks;
    if (!Array.isArray(blocks)) return undefined;
    for (const block of blocks) {
      if (typeof block !== 'object' || block === null) continue;
      const rec = block as { type?: unknown; id?: unknown };
      if (typeof rec.type === 'string' && !this.registry.getManifest(rec.type)) {
        const nodeId = typeof rec.id === 'string' ? rec.id : undefined;
        return createError('unknown-type', `Unknown block type: ${rec.type}`, nodeId, rec.type);
      }
    }
    return undefined;
  }
}

function hashOp(op: unknown): string {
  return djb2(JSON.stringify(op));
}

/** djb2 string hash over the full serialized op — no prefix truncation, so
 *  distinct ops collide only with astronomically small probability (2^32 per pair). */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
