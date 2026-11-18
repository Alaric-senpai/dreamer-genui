'use client';

import { useId, useMemo, useState } from 'react';
import { cx } from './lib';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

/**
 * A searchable single-select. The trigger is a real button; the list is cmdk
 * inside a popover, so typing, arrow keys, Home/End and Enter all work without
 * custom key handling. Tap-first by construction: there is no hover behaviour.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  disabled,
  className,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          className={cx('dg-ui-combobox-trigger', !selected && 'dg-ui-combobox-placeholder', className)}
        >
          <span className="dg-ui-combobox-value">{selected ? selected.label : placeholder}</span>
          <span aria-hidden="true" className="dg-ui-combobox-chevron">⌄</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="dg-ui-combobox-content" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  disabled={option.disabled}
                  onSelect={() => {
                    onValueChange?.(option.value);
                    setOpen(false);
                  }}
                >
                  <span aria-hidden="true" className="dg-ui-combobox-check">
                    {option.value === value ? '✓' : ''}
                  </span>
                  <span className="dg-ui-combobox-option">
                    <span className="dg-ui-combobox-option-label">{option.label}</span>
                    {option.description ? (
                      <span className="dg-ui-combobox-option-description">{option.description}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </Popover>
  );
}
