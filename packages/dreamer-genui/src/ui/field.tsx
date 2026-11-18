'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './lib';
import { Label } from './label';

export const FieldSet = forwardRef<HTMLFieldSetElement, ComponentPropsWithoutRef<'fieldset'>>(
  function FieldSet({ className, ...props }, ref) {
    return <fieldset ref={ref} className={cx('dg-ui-field-set', className)} {...props} />;
  },
);

export const FieldLegend = forwardRef<HTMLLegendElement, ComponentPropsWithoutRef<'legend'>>(
  function FieldLegend({ className, ...props }, ref) {
    return <legend ref={ref} className={cx('dg-ui-field-legend', className)} {...props} />;
  },
);

export function FieldGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-field-group', className)} {...props} />;
}

export function Field({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-field', className)} {...props} />;
}

export const FieldLabel = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<typeof Label>>(
  function FieldLabel({ className, ...props }, ref) {
    return <Label ref={ref} className={cx('dg-ui-field-label', className)} {...props} />;
  },
);

export function FieldDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cx('dg-ui-field-description', className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p role="alert" className={cx('dg-ui-field-error', className)} {...props} />;
}

export function FieldContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-field-content', className)} {...props} />;
}

export function FieldTitle({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dg-ui-field-title', className)} {...props} />;
}
