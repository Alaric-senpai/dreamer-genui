import { useMemo, useRef, useSyncExternalStore } from 'react';
import { BoardResolver, type ResolverOptions, type ReplyLike } from '../core/resolver';
import type { BoardState, LibraryError, ResolvedOp, CameraMove } from '../core/types';
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
  applyOps(reply: ReplyLike): ResolvedOp[];
  applyPartial(reply: ReplyLike): ResolvedOp[];
  applyFinal(reply: ReplyLike): ResolvedOp[];
  back(): BoardState;
  /** Close the top detour (built-in return control); its scoped theme reverts. */
  closeDetour(): BoardState;
  reset(): void;
  /** Fire a narration cue (§6.3). Nodes waiting on it enter. */
  cue(cueId: string): void;
  /** Skip control: every pending node enters immediately. */
  flush(): void;
  /** Fire every cue up to and including cueId, instantly. */
  seek(cueId: string): void;
  /** Cue bus: onCue notifications (host sync, §6.3). */
  readonly cueBus: EventSink<string>;
  /** Enter bus: onEnter notifications as entry gates open. */
  readonly enterBus: EventSink<string>;
  /** Theme-change bus: emits the resolved theme on theme changes (§6.8). */
  readonly themeChangeBus: EventSink<import('../core/theme').ResolvedTheme>;
  /** Camera bus: validated explicit camera ops, presentation-only (§6.10). */
  readonly cameraBus: EventSink<CameraMove>;
  /** UIEvents emitted by rendered components (focus/select/answer/action). */
  readonly events: EventSink<UIEvent>;
  /** Library errors (validation, unknown type...). Buffers pre-mount errors. */
  readonly errors: EventSink<LibraryError>;
}

export interface CreateBoardStoreOptions extends ResolverOptions {
  /** Pre-built resolver instead of the default one (overrides the other options). */
  resolver?: BoardResolver;
}

/**
 * Create a board store around a BoardResolver. Configuration (registry,
 * onError, theme policy/allowlists/baseline) lives here — at engine level —
 * because ops may be applied before React ever renders (streaming, SSR data).
 * The provider stays presentation-level; see DECISIONS.md M3 ruling.
 */
export function createBoardStore(options: CreateBoardStoreOptions | BoardResolver = {}): BoardStore {
  const resolver = options instanceof BoardResolver ? options : (options.resolver ?? new BoardResolver(options));
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
    closeDetour() {
      const state = resolver.closeDetour();
      notify();
      return state;
    },
    reset() {
      resolver.reset();
      notify();
    },
    cue(cueId) {
      resolver.cue(cueId);
      notify();
    },
    flush() {
      resolver.flush();
      notify();
    },
    seek(cueId) {
      resolver.seek(cueId);
      notify();
    },
    cueBus: resolver.cueBus,
    enterBus: resolver.enterBus,
    themeChangeBus: resolver.themeChangeBus,
    cameraBus: resolver.cameraBus,
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
