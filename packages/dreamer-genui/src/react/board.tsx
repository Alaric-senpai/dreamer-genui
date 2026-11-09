import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { UIEvent } from '../schema/events';
import type { BoardState, LibraryError, Node } from '../core/types';
import type { BoardStore } from './use-board';
import { useBoardVersion } from './use-board';
import { useDreamer } from './provider';
import { BoardEmitContext } from './emit-context';
import { NodeView } from './components/block-renderer';

/** Keys whose values carry announcement-worthy text (strings, inline marks,
 * choice labels, step titles, alt fallbacks). Deliberately excludes ids/types. */
const TEXT_KEYS = ['content', 'prompt', 'text', 'definition', 'label', 'title', 'caption', 'alt', 'tex', 'items', 'blocks'] as const;

function collectText(value: unknown, parts: string[]): void {
  if (typeof value === 'string') {
    parts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectText(item, parts);
  } else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      if (obj[key] !== undefined) collectText(obj[key], parts);
    }
  }
}

/** Plain-text announcement for a node: content strings, mark texts, labels and alt. */
function nodeText(node: Node): string {
  const parts: string[] = [];
  collectText(node.altText, parts);
  collectText(node.block, parts);
  return parts.join(' ');
}

function LiveAnnouncer({ state }: { state: BoardState }): ReactNode {
  const nodes = Object.values(state.nodes);
  const last = nodes[nodes.length - 1];
  const lastId = last !== undefined ? last.id : null;
  const [message, setMessage] = useState('');
  const announcedRef = useRef<string | null>(null);
  // Latest state without re-subscribing the effect per render (synced in an
  // effect that runs before the announcement effect, declaration order).
  const stateRef = useRef<BoardState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Announce whenever the newest node id changes — covers append AND replace
  // (replace lowers the node count, so a count-based check would stay silent).
  useEffect(() => {
    if (lastId === null || lastId === announcedRef.current) return;
    announcedRef.current = lastId;
    const node = stateRef.current.nodes[lastId];
    setMessage(node ? nodeText(node) : lastId);
  }, [lastId]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="dgui-live-region"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    >
      {message}
    </div>
  );
}

export interface BoardProps {
  store: BoardStore;
  /** Optional board-level sinks. Both provider-level and board-level sinks fire. */
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
}

/**
 * The classroom blackboard: renders the current board state in insertion
 * order, with enter animations sequenced by `enter.order`, a polite live
 * region for board changes, and resolver errors/interaction events bridged
 * to the provider and board-level sinks.
 */
export function Board({ store, onEvent, onError }: BoardProps): ReactNode {
  useBoardVersion(store);
  const state = store.getState();
  const { theme, onEvent: providerOnEvent, onError: providerOnError } = useDreamer();
  const nodes = Object.values(state.nodes);

  // Interactive components emit onto the board's events bus; the bridge
  // below forwards every bus event to both the provider and board sinks.
  const emit = useCallback((event: UIEvent) => store.events.emit(event), [store]);

  // Latest sinks without re-subscribing the buses per render (synced before
  // the bus-bridge effect below, declaration order).
  const sinksRef = useRef({ onEvent, onError, providerOnEvent, providerOnError });
  useEffect(() => {
    sinksRef.current = { onEvent, onError, providerOnEvent, providerOnError };
  });

  // Bridge the resolver buses to the host-facing sinks: engine errors
  // (duplicate-id, unknown-type, depth-exceeded...) must reach onError (§6.8),
  // and rendered components' events reach onEvent.
  useEffect(() => {
    const offEvent: () => void = store.events.subscribe((event) => {
      sinksRef.current.providerOnEvent?.(event);
      sinksRef.current.onEvent?.(event);
    });
    const offErrors: () => void = store.errors.subscribe((err) => {
      sinksRef.current.providerOnError?.(err);
      sinksRef.current.onError?.(err);
    });
    return () => {
      offEvent();
      offErrors();
    };
  }, [store]);

  return (
    <BoardEmitContext.Provider value={emit}>
      <section
        className="dgui-board"
        aria-label={state.title ?? 'Blackboard'}
        style={{ background: theme['--dgui-color-bg'], color: theme['--dgui-color-fg'], fontFamily: theme['--dgui-font-family'] }}
      >
        {state.title && <h2 className="dgui-board-title">{state.title}</h2>}
        <LiveAnnouncer state={state} />
        <div className="dgui-board-content">
          {nodes.map((node, i) => (
            <NodeView key={node.id} node={node} docIndex={i} />
          ))}
        </div>
      </section>
    </BoardEmitContext.Provider>
  );
}
