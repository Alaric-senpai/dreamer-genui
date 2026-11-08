import { createError } from './errors';
import { EventBus } from './events';
import type { ResolvedOp, LibraryError, BoardState } from './types';
import type { UIEvent } from '../schema/events';
import { validateOp } from './validator';
import { boardReducer, back as reduceBack, createBoard } from './reducer';
import type { Registry } from './registry';
import { createRegistry } from './registry';
import type { Reply } from '../schema/envelope';
import type { Op } from '../schema/ops';

interface ResolverOptions {
  /** Registry used to resolve block types. Defaults to a fresh built-ins registry. */
  registry?: Registry;
  /** Called for errors (validation, unknown type...). Also routed to errorBus. */
  onError?: (err: LibraryError) => void;
}

/**
 * Headless board resolver: validates ops against the current state,
 * applies them through the pure reducer, and emits errors.
 *
 * Streaming-tolerant: `applyPartial` is idempotent — the same partial
 * applied twice keyed by op index + op content produces no duplicate effects.
 */
export class BoardResolver {
  private state: BoardState;
  private registry: Registry;
  private appliedKeys = new Set<string>();
  private readonly _events: EventBus<UIEvent>;
  private readonly _errors: EventBus<LibraryError>;
  private readonly onError?: (err: LibraryError) => void;

  constructor(options: ResolverOptions = {}) {
    this.registry = options.registry ?? createRegistry({ onError: options.onError });
    this.onError = options.onError;
    this._events = new EventBus<UIEvent>();
    this._errors = new EventBus<LibraryError>();
    this.state = createBoard();
  }

  /** Event bus emitting schema UIEvents. */
  get events(): EventBus<UIEvent> {
    return this._events;
  }

  /** Error bus emitting LibraryErrors { code, nodeId?, type?, detail? }. */
  get errors(): EventBus<LibraryError> {
    return this._errors;
  }

  /** Current (immutable) board state. */
  getState(): BoardState {
    return this.state;
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
  applyFinal(reply: Reply): ResolvedOp[] {
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
  applyPartial(reply: Reply): ResolvedOp[] {
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
  applyOps(reply: Reply): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    for (const rawOp of reply.ops) {
      results.push(this.validateApply(rawOp));
    }
    return results;
  }

  /** Pop the most recent history snapshot ("back to previous topic"). */
  back(): BoardState {
    this.state = reduceBack(this.state);
    return this.state;
  }

  /** Reset to an empty board. */
  reset(): void {
    this.state = createBoard();
    this.appliedKeys.clear();
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
      this.state = boardReducer(this.state, validated.op);
      return { op: validated.op, status: 'applied' };
    }
    const err = validated.error ?? createError('invalid-node', 'Validation failed');
    this._errors.emit(err);
    this.onError?.(err);
    return { op: rawOp as Op, status: 'error', error: err };
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
