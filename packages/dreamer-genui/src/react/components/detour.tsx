'use client';

/**
 * Attachment/detour presentation (§7.5, M4).
 *
 * Placement is resolved by the board (inline/below stay in document flow;
 * side/overlay/drawer/spotlight float above it). This module renders the
 * detour content, its scoped theme, the built-in return control, the target
 * annotation and the SVG connector. The hand-drawn stroke primitives are M5;
 * M4 draws an explicit line/arrow/bracket so the relationship is legible.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Detour, DetourPlacement } from '../../core/types';
import { tokensToVars, type CssTokens } from '../../theme/tokens';
import type { UIStrings } from '../provider';
import { useEmitEvent } from '../provider';
import { NodeView } from './block-renderer';

export type EffectivePlacement = DetourPlacement | 'drawer' | 'spotlight';

const SIDE_MIN_BOARD = 900;
const DETOUR_GAP = 18;
const NARROW_BOARD = 720;
const EASE_NAMES = new Set(['smooth', 'snappy', 'overshoot', 'anticipate', 'linear']);

export function detourThemeStyle(detour: Detour): CSSProperties {
  if (!detour.theme) return {};
  const vars: CssTokens = tokensToVars(detour.theme.tokens);
  vars['--dg-theme-duration'] = `${detour.theme.transition.duration}ms`;
  vars['--dg-theme-ease'] = EASE_NAMES.has(detour.theme.transition.ease) ? detour.theme.transition.ease : 'smooth';
  return vars as CSSProperties;
}

/** Resolve the authored NodeRef to the rendered element (item first, then node). */
export function resolveTargetElement(root: HTMLElement | null, ref: string): HTMLElement | null {
  if (!root) return null;
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(ref) : ref.replace(/["\\]/g, '\\$&');
  return (
    root.querySelector<HTMLElement>(`[data-dg-target="${escaped}"]`) ??
    root.querySelector<HTMLElement>(`[data-node-id="${escaped.split('/')[0]}"]`)
  );
}

/**
 * Decide the rendered placement. Narrow boards fall back to below/inline
 * (§7.5); drawer and spotlight are modes, not placements, and win on wide
 * boards. Deterministic from the measured board width, so it never flickers
 * between renders.
 */
export function resolvePlacement(detour: Detour, boardWidth: number): EffectivePlacement {
  if (boardWidth > 0 && boardWidth < NARROW_BOARD) {
    if (detour.mode === 'drawer' || detour.mode === 'spotlight') return 'below';
    if (detour.placement !== 'inline' && detour.placement !== 'below') return 'below';
    return detour.placement;
  }
  if (detour.mode === 'drawer') return 'drawer';
  if (detour.mode === 'spotlight') return 'spotlight';
  if (boardWidth > 0 && boardWidth < SIDE_MIN_BOARD) {
    if (detour.placement !== 'inline' && detour.placement !== 'below') return 'below';
  }
  return detour.placement;
}

export function isFlowPlacement(placement: EffectivePlacement): placement is 'inline' | 'below' {
  return placement === 'inline' || placement === 'below';
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface DetourViewProps {
  detour: Detour;
  strings: UIStrings;
  onReturn: (detour: Detour) => void;
  placement: EffectivePlacement;
  /** Focus the region when it appears (floating detours wait for layout). */
  autoFocus?: boolean;
  className?: string;
  style?: CSSProperties;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function DetourView({
  detour,
  strings,
  onReturn,
  placement,
  autoFocus = true,
  className,
  style,
  containerRef,
}: DetourViewProps): ReactNode {
  const emit = useEmitEvent();
  const localRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    if (focusedRef.current === detour.id) return;
    focusedRef.current = detour.id;
    // Keep the page still; the board/camera owns scroll.
    localRef.current?.focus?.({ preventScroll: true });
  }, [autoFocus, detour.id]);

  function close(): void {
    emit({ type: 'action', action: 'return', nodeId: detour.targetNodeId });
    onReturn(detour);
  }

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (containerRef) containerRef.current = node;
      }}
      className={`dg-detour dg-detour-placement-${placement} dg-detour-mode-${detour.mode}${className ? ` ${className}` : ''}`}
      data-dg-detour={detour.id}
      data-dg-placement={placement}
      role="region"
      aria-label={strings.explainer}
      tabIndex={-1}
      style={{ ...detourThemeStyle(detour), ...style }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="dg-detour-blocks">
        {detour.blocks.map((block, i) => (
          <NodeView key={block.id} node={{ id: block.id, block, state: 'complete', altText: block.alt }} docIndex={i} />
        ))}
      </div>
      <button type="button" className="dg-detour-return" onClick={close}>
        <span aria-hidden="true" className="dg-detour-return-icon">↩</span>
        {strings.return}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating placement + connector
// ---------------------------------------------------------------------------

interface Layout {
  placement: EffectivePlacement;
  top: number;
  left: number;
  width: number;
  height: number;
  anchor: { x: number; y: number; w: number; h: number } | null;
}

export interface FloatingDetourProps extends Omit<DetourViewProps, 'placement'> {
  boardRef: RefObject<HTMLElement | null>;
  /** Re-measure when the camera transform changes. */
  cameraToken?: string;
}

export function FloatingDetour({ boardRef, cameraToken, ...props }: FloatingDetourProps): ReactNode {
  const { detour } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = (): void => {
      const board = boardRef.current;
      const el = containerRef.current;
      if (!board || !el) return;
      const boardRect = board.getBoundingClientRect();
      const content = board.querySelector<HTMLElement>('.dg-board-content');
      const contentRect = content?.getBoundingClientRect() ?? boardRect;
      const target = resolveTargetElement(board, detour.targetRef ?? detour.targetNodeId);
      const node = board.querySelector<HTMLElement>(`[data-node-id="${cssEscape(detour.targetNodeId)}"]`) ?? target;
      const anchor = target?.getBoundingClientRect() ?? null;
      const nodeRect = node?.getBoundingClientRect() ?? null;
      const height = el.offsetHeight;
      const placement = resolvePlacement(detour, boardRect.width);
      const sideWidth = Math.max(240, Math.min(360, boardRect.width * 0.4));
      const pad = 10;
      let top = 0;
      let left = 0;
      let width = sideWidth;

      if (placement === 'drawer') {
        width = Math.max(260, Math.min(380, boardRect.width * 0.86));
        top = pad;
        left = boardRect.width - width - pad;
      } else if (placement === 'spotlight' || placement === 'overlay') {
        width = Math.max(280, Math.min(560, contentRect.width));
        left = (boardRect.width - width) / 2;
        top = Math.max(pad, (boardRect.height - height) / 2);
      } else if (placement === 'right') {
        const anchorRight = anchor ? anchor.right - boardRect.left : contentRect.right - boardRect.left;
        left = anchorRight + DETOUR_GAP;
        if (left + sideWidth > boardRect.width - pad) left = boardRect.width - sideWidth - pad;
        top = anchor ? anchor.top - boardRect.top + anchor.height / 2 - height / 2 : pad;
      } else if (placement === 'left') {
        const anchorLeft = anchor ? anchor.left - boardRect.left : contentRect.left - boardRect.left;
        left = anchorLeft - sideWidth - DETOUR_GAP;
        if (left < pad) left = pad;
        top = anchor ? anchor.top - boardRect.top + anchor.height / 2 - height / 2 : pad;
      } else if (placement === 'above') {
        width = Math.max(280, Math.min(480, contentRect.width));
        left = contentRect.left - boardRect.left + (contentRect.width - width) / 2;
        top = (nodeRect?.top ?? boardRect.top) - boardRect.top - height - DETOUR_GAP;
      } else {
        width = Math.max(280, Math.min(480, contentRect.width));
        left = contentRect.left - boardRect.left + (contentRect.width - width) / 2;
        top = (nodeRect?.bottom ?? boardRect.top) - boardRect.top + DETOUR_GAP;
      }

      const maxTop = Math.max(pad, boardRect.height - height - pad);
      top = Math.min(maxTop, Math.max(pad, top));
      left = Math.min(Math.max(pad, left), Math.max(pad, boardRect.width - width - pad));

      setLayout({
        placement,
        top,
        left,
        width,
        height,
        anchor: anchor
          ? {
              x: anchor.left - boardRect.left,
              y: anchor.top - boardRect.top,
              w: anchor.width,
              h: anchor.height,
            }
          : null,
      });
    };
    // Measure once synchronously so the first paint lands in the right place,
    // then again next frame for late layout (fonts, images, enter animations).
    measure();
    frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (observer) {
      if (boardRef.current) observer.observe(boardRef.current);
      if (containerRef.current) observer.observe(containerRef.current);
      const target = resolveTargetElement(boardRef.current, detour.targetRef ?? detour.targetNodeId);
      if (target) observer.observe(target);
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [boardRef, detour, cameraToken]);

  const ready = layout !== null;
  return (
    <>
      <div
        className="dg-detour-float"
        style={{
          top: layout?.top ?? 0,
          left: layout?.left ?? 0,
          width: layout?.width ?? 320,
          visibility: ready ? 'visible' : 'hidden',
        }}
      >
        <DetourView {...props} placement={layout?.placement ?? detour.placement} autoFocus={ready} containerRef={containerRef} className="dg-detour-floating" />
      </div>
      {layout?.anchor && detour.connector !== 'none' && (
        <Connector
          kind={detour.connector}
          placement={layout.placement}
          anchor={layout.anchor}
          detour={{ x: layout.left, y: layout.top, w: layout.width, h: layout.height }}
        />
      )}
    </>
  );
}

function Connector({
  kind,
  placement,
  anchor,
  detour,
}: {
  kind: Detour['connector'];
  placement: EffectivePlacement;
  anchor: { x: number; y: number; w: number; h: number };
  detour: { x: number; y: number; w: number; h: number };
}): ReactNode {
  const a = { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 };
  const edge = { x: anchor.x + anchor.w, y: a.y };
  let start = { x: anchor.x + anchor.w, y: a.y };
  let end = { x: detour.x, y: detour.y + detour.h / 2 };
  if (placement === 'left') {
    start = { x: anchor.x, y: a.y };
    end = { x: detour.x + detour.w, y: detour.y + detour.h / 2 };
  } else if (placement === 'above') {
    start = { x: a.x, y: anchor.y };
    end = { x: detour.x + detour.w / 2, y: detour.y + detour.h };
  } else if (placement === 'below' || placement === 'spotlight' || placement === 'overlay' || placement === 'drawer') {
    start = { x: a.x, y: anchor.y + anchor.h };
    end = { x: detour.x + detour.w / 2, y: detour.y };
  }
  void edge;
  const midX = (start.x + end.x) / 2;
  const path =
    placement === 'left' || placement === 'right'
      ? `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x} ${(start.y + end.y) / 2}, ${end.x} ${(start.y + end.y) / 2}, ${end.x} ${end.y}`;
  const marker = kind === 'arrow' ? (
    <polygon
      points={`${end.x},${end.y} ${end.x - 7},${end.y - 4} ${end.x - 7},${end.y + 4}`}
      className="dg-detour-connector-head"
      transform={`rotate(${placement === 'left' ? 180 : placement === 'above' ? -90 : placement === 'right' ? 0 : 90} ${end.x} ${end.y})`}
    />
  ) : kind === 'bracket' ? (
    <path d={`M ${end.x - 6} ${end.y - 8} L ${end.x} ${end.y} L ${end.x - 6} ${end.y + 8}`} className="dg-detour-connector-head" />
  ) : null;

  return (
    <svg className="dg-detour-connector" aria-hidden="true">
      <path d={path} pathLength={1} className="dg-detour-connector-path" />
      {marker}
    </svg>
  );
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
