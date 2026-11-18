'use client';

import { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cx } from './lib';

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used inside <SidebarProvider>.');
  return context;
}

export type SidebarProviderProps = ComponentPropsWithoutRef<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  ...props
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const value = useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen: (next) => {
        if (controlledOpen === undefined) setUncontrolledOpen(next);
        onOpenChange?.(next);
      },
      toggle: () => {
        const next = !open;
        if (controlledOpen === undefined) setUncontrolledOpen(next);
        onOpenChange?.(next);
      },
    }),
    [controlledOpen, onOpenChange, open],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div className={cx('dg-ui-sidebar-provider', className)} {...props}>{children}</div>
    </SidebarContext.Provider>
  );
}

export const Sidebar = forwardRef<HTMLElement, ComponentPropsWithoutRef<'aside'>>(
  function Sidebar({ className, ...props }, ref) {
    const { open } = useSidebar();
    return <aside ref={ref} data-state={open ? 'expanded' : 'collapsed'} className={cx('dg-ui-sidebar', className)} {...props} />;
  },
);

export function SidebarHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-header', className)} {...props} />;
}

export function SidebarContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-content', className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-footer', className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-group', className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-group-label', className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-sidebar-group-content', className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: ComponentPropsWithoutRef<'ul'>) {
  return <ul className={cx('dg-ui-sidebar-menu', className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: ComponentPropsWithoutRef<'li'>) {
  return <li className={cx('dg-ui-sidebar-menu-item', className)} {...props} />;
}

export type SidebarMenuButtonProps = ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
};

export const SidebarMenuButton = forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  function SidebarMenuButton({ className, asChild, isActive, tooltip, children, ...props }, ref) {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        data-active={isActive || undefined}
        title={tooltip}
        className={cx('dg-ui-sidebar-menu-button', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

export const SidebarMenuAction = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function SidebarMenuAction({ className, type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={cx('dg-ui-sidebar-menu-action', className)} {...props} />;
  },
);

export function SidebarMenuBadge({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('dg-ui-sidebar-menu-badge', className)} {...props} />;
}

export const SidebarTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function SidebarTrigger({ className, type = 'button', onClick, ...props }, ref) {
    const { open, toggle } = useSidebar();
    return (
      <button
        ref={ref}
        type={type}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={open}
        data-state={open ? 'expanded' : 'collapsed'}
        className={cx('dg-ui-sidebar-trigger', className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle();
        }}
        {...props}
      >
        <span aria-hidden="true" className="dg-ui-sidebar-trigger-icon">▤</span>
      </button>
    );
  },
);

export const SidebarInset = forwardRef<HTMLElement, ComponentPropsWithoutRef<'main'>>(
  function SidebarInset({ className, ...props }, ref) {
    return <main ref={ref} className={cx('dg-ui-sidebar-inset', className)} {...props} />;
  },
);

export const SidebarRail = forwardRef<ElementRef<'button'>, ComponentPropsWithoutRef<'button'>>(
  function SidebarRail({ className, type = 'button', onClick, ...props }, ref) {
    const { toggle } = useSidebar();
    return (
      <button
        ref={ref}
        type={type}
        aria-label="Resize sidebar"
        className={cx('dg-ui-sidebar-rail', className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle();
        }}
        {...props}
      />
    );
  },
);

export function SidebarSeparator({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span role="separator" className={cx('dg-ui-sidebar-separator', className)} {...props} />;
}
