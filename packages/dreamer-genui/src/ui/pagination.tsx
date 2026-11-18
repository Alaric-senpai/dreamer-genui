'use client';

import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav role="navigation" aria-label="Pagination" className={cx('dg-ui-pagination', className)} {...props} />;
}

export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cx('dg-ui-pagination-content', className)} {...props} />;
}

export function PaginationItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cx('dg-ui-pagination-item', className)} {...props} />;
}

export interface PaginationLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PaginationLink({ className, isActive, size = 'md', ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? '' : undefined}
      className={cx('dg-ui-pagination-link', `dg-ui-pagination-link-${size}`, className)}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, children = 'Previous', ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to previous page" className={cx('dg-ui-pagination-previous', className)} {...props}>
      <span aria-hidden="true">‹</span>
      {children}
    </PaginationLink>
  );
}

export function PaginationNext({ className, children = 'Next', ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to next page" className={cx('dg-ui-pagination-next', className)} {...props}>
      {children}
      <span aria-hidden="true">›</span>
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cx('dg-ui-pagination-ellipsis', className)} {...props}>
      …
    </span>
  );
}

export function PaginationSpacer({ children }: { children?: ReactNode }) {
  return <span className="dg-ui-pagination-spacer">{children}</span>;
}
