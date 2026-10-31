import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  ...props
}) => (
  <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
    <table className={twMerge(clsx('w-full text-left text-sm text-slate-300', className))} {...props} />
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <thead
    className={twMerge(
      clsx('bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800', className),
    )}
    {...props}
  />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <tbody className={twMerge(clsx('divide-y divide-slate-800/80 bg-slate-900/40', className))} {...props} />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  ...props
}) => (
  <tr
    className={twMerge(clsx('hover:bg-slate-800/40 transition-colors', className))}
    {...props}
  />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => (
  <th className={twMerge(clsx('px-4 py-3 font-medium text-slate-400', className))} {...props} />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <td className={twMerge(clsx('px-4 py-3 text-slate-200', className))} {...props} />;
