import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const TOAST_DURATION_MS = 3500;
const CLOSE_ANIMATION_MS = 250;

const TOAST_STYLES = {
  success: { icon: CheckCircle2, iconBg: 'bg-green-50 text-green-600', bar: 'bg-green-400', title: 'Acción realizada' },
  error: { icon: AlertCircle, iconBg: 'bg-red-50 text-red-600', bar: 'bg-red-400', title: 'Algo salió mal' },
};

// Los mensajes de exito siguen casi todos el patron "Algo paso exitosamente."
// o "Algo paso con exito."; en vez de pedirle a cada pantalla que mande un
// titulo aparte (son ~30 lugares distintos), se recorta el propio mensaje
// para armar un titulo corto y especifico a la accion (ej. "Usuario creado"
// en vez del generico "Accion realizada" de siempre).
const tituloDesdeMensaje = (mensaje) => {
  if (!mensaje) return null;
  const recortado = mensaje
    .trim()
    .replace(/\.+$/, '')
    .replace(/\s+(exitosamente|con éxito|con exito)$/i, '')
    .trim();
  return recortado || null;
};

const ToastHost = () => {
  const [toasts, setToasts] = useState([]);
  const [closingIds, setClosingIds] = useState(() => new Set());

  const removeToast = (id) => {
    setClosingIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });

    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      setClosingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    const handleToast = (event) => {
      const toast = event.detail;
      setToasts((current) => [...current, toast]);
      setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS);
    };

    window.addEventListener('rapitaxi-toast', handleToast);
    return () => window.removeEventListener('rapitaxi-toast', handleToast);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.success;
        const Icon = style.icon;
        const isClosing = closingIds.has(toast.id);
        const titulo = (toast.type === 'success' && tituloDesdeMensaje(toast.message)) || style.title;

        return (
          <div
            key={toast.id}
            style={{
              animation: isClosing
                ? `toast-slide-out ${CLOSE_ANIMATION_MS}ms ease-in forwards`
                : 'toast-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-slate-800 shadow-2xl"
          >
            <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900">{titulo}</p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-slate-600">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>

            {!isClosing && (
              <div
                style={{ animation: `toast-progress ${TOAST_DURATION_MS}ms linear forwards` }}
                className={`absolute bottom-0 left-0 h-1 ${style.bar}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ToastHost;
