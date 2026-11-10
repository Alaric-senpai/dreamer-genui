import { createError } from './errors';
import { EventBus } from './events';
import type { ResolvedOp, LibraryError, BoardState } from './types';
import type { UIEvent } from '../schema/events';
import { validateOp } from './validator';
import { boardReducer, back as reduceBack, createBoard, applyResolvedTheme } from './reducer';
import type { Registry } from './registry';
import { createRegistry } from './registry';
import { createThemeResolver, type ThemeContext, type ThemePolicy, type ResolvedTheme } from './theme';
import { computeEntryPlan, fireCue, flushAll, seekTo, signalEvent, newlyEntered, type EntryPlan, type Pacing } from './cues';

import type { Op } from '../schema/ops';

export interface ResolverOptions {
  /** Registry used to resolve block types. Defaults to a fresh built-ins registry. */
  registry?: Registry;
  /** Called for errors (validation, unknown type...). Also routed to errorBus. */
  onError?: (err: LibraryError) => void;
  /** Theme policy + allowlists + optional host baseline (§6.8). */
  theme?: Partial<ThemeContext>;
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
  private entryPlan: EntryPlan = { entered: [], pending: [], pendingCues: [] };
  private readonly onError?: (err: LibraryError) => void;

  constructor(options: ResolverOptions = {}) {
    this.registry = options.registry ?? createRegistry({ onError: options.onError });
    this.onError = options.onError;
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

  /** Current (immutable) board state. */
  getState(): BoardState {
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
    this.refreshEntry();
    return this.state;
  }

  /** Reset to an empty board. */
  reset(): void {
    this.state = createBoard();
    this.appliedKeys.clear();
    this.refreshEntry();
  }

  /** Fire a narration cue (§6.3): nodes waiting on it enter. */
  cue(cueId: string): void {
    this._cueBus.emit(cueId);
    this.state = fireCue(this.state, cueId);
    this.refreshEntry();
  }

  /** Skip control: everything pending enters immediately. */
  flush(): void {
    this.state = flushAll(this.state);
    this.refreshEntry();
  }

  /** Fire every cue up to and including cueId (document order), instantly. */
  seek(cueId: string): void {
    this.state = seekTo(this.state, cueId);
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
  private refreshEntry(): void {
    const next = computeEntryPlan(this.state);
    for (const id of newlyEntered(this.entryPlan, next)) {
      this._enterBus.emit(id);
    }
    this.entryPlan = next;
  }

  private validateApply(rawOp: unknown): ResolvedOp {
    // Registry precheck BEFORE the schema parse: an unknown block type must
    // surface as `unknown-type`, not as a generic Zod `invalid-node`. (Per-node
    // full registry resolution — schema-per-type, loader kickoff, skeletons —
    // is wired in M3; see DECISIONS.md M2 ruling on the registry/resolver split.)
    const unknownType = this.precheckBlockTypes(rawOp);
    if (unknownType) {
      this._errors.emit(unknownType);
      this.onError?.(unknownType);
      return { op: rawOp as Op, status: 'error', error: unknownType };
    }
    const validated = validateOp(this.state, rawOp);
    if (validated.valid && validated.op) {
      for (const warning of validated.warnings ?? []) {
        this._errors.emit(warning);
        this.onError?.(warning);
      }
      this.state = boardReducer(this.state, validated.op);
      this.applyThemeSide(validated.op);
      const result: ResolvedOp = { op: validated.op, status: 'applied' };
      if (validated.warnings?.length) result.error = validated.warnings[0];
      this.refreshEntry();
      return result;
    }
    const err = validated.error ?? createError('invalid-node', 'Validation failed');
    this._errors.emit(err);
    this.onError?.(err);
    return { op: rawOp as Op, status: 'error', error: err };
  }

  /**
   * Theme parts of applied ops: `theme` ops and `theme` on attach/replace go
   * through policy resolution here (the pure reducer only sees ResolvedTheme).
   * Rejections keep the previous theme and surface as warnings.
   */
  private applyThemeSide(op: Op): ResolvedTheme | undefined {
    const spec =
      op.op === 'theme' ? op.theme :
      op.op === 'replace' ? op.theme :
      op.op === 'attach' ? op.theme :
      undefined;
    if (!spec) return undefined;

    const resolution = this.resolveTheme(spec);
    for (const warning of resolution.warnings) {
      this._errors.emit(warning);
      this.onError?.(warning);
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
