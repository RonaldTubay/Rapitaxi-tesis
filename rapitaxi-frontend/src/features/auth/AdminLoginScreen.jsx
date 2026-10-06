import { useState } from 'react';
import {
  ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle, Clock,
  Eye, EyeOff, Users, CarFront, BarChart3,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showSuccessToast } from '../../utils/feedback';
import { isRequired, isValidEmail, validateFields } from '../../utils/validators';
import { ApiError } from '../../lib/apiClient';
import { useAuth } from './AuthContext';

const REMEMBER_EMAIL_KEY = 'rapitaxi_remembered_email';

const loginRules = {
  email: [
    (value) => isRequired(value) || 'El correo es obligatorio.',
    (value) => isValidEmail(value) || 'Ingresa un correo valido.',
  ],
  password: [(value) => isRequired(value) || 'La contrasena es obligatoria.'],
};

const features = [
  { icon: Users, title: 'Gestión de Usuarios', description: 'Administra roles y permisos' },
  { icon: CarFront, title: 'Control de Flota', description: 'Supervisa vehículos y socios' },
  { icon: BarChart3, title: 'Reportes en Tiempo Real', description: 'Métricas y estadísticas al instante' },
];

const AdminLoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState(() => ({
    email: localStorage.getItem(REMEMBER_EMAIL_KEY) || '',
    password: '',
  }));
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY)));
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sessionExpiredByIdle = location.state?.reason === 'idle';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateFields(formData, loginRules);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError('');
    setIsLoading(true);

    try {
      const loggedInUser = await login(formData);

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, formData.email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      showSuccessToast('Sesion iniciada exitosamente.');
      navigate(loggedInUser.role === 'socio' ? '/portal/perfil' : '/panel');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const backendErrors = Object.fromEntries(
          Object.entries(err.data.errors).map(([field, messages]) => [field, messages[0]])
        );
        setFieldErrors(backendErrors);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Error al conectar con el servidor. Verifica que el backend este encendido.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-6xl grid overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl lg:grid-cols-2 animate-in fade-in zoom-in-95 duration-300">

        {/* PANEL IZQUIERDO: branding, oculto en pantallas chicas */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:flex">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-yellow-400/10 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-yellow-400/30 bg-slate-900">
                <ShieldCheck className="h-7 w-7 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold leading-none text-white">RapiTaxi</h1>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Portal de Administración</p>
              </div>
            </div>

            <h2 className="mb-4 text-4xl font-extrabold leading-tight text-white">
              Control total.<br /><span className="text-yellow-400">Mejores decisiones.</span>
            </h2>
            <p className="mb-10 max-w-sm text-slate-400">
              Administra socios, vehículos y reportes de tu cooperativa en un solo lugar.
            </p>

            <div className="space-y-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-center gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
                    <feature.icon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="text-xs text-slate-500">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-10 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/10">
              <ShieldCheck className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Seguridad y confiabilidad</p>
              <p className="text-xs text-slate-500">Tus datos siempre protegidos.</p>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: formulario */}
        <div className="flex items-center justify-center bg-slate-900 p-8 sm:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
                <ShieldCheck className="h-9 w-9 text-yellow-400" />
                <span className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
              </div>
            </div>

            <h2 className="mb-1 text-center text-2xl font-bold text-white">Bienvenido de nuevo</h2>
            <p className="mb-8 text-center text-sm text-slate-400">Inicia sesión para continuar</p>

            {sessionExpiredByIdle && !formError && (
              <div className="mb-6 flex items-start rounded-r-lg border-l-4 border-blue-400 bg-blue-400/10 p-4">
                <Clock className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                <p className="text-sm font-medium text-blue-300">Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.</p>
              </div>
            )}

            {formError && (
              <div className="mb-6 flex items-start rounded-r-lg border-l-4 border-red-500 bg-red-500/10 p-4">
                <AlertCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                <p className="text-sm font-medium text-red-300">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Correo de Administrador
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full rounded-lg border bg-slate-800 py-3 pl-10 pr-4 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                      fieldErrors.email ? 'border-red-500' : 'border-slate-700'
                    }`}
                    placeholder="admin@rapitaxi.com"
                    maxLength="100"
                    disabled={isLoading}
                  />
                </div>
                {fieldErrors.email && <p className="mt-1.5 text-xs font-medium text-red-400">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full rounded-lg border bg-slate-800 py-3 pl-10 pr-11 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                      fieldErrors.password ? 'border-red-500' : 'border-slate-700'
                    }`}
                    placeholder="••••••••"
                    maxLength="100"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1.5 text-xs font-medium text-red-400">{fieldErrors.password}</p>}
              </div>

              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-slate-900"
                  />
                  Recordarme
                </label>
                <span className="text-xs text-slate-500 sm:text-right">¿Problemas para ingresar? Contacta al administrador.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`group flex w-full items-center justify-center rounded-lg px-4 py-3 font-bold transition-all focus:outline-none focus:ring-4 ${
                  isLoading
                    ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                    : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 focus:ring-yellow-400/30'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Ingresar al Sistema
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 p-3">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-green-400" />
              <div>
                <p className="text-xs font-semibold text-slate-300">Autenticación segura</p>
                <p className="text-[11px] text-slate-500">Protegido con encriptación SSL</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <p className="text-center text-xs text-slate-500">
                Acceso restringido. Este sistema es de uso exclusivo para personal autorizado. Todo acceso no autorizado será registrado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginScreen;
