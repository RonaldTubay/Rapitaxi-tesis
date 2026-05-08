import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Car, AlertCircle } from 'lucide-react';
import api from '../services/api'; 

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Todos los campos son obligatorios');
      return;
    }

    setLoading(true);

    try {
      const data = await api.login({ email, password });

      // Laravel devuelve data.access_token en caso de éxito
      if (data && data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard'; 
      } else {
        setError(data?.message || 'Credenciales inválidas');
      }
    } catch (err) {
      // Maneja errores de autenticación (401), validación (422), servidor (500), etc.
      const msg = err?.message || err?.body?.message || 'Error de conexión con el servidor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#facc15] p-4 font-sans">
      
      {/* SECCIÓN DEL LOGO */}
      <div className="flex flex-col items-center mb-16 text-center">
        <div className="bg-[#0f172a] p-4 rounded-2xl mb-6 shadow-xl">
          <Car size={48} color="#facc15" strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl font-extrabold text-[#0f172a] tracking-tight mb-2">
          RAPITAXI
        </h1>
        <p className="text-[#0f172a] font-semibold opacity-80 text-base">
          Sistema de Gestión Vehicular
        </p>
      </div>

      {/* TARJETA BLANCA */}
      <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-10 md:p-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-3 text-center">Iniciar Sesión</h2>
        <p className="text-slate-500 text-sm text-center mb-10">
          Ingrese sus credenciales para acceder al sistema
        </p>

        <form onSubmit={handleSubmit} className="space-y-7">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-pulse">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Email</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-[#facc15] transition-colors">
                <User size={18} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#facc15] transition-all"
                placeholder="admin@rapitaxi.com"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Contraseña</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-[#facc15] transition-colors">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#facc15] transition-all"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#0f172a]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 bg-[#0f172a] text-[#facc15] font-bold rounded-xl shadow-lg transition-all transform ${
              loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-800 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-500 text-xs">
            ¿Necesita ayuda? <a href="#" className="text-[#0f172a] font-bold hover:underline">Contacte al administrador</a>
          </p>
        </div>
      </div>

      <footer className="mt-12 text-center text-[#0f172a] text-xs opacity-70">
        <p>© 2026 RAPITAXI. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default Login;