'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cx } from './lib';

/** Host-only text input (token-themed, 44px minimum target). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return <input ref={ref} type={type} className={cx('dg-ui-input', className)} {...props} />;
  }
);
