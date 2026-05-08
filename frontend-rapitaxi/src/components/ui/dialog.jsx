import React, { createContext, useContext, useMemo, useState } from 'react';

const DialogContext = createContext(null);

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Dialog({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ asChild = false, children }) {
  const ctx = useContext(DialogContext);
  if (!ctx) return children;

  const handleClick = (event) => {
    if (children?.props?.onClick) children.props.onClick(event);
    if (!event.defaultPrevented) ctx.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: handleClick });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

export function DialogContent({ className = '', children }) {
  const ctx = useContext(DialogContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => ctx.setOpen(false)}>
      <div
        className={cx('w-full max-h-[90vh] overflow-auto rounded-xl bg-white border border-slate-200 p-6 shadow-2xl', className)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = '', children }) {
  return <div className={cx('mb-4', className)}>{children}</div>;
}

export function DialogTitle({ className = '', children }) {
  return <h2 className={cx('text-xl font-bold text-slate-900', className)}>{children}</h2>;
}

export function DialogDescription({ className = '', children }) {
  return <p className={cx('mt-1 text-sm text-slate-600', className)}>{children}</p>;
}
