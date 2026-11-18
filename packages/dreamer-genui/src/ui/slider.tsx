'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cx } from './lib';

export const Slider = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function Slider({ className, defaultValue, value, ...props }, ref) {
  const values = value ?? defaultValue ?? [0];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cx('dg-ui-slider', className)}
      defaultValue={defaultValue}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track className="dg-ui-slider-track">
        <SliderPrimitive.Range className="dg-ui-slider-range" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb key={i} className="dg-ui-slider-thumb" />
      ))}
    </SliderPrimitive.Root>
  );
});
