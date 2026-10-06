import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

/**
 * Detecta inactividad del usuario en la pestaña. Cualquier interaccion
 * (mouse, teclado, scroll, touch) reinicia el conteo. Se reutiliza para
 * cualquier flujo que necesite cerrar sesion por inactividad.
 *
 * @param {boolean} enabled - Solo corre mientras hay sesion activa.
 * @param {number} idleTimeoutMs - Tiempo total de inactividad antes de onIdle.
 * @param {number} warningBeforeMs - Cuanto antes del limite se activa isWarning.
 * @param {() => void} onIdle - Se llama al cumplirse idleTimeoutMs sin actividad.
 */
export const useIdleTimer = ({ enabled, idleTimeoutMs, warningBeforeMs, onIdle }) => {
  const [isWarning, setIsWarning] = useState(false);
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  const reset = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    setIsWarning(false);

    if (!enabled) return;

    warningTimerRef.current = setTimeout(() => setIsWarning(true), idleTimeoutMs - warningBeforeMs);
    idleTimerRef.current = setTimeout(onIdle, idleTimeoutMs);
  }, [enabled, idleTimeoutMs, warningBeforeMs, onIdle]);

  useEffect(() => {
    if (!enabled) {
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      setIsWarning(false);
      return undefined;
    }

    reset();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, reset));

    return () => {
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, reset));
    };
  }, [enabled, reset]);

  return { isWarning, reset };
};
