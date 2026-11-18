'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cx } from './lib';

/** Host-only form label; Radix keeps it associated with its control. */
export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return <LabelPrimitive.Root ref={ref} className={cx('dg-ui-label', className)} {...props} />;
});
