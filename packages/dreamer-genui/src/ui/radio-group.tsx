'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cx } from './lib';

export const RadioGroup = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cx('dg-ui-radio-group', className)} {...props} />;
});

export const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item ref={ref} className={cx('dg-ui-radio', className)} {...props}>
      <RadioGroupPrimitive.Indicator className="dg-ui-radio-indicator" />
    </RadioGroupPrimitive.Item>
  );
});
