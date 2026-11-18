'use client';

import type { AnchorHTMLAttributes, HTMLAttributes, LiHTMLAttributes, OlHTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cx('dg-ui-breadcrumb', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: OlHTMLAttributes<HTMLOListElement>) {
  return <ol className={cx('dg-ui-breadcrumb-list', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cx('dg-ui-breadcrumb-item', className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cx('dg-ui-breadcrumb-link', className)} {...props} />;
}

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cx('dg-ui-breadcrumb-page', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, children = '/', ...props }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) {
  return (
    <span role="presentation" aria-hidden="true" className={cx('dg-ui-breadcrumb-separator', className)} {...props}>
      {children}
    </span>
  );
}

export function BreadcrumbEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cx('dg-ui-breadcrumb-ellipsis', className)} {...props}>
      …
    </span>
  );
}
