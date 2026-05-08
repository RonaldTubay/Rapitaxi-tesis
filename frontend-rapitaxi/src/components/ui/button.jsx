import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

const variants = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
};

const sizes = {
  default: 'h-10 px-4 py-2',
  icon: 'h-10 w-10 p-0',
};

export const Button = React.forwardRef(function Button(
  { className = '', variant = 'default', size = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant] || variants.default,
        sizes[size] || sizes.default,
        className,
      )}
      {...props}
    />
  );
});
