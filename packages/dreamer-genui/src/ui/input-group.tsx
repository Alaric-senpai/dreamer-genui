'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cx } from './lib';

export const InputGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function InputGroup({ className, ...props }, ref) {
    return <div ref={ref} className={cx('dg-ui-input-group', className)} {...props} />;
  },
);

export function InputGroupAddon({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-input-group-addon', className)} {...props} />;
}

export const InputGroupInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
  function InputGroupInput({ className, ...props }, ref) {
    return <input ref={ref} className={cx('dg-ui-input-group-input', className)} {...props} />;
  },
);

export const InputGroupTextarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  function InputGroupTextarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx('dg-ui-input-group-textarea', className)} {...props} />;
  },
);

export function InputGroupText({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-input-group-text', className)} {...props} />;
}
