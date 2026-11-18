'use client';

import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cx } from './lib';

/** Host-only multiline input. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cx('dg-ui-textarea', className)} {...props} />;
  }
);
