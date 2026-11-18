'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cx } from './lib';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  return <AccordionPrimitive.Item ref={ref} className={cx('dg-ui-accordion-item', className)} {...props} />;
});

export const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="dg-ui-accordion-header">
      <AccordionPrimitive.Trigger ref={ref} className={cx('dg-ui-accordion-trigger', className)} {...props}>
        {children}
        <span aria-hidden="true" className="dg-ui-accordion-indicator" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content ref={ref} className={cx('dg-ui-accordion-content', className)} {...props}>
      <div className="dg-ui-accordion-body">{children}</div>
    </AccordionPrimitive.Content>
  );
});
