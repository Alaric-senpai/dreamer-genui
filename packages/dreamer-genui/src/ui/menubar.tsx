'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { cx } from './lib';

export const MenubarMenu: typeof MenubarPrimitive.Menu = MenubarPrimitive.Menu;
export const MenubarGroup: typeof MenubarPrimitive.Group = MenubarPrimitive.Group;
export const MenubarPortal: typeof MenubarPrimitive.Portal = MenubarPrimitive.Portal;
export const MenubarSub: typeof MenubarPrimitive.Sub = MenubarPrimitive.Sub;
export const MenubarRadioGroup: typeof MenubarPrimitive.RadioGroup = MenubarPrimitive.RadioGroup;

export const Menubar = forwardRef<
  ElementRef<typeof MenubarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(function Menubar({ className, ...props }, ref) {
  return <MenubarPrimitive.Root ref={ref} className={cx('dg-ui-menubar', className)} {...props} />;
});

export const MenubarTrigger = forwardRef<
  ElementRef<typeof MenubarPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(function MenubarTrigger({ className, ...props }, ref) {
  return <MenubarPrimitive.Trigger ref={ref} className={cx('dg-ui-menubar-trigger', className)} {...props} />;
});

export const MenubarSubTrigger = forwardRef<
  ElementRef<typeof MenubarPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger>
>(function MenubarSubTrigger({ className, children, ...props }, ref) {
  return (
    <MenubarPrimitive.SubTrigger ref={ref} className={cx('dg-ui-menu-item dg-ui-menu-sub-trigger', className)} {...props}>
      {children}
      <span aria-hidden="true" className="dg-ui-menu-chevron">›</span>
    </MenubarPrimitive.SubTrigger>
  );
});

export const MenubarSubContent = forwardRef<
  ElementRef<typeof MenubarPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(function MenubarSubContent({ className, ...props }, ref) {
  return <MenubarPrimitive.SubContent ref={ref} className={cx('dg-ui-menu-content', className)} {...props} />;
});

export const MenubarContent = forwardRef<
  ElementRef<typeof MenubarPrimitive.Content>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(function MenubarContent({ className, align = 'start', alignOffset = -4, sideOffset = 6, ...props }, ref) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cx('dg-ui-menu-content', className)}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
});

export const MenubarItem = forwardRef<
  ElementRef<typeof MenubarPrimitive.Item>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & { inset?: boolean }
>(function MenubarItem({ className, inset, ...props }, ref) {
  return <MenubarPrimitive.Item ref={ref} className={cx('dg-ui-menu-item', inset && 'dg-ui-menu-item-inset', className)} {...props} />;
});

export const MenubarCheckboxItem = forwardRef<
  ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(function MenubarCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <MenubarPrimitive.CheckboxItem ref={ref} className={cx('dg-ui-menu-item', className)} checked={checked} {...props}>
      <span aria-hidden="true" className="dg-ui-menu-indicator">{checked ? '✓' : ''}</span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
});

export const MenubarRadioItem = forwardRef<
  ElementRef<typeof MenubarPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(function MenubarRadioItem({ className, children, ...props }, ref) {
  return (
    <MenubarPrimitive.RadioItem ref={ref} className={cx('dg-ui-menu-item', className)} {...props}>
      <span aria-hidden="true" className="dg-ui-menu-indicator">•</span>
      {children}
    </MenubarPrimitive.RadioItem>
  );
});

export const MenubarLabel = forwardRef<
  ElementRef<typeof MenubarPrimitive.Label>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & { inset?: boolean }
>(function MenubarLabel({ className, inset, ...props }, ref) {
  return <MenubarPrimitive.Label ref={ref} className={cx('dg-ui-menu-label', inset && 'dg-ui-menu-item-inset', className)} {...props} />;
});

export const MenubarSeparator = forwardRef<
  ElementRef<typeof MenubarPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(function MenubarSeparator({ className, ...props }, ref) {
  return <MenubarPrimitive.Separator ref={ref} className={cx('dg-ui-menu-separator', className)} {...props} />;
});

export function MenubarShortcut({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-menu-shortcut', className)} {...props} />;
}
