'use client';

import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { BoardStore } from '../use-board';
import { BoardStoreContext, useBoardStatus } from '../store-context';
import { DreamerContext } from '../provider';
import type { Registry } from '../../core/registry';
import type { UIEvent } from '../../schema/events';
import type { LibraryError } from '../../core/types';

const MAX_LOGS = 30;
const NOOP_SUBSCRIBE = (): (() => void) => () => {};
const NOOP_VERSION = (): number => 0;

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: '0.75rem',
  bottom: '3.5rem',
  zIndex: 2147483000,
  width: 'min(24rem, calc(100vw - 1.5rem))',
  maxHeight: 'min(34rem, calc(100vh - 5rem))',
  overflow: 'auto',
  padding: '0.75rem',
  borderRadius: 'var(--dg-radius-md, 10px)',
  border: '1px solid var(--dg-color-border, rgba(20, 20, 20, 0.18))',
  background: 'var(--dg-color-surface, #fff)',
  color: 'var(--dg-color-ink, #171717)',
  font: '12px/1.45 var(--dg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22)',
};

const toggleStyle: CSSProperties = {
  position: 'fixed',
  right: '0.75rem',
  bottom: '0.75rem',
  zIndex: 2147483000,
  minWidth: 'var(--dg-min-target, 44px)',
  minHeight: 'var(--dg-min-target, 44px)',
  padding: '0 0.75rem',
  borderRadius: '999px',
  border: '1px solid var(--dg-color-border, rgba(20, 20, 20, 0.18))',
  background: 'var(--dg-color-ink, #171717)',
  color: 'var(--dg-color-surface, #fff)',
  font: '700 12px/1 var(--dg-font-mono, ui-monospace, monospace)',
  cursor: 'pointer',
};

const sectionStyle: CSSProperties = {
  marginTop: '0.75rem',
  paddingTop: '0.6rem',
  borderTop: '1px solid var(--dg-color-border, rgba(20, 20, 20, 0.12))',
};

const headingStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--dg-color-muted, #6b7280)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.15rem 0',
};

const chipStyle: CSSProperties = {
  display: 'inline-block',
  margin: '0 0.25rem 0.25rem 0',
  padding: '0.1rem 0.4rem',
  borderRadius: '999px',
  border: '1px solid var(--dg-color-border, rgba(20, 20, 20, 0.16))',
  background: 'var(--dg-color-bg, transparent)',
  font: 'inherit',
};

function Dot({ tone }: { tone: 'entered' | 'pending' | 'idle' }): ReactNode {
  const color = tone === 'entered' ? 'var(--dg-color-success, #15803d)' : tone === 'pending' ? 'var(--dg-color-warn, #b45309)' : 'var(--dg-color-muted, #9ca3af)';
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 6, background: color }} />;
}

export interface DevtoolsOverlayProps {
  /** Defaults to the store provided by `<Board>`/`BoardStoreProvider`. */
  store?: BoardStore;
  /** Defaults to the provider registry when one is mounted. */
  registry?: Registry;
  /** Open on first render. Defaults to false. */
  defaultOpen?: boolean;
  title?: string;
  /** Override snapshot export (defaults to a JSON download). */
  onExportSnapshot?: (store: BoardStore) => void;
}

/**
 * Development overlay (§7.13, initial version): node tree with entry state,
 * cue timeline, resolved theme, layout, registry summary, event/error logs and
 * snapshot export. Import it lazily so production bundles can drop it.
 */
export function DevtoolsOverlay({ store: storeProp, registry: registryProp, defaultOpen = false, title = 'dreamer-genui', onExportSnapshot }: DevtoolsOverlayProps): ReactNode {
  const store = storeProp ?? useContext(BoardStoreContext);
  const dreamer = useContext(DreamerContext);
  const registry = registryProp ?? dreamer?.registry;
  const status = useBoardStatus();
  const [open, setOpen] = useState(defaultOpen);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const version = useSyncExternalStore(
    store ? store.subscribe : NOOP_SUBSCRIBE,
    store ? store.getVersion : NOOP_VERSION,
    store ? store.getVersion : NOOP_VERSION,
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!store) return;
    const offEvent = store.events.subscribe((event) => {
      if (!mounted.current) return;
      setEvents((prev) => [...prev.slice(-(MAX_LOGS - 1)), event]);
    });
    const offError = store.errors.subscribe((error) => {
      if (!mounted.current) return;
      setErrors((prev) => [...prev.slice(-(MAX_LOGS - 1)), error]);
    });
    return () => {
      offEvent();
      offError();
    };
  }, [store]);

  const registrySummary = useMemo(() => {
    if (!registry) return [];
    const counts = new Map<string, number>();
    for (const entry of registry.list()) {
      counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + (entry.disabled ? 0 : 1));
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [registry, version]);

  const panels = useMemo(() => (registry ? registry.list('devtoolsPanels') : []), [registry, version]);

  if (!store) return null;

  const state = store.getState();
  const entry = store.getEntry();
  const nodes = Object.values(state.nodes);
  const ops = store.exportOps();
  const enteredSet = new Set(entry.entered);
  const pendingSet = new Set(entry.pending);

  const exportSnapshot = (): void => {
    if (onExportSnapshot) {
      onExportSnapshot(store);
      return;
    }
    try {
      const json = JSON.stringify(store.snapshot(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dreamer-board-${state.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Non-browser/test environments: keep the overlay passive.
    }
  };

  return (
    <>
      <button type="button" style={toggleStyle} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle dreamer-genui devtools">
        DG
      </button>
      {open && (
        <aside style={panelStyle} role="complementary" aria-label="dreamer-genui devtools" data-dg-part="devtools-panel">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <strong style={{ flex: 1, fontSize: '13px' }}>{title}</strong>
            <span style={{ color: 'var(--dg-color-muted, #6b7280)' }}>v{version}</span>
            <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit' }} aria-label="Close devtools">
              ×
            </button>
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Board</h4>
            <div style={rowStyle}><span>id</span><span>{state.id}</span></div>
            <div style={rowStyle}><span>status</span><span>{status}</span></div>
            <div style={rowStyle}><span>nodes</span><span>{nodes.length}</span></div>
            <div style={rowStyle}><span>entered / pending</span><span>{entry.entered.length} / {entry.pending.length}</span></div>
            <div style={rowStyle}><span>detours</span><span>{state.detours.length}</span></div>
            <div style={rowStyle}><span>history</span><span>{state.history.length}</span></div>
            <div style={rowStyle}><span>ops log</span><span>{ops.entries.length}</span></div>
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Cues</h4>
            <div style={{ marginBottom: '0.25rem' }}>
              {state.firedCues.length === 0 ? <span style={{ color: 'var(--dg-color-muted, #6b7280)' }}>none fired</span> : state.firedCues.map((cue) => <span key={cue} style={chipStyle}>{cue}</span>)}
            </div>
            {entry.pendingCues.length > 0 && (
              <div>
                {entry.pendingCues.map((cue) => (
                  <button key={cue} type="button" style={{ ...chipStyle, cursor: 'pointer' }} onClick={() => store.cue(cue)} title={`Fire cue ${cue}`}>
                    {cue} ▸
                  </button>
                ))}
                <button type="button" style={{ ...chipStyle, cursor: 'pointer' }} onClick={() => store.flush()}>flush</button>
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Nodes</h4>
            {nodes.length === 0 && <div style={{ color: 'var(--dg-color-muted, #6b7280)' }}>empty board</div>}
            {nodes.map((node) => {
              const tone = enteredSet.has(node.id) ? 'entered' : pendingSet.has(node.id) ? 'pending' : 'idle';
              return (
                <div key={node.id} style={rowStyle}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Dot tone={tone} />{node.id}
                  </span>
                  <span style={{ color: 'var(--dg-color-muted, #6b7280)' }}>{node.block.type} · {node.state}</span>
                </div>
              );
            })}
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Theme & layout</h4>
            <div style={rowStyle}><span>layout</span><span>{state.layout.kind}</span></div>
            <div style={rowStyle}><span>mood</span><span>{state.theme?.mood ?? '—'}</span></div>
            <div style={rowStyle}><span>ambience</span><span>{state.theme?.ambience?.preset ?? '—'}</span></div>
            <div style={rowStyle}><span>surface</span><span>{state.theme?.surface ?? '—'}</span></div>
            <div style={rowStyle}><span>ink / accent</span><span>{state.theme?.tokens.color?.ink ?? '—'} / {state.theme?.tokens.color?.accent ?? '—'}</span></div>
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Registry</h4>
            {registrySummary.length === 0 && <div style={{ color: 'var(--dg-color-muted, #6b7280)' }}>no registry</div>}
            {registrySummary.map(([kind, count]) => (
              <div key={kind} style={rowStyle}><span>{kind}</span><span>{count}</span></div>
            ))}
            {panels.length > 0 && <div style={{ marginTop: '0.25rem' }}>panels: {panels.map((panel) => panel.name).join(', ')}</div>}
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Events ({events.length})</h4>
            {events.length === 0 && <div style={{ color: 'var(--dg-color-muted, #6b7280)' }}>none</div>}
            {events.map((event, i) => (
              <div key={`${event.type}-${i}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.type}{'nodeId' in event && event.nodeId ? ` · ${event.nodeId}` : ''}{'ref' in event && event.ref ? `/${event.ref}` : ''}
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <h4 style={headingStyle}>Errors ({errors.length})</h4>
            {errors.length === 0 && <div style={{ color: 'var(--dg-color-muted, #6b7280)' }}>none</div>}
            {errors.map((error, i) => (
              <div key={`${error.code}-${i}`} style={{ color: 'var(--dg-color-danger, #b91c1c)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {error.code}{error.nodeId ? ` · ${error.nodeId}` : ''}
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <button type="button" onClick={exportSnapshot} style={{ ...chipStyle, cursor: 'pointer' }}>Export snapshot</button>
            <button type="button" onClick={() => store.reset()} style={{ ...chipStyle, cursor: 'pointer' }}>Reset board</button>
          </div>
        </aside>
      )}
    </>
  );
}
