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
import type { Block } from '../schema/blocks';

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

  /** Apply a complete Reply. Clears the streaming idempotency ledger. */
  applyFinal(reply: Reply): ResolvedOp[] {
    const results = this.applyOps(reply);
    this.appliedKeys.clear();
    return results;
  }

  /**
   * Apply a partial Reply during streaming.
   * Idempotent: applying the same ops array twice produces no duplicate nodes
   * (each entry keyed by "index:contentHash").
   */
  applyPartial(reply: Reply): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    reply.ops.forEach((rawOp, i) => {
      const key = `${i}:${hashOp(rawOp)}`;
      if (this.appliedKeys.has(key)) {
        results.push({ op: rawOp as Op, status: 'applied' });
        return;
      }
      const validated = this.validateAndEmitError(rawOp);
      if (!validated.op) {
        results.push({ op: rawOp as Op, status: 'error', error: validated.error });
        return;
      }
      this.state = boardReducer(this.state, validated.op);
      this.appliedKeys.add(key);
      results.push({ op: validated.op, status: 'applied' });
    });
    return results;
  }

  /** Apply a full Reply without clearing the streaming ledger. */
  applyOps(reply: Reply): ResolvedOp[] {
    const results: ResolvedOp[] = [];
    for (const rawOp of reply.ops) {
      const validated = this.validateAndEmitError(rawOp);
      if (!validated.op) {
        results.push({ op: rawOp as Op, status: 'error', error: validated.error });
        continue;
      }
      this.state = boardReducer(this.state, validated.op);
      results.push({ op: validated.op, status: 'applied' });
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

  private validateAndEmitError(rawOp: unknown): { op?: Op; error?: LibraryError } {
    const validated = validateOp(this.state, rawOp);
    if (validated.valid && validated.op) {
      return { op: validated.op };
    }
    const err = validated.error ?? createError('invalid-node', 'Validation failed');
    this._errors.emit(err);
    this.onError?.(err);
    return { error: err };
  }
}

function hashOp(op: unknown): string {
  const s = JSON.stringify(op);
  return `${s.length}:${s.slice(0, 120)}`;
}
