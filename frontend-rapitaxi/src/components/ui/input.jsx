import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        'w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400',
        className,
      )}
      {...props}
    />
  );
});
