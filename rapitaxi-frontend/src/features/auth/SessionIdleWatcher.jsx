import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import IdleWarningModal from './IdleWarningModal';

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos
const WARNING_BEFORE_MS = 2 * 60 * 1000; // aviso 2 minutos antes

/**
 * Vive dentro de AuthProvider (fuera de las rutas) para seguir activo sin
 * importar en que pantalla del panel este el usuario.
 */
const SessionIdleWatcher = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleIdle = useCallback(async () => {
    await logout();
    navigate('/admin/login', { state: { reason: 'idle' } });
  }, [logout, navigate]);

  const { isWarning, reset } = useIdleTimer({
    enabled: isAuthenticated,
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    warningBeforeMs: WARNING_BEFORE_MS,
    onIdle: handleIdle,
  });

  if (!isWarning) return null;

  return (
    <IdleWarningModal
      secondsRemaining={WARNING_BEFORE_MS / 1000}
      onContinue={reset}
      onLogoutNow={handleIdle}
    />
  );
};

export default SessionIdleWatcher;
