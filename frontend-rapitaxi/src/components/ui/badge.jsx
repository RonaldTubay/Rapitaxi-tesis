import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Badge({ className = '', children, ...props }) {
  return (
    <span
      className={cx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', className)}
      {...props}
    >
      {children}
    </span>
  );
}
