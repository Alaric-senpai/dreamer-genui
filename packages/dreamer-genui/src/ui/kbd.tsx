'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export interface KbdProps extends HTMLAttributes<HTMLSpanElement> {
  keys?: string[];
  children?: ReactNode;
  /** Accessible name for the shortcut group. */
  label?: string;
}

export function Kbd({ keys, children, label = 'Keyboard shortcut', className, ...props }: KbdProps) {
  const items = keys ?? (typeof children === 'string' ? children.split('+').map(key => key.trim()).filter(Boolean) : []);
  return (
    <span role="group" aria-label={label} className={cx('dg-ui-kbd', className)} {...props}>
      {items.length > 0
        ? items.map((key, i) => (
            <kbd key={`${key}-${i}`} className="dg-ui-kbd-key">
              {key}
            </kbd>
          ))
        : children}
    </span>
  );
}
