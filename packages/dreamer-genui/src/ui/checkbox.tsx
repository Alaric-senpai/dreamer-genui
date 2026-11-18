'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cx } from './lib';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root ref={ref} className={cx('dg-ui-checkbox', className)} {...props}>
      <CheckboxPrimitive.Indicator className="dg-ui-checkbox-indicator">✓</CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
