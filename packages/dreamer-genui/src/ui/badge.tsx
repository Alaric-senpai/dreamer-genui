'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'info' | 'success' | 'warn' | 'danger' | 'muted';
  children?: ReactNode;
}

export function Badge({ tone = 'accent', className, children, ...props }: BadgeProps) {
  return (
    <span className={cx('dg-ui-badge', `dg-ui-badge-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
