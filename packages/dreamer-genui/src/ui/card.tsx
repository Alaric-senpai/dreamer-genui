'use client';

import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './lib';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'plain' | 'outlined' | 'elevated' | 'accent';
  children?: ReactNode;
}
export function Card({ variant = 'outlined', className, children, ...props }: CardProps) {
  return (
    <div className={cx('dg-ui-card', `dg-ui-card-${variant}`, className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-card-header', className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx('dg-ui-card-title', className)} {...props} />;
}
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('dg-ui-card-description', className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-card-content', className)} {...props} />;
}
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('dg-ui-card-footer', className)} {...props} />;
}

export const CardMedia = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  function CardMedia({ className, alt = '', ...props }, ref) {
    return <img ref={ref} alt={alt} className={cx('dg-ui-card-media', className)} {...props} />;
  }
);
