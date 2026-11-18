'use client';

import { useId, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './lib';

const MS_PER_DAY = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type CalendarProps = Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'> & {
  selected?: Date;
  onSelect?: (date: Date) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  min?: Date;
  max?: Date;
  locale?: string;
  weekStartsOn?: 0 | 1;
  /** Rendered weekday headers; defaults to narrow Intl weekday names. */
  weekdayLabels?: string[];
};

/**
 * A dependency-free month calendar. Every day is a real button; the grid uses a
 * single tab stop (roving tabindex) and supports arrow keys, Home/End and
 * PageUp/PageDown. Day labels are full dates from `Intl`, not bare numbers.
 */
export function Calendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  min,
  max,
  locale,
  weekStartsOn = 1,
  weekdayLabels,
  className,
  ...props
}: CalendarProps) {
  const gridId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const [uncontrolledMonth, setUncontrolledMonth] = useState(() => startOfDay(selected ?? new Date()));
  const view = startOfDay(month ?? uncontrolledMonth);
  const today = startOfDay(new Date());
  const focusDay = selected ?? today;

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    const gridStart = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [view, weekStartsOn]);

  const labels = useMemo(() => {
    if (weekdayLabels) return weekdayLabels;
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const base = new Date(2024, 0, 7); // a Sunday
    return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(base, index + weekStartsOn)));
  }, [locale, weekStartsOn, weekdayLabels]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view),
    [locale, view],
  );
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    [locale],
  );

  function setMonth(next: Date) {
    if (month === undefined) setUncontrolledMonth(next);
    onMonthChange?.(next);
  }

  function isDisabled(date: Date) {
    if (min && startOfDay(min).getTime() > date.getTime()) return true;
    if (max && startOfDay(max).getTime() < date.getTime()) return true;
    return false;
  }

  function focusDate(date: Date) {
    const button = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${toKey(date)}"]`);
    button?.focus();
  }

  function moveFocus(from: Date, deltaDays: number, deltaMonths = 0) {
    let next = addDays(from, deltaDays);
    if (deltaMonths !== 0) {
      const day = from.getDate();
      next = new Date(from.getFullYear(), from.getMonth() + deltaMonths, 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next = new Date(next.getFullYear(), next.getMonth(), Math.min(day, lastDay));
    }
    if (min && next.getTime() < startOfDay(min).getTime()) next = startOfDay(min);
    if (max && next.getTime() > startOfDay(max).getTime()) next = startOfDay(max);
    if (next.getMonth() !== from.getMonth() || next.getFullYear() !== from.getFullYear()) setMonth(next);
    // Wait for the month (and therefore the day buttons) to render.
    requestAnimationFrame(() => focusDate(next));
  }

  const tabStop = days.some((day) => isSameDay(day, focusDay)) ? focusDay : (days[0] ?? focusDay);

  return (
    <div className={cx('dg-ui-calendar', className)} {...props}>
      <div className="dg-ui-calendar-header">
        <button
          type="button"
          className="dg-ui-calendar-nav"
          aria-label="Previous month"
          onClick={() => setMonth(addMonths(view, -1))}
        >
          ‹
        </button>
        <span aria-live="polite" className="dg-ui-calendar-caption">{monthLabel}</span>
        <button
          type="button"
          className="dg-ui-calendar-nav"
          aria-label="Next month"
          onClick={() => setMonth(addMonths(view, 1))}
        >
          ›
        </button>
      </div>
      <div className="dg-ui-calendar-weekdays" aria-hidden="true">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`} className="dg-ui-calendar-weekday">{label}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        id={gridId}
        role="grid"
        aria-label={monthLabel}
        className="dg-ui-calendar-grid"
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          const raw = target.getAttribute('data-date');
          if (!raw) return;
          const parts = raw.split('-').map(Number);
          const from = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [-7, 0],
            ArrowDown: [7, 0],
            PageUp: [0, -1],
            PageDown: [0, 1],
          };
          if (event.key === 'Home') {
            event.preventDefault();
            moveFocus(from, -((from.getDay() - weekStartsOn + 7) % 7));
            return;
          }
          if (event.key === 'End') {
            event.preventDefault();
            moveFocus(from, 6 - ((from.getDay() - weekStartsOn + 7) % 7));
            return;
          }
          const move = moves[event.key];
          if (!move) return;
          event.preventDefault();
          moveFocus(from, move[0], move[1]);
        }}
      >
        {days.map((day) => {
          const outside = day.getMonth() !== view.getMonth();
          const disabled = isDisabled(day);
          const isSelected = selected ? isSameDay(day, selected) : false;
          return (
            <button
              key={toKey(day)}
              type="button"
              role="gridcell"
              data-date={toKey(day)}
              data-outside={outside || undefined}
              aria-selected={isSelected}
              aria-label={dayLabel.format(day)}
              aria-current={isSameDay(day, today) ? 'date' : undefined}
              disabled={disabled}
              tabIndex={isSameDay(day, tabStop) ? 0 : -1}
              className={cx('dg-ui-calendar-day', outside && 'dg-ui-calendar-day-outside', isSelected && 'dg-ui-calendar-day-selected')}
              onClick={() => onSelect?.(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
