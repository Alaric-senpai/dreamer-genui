'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cx } from './lib';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root ref={ref} className={cx('dg-ui-switch', className)} {...props}>
      <SwitchPrimitive.Thumb className="dg-ui-switch-thumb" />
    </SwitchPrimitive.Root>
  );
});
