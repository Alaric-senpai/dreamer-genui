'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cx } from './lib';

export const Avatar = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }
>(function Avatar({ className, size = 'md', ...props }, ref) {
  return <AvatarPrimitive.Root ref={ref} className={cx('dg-ui-avatar', `dg-ui-avatar-${size}`, className)} {...props} />;
});

export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return <AvatarPrimitive.Image ref={ref} className={cx('dg-ui-avatar-image', className)} {...props} />;
});

export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return <AvatarPrimitive.Fallback ref={ref} className={cx('dg-ui-avatar-fallback', className)} {...props} />;
});
