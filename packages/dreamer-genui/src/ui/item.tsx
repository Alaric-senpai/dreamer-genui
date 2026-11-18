'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cx } from './lib';

export const ItemGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function ItemGroup({ className, ...props }, ref) {
    return <div ref={ref} role="list" className={cx('dg-ui-item-group', className)} {...props} />;
  },
);

export const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function Item({ className, ...props }, ref) {
    return <div ref={ref} role="listitem" className={cx('dg-ui-item', className)} {...props} />;
  },
);

export const ItemMedia = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function ItemMedia({ className, ...props }, ref) {
    return <div ref={ref} aria-hidden="true" className={cx('dg-ui-item-media', className)} {...props} />;
  },
);

export function ItemContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-item-content', className)} {...props} />;
}

export function ItemTitle({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-item-title', className)} {...props} />;
}

export function ItemDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cx('dg-ui-item-description', className)} {...props} />;
}

export function ItemActions({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-item-actions', className)} {...props} />;
}

export function ItemHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-item-header', className)} {...props} />;
}

export function ItemFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-item-footer', className)} {...props} />;
}

export const ItemSeparator = forwardRef<ElementRef<'span'>, ComponentPropsWithoutRef<'span'>>(
  function ItemSeparator({ className, ...props }, ref) {
    return <span ref={ref} role="separator" className={cx('dg-ui-item-separator', className)} {...props} />;
  },
);
