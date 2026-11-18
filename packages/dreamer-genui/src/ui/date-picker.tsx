'use client';

import { useMemo, useState } from 'react';
import { cx } from './lib';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Calendar } from './calendar';

export type DatePickerProps = {
  value?: Date;
  onChange?: (date: Date) => void;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
};

/** A date field: a button showing the formatted date, opening the calendar. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  locale,
  disabled,
  className,
  id,
  name,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const formatted = useMemo(
    () => (value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : ''),
    [locale, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cx('dg-ui-date-picker-trigger', !value && 'dg-ui-date-picker-placeholder', className)}
        >
          <span aria-hidden="true" className="dg-ui-date-picker-icon">▦</span>
          <span>{formatted || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="dg-ui-date-picker-content" align="start">
        <Calendar
          selected={value}
          locale={locale}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value ? value.toISOString().slice(0, 10) : ''} /> : null}
    </Popover>
  );
}
