'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cx } from './lib';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  asChild?: boolean;
}

/** Host-only button: token-themed, tap-first, RTL-safe (§7.16). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', asChild = false, type, ...props },
  ref
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      className={cx('dg-ui-button', `dg-ui-button-${variant}`, `dg-ui-button-${size}`, className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
});
