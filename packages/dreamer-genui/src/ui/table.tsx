'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { cx } from './lib';

export const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(function Table({ className, ...props }, ref) {
  return (
    <div className="dg-ui-table-wrap">
      <table ref={ref} className={cx('dg-ui-table', className)} {...props} />
    </div>
  );
});

export const TableHeader = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'thead'>>(
  function TableHeader({ className, ...props }, ref) {
    return <thead ref={ref} className={cx('dg-ui-table-header', className)} {...props} />;
  },
);

export const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cx('dg-ui-table-body', className)} {...props} />;
  },
);

export const TableFooter = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tfoot'>>(
  function TableFooter({ className, ...props }, ref) {
    return <tfoot ref={ref} className={cx('dg-ui-table-footer', className)} {...props} />;
  },
);

export const TableRow = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<'tr'>>(
  function TableRow({ className, ...props }, ref) {
    return <tr ref={ref} className={cx('dg-ui-table-row', className)} {...props} />;
  },
);

export const TableHead = forwardRef<HTMLTableCellElement, ComponentPropsWithoutRef<'th'>>(
  function TableHead({ className, ...props }, ref) {
    return <th ref={ref} className={cx('dg-ui-table-head', className)} {...props} />;
  },
);

export const TableCell = forwardRef<HTMLTableCellElement, ComponentPropsWithoutRef<'td'>>(
  function TableCell({ className, ...props }, ref) {
    return <td ref={ref} className={cx('dg-ui-table-cell', className)} {...props} />;
  },
);

export const TableCaption = forwardRef<HTMLTableCaptionElement, ComponentPropsWithoutRef<'caption'>>(
  function TableCaption({ className, ...props }, ref) {
    return <caption ref={ref} className={cx('dg-ui-table-caption', className)} {...props} />;
  },
);
