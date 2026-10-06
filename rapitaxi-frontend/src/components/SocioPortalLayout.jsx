import { useEffect, useState } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { CarFront, FileText, LogOut, UserCircle, Receipt, AlertTriangle } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { apiClient } from '../lib/apiClient';

const TABS = [
  { path: '/portal/perfil', label: 'Mi Perfil', icon: UserCircle },
  { path: '/portal/unidades', label: 'Mis Unidades', icon: CarFront },
  { path: '/portal/documentos', label: 'Mis Documentos', icon: FileText },
  { path: '/portal/aportaciones', label: 'Mis Aportaciones', icon: Receipt },
];

// Layout propio del portal del socio: mucho mas simple que MainLayout (el
// del panel administrativo) porque solo tiene tres secciones y el socio no
// necesita el menu completo del staff.
const SocioPortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [unidadesEnAlerta, setUnidadesEnAlerta] = useState([]);

  // El aviso de mantenimiento vive en el layout para que el socio lo vea
  // en cualquier pantalla del portal, no solo si entra a Mis Unidades.
  useEffect(() => {
    let vigente = true;

    apiClient.get('/mis-unidades')
      .then((data) => {
        if (!vigente) return;
        const enAlerta = (data.unidades || []).filter((u) => u.resumen !== 'Al día');
        setUnidadesEnAlerta(enAlerta);
      })
      .catch(() => setUnidadesEnAlerta([]));

    return () => { vigente = false; };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const hayVencidas = unidadesEnAlerta.some((u) => u.resumen === 'Vencido');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <CarFront className="w-7 h-7 mr-2 text-yellow-400" />
            <span className="font-extrabold tracking-tight">RAPITAXI</span>
            <span className="ml-2 text-xs text-slate-400 hidden sm:inline">Portal del Socio</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold hidden sm:inline">{user?.name}</span>
            <button onClick={handleLogout} className="flex items-center text-sm font-bold text-slate-300 hover:text-white transition-colors">
              <LogOut className="w-4 h-4 mr-1.5" /> Salir
            </button>
          </div>
        </div>
        {/* overflow-x-auto es un seguro: si algun telefono muy angosto no
            alcanza a mostrar las pestañas completas, se desliza en vez
            de romper el diseño o encimarse. */}
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = location.pathname === tab.path;
            const marcarAlerta = tab.path === '/portal/unidades' && unidadesEnAlerta.length > 0;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center whitespace-nowrap px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                  isActive ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-slate-300 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-1.5 sm:mr-2 flex-shrink-0" /> {tab.label}
                {marcarAlerta && (
                  <span className={`ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
                    hayVencidas ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
                  }`}>
                    {unidadesEnAlerta.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Franja de aviso: dice exactamente cual unidad necesita taller, que
          es lo que el socio con varias unidades necesita saber de un vistazo. */}
      {unidadesEnAlerta.length > 0 && location.pathname !== '/portal/unidades' && (
        <div className={`border-b ${hayVencidas ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${hayVencidas ? 'text-red-500' : 'text-amber-500'}`} />
            <p className={`text-sm font-semibold ${hayVencidas ? 'text-red-800' : 'text-amber-800'}`}>
              {unidadesEnAlerta.length === 1
                ? `Tu unidad ${unidadesEnAlerta[0].numero_vehiculo} (${unidadesEnAlerta[0].placa}) necesita mantenimiento.`
                : `${unidadesEnAlerta.length} de tus unidades necesitan mantenimiento: ${unidadesEnAlerta.map((u) => u.numero_vehiculo).join(', ')}.`}
            </p>
            <Link
              to="/portal/unidades"
              className={`text-xs font-bold underline underline-offset-2 ${hayVencidas ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}
            >
              Ver detalle
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default SocioPortalLayout;
