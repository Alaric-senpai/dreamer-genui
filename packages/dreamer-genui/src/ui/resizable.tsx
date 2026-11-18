'use client';

import { createContext, forwardRef, useCallback, useContext, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cx } from './lib';

type Direction = 'horizontal' | 'vertical';

interface ResizableContextValue {
  direction: Direction;
  sizes: number[];
  setSizes: (next: number[]) => void;
  container: React.RefObject<HTMLDivElement | null>;
}

const ResizableContext = createContext<ResizableContextValue | null>(null);

export interface ResizablePanelGroupProps extends ComponentPropsWithoutRef<'div'> {
  direction?: Direction;
  /** Initial panel percentages; defaults to equal shares. */
  defaultSizes?: number[];
}

export const ResizablePanelGroup = forwardRef<HTMLDivElement, ResizablePanelGroupProps>(
  function ResizablePanelGroup({ direction = 'horizontal', defaultSizes, className, children, ...props }, ref) {
    const container = useRef<HTMLDivElement | null>(null);
    const panels = Array.isArray(children) ? children.length : 1;
    const [sizes, setSizes] = useState<number[]>(
      defaultSizes ?? Array.from({ length: Math.max(panels, 1) }, () => 100 / Math.max(panels, 1)),
    );

    return (
      <ResizableContext.Provider value={{ direction, sizes, setSizes, container }}>
        <div
          ref={(el) => {
            container.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          className={cx('dg-ui-resizable', `dg-ui-resizable-${direction}`, className)}
          data-dg-direction={direction}
          {...props}
        >
          {children}
        </div>
      </ResizableContext.Provider>
    );
  },
);

export interface ResizablePanelProps extends ComponentPropsWithoutRef<'div'> {
  index?: number;
}

export const ResizablePanel = forwardRef<HTMLDivElement, ResizablePanelProps>(function ResizablePanel(
  { index = 0, className, style, ...props },
  ref,
) {
  const ctx = useContext(ResizableContext);
  const size = ctx?.sizes[index] ?? 100;
  const flexBasis = ctx?.direction === 'vertical' ? undefined : `calc(${size}% - 4px)`;
  const flexHeight = ctx?.direction === 'vertical' ? `calc(${size}% - 4px)` : undefined;
  return (
    <div
      ref={ref}
      className={cx('dg-ui-resizable-panel', className)}
      style={{ flexBasis, height: flexHeight, ...style }}
      {...props}
    />
  );
});

export interface ResizableHandleProps extends ComponentPropsWithoutRef<'div'> {
  /** Index of the panel before this handle. */
  index?: number;
  withHandle?: boolean;
  label?: string;
}

export const ResizableHandle = forwardRef<HTMLDivElement, ResizableHandleProps>(function ResizableHandle(
  { index = 0, withHandle = false, label = 'Resize panels', className, onKeyDown, ...props },
  ref,
) {
  const ctx = useContext(ResizableContext);
  const dragging = useRef(false);
  const direction = ctx?.direction ?? 'horizontal';

  const resize = useCallback(
    (deltaPx: number) => {
      if (!ctx) return;
      const rect = ctx.container.current?.getBoundingClientRect();
      const total = direction === 'horizontal' ? (rect?.width ?? 1) : (rect?.height ?? 1);
      const deltaPct = (deltaPx / total) * 100;
      const next = [...ctx.sizes];
      const a = next[index] ?? 50;
      const b = next[index + 1] ?? 50;
      const moved = Math.max(-a + 10, Math.min(deltaPct, b - 10));
      next[index] = a + moved;
      next[index + 1] = b - moved;
      ctx.setSizes(next);
    },
    [ctx, direction, index],
  );

  return (
    <div
      ref={ref}
      role="separator"
      aria-label={label}
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(ctx?.sizes[index] ?? 50)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      className={cx('dg-ui-resizable-handle', className)}
      data-dg-direction={direction}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        resize(direction === 'horizontal' ? event.movementX : event.movementY);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const step = event.shiftKey ? 10 : 2;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          resize(-step);
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          resize(step);
        }
      }}
      {...props}
    >
      {withHandle ? <span className="dg-ui-resizable-grip" aria-hidden="true" /> : null}
    </div>
  );
});

export type ResizableHandleRef = ElementRef<'div'>;
