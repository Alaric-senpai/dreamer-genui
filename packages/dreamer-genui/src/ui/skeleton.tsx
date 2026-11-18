'use client';

import type { HTMLAttributes } from 'react';
import { cx } from './lib';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cx('dg-ui-skeleton', className)} {...props} />;
}
