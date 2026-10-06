import { ShieldAlert, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Se muestra cuando alguien inicia sesion correctamente pero su rol no
 * tiene acceso a la seccion (ej. un socio entrando al panel de admin).
 * No es un error de autenticacion, por eso no lo mandamos de vuelta al login.
 */
const AccessDeniedScreen = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-200">
        <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Acceso no disponible</h1>
        <p className="text-slate-500 text-sm mb-6">
          Tu cuenta no tiene permisos para entrar a esta sección. Si crees que esto es un error, contacta al administrador.
        </p>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center bg-slate-900 text-yellow-400 font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default AccessDeniedScreen;
