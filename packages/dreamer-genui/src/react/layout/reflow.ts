import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Animated re-flow for the `layout` op (§6.4). FLIP over top-level node
 * positions: the pre-commit capture happens when the layout op arrives (the
 * bus fires before React re-renders), and a layout effect diffs it against
 * the committed DOM, animating the delta with the Web Animations API.
 *
 * Transform-only (no width/height interpolation): layout regions resize the
 * tracks instantly while node positions glide. Reduced motion skips the
 * animation entirely — the brief's "instant" collapse. Deliberately not
 * motion's shared layout: `domAnimation` features stay lighter than the
 * layout-projection bundle, and nodes are plain divs here.
 */

/** Top-level node id → viewport-relative rect, captured pre-commit. */
export type ReflowRects = Map<string, { left: number; top: number }>;

/** Capture current top-level node positions, or null when unmounted. */
export function captureReflowRects(content: HTMLElement | null): ReflowRects | null {
  if (!content) return null;
  const rects: ReflowRects = new Map();
  for (const el of content.querySelectorAll<HTMLElement>("[data-dg-board-node='true']")) {
    const id = el.getAttribute('data-node-id');
    if (!id) continue;
    const rect = el.getBoundingClientRect();
    rects.set(id, { left: rect.left, top: rect.top });
  }
  return rects;
}

/**
 * Runs after every commit; when a pending capture exists it animates node
 * deltas. `pending` holds `{ rects, duration, ease }` set by the layout-bus
 * subscription; set `enabled` false under reduced motion or exam mode.
 */
export function useLayoutReflow(
  contentRef: RefObject<HTMLElement | null>,
  pending: RefObject<{ rects: ReflowRects; duration: number; ease: string } | null>,
  enabled: boolean,
  defaultDuration = 600,
  defaultEase = 'cubic-bezier(0.22, 1, 0.36, 1)'
): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useLayoutEffect(() => {
    const spec = pending.current;
    if (!spec) return;
    pending.current = null;
    if (!enabledRef.current) return;
    const content = contentRef.current;
    if (!content) return;

    for (const el of content.querySelectorAll<HTMLElement>("[data-dg-board-node='true']")) {
      const id = el.getAttribute('data-node-id');
      const prev = id ? spec.rects.get(id) : undefined;
      if (!prev) continue;
      const rect = el.getBoundingClientRect();
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        {
          duration: spec.duration || defaultDuration,
          easing: spec.ease || defaultEase,
        }
      );
    }
  });
}
