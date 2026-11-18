'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  children?: ReactNode;
}

export function Heading({ level = 2, className, ...props }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Tag className={cx('dg-ui-heading', `dg-ui-heading-${level}`, className)} {...props} />;
}

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div';
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}

export function Text({ as: Tag = 'p', size = 'md', muted = false, className, ...props }: TextProps) {
  return (
    <Tag
      className={cx('dg-ui-text', `dg-ui-text-${size}`, muted && 'dg-ui-text-muted', className)}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('dg-ui-lead', className)} {...props} />;
}

export function Muted({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('dg-ui-muted', className)} {...props} />;
}

export function Blockquote({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) {
  return <blockquote className={cx('dg-ui-blockquote', className)} {...props} />;
}

export function Code({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={cx('dg-ui-code', className)} {...props} />;
}

export function InlineCode({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={cx('dg-ui-inline-code', className)} {...props} />;
}
