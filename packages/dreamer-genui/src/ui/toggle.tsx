'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cx } from './lib';

export type ToggleVariant = 'default' | 'outline';
export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps extends ComponentPropsWithoutRef<typeof TogglePrimitive.Root> {
  variant?: ToggleVariant;
  size?: ToggleSize;
}

export const Toggle = forwardRef<ElementRef<typeof TogglePrimitive.Root>, ToggleProps>(
  function Toggle({ className, variant = 'default', size = 'md', ...props }, ref) {
    return (
      <TogglePrimitive.Root
        ref={ref}
        className={cx('dg-ui-toggle', `dg-ui-toggle-${variant}`, `dg-ui-toggle-${size}`, className)}
        {...props}
      />
    );
  }
);
