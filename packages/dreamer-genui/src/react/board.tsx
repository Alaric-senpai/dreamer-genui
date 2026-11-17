import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { UIEvent } from '../schema/events';
import type { EaseName } from '../schema/motion';
import { examLocksFor, type ExamLockPolicy } from '../core/assessment';
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

/** Camera zoom is presentation-only and bounded (§6.12): never above 1.6x. */
const MIN_CAMERA_ZOOM = 1;
const MAX_CAMERA_ZOOM = 1.6;
const AUTO_CAMERA_ZOOM = 1.09;
const AUTO_CAMERA_HOLD_MS = 1600;
const WIDE_CAMERA_ZOOM = 1;
const CLOSEUP_CAMERA_ZOOM = 1.45;
/** One dolly step in CSS pixels of depth (the perspective layer owns the feel). */
const DOLLY_STEP_PX = 48;

interface CameraState {
  scale: number;
  originX: number;
  originY: number;
  translateX: number;
  translateY: number;
  tiltX: number;
  tiltY: number;
  dolly: number;
  duration: number;
  ease: EaseName;
}

const IDENTITY_CAMERA: CameraState = {
  scale: 1,
  originX: 50,
  originY: 50,
  translateX: 0,
  translateY: 0,
  tiltX: 0,
  tiltY: 0,
  dolly: 0,
  duration: 0,
  ease: 'smooth',
};

/** Bounded per §6.12: tilt ±15°, dolly ±3 steps. */
function clampTilt(value: number | undefined): number {
  return clamp(value ?? 0, -15, 15);
}

function resolveDolly(value: CameraMove['dolly']): number {
  if (value === undefined) return 0;
  if (value === 'in') return DOLLY_STEP_PX;
  if (value === 'out') return -DOLLY_STEP_PX;
  return clamp(value, -3, 3) * DOLLY_STEP_PX;
}

function presetZoom(preset: CameraMove['preset']): number | undefined {
  if (preset === 'closeup') return CLOSEUP_CAMERA_ZOOM;
  if (preset === 'wide') return WIDE_CAMERA_ZOOM;
  if (preset === 'overview') return 1;
  return undefined;
}

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
  className = 'dg-live-region',
  style,
  dataPart,
}: {
  state: BoardState;
  entry: EntryPlan;
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
  // replace (node count can drop) and cue-gated entrances.
  const announced = entry.entered;
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
  /** "auto" follows newly entered nodes; "off" disables the virtual camera (§6.12). */
  camera?: 'auto' | 'off';
  /**
   * Optional student camera control (§6.12). `"pinch-pan"` enables one-finger
   * drag-pan and two-finger pinch-zoom inside the board and shows a reset-view
   * control while the student has moved the camera. The next tutor camera move
   * (or reset) releases the student's override. Defaults to `"none"`.
   */
  cameraControls?: 'none' | 'pinch-pan';
  /**
   * Per-aspect exam-mode locks (§6.8). Defaults to every distraction lock on
   * while an assessment in `exam` mode is active; pass `{ camera: false }` etc.
   * to opt out of an aspect. Locked tutor ops are queued or rejected by the
   * store's resolver (`examLocks`/`examLockStrategy` options).
   */
  examLocks?: Partial<ExamLockPolicy>;
  /** "auto" uses the resolved preset, "lite" halves particles, "off" disables (§6.9). */
  ambience?: 'auto' | 'off' | 'lite';
  /** Recede previously entered scenes (§9.2). Defaults to true. */
  recede?: boolean;
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
  cameraControls = 'none',
  examLocks,
  ambience = 'auto',
  recede = true,
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

  const exam = examLocksFor(Object.values(state.assessments), examLocks);
  const examActive = Object.values(exam).some(Boolean);
  /** Exam mode is calm and silent: no camera, no ambience, no cue pacing (§6.8). */
  const effectiveCamera = exam.camera ? 'off' : camera;
  const effectiveAmbience = exam.ambience ? 'off' : ambience;
  const effectivePacing = examActive ? 'auto' : (pacing ?? defaultPacing(state));
  const entry = computeEntryPlan(state, effectivePacing);
  const enteredKey = entry.entered.join('\u0000');

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
  const orderedIds = Object.keys(state.nodes).filter((id) => entered.has(id));
  const pending = entry.pending;

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
    // orderedIds/state.nodes change together with entry; recomputing per
    // render is fine (pure, cheap) — the memo only avoids reallocating maps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enteredKey, layoutModel]
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
  // Exam calm: near-instant entrances, no kinetic choreography (§6.8).
  const effectiveTempo = exam.kinetic ? 1000 : tempo;

  // ---- camera (§6.12) ----
  const boardRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(IDENTITY_CAMERA);
  const [cameraToken, setCameraToken] = useState(0);
  const [userMoved, setUserMoved] = useState(false);
  const cameraStateRef = useRef(cameraState);
  cameraStateRef.current = cameraState;
  const userMovedRef = useRef(false);
  const tutorCameraRef = useRef<CameraState>(IDENTITY_CAMERA);
  const holdCameraUntilRef = useRef(0);
  const detourRef = useRef<string | null>(detour?.id ?? null);
  detourRef.current = detour?.id ?? null;

  /** Execute one validated camera move. Presentation-only; never in state. */
  const applyCamera = useCallback(
    (move: CameraMove, instant = false) => {
      const board = boardRef.current;
      const content = cameraRef.current;
      if (!board || !content) return;

      const to = move.to ?? (move.preset === 'overview' ? 'overview' : undefined);
      const ease = move.ease ?? 'smooth';
      const duration = instant ? 0 : Math.max(0, move.duration ?? 800);
      const tiltX = clampTilt(move.tilt?.x);
      const tiltY = clampTilt(move.tilt?.y);
      const dolly = resolveDolly(move.dolly);

      if (to === 'overview' || (!to && move.preset === 'overview')) {
        const next: CameraState = {
          ...IDENTITY_CAMERA,
          scale: clamp(move.zoom ?? 1, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
          tiltX,
          tiltY,
          dolly,
          duration,
          ease,
        };
        tutorCameraRef.current = next;
        userMovedRef.current = false;
        setUserMoved(false);
        setCameraState(next);
        setCameraToken((token) => token + 1);
        return;
      }

      if (to) {
        const target = resolveTargetElement(board, to);
        if (!target) return;

        // Reduced motion: plain scroll-into-view, no transform (§6.12/§7.9).
        if (prefersReduced) {
          target.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
          return;
        }

        const contentRect = content.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const originX = contentRect.width > 0 ? ((targetRect.left + targetRect.width / 2 - contentRect.left) / contentRect.width) * 100 : 50;
        const originY = contentRect.height > 0 ? ((targetRect.top + targetRect.height / 2 - contentRect.top) / contentRect.height) * 100 : 50;

        // Bring the target on screen first; the push-in then has something to hold.
        target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });

        const next: CameraState = {
          scale: clamp(move.zoom ?? presetZoom(move.preset) ?? 1.2, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
          originX: clamp(originX, 0, 100),
          originY: clamp(originY, 0, 100),
          translateX: 0,
          translateY: 0,
          tiltX,
          tiltY,
          dolly,
          duration,
          ease,
        };
        tutorCameraRef.current = next;
        userMovedRef.current = false;
        setUserMoved(false);
        setCameraState(next);
        setCameraToken((token) => token + 1);
        return;
      }

      if (prefersReduced) return;

      // A zoom/preset with no target keeps the current focus and only changes depth.
      const current = cameraStateRef.current;
      const next: CameraState = {
        ...current,
        scale: clamp(move.zoom ?? presetZoom(move.preset) ?? current.scale, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
        tiltX,
        tiltY,
        dolly,
        duration,
        ease,
      };
      tutorCameraRef.current = next;
      userMovedRef.current = false;
      setUserMoved(false);
      setCameraState(next);
      setCameraToken((token) => token + 1);
    },
    [prefersReduced]
  );

  const moveCamera = useCallback(
    (to: string, zoom = 1.2, duration = 800, ease: EaseName = 'smooth', instant = false) => {
      applyCamera({ to, zoom, duration, ease }, instant);
    },
    [applyCamera]
  );

  // Reduced motion wins over any in-flight transform.
  useEffect(() => {
    if (!prefersReduced) return;
    setCameraState((current) =>
      current.scale === 1 && current.tiltX === 0 && current.tiltY === 0 && current.dolly === 0
        ? current
        : { ...IDENTITY_CAMERA, duration: 0 }
    );
  }, [prefersReduced]);

  // Auto camera: push in on the newest entered node, then return to overview.
  const autoReturnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEnteredRef = useRef<Set<string>>(new Set());

  // Guided camera paths: each step may wait for its own cue (§6.12).
  const pathRunRef = useRef(0);
  const pathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathCueUnsubRef = useRef<(() => void) | null>(null);

  const cancelCameraPath = useCallback(() => {
    pathRunRef.current += 1;
    if (pathTimerRef.current) {
      clearTimeout(pathTimerRef.current);
      pathTimerRef.current = null;
    }
    pathCueUnsubRef.current?.();
    pathCueUnsubRef.current = null;
  }, []);

  const runCameraOp = useCallback(
    (op: CameraMove & { path?: CameraMove[] }) => {
      cancelCameraPath();
      const run = pathRunRef.current;
      const steps: CameraMove[] = op.path ?? [op];

      const schedule = (index: number): void => {
        if (run !== pathRunRef.current) return;
        const step = steps[index];
        if (!step) return;
        const trigger = step.trigger;
        if (trigger?.on === 'cue' && !store.getState().firedCues.includes(trigger.id)) {
          pathCueUnsubRef.current = store.cueBus.subscribe((cueId) => {
            if (cueId !== trigger.id) return;
            pathCueUnsubRef.current?.();
            pathCueUnsubRef.current = null;
            play(index);
          });
          return;
        }
        play(index);
      };

      const play = (index: number): void => {
        if (run !== pathRunRef.current) return;
        const step = steps[index];
        if (!step) return;
        requestAnimationFrame(() => {
          if (run !== pathRunRef.current || detourRef.current) return;
          applyCamera(step);
        });
        pathTimerRef.current = setTimeout(
          () => schedule(index + 1),
          (step.duration ?? 800) + 80
        );
      };

      schedule(0);
    },
    [applyCamera, cancelCameraPath, store]
  );

  // Explicit `camera` ops are validated by the resolver and executed here;
  // rAF lets the append from the same reply commit first.
  useEffect(() => {
    const off = store.cameraBus.subscribe((move) => {
      // `camera="off"` disables the virtual camera entirely (§6.12).
      if (effectiveCamera !== 'auto') return;
      // An explicit move owns the frame: cancel any pending auto-return so it
      // cannot snap the camera back mid-move.
      if (autoReturnRef.current) {
        clearTimeout(autoReturnRef.current);
        autoReturnRef.current = null;
      }
      holdCameraUntilRef.current = Date.now() + (move.duration ?? 800) + 800;
      runCameraOp(move);
    });
    return () => {
      off();
      cancelCameraPath();
    };
  }, [store, effectiveCamera, runCameraOp, cancelCameraPath]);

  useEffect(() => {
    const previously = prevEnteredRef.current;
    const next = new Set(entry.entered);
    const fresh = entry.entered.filter((id) => !previously.has(id));
    prevEnteredRef.current = next;
    if (fresh.length === 0) return;

    const newest = fresh[fresh.length - 1];
    if (!newest) return;
    const node = resolveTargetElement(boardRef.current, newest);
    node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });

    if (effectiveCamera !== 'auto' || prefersReduced || detourRef.current || userMovedRef.current) return;
    if (Date.now() < holdCameraUntilRef.current) return;
    moveCamera(newest, AUTO_CAMERA_ZOOM, 700, 'smooth');
    if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
    autoReturnRef.current = setTimeout(() => {
      // A camera op that arrived while this timer ran owns the frame.
      if (Date.now() < holdCameraUntilRef.current) return;
      if (detourRef.current || userMovedRef.current) return;
      moveCamera('overview', 1, 800, 'smooth');
    }, AUTO_CAMERA_HOLD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredKey, effectiveCamera, prefersReduced, moveCamera]);

  useEffect(
    () => () => {
      if (autoReturnRef.current) clearTimeout(autoReturnRef.current);
      cancelCameraPath();
    },
    [cancelCameraPath]
  );

  // ---- optional student pinch-pan (§6.12) ----
  interface PointerPoint {
    x: number;
    y: number;
  }
  interface CameraGesture {
    pointers: Map<number, PointerPoint>;
    start: CameraState;
    startPoint: PointerPoint;
    startDistance: number;
    width: number;
    height: number;
  }
  const gestureRef = useRef<CameraGesture | null>(null);

  const updateUserCamera = useCallback((next: Partial<CameraState>) => {
    userMovedRef.current = true;
    setUserMoved(true);
    setCameraState((current) => ({ ...current, ...next, duration: 0 }));
  }, []);

  const resetCamera = useCallback(() => {
    cancelCameraPath();
    userMovedRef.current = false;
    setUserMoved(false);
    setCameraState({ ...tutorCameraRef.current, duration: 400 });
    setCameraToken((token) => token + 1);
  }, [cancelCameraPath]);

  const onCameraPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (cameraControls !== 'pinch-pan' || effectiveCamera === 'off') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const gesture = gestureRef.current;
    const pointers = gesture?.pointers ?? new Map<number, PointerPoint>();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()];
    const startPoint = points[0] ?? { x: event.clientX, y: event.clientY };
    const startDistance =
      points.length > 1 && points[0] && points[1]
        ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        : 0;
    gestureRef.current = {
      pointers,
      start: cameraStateRef.current,
      startPoint,
      startDistance,
      width: Math.max(1, rect.width || 800),
      height: Math.max(1, rect.height || 600),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onCameraPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...gesture.pointers.values()];
    const start = gesture.start;

    if (points.length > 1 && points[0] && points[1]) {
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;
      const baseMidX = gesture.startPoint.x;
      const baseMidY = gesture.startPoint.y;
      const ratio = gesture.startDistance > 0 ? distance / gesture.startDistance : 1;
      updateUserCamera({
        scale: clamp(start.scale * ratio, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
        translateX: start.translateX + (midX - baseMidX),
        translateY: start.translateY + (midY - baseMidY),
      });
      event.preventDefault();
      return;
    }

    const point = points[0];
    if (!point) return;
    const dx = point.x - gesture.startPoint.x;
    const dy = point.y - gesture.startPoint.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    updateUserCamera({
      translateX: clamp(start.translateX + dx, -gesture.width, gesture.width),
      translateY: clamp(start.translateY + dy, -gesture.height, gesture.height),
    });
    event.preventDefault();
  };

  const onCameraPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gesture.pointers.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const remaining = [...gesture.pointers.values()];
    if (remaining.length === 0) {
      gestureRef.current = null;
      return;
    }
    const point = remaining[0];
    if (!point) return;
    gestureRef.current = {
      pointers: new Map(gesture.pointers),
      start: cameraStateRef.current,
      startPoint: point,
      startDistance: 0,
      width: gesture.width,
      height: gesture.height,
    };
  };

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
      transform: `translate(${cameraState.translateX}px, ${cameraState.translateY}px) scale(${cameraState.scale})`,
      transformOrigin: `${cameraState.originX}% ${cameraState.originY}%`,
      transition:
        cameraState.duration > 0
          ? `transform ${cameraState.duration}ms ${CAMERA_EASE[cameraState.ease]}`
          : 'none',
      touchAction: cameraControls === 'pinch-pan' && effectiveCamera === 'auto' ? 'pan-y' : undefined,
    }),
    [cameraState, cameraControls, effectiveCamera]
  );

  // Tilt/dolly live on variables consumed by figure layers and the backdrop,
  // never by text blocks (§6.12). A camera push-in stays a flat transform.
  const cameraVars = useMemo<CSSProperties>(
    () =>
      ({
        '--dg-camera-tilt-x': `${cameraState.tiltX}deg`,
        '--dg-camera-tilt-y': `${cameraState.tiltY}deg`,
        '--dg-camera-dolly-z': `${cameraState.dolly}px`,
        '--dg-camera-duration': `${cameraState.duration}ms`,
      }) as CSSProperties,
    [cameraState]
  );

  const cameraDepthStyle = useMemo<CSSProperties>(
    () => ({
      transform: `perspective(1200px) rotateX(${cameraState.tiltX}deg) rotateY(${cameraState.tiltY}deg) translateZ(${cameraState.dolly}px)`,
      transition:
        cameraState.duration > 0
          ? `transform ${cameraState.duration}ms ${CAMERA_EASE[cameraState.ease]}`
          : 'none',
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
  const cameraResetPart = bp('camera-reset', 'dg-camera-reset');
  const boardStyle = boardPart.style
    ? { ...style, ...cameraVars, ...boardPart.style }
    : { ...style, ...cameraVars };

  return (
    <BoardStoreProvider store={store} status={status}>
    <TempoContext.Provider value={effectiveTempo}>
      <BoardEmitContext.Provider value={emit}>
        <BoardErrorContext.Provider value={reportError}>
        <AnatomyProvider classNames={partClassNames} styles={partStyles}>
          <section
            ref={boardRef}
            {...boardPart}
            aria-label={state.title ?? 'Blackboard'}
            data-dg-mood={theme?.mood ?? undefined}
            data-dg-surface={theme?.surface ?? undefined}
            data-dg-camera={effectiveCamera}
            data-dg-camera-controls={cameraControls}
            data-dg-camera-user={userMoved ? 'true' : undefined}
            data-dg-ambience={effectiveAmbience}
            data-dg-exam={examActive ? 'true' : undefined}
            data-dg-recede={recede ? 'true' : undefined}
            data-dg-detour-open={detour ? placement ?? 'true' : undefined}
            data-dg-density={density}
            dir={dir}
            style={boardStyle}
          >
            <div className="dg-camera-backdrop" data-dg-camera-backdrop="" style={cameraDepthStyle} aria-hidden="true">
              <AmbienceLayer
                preset={ambiencePreset}
                texture={theme?.tokens.texture}
                mode={effectiveAmbience}
                reducedMotion={prefersReduced}
              />
            </div>
            <LiveAnnouncer
              state={state}
              entry={entry}
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
              onPointerDown={onCameraPointerDown}
              onPointerMove={onCameraPointerMove}
              onPointerUp={onCameraPointerUp}
              onPointerCancel={onCameraPointerUp}
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

            {cameraControls === 'pinch-pan' && effectiveCamera === 'auto' && userMoved && (
              <button
                type="button"
                {...cameraResetPart}
                onClick={resetCamera}
                aria-label={t('board.resetView')}
              >
                {t('board.resetView')}
              </button>
            )}

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
