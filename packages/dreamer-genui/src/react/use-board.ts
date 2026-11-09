import { useMemo, useRef, useSyncExternalStore } from 'react';
import { BoardResolver } from '../core/resolver';
import type { BoardState, LibraryError, ResolvedOp } from '../core/types';
import type { UIEvent } from '../schema/events';
import type { Reply } from '../schema/envelope';

/** Structural bus surface exposed by the store — a buffering proxy fits this
 * without matching `EventBus`'s private internals. */
export interface EventSink<T> {
  subscribe(fn: (event: T) => void): () => void;
  emit(event: T): void;
  readonly size: number;
}

/**
 * React-facing wrapper around the headless BoardResolver.
 * Notifies subscribers whenever the board state changes, so
 * `useSyncExternalStore` can re-render `<Board>`.
 */
export interface BoardStore {
  getState(): BoardState;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
  /** Snapshot for useSyncExternalStore — a monotonically increasing version. */
  getVersion(): number;
  applyOps(reply: Reply): ResolvedOp[];
  applyPartial(reply: Reply): ResolvedOp[];
  applyFinal(reply: Reply): ResolvedOp[];
  back(): BoardState;
  reset(): void;
  /** UIEvents emitted by rendered components (focus/select/answer/action). */
  readonly events: EventSink<UIEvent>;
  /** Library errors (validation, unknown type...). Buffers pre-mount errors. */
  readonly errors: EventSink<LibraryError>;
}

export function createBoardStore(resolver: BoardResolver = new BoardResolver()): BoardStore {
  const listeners = new Set<() => void>();
  let version = 0;

  const notify = (): void => {
    version += 1;
    for (const fn of listeners) fn();
  };

  // Errors can be emitted before <Board> mounts and subscribes (hosts often
  // apply ops first). Buffer them until the first subscriber, then live.
  const pendingErrors: LibraryError[] = [];
  let errorsBuffered = true;
  resolver.errors.subscribe((err) => {
    if (errorsBuffered) pendingErrors.push(err);
  });
  const errors = {
    subscribe(fn: (err: LibraryError) => void): () => void {
      if (errorsBuffered) {
        errorsBuffered = false;
        for (const err of pendingErrors.splice(0)) fn(err);
      }
      return resolver.errors.subscribe(fn);
    },
    emit: (err: LibraryError): void => resolver.errors.emit(err),
    get size(): number {
      return resolver.errors.size;
    },
  };

  const store: BoardStore = {
    getState: () => resolver.getState(),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getVersion: () => version,
    events: resolver.events,
    errors,
    applyOps(reply) {
      const result = resolver.applyOps(reply);
      notify();
      return result;
    },
    applyPartial(reply) {
      const result = resolver.applyPartial(reply);
      notify();
      return result;
    },
    applyFinal(reply) {
      const result = resolver.applyFinal(reply);
      notify();
      return result;
    },
    back() {
      const state = resolver.back();
      notify();
      return state;
    },
    reset() {
      resolver.reset();
      notify();
    },
  };
  return store;
}

/**
 * Create a board store bound to the component lifetime:
 * `{ state, applyFinal, applyPartial, back, reset, events, errors }` —
 * usable with streamed partials and plain replies alike.
 */
export function useBoard(): BoardStore {
  const resolverRef = useRef<BoardResolver | null>(null);
  if (!resolverRef.current) resolverRef.current = new BoardResolver();
  return useMemo(() => createBoardStore(resolverRef.current as BoardResolver), []);
}

/** Subscribe a component to a board store's changes. */
export function useBoardVersion(store: BoardStore): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
