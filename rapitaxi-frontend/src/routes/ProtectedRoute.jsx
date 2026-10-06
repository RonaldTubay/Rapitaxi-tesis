import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import AccessDeniedScreen from './AccessDeniedScreen';

/**
 * Guarda de rutas: si no hay sesion, redirige al login de admin.
 * `allowedRoles` es opcional y permite reutilizar el mismo guard para
 * futuros portales (ej. socio) sin duplicar esta logica.
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, isReady, role } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  // Esta sí tiene sesión válida, solo que su rol no puede entrar aquí:
  // no lo mandamos al login (seria confuso), le explicamos por qué.
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <AccessDeniedScreen />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
