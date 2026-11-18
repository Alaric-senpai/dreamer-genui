'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export function Empty({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cx('dg-ui-empty', className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-empty-header', className)} {...props} />;
}

export function EmptyMedia({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-empty-media', className)} aria-hidden="true" {...props} />;
}

export function EmptyTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx('dg-ui-empty-title', className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('dg-ui-empty-description', className)} {...props} />;
}

export function EmptyContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-empty-content', className)} {...props} />;
}
