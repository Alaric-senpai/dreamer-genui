'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: 'info' | 'success' | 'warn' | 'danger';
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Alert({ tone = 'info', title, icon, className, children, ...props }: AlertProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('dg-ui-alert', `dg-ui-alert-${tone}`, className)} {...props}>
      {icon ? <span className="dg-ui-alert-icon" aria-hidden="true">{icon}</span> : null}
      <div className="dg-ui-alert-body">
        {title ? <strong className="dg-ui-alert-title">{title}</strong> : null}
        <div className="dg-ui-alert-content">{children}</div>
      </div>
    </div>
  );
}
