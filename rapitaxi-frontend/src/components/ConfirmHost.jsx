import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

const CLOSE_ANIMATION_MS = 180;

/**
 * Dibuja el dialogo disparado por confirmDialog(). Montado una sola vez en
 * App.jsx, igual que ToastHost.
 */
const ConfirmHost = () => {
  const [dialog, setDialog] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleConfirm = (event) => {
      setIsClosing(false);
      setDialog(event.detail);
    };
    window.addEventListener('rapitaxi-confirm', handleConfirm);
    return () => window.removeEventListener('rapitaxi-confirm', handleConfirm);
  }, []);

  const close = (result) => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      dialog?.resolve(result);
      setDialog(null);
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  };

  if (!dialog) return null;

  const Icon = dialog.danger ? AlertTriangle : HelpCircle;

  return (
    <div
      style={{
        animation: isClosing
          ? `overlay-fade-out ${CLOSE_ANIMATION_MS}ms ease-in forwards`
          : 'overlay-fade-in 150ms ease-out',
      }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={() => close(false)}
    >
      <div
        style={{
          animation: isClosing
            ? `toast-out ${CLOSE_ANIMATION_MS}ms ease-in forwards`
            : 'toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${dialog.danger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="pt-1.5">
            <h3 className="font-bold text-slate-900">{dialog.title}</h3>
          </div>
        </div>

        <p className="mb-6 text-sm leading-snug text-slate-600">{dialog.message}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => close(false)}
            className="rounded-xl px-4 py-2 font-semibold text-slate-500 transition-colors hover:bg-slate-50"
          >
            {dialog.cancelText}
          </button>
          <button
            onClick={() => close(true)}
            className={`rounded-xl px-4 py-2 font-bold text-white transition-colors ${
              dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmHost;
