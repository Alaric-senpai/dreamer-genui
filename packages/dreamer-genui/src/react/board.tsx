import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { UIEvent } from '../schema/events';
import type { EaseName } from '../schema/motion';
import type { BoardState, CameraMove, Detour, LibraryError, Node } from '../core/types';
import type { ResolvedTheme } from '../core/theme';
import type { BoardStore } from './use-board';
import { useBoardVersion } from './use-board';
import { useDreamer } from './provider';
import { BoardStoreProvider, type BoardStatus } from './store-context';
export type { BoardStatus } from './store-context';
import { BoardEmitContext, BoardErrorContext } from './emit-context';
import { computeEntryPlan, defaultPacing, type EntryPlan, type Pacing } from '../core/cues';
import { assignSlots, createLayoutModel, type SlotAssignment } from '../core/layout';
import type { Slot } from '../schema/layout';
import { LayoutRegions, isNarrow } from './layout/regions';
import { captureReflowRects, useLayoutReflow, type ReflowRects } from './layout/reflow';
import { tokensToVars, type CssTokens } from '../theme/tokens';
import { TempoContext, tempoOf } from './motion/tempo';
import { NodeView } from './components/block-renderer';
import { DetourView, FloatingDetour, isFlowPlacement, resolvePlacement, resolveTargetElement } from './components/detour';
import { AmbienceLayer } from './ambience/AmbienceLayer';
import { AnatomyProvider, partProps, type PartOverrides, type PartStyleOverrides } from './anatomy';

/** Valid EaseName values for theme-transition variables (render-side allowlist for the var). */
const EASE_NAMES = new Set(['smooth', 'snappy', 'overshoot', 'anticipate', 'linear']);

/** CSS fallbacks for protocol ease names — one table, tuned with motion/presets.ts. */
const CAMERA_EASE: Record<EaseName, string> = {
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  snappy: 'cubic-bezier(0.2, 0, 0, 1)',
  overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  anticipate: 'cubic-bezier(0.36, 0, 0.66, -0.56)',
  linear: 'linear',
};

/** Camera zoom is presentation-only and bounded (§6.10): never above 1.6x. */
const MIN_CAMERA_ZOOM = 1;
const MAX_CAMERA_ZOOM = 1.6;
const AUTO_CAMERA_ZOOM = 1.09;
const AUTO_CAMERA_HOLD_MS = 1600;

interface CameraState {
  scale: number;
  originX: number;
  originY: number;
  duration: number;
  ease: EaseName;
}

const IDENTITY_CAMERA: CameraState = { scale: 1, originX: 50, originY: 50, duration: 0, ease: 'smooth' };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
function LiveAnnouncer({
  state,
  entry,
  visible,
  className = 'dg-live-region',
  style,
  dataPart,
}: {
  state: BoardState;
  entry: EntryPlan;
  /** Render window (§7.6): hidden nodes are never announced. */
  visible?: ReadonlySet<string> | null;
  className?: string;
  style?: CSSProperties;
  dataPart?: string;
}): ReactNode {
  const announcedRef = useRef<string | null>(null);
  const [message, setMessage] = useState('');
  const latest = useRef({ state, entry });
  useEffect(() => {
    latest.current = { state, entry };
  });

  // Announce the last newly-entered node id in document order — covers append,
  // replace (node count can drop) and cue-gated entrances. A host render window
  // (`visibleNodeIds`) also silences nodes outside the window.
  const announced = visible === null || visible === undefined
    ? entry.entered
    : entry.entered.filter((id) => visible.has(id));
  const lastEnteredId = announced[announced.length - 1];
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
      className={className}
      data-dg-part={dataPart}
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', ...style }}
    >
      {message}
    </div>
  );
}

/** Lifecycle indicator state shown while the tutor/voice model is at work (§7.5). */
/** Density presets (§6.10): type/space scale and minimum tap target. */
const DENSITY_VARS: Record<'compact' | 'comfortable' | 'large', { scale: number; minTarget: number }> = {
  compact: { scale: 0.9, minTarget: 40 },
  comfortable: { scale: 1, minTarget: 44 },
  large: { scale: 1.18, minTarget: 56 },
};

export interface BoardProps {
  store: BoardStore;
  /** Unobtrusive lifecycle indicator; invisible when `idle` (§7.5). */
  status?: BoardStatus;
  /** "cued" | "auto"; defaults to cued once any node uses a cue trigger, else auto (§6.3). */
  pacing?: Pacing;
  /** "auto" follows newly entered nodes; "off" disables the virtual camera (§6.10). */
  camera?: 'auto' | 'off';
  /** "auto" uses the resolved preset, "lite" halves particles, "off" disables (§6.9). */
  ambience?: 'auto' | 'off' | 'lite';
  /** Recede previously entered scenes (§9.2). Defaults to true. */
  recede?: boolean;
  /**
   * Host-controlled render window (§7.6): when set, only these entered node ids
   * (plus an open detour's target) are rendered. Hiding a node is purely a view
   * concern — it stays in `BoardState`, snapshots, history and `serializeBoard`,
   * so the tutor keeps full context. Hidden nodes are absent from the DOM, the
   * accessibility tree, live announcements and the auto camera, exactly like
   * unentered nodes. Omit to render every entered node (default).
   */
  visibleNodeIds?: readonly string[];
  /** Optional board-level sinks. Both provider-level and board-level sinks fire. */
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
  /** Fired as each node's entry gate opens (§6.3). */
  onEnter?: (nodeId: string) => void;
  /** Fired as host cues arrive (§6.3). */
  onCue?: (cueId: string) => void;
  /** Fired with every resolved theme change (§6.8). */
  onThemeChange?: (theme: ResolvedTheme) => void;
  /** Slot overrides (Tailwind strings welcome; merged with the library classes). */
  classNames?: { root?: string; content?: string; skip?: string };
  /** Per-part class overrides for built-in components (§8.5): component → part → class. */
  partClassNames?: PartOverrides;
  /** Per-part inline styles for built-in components (§8.5), applied after library styles. */
  partStyles?: PartStyleOverrides;
}

/**
 * The classroom blackboard (M3/M4): renders only entered nodes
 * (not-mounted-until-triggered, §6.3), the active detour with its placement,
 * connector and return control (§7.5), receding scenes (§9.2), the virtual
 * camera (§6.10) and the ambience layer (§6.9). The engine-resolved theme is
 * written to `--dg-*` variables scoped to the board root (§6.8).
 */
export function Board({
  store,
  status = 'idle',
  pacing,
  camera = 'auto',
  ambience = 'auto',
  recede = true,
  visibleNodeIds,
  onEvent,
  onError,
  onEnter,
  onCue,
  onThemeChange,
  classNames,
  partClassNames,
  partStyles,
}: BoardProps): ReactNode {
  useBoardVersion(store);
  const state = store.getState();
  const {
    onEvent: providerOnEvent,
    onError: providerOnError,
    registry,
    strings,
    dir,
    density,
    t,
  } = useDreamer();
  const theme = state.theme;
  // Board parts cannot read the AnatomyProvider it renders below, so bind them directly.
  const bp = (part: string, extra?: string) => partProps('board', part, partClassNames?.board, partStyles?.board, extra);

  const effectivePacing = pacing ?? defaultPacing(state);
  const entry = computeEntryPlan(state, effectivePacing);
  const enteredKey = entry.entered.join('\u0000');
  const visibleKey = visibleNodeIds ? visibleNodeIds.join('\u0000') : '\u0000all';

  const prefersReduced = useReducedMotion() === true;

  // ---- theme variables (§6.8 precedence: library defaults live in the base
  // stylesheet's var() fallbacks < host CSS < resolved board theme, so the
  // inline style only ever carries the RESOLVED theme tokens + transition knobs) ----
  const style = useMemo<CSSProperties>(() => {
    const vars: CssTokens = theme ? tokensToVars(theme.tokens) : {};
    if (theme) {
      // Theme-transition knobs (§6.8: tween, never a cut) — consumed by the base
      // stylesheet; reduced motion shortens to near-instant via the media query there.
      vars['--dg-theme-duration'] = `${theme.transition.duration}ms`;
      vars['--dg-theme-ease'] = EASE_NAMES.has(theme.transition.ease) ? theme.transition.ease : 'smooth';
    }
    // Density is a host/user setting (§6.10): it scales type, space and the
    // minimum tap target without overriding the tutor's theme tokens.
    const densityVars = DENSITY_VARS[density];
    vars['--dg-density-scale'] = String(densityVars.scale);
    vars['--dg-min-target'] = `${densityVars.minTarget}px`;
    const css: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) css[k] = v;
    return css as CSSProperties;
  }, [theme, density]);

  const entered = new Set(entry.entered);
  const detour = state.detours[state.detours.length - 1];
  const detourTargetId = detour?.targetNodeId;
  // Render window (§7.6): state stays authoritative; only the view is filtered.
  const visible = visibleNodeIds ? new Set(visibleNodeIds) : null;
  const orderedIds = Object.keys(state.nodes).filter(
    (id) => entered.has(id) && (visible === null || visible.has(id) || id === detourTargetId)
  );
  const pending = visible === null ? entry.pending : entry.pending.filter((id) => visible.has(id));

  // ---- layout engine (§6.4): regions from the active spec; slots the layout
  // does not define fall back to the primary region (never fatal) ----
  const [boardWidth, setBoardWidth] = useState(0);
  const layoutModel = useMemo(() => createLayoutModel(state.layout, registry), [state.layout, registry]);
  const assignment: SlotAssignment = useMemo(
    () =>
      assignSlots(
        orderedIds.map((id) => ({
          id,
          slot: (state.nodes[id]?.block as { slot?: Slot } | undefined)?.slot,
        })),
        layoutModel
      ),
    // orderedIds/state.nodes change together with entry or the host window;
    // recomputing per render is fine (pure, cheap) — the memo only avoids
    // reallocating maps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enteredKey, visibleKey, layoutModel]
  );
  const narrow = isNarrow(boardWidth);

  // ---- receding scenes (§9.2): nodes entering in the same commit form one
  // scene; older scenes visibly recede so the newest idea owns the focal point. ----
  const [sceneOf, setSceneOf] = useState<Record<string, number>>({});
  const nextSceneRef = useRef(0);
  useEffect(() => {
    setSceneOf((prev) => {
      const fresh = entry.entered.filter((id) => prev[id] === undefined);
      if (fresh.length === 0) return prev;
      const scene = nextSceneRef.current;
      nextSceneRef.current += 1;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!(id in state.nodes)) delete next[id];
      }
      for (const id of fresh) next[id] = scene;
      return next;
    });
    // entry.entered identity changes every render; the joined key is the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredKey]);
  const activeScene = useMemo(() => {
    const values = Object.values(sceneOf);
    return values.length === 0 ? -1 : Math.max(...values);
  }, [sceneOf]);

  // Per-region receding (§6.4/§9.2): each region recedes finished content
  // independently — a node recedes when a newer scene exists in its own region.
  const regionMaxScene = useMemo(() => {
    const max: Partial<Record<Slot, number>> = {};
    for (const slot of Object.keys(assignment.regions) as Slot[]) {
      let best = -1;
      for (const id of assignment.regions[slot] ?? []) {
        const scene = sceneOf[id];
        if (scene !== undefined && scene > best) best = scene;
      }
      max[slot] = best;
    }
    return max;
  }, [assignment, sceneOf]);

  const regionOf = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const slot of Object.keys(assignment.regions) as Slot[]) {
      for (const id of assignment.regions[slot] ?? []) map.set(id, slot);
    }
    return map;
  }, [assignment]);

  const isReceded = useCallback(
    (id: string): boolean => {
      if (!recede || detour) return false;
      const scene = sceneOf[id] ?? -1;
      const slot = regionOf.get(id);
      const max = slot !== undefined ? regionMaxScene[slot] : activeScene;
      return scene < (max ?? activeScene);
    },
    [recede, detour, sceneOf, regionOf, regionMaxScene, activeScene]
  );

  // Interactive components emit onto the board's events bus; the bridge
  // below forwards every bus event to both the provider and board sinks.
  const emit = useCallback((event: UIEvent) => store.events.emit(event), [store]);
  const reportError = useCallback((error: LibraryError) => store.errors.emit(error), [store]);

  // Latest sinks without re-subscribing the buses per render (synced before
  // the bus-bridge effect below, declaration order).
  const sinksRef = useRef({ onEvent, onError, providerOnEvent, providerOnError, onEnter, onCue, onThemeChange });
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    sinksRef.current = { onEvent, onError, providerOnEvent, providerOnError, onEnter, onCue, onThemeChange };
  });

  // Bridge resolver buses to host-facing sinks: engine errors must reach
  // onError (§6.12), rendered components' events reach onEvent, and entry/cue
  // notifications reach onEnter/onCue (§6.3).
  useEffect(() => {
    const offEvent: () => void = store.events.subscribe((event) => {
      sinksRef.current.providerOnEvent?.(event);
      sinksRef.current.onEvent?.(event);
    });
    const offErrors: () => void = store.errors.subscribe((err) => {
      sinksRef.current.providerOnError?.(err);
      sinksRef.current.onError?.(err);
    });
    const offEnter: () => void = store.enterBus.subscribe((id) => {
      // Hidden nodes are not announced to the host either (render window, §7.6).
      const window = visibleRef.current;
      if (window !== null && !window.has(id)) return;
      sinksRef.current.onEnter?.(id);
    });
    const offCue: () => void = store.cueBus.subscribe((id) => {
      sinksRef.current.onCue?.(id);
    });
    return () => {
      offEvent();
      offErrors();
      offEnter();
      offCue();
    };
  }, [store]);

  // Theme changes may arrive before this component mounted (ops are applied
  // outside React), so report from resolved state rather than only from the bus.
  const reportedThemeRef = useRef<ResolvedTheme | undefined>(undefined);
  useEffect(() => {
    if (!theme || theme === reportedThemeRef.current) return;
    reportedThemeRef.current = theme;
    sinksRef.current.onThemeChange?.(theme);
  }, [theme]);

  // ---- scene tempo (§6.8 motion.speed; every timing in the motion layer scales by it) ----
  const tempo = useMemo(() => tempoOf(theme), [theme]);

  // ---- camera (§6.10) ----
  const boardRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(IDENTITY_CAMERA);
  const [cameraToken, setCameraToken] = useState(0);
  const holdCameraUntilRef = useRef(0);
  const detourRef = useRef<string | null>(detour?.id ?? null);
  detourRef.current = detour?.id ?? null;

  const moveCamera = useCallback(
    (to: string, zoom = 1.2, duration = 800, ease: EaseName = 'smooth', instant = false) => {
      const board = boardRef.current;
      const content = cameraRef.current;
      if (!board || !content) return;

      if (to === 'overview') {
        setCameraState({ scale: 1, originX: 50, originY: 50, duration: instant ? 0 : duration, ease });
        setCameraToken((token) => token + 1);
        return;
      }

      const target = resolveTargetElement(board, to);
      if (!target) return;

      // Reduced motion: plain scroll-into-view, no transform (§6.10/§7.7).
      if (prefersReduced) {
        target.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
        return;
      }

      const contentRect = content.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      // Ratios remain correct under the current uniform scale + translation.
      const originX = contentRect.width > 0 ? ((targetRect.left + targetRect.width / 2 - contentRect.left) / contentRect.width) * 100 : 50;
      const originY = contentRect.height > 0 ? ((targetRect.top + targetRect.height / 2 - contentRect.top) / contentRect.height) * 100 : 50;

      // Bring the target on screen first; the push-in then has something to hold.
      target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });

      setCameraState({
        scale: clamp(zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
        originX: clamp(originX, 0, 100),
        originY: clamp(originY, 0, 100),
        duration: instant ? 0 : Math.max(0, duration),
        ease,
      });
      setCameraToken((token) => token + 1);
    },
    [prefersReduced]
  );

  // Reduced motion wins over any in-flight transform.
  useEffect(() => {
    if (!prefersReduced) return;
    setCameraState((current) => (current.scale === 1 ? current : { ...IDENTITY_CAMERA, duration: 0 }));
  }, [prefersReduced]);

  // Auto camera: push in on the newest entered node, then return to overview.
  const autoReturnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEnteredRef = useRef<Set<string>>(new Set());

  // Explicit `camera` ops are validated by the resolver and executed here;
  // rAF lets the append from the same reply commit first.
  useEffect(() => {
    const off = store.cameraBus.subscribe((move: CameraMove) => {
      // `camera="off"` disables the virtual camera entirely (§6.10).
      if (camera !== 'auto') return;
      // An explicit move owns the frame: cancel any pending auto-return so it
      // cannot snap the camera back mid-move.
      if (autoReturnRef.current) {
        clearTimeout(autoReturnRef.current);
        autoReturnRef.current = null;
      }
      holdCameraUntilRef.current = Date.now() + (move.duration ?? 800) + 800;
      requestAnimationFrame(() => {
        if (detourRef.current) return;
        moveCamera(move.to ?? 'overview', move.zoom ?? 1.2, move.duration ?? 800, move.ease ?? 'smooth');
      });
    });
    return off;
  }, [store, moveCamera, camera]);

  useEffect(() => {
    const previously = prevEnteredRef.current;
    const next = new Set(entry.entered);
    const fresh = entry.entered.filter(
      (id) => !previously.has(id) && (visible === null || visible.has(id))
    );
    prevEnteredRef.current = next;
    if (fresh.length === 0) return;

    const newest = fresh[fresh.length - 1];
    if (!newest) return;
    const node = resolveTargetElement(boardRef.current, newest);
    node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });

    if (camera !== 'auto' || prefersReduced || detourRef.current) return;
    if (Date.now() < holdCameraUntilRef.current) return;
    moveCamera(newest, AUTO_CAMERA_ZOOM, 700, 'smooth');
    if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    autoReturnRef.current = setTimeout(() => {
      // A camera op that arrived while this timer ran owns the frame.
      if (Date.now() < holdCameraUntilRef.current) return;
      if (detourRef.current) return;
      moveCamera('overview', 1, 800, 'smooth');
    }, AUTO_CAMERA_HOLD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredKey, camera, prefersReduced, moveCamera]);

  useEffect(() => () => {
    if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
  }, []);

  // ---- layout re-flow (§6.4): the layout op's transition knobs arrive on the
  // layoutBus before React re-renders; capture pre-commit positions now, then
  // the layout effect animates the delta. Reduced motion renders instantly.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pendingReflowRef = useRef<{ rects: ReflowRects; duration: number; ease: string } | null>(null);
  useEffect(() => {
    return store.layoutBus.subscribe((transition) => {
      const rects = captureReflowRects(contentRef.current);
      if (!rects) return;
      pendingReflowRef.current = {
        rects,
        duration: transition.duration ?? 600,
        ease: CAMERA_EASE[(transition.ease ?? 'smooth') as EaseName] ?? CAMERA_EASE.smooth ?? '',
      };
    });
  }, [store]);
  useLayoutReflow(contentRef, pendingReflowRef, !prefersReduced);

  // ---- detour presentation (§7.5) ----
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = (): void => setBoardWidth(board.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const placement = detour ? resolvePlacement(detour, boardWidth) : null;
  const floating = placement !== null && !isFlowPlacement(placement);

  // Opening a detour returns the camera to overview (the detour owns the
  // frame) and brings its target on screen. Detour themes live on the detour,
  // so popping it restores the board theme automatically (§6.8).
  useEffect(() => {
    if (!detour) return;
    moveCamera('overview', 1, 0, 'smooth', true);
    const target = resolveTargetElement(boardRef.current, detour.targetRef ?? detour.targetNodeId);
    target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detour?.id, prefersReduced]);

  // Target annotation hook (§7.5): the same visual vocabulary as inline marks.
  useEffect(() => {
    if (!detour || !detour.targetAnnotate || detour.targetAnnotate === 'none') return;
    const target = resolveTargetElement(boardRef.current, detour.targetRef ?? detour.targetNodeId);
    if (!target) return;
    target.setAttribute('data-dg-annotated', detour.targetAnnotate);
    return () => target.removeAttribute('data-dg-annotated');
  }, [detour?.id, detour?.targetAnnotate, detour?.targetRef, detour?.targetNodeId]);

  const closeTopDetour = useCallback(
    (closing: Detour) => {
      store.closeDetour();
      const board = boardRef.current;
      if (!board) return;
      requestAnimationFrame(() => {
        const target = resolveTargetElement(board, closing.targetRef ?? closing.targetNodeId);
        if (!target) return;
        if (!target.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
      });
    },
    [store]
  );

  // While a detour is open the rest of the board is visually dimmed; it also
  // leaves the accessibility tree and the tab order (inert) so the explainer
  // reads as a modal surface, not as competing content (§7.5/§7.7).
  useEffect(() => {
    const content = boardRef.current?.querySelector<HTMLElement>('.dg-board-content');
    if (!content) return undefined;
    const nodes = Array.from(content.querySelectorAll<HTMLElement>("[data-dg-board-node='true']"));
    if (!detour) {
      for (const el of nodes) {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      }
      return undefined;
    }
    for (const el of nodes) {
      const isTarget = el.getAttribute('data-dg-detour-target') === 'true';
      if (isTarget) {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      } else {
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
      }
    }
    return () => {
      for (const el of nodes) {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      }
    };
    // Entered nodes can mount/leave while the detour stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detour?.id, enteredKey]);

  // ---- ambience (§6.9): resolved from the theme, never hard-coded per mood ----
  const ambiencePreset = useMemo(() => {
    if (!theme?.ambience) return null;
    const preset = registry.getAmbience(theme.ambience.preset);
    if (!preset) return null;
    return { ...preset, intensity: (preset.intensity ?? 1) * theme.ambience.intensity };
  }, [registry, theme?.ambience]);

  const cameraStyle = useMemo<CSSProperties>(
    () => ({
      transform: `scale(${cameraState.scale})`,
      transformOrigin: `${cameraState.originX}% ${cameraState.originY}%`,
      transition: cameraState.duration > 0 ? `transform ${cameraState.duration}ms ${CAMERA_EASE[cameraState.ease]}` : 'none',
    }),
    [cameraState]
  );

  const flowAnchorIndex = detour && placement && isFlowPlacement(placement) ? orderedIds.indexOf(detourTargetId ?? '') : -1;

  function renderDetour(): ReactNode {
    if (!detour || !placement) return null;
    return (
      <DetourView
        detour={detour}
        strings={strings}
        placement={placement}
        onReturn={closeTopDetour}
        autoFocus
        className={isFlowPlacement(placement) ? 'dg-detour-flow' : undefined}
      />
    );
  }

  /** Flow (inline) detours render inside their region, after the anchor node;
   * when the anchor has not entered, at the end of the primary region. */
  const renderFlowDetour = (afterId: string | null): ReactNode => {
    if (!detour || !placement || !isFlowPlacement(placement)) return null;
    const anchorId = flowAnchorIndex >= 0 ? (orderedIds[flowAnchorIndex] ?? null) : null;
    return afterId === anchorId ? renderDetour() : null;
  };

  const renderNode = (id: string, index: number): ReactNode => {
    const node = state.nodes[id];
    if (!node) return null;
    return (
      <NodeView
        node={node}
        docIndex={index}
        receded={isReceded(id)}
        detourTarget={id === detourTargetId}
        topLevel
      />
    );
  };

  const boardPart = bp('root', `dg-board${classNames?.root ? ` ${classNames.root}` : ''}`);
  const cameraPart = bp('camera', 'dg-camera');
  const contentPart = bp('content', `dg-board-content${classNames?.content ? ` ${classNames.content}` : ''}`);
  const titlePart = bp('title', 'dg-board-title');
  const skipPart = bp('skip', `dg-skip${classNames?.skip ? ` ${classNames.skip}` : ''}`);
  const liveRegionPart = bp('live-region', 'dg-live-region');
  const statusPart = bp('status', 'dg-status');
  const emptyPart = bp('empty', 'dg-empty');

  return (
    <BoardStoreProvider store={store} status={status}>
    <TempoContext.Provider value={tempo}>
      <BoardEmitContext.Provider value={emit}>
        <BoardErrorContext.Provider value={reportError}>
        <AnatomyProvider classNames={partClassNames} styles={partStyles}>
          <section
            ref={boardRef}
            {...boardPart}
            aria-label={state.title ?? 'Blackboard'}
            data-dg-mood={theme?.mood ?? undefined}
            data-dg-surface={theme?.surface ?? undefined}
            data-dg-camera={camera}
            data-dg-ambience={ambience}
            data-dg-recede={recede ? 'true' : undefined}
            data-dg-detour-open={detour ? placement ?? 'true' : undefined}
            data-dg-density={density}
            dir={dir}
            style={boardPart.style ? { ...style, ...boardPart.style } : style}
          >
            <AmbienceLayer
              preset={ambiencePreset}
              texture={theme?.tokens.texture}
              mode={ambience}
              reducedMotion={prefersReduced}
            />
            <LiveAnnouncer
              state={state}
              entry={entry}
              visible={visible}
              className={liveRegionPart.className}
              dataPart={liveRegionPart['data-dg-part']}
              style={liveRegionPart.style}
            />
            {status !== 'idle' && (
              <div {...statusPart} data-dg-status={status} role="status" aria-live="polite">
                <span className="dg-status-dot" aria-hidden="true" />
                <span className="dg-status-label">{t(`board.${status}`)}</span>
              </div>
            )}
            <div
              ref={cameraRef}
              {...cameraPart}
              style={cameraPart.style ? { ...cameraStyle, ...cameraPart.style } : cameraStyle}
              data-dg-camera-layer=""
            >
              <div
                ref={contentRef}
                {...contentPart}
                data-dg-layout={layoutModel.kind}
                data-dg-narrow={narrow || undefined}
              >
                {state.title && <h2 {...titlePart}>{state.title}</h2>}
                {Object.keys(state.nodes).length === 0 && (
                  <div {...emptyPart} data-dg-empty="">
                    {t('board.empty')}
                  </div>
                )}
                {pending.length > 0 && (
                  <button type="button" {...skipPart} onClick={() => store.flush()}>
                    {strings.skip}
                  </button>
                )}
                <LayoutRegions
                  model={layoutModel}
                  orderedIds={orderedIds}
                  nodes={state.nodes}
                  assignment={assignment}
                  narrow={narrow}
                  renderNode={renderNode}
                  renderFlowDetour={renderFlowDetour}
                />
              </div>
            </div>

            {detour && floating && placement && (
              <>
                {(placement === 'spotlight' || placement === 'overlay') && (
                  <div className="dg-detour-backdrop" aria-hidden="true" onClick={() => closeTopDetour(detour)} />
                )}
                <div className="dg-detour-overlay" data-dg-detour-overlay-placement={placement}>
                  <FloatingDetour
                    detour={detour}
                    strings={strings}
                    onReturn={closeTopDetour}
                    boardRef={boardRef}
                    cameraToken={String(cameraToken)}
                  />
                </div>
              </>
            )}
          </section>
        </AnatomyProvider>
        </BoardErrorContext.Provider>
      </BoardEmitContext.Provider>
    </TempoContext.Provider>
    </BoardStoreProvider>
  );
}
