'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cx } from './lib';

export const ScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root ref={ref} className={cx('dg-ui-scroll-area', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="dg-ui-scroll-viewport">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="dg-ui-scrollbar">
        <ScrollAreaPrimitive.Thumb className="dg-ui-scrollbar-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar orientation="horizontal" className="dg-ui-scrollbar">
        <ScrollAreaPrimitive.Thumb className="dg-ui-scrollbar-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner className="dg-ui-scroll-corner" />
    </ScrollAreaPrimitive.Root>
  );
});

export const ScrollAreaViewport = ScrollAreaPrimitive.Viewport;
export const ScrollAreaScrollbar = ScrollAreaPrimitive.Scrollbar;
export const ScrollAreaThumb = ScrollAreaPrimitive.Thumb;
