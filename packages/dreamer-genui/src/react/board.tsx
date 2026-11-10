import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { UIEvent } from '../schema/events';
import type { BoardState, LibraryError, Node } from '../core/types';
import type { BoardStore } from './use-board';
import { useBoardVersion } from './use-board';
import { useDreamer } from './provider';
import { BoardEmitContext } from './emit-context';
import { computeEntryPlan, defaultPacing, type EntryPlan, type Pacing } from '../core/cues';
import { resolveTheme, tokensToVars, type CssTokens } from '../theme/tokens';
import { TempoContext } from './motion/tempo';
import { NodeView } from './components/block-renderer';

/** Bridge a schema block into the renderer's plain-Node shape for detours/groups. */
function asNode(block: { id: string; alt?: string } & Record<string, unknown>): Node {
  return { id: block.id, block: block as Node['block'], state: 'complete', altText: block.alt };
}

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

/** Live region announces the newest *entered* node (§7.7: unentered nodes stay silent). */
function LiveAnnouncer({ state, entry }: { state: BoardState; entry: EntryPlan }): ReactNode {
  const announcedRef = useRef<string | null>(null);
  const [message, setMessage] = useState('');
  const latest = useRef({ state, entry });
  useEffect(() => {
    latest.current = { state, entry };
  });

  // Announce the last newly-entered node id in document order — covers append,
  // replace (node count can drop) and cue-gated entrances.
  const lastEnteredId = entry.entered[entry.entered.length - 1];
  useEffect(() => {
    if (lastEnteredId === undefined || lastEnteredId === announcedRef.current) return;
    announcedRef.current = lastEnteredId;
    const node = latest.current.state.nodes[lastEnteredId];
    setMessage(node ? nodeText(node) : lastEnteredId);
  }, [lastEnteredId]);

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
  /** "cued" | "auto"; defaults to cued once any node uses a cue trigger, else auto (§6.3). */
  pacing?: Pacing;
  /** Optional board-level sinks. Both provider-level and board-level sinks fire. */
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
  /** Slot overrides (Tailwind strings welcome; merged with the library classes). */
  classNames?: { root?: string; content?: string };
}

/**
 * The classroom blackboard (M3a): renders only the nodes whose entry gate has
 * opened (not mounted until triggered, §6.3), the open detour inline, and the
 * engine-resolved theme as `--dg-*` variables scoped to the board root (§6.8).
 * Enter animation sequencing is the motion layer (M3b+).
 */
export function Board({ store, pacing, onEvent, onError, classNames }: BoardProps): ReactNode {
  useBoardVersion(store);
  const state = store.getState();
  const { scheme, onEvent: providerOnEvent, onError: providerOnError } = useDreamer();
  const { theme } = state as { theme?: import('../core/theme').ResolvedTheme };

  const effectivePacing = pacing ?? defaultPacing(state);
  const entry = computeEntryPlan(state, effectivePacing);

  // ---- theme variables (engine-resolved; library defaults < resolved board theme) ----
  const style = useMemo<CSSProperties>(() => {
    const vars: CssTokens = { ...resolveTheme(scheme), ...(theme ? tokensToVars(theme.tokens) : {}) };
    const css: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) css[k] = v;
    return css as CSSProperties;
  }, [scheme, theme]);

  const entered = new Set(entry.entered);
  const orderedIds = Object.keys(state.nodes).filter((id) => entered.has(id));
  const detour = state.detours[state.detours.length - 1];

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
  // (duplicate-id, unknown-type...) must reach onError (§6.12), and rendered
  // components' events reach onEvent.
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

  // ---- scene tempo (§6.8 motion.speed; every timing in the motion layer scales by it) ----
  const tempo = useMemo(() => {
    const speed = theme?.tokens.motion?.speed;
    return typeof speed === 'number' && speed > 0 ? speed : 1;
  }, [theme]);

  return (
    <TempoContext.Provider value={tempo}>
    <BoardEmitContext.Provider value={emit}>
      <section
        className={`dgui-board${classNames?.root ? ` ${classNames.root}` : ''}`}
        aria-label={state.title ?? 'Blackboard'}
        data-dg-mood={theme?.mood ?? undefined}
        data-dg-surface={theme?.surface ?? undefined}
        style={style}
      >
        <LiveAnnouncer state={state} entry={entry} />
        <div className={`dgui-board-content${classNames?.content ? ` ${classNames.content}` : ''}`}>
          {state.title && <h2 className="dgui-board-title">{state.title}</h2>}
          {orderedIds.map((id, i) => {
            const node = state.nodes[id];
            return node ? <NodeView key={id} node={node} docIndex={i} /> : null;
          })}
          {detour && (
            <div className="dgui-detour" data-dg-detour="">
              {detour.blocks.map((block, i) => (
                <NodeView key={block.id} node={asNode(block as never)} docIndex={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </BoardEmitContext.Provider>
    </TempoContext.Provider>
  );
}
