'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cx } from './lib';

export const ButtonGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function ButtonGroup({ className, role = 'group', ...props }, ref) {
    return <div ref={ref} role={role} className={cx('dg-ui-button-group', className)} {...props} />;
  },
);

export function ButtonGroupText({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-button-group-text', className)} {...props} />;
}

export const ButtonGroupSeparator = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  function ButtonGroupSeparator({ className, ...props }, ref) {
    return <span ref={ref} aria-hidden="true" className={cx('dg-ui-button-group-separator', className)} {...props} />;
  },
);
