'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cx } from './lib';
import { Dialog, DialogContent } from './dialog';

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return <CommandPrimitive ref={ref} className={cx('dg-ui-command', className)} {...props} />;
});

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
  return (
    <div className="dg-ui-command-input-wrap" data-dg-part="input-wrap">
      <span aria-hidden="true" className="dg-ui-command-search">⌕</span>
      <CommandPrimitive.Input ref={ref} className={cx('dg-ui-command-input', className)} {...props} />
    </div>
  );
});

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
  return <CommandPrimitive.List ref={ref} className={cx('dg-ui-command-list', className)} {...props} />;
});

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty({ className, ...props }, ref) {
  return <CommandPrimitive.Empty ref={ref} className={cx('dg-ui-command-empty', className)} {...props} />;
});

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return <CommandPrimitive.Group ref={ref} className={cx('dg-ui-command-group', className)} {...props} />;
});

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
  return <CommandPrimitive.Item ref={ref} className={cx('dg-ui-command-item', className)} {...props} />;
});

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return <CommandPrimitive.Separator ref={ref} className={cx('dg-ui-command-separator', className)} {...props} />;
});

export function CommandShortcut({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-command-shortcut', className)} {...props} />;
}

export function CommandLoading(props: ComponentPropsWithoutRef<typeof CommandPrimitive.Loading>) {
  return <CommandPrimitive.Loading className="dg-ui-command-loading" {...props} />;
}

export function CommandDialog({
  title = 'Command menu',
  description = 'Search for a command to run.',
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Dialog> & { title?: string; description?: string }) {
  return (
    <Dialog {...props}>
      <DialogContent className="dg-ui-command-dialog">
        <span className="dg-ui-visually-hidden">{title}</span>
        <span className="dg-ui-visually-hidden">{description}</span>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}
