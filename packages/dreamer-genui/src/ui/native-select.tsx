'use client';

import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './lib';

export const NativeSelect = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<'select'>>(
  function NativeSelect({ className, ...props }, ref) {
    return <select ref={ref} className={cx('dg-ui-native-select', className)} {...props} />;
  },
);

export const NativeSelectOption = forwardRef<HTMLOptionElement, ComponentPropsWithoutRef<'option'>>(
  function NativeSelectOption({ className, ...props }, ref) {
    return <option ref={ref} className={cx('dg-ui-native-select-option', className)} {...props} />;
  },
);

export const NativeSelectOptGroup = forwardRef<HTMLOptGroupElement, ComponentPropsWithoutRef<'optgroup'>>(
  function NativeSelectOptGroup({ className, ...props }, ref) {
    return <optgroup ref={ref} className={cx('dg-ui-native-select-group', className)} {...props} />;
  },
);
