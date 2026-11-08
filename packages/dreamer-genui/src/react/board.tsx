import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { BoardStore } from './use-board';
import { useBoardVersion } from './use-board';
import { useDreamer } from './provider';
import { NodeView } from './components/block-renderer';
import type { BoardState, Node } from '../core/types';

function nodeText(node: Node): string {
  const block = node.block as { type?: string; content?: unknown[] };
  if (block.type === 'text' && Array.isArray(block.content)) {
    return block.content.filter((c): c is string => typeof c === 'string').join(' ');
  }
  return block.type ?? '';
}

function LiveAnnouncer({ state }: { state: BoardState }): ReactNode {
  const prevCount = useRef(0);
  const count = Object.keys(state.nodes).length;
  const isNew = count > prevCount.current;
  // Render effect: keep the ref updated after paint
  prevCount.current = count;
  const nodes = Object.values(state.nodes);
  const last = nodes[nodes.length - 1];
  return (
    <div aria-live="polite" aria-atomic="true" role="status" className="dgui-live-region" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
      {isNew && count > 0 && last ? nodeText(last) : ''}
    </div>
  );
}

export interface BoardProps {
  store: BoardStore;
  /** Optional board-level sinks; provider-level sinks also fire. */
  onEvent?: (event: import('../schema/events').UIEvent) => void;
  onError?: (err: import('../core/types').LibraryError) => void;
}

/**
 * The classroom blackboard: renders the current board state in insertion
 * order, with enter animations sequenced by `enter.order`, a polite live
 * region for newly appended content, and graceful fallbacks.
 */
export function Board({ store }: BoardProps): ReactNode {
  useBoardVersion(store);
  const state = store.getState();
  const { theme } = useDreamer();
  const nodes = Object.values(state.nodes);

  return (
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
  );
}
