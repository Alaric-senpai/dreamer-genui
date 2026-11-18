'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cx } from './lib';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return <ToastPrimitive.Viewport ref={ref} className={cx('dg-ui-toast-viewport', className)} {...props} />;
});

export const Toast = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { tone?: 'default' | 'success' | 'danger' }
>(function Toast({ className, tone = 'default', ...props }, ref) {
  return <ToastPrimitive.Root ref={ref} className={cx('dg-ui-toast', `dg-ui-toast-${tone}`, className)} {...props} />;
});

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return <ToastPrimitive.Title ref={ref} className={cx('dg-ui-toast-title', className)} {...props} />;
});

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return <ToastPrimitive.Description ref={ref} className={cx('dg-ui-toast-description', className)} {...props} />;
});

export const ToastClose = forwardRef<
  ElementRef<typeof ToastPrimitive.Close>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(function ToastClose({ className, children, ...props }, ref) {
  return (
    <ToastPrimitive.Close ref={ref} className={cx('dg-ui-toast-close', className)} {...props}>
      {children ?? '×'}
    </ToastPrimitive.Close>
  );
});

export const ToastAction = forwardRef<
  ElementRef<typeof ToastPrimitive.Action>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(function ToastAction({ className, ...props }, ref) {
  return <ToastPrimitive.Action ref={ref} className={cx('dg-ui-toast-action', className)} {...props} />;
});

/** Convenience composition: provider + viewport around the host's toasts. */
export function Toaster({ children }: { children?: ReactNode }) {
  return (
    <ToastProvider swipeDirection="right">
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
