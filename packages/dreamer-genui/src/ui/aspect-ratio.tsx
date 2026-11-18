'use client';

import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';
import { cx } from './lib';

export const AspectRatio = forwardRef<
  ElementRef<typeof AspectRatioPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>
>(function AspectRatio({ className, ...props }, ref) {
  return <AspectRatioPrimitive.Root ref={ref} className={cx('dg-ui-aspect-ratio', className)} {...props} />;
});
