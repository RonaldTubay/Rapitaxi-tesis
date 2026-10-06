import { useEffect, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Aviso antes de cerrar sesion por inactividad. El conteo es solo visual;
 * el cierre real de sesion lo maneja el temporizador de useIdleTimer.
 */
const IdleWarningModal = ({ secondsRemaining, onContinue, onLogoutNow }) => {
  const [secondsLeft, setSecondsLeft] = useState(secondsRemaining);

  useEffect(() => {
    setSecondsLeft(secondsRemaining);
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">¿Sigues ahí?</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tu sesión se cerrará por inactividad en <span className="font-bold text-slate-800">{formatTime(secondsLeft)}</span>.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full rounded-xl bg-slate-900 py-3 font-bold text-yellow-400 transition-colors hover:bg-slate-800"
          >
            Seguir conectado
          </button>
          <button
            onClick={onLogoutNow}
            className="flex w-full items-center justify-center rounded-xl py-3 font-semibold text-slate-500 transition-colors hover:bg-slate-50"
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión ahora
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdleWarningModal;
