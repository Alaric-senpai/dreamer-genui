'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cx } from './lib';

/**
 * A bottom sheet built on the dialog primitive. Radix's dialog supplies the
 * focus trap, escape handling and `aria-modal` semantics; the styling makes it
 * a sheet that rises from the bottom edge and is thumb-reachable on phones.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerPortal = DialogPrimitive.Portal;

export const DrawerOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DrawerOverlay({ className, ...props }, ref) {
  return <DialogPrimitive.Overlay ref={ref} className={cx('dg-ui-drawer-overlay', className)} {...props} />;
});

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DrawerContent({ className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Content ref={ref} className={cx('dg-ui-drawer-content', className)} {...props}>
        <span aria-hidden="true" className="dg-ui-drawer-grip" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DrawerHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-drawer-header', className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-drawer-footer', className)} {...props} />;
}

export const DrawerTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DrawerTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cx('dg-ui-drawer-title', className)} {...props} />;
});

export const DrawerDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DrawerDescription({ className, ...props }, ref) {
  return <DialogPrimitive.Description ref={ref} className={cx('dg-ui-drawer-description', className)} {...props} />;
});
