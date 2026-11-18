'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './lib';

export interface SpinnerProps extends ComponentPropsWithoutRef<'span'> {
  /** Accessible label; defaults to "Loading". */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, label = 'Loading', size = 'md', ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx('dg-ui-spinner', `dg-ui-spinner-${size}`, className)}
      {...props}
    />
  );
}
