'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cx } from './lib';

export const ToggleGroup = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ className, ...props }, ref) {
  return <ToggleGroupPrimitive.Root ref={ref} className={cx('dg-ui-toggle-group', className)} {...props} />;
});

export const ToggleGroupItem = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & { size?: 'sm' | 'md' | 'lg' }
>(function ToggleGroupItem({ className, size = 'md', ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cx('dg-ui-toggle-group-item', `dg-ui-toggle-${size}`, className)}
      {...props}
    />
  );
});
