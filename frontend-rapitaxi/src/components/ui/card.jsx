import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={cx('bg-white border border-slate-200 rounded-xl', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cx('p-4 border-b border-slate-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={cx('text-base font-semibold text-slate-900', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cx('p-4', className)} {...props}>
      {children}
    </div>
  );
}
