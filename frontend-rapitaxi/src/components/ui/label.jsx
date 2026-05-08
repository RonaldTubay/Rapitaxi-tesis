import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Label({ className = '', children, ...props }) {
  return (
    <label className={cx('text-sm font-semibold text-slate-700', className)} {...props}>
      {children}
    </label>
  );
}
