import { useState, useEffect } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import {
  CarFront, LayoutDashboard, Users, Wrench, FolderOpen,
  FileText, ClipboardCheck, BookOpen, LogOut, Menu, DollarSign, Settings, X, UserPlus, ChevronDown, History, Sun, Moon
} from 'lucide-react';

// IMPORTAMOS TU NUEVO COMPONENTE DE NOTIFICACIONES
// (Asegúrate de que la ruta sea correcta según donde guardaste el archivo)
import NotificacionesBell from './NotificacionesBell';
import { useAuth } from '../features/auth/AuthContext';
import logoRapitaxi from '../img/logo.jpg';
import { getTheme, setTheme } from '../utils/theme';

// Estructura del menu: enlaces sueltos y grupos con sub-opciones (acordeon).
// Vive fuera del componente porque no depende de props/estado, asi no se
// recrea en cada render.
const MENU_STRUCTURE = [
  { type: 'link', icon: LayoutDashboard, label: 'Dashboard', path: '/panel' },
  {
    type: 'group', key: 'socios', icon: Users, label: 'Socios',
    items: [
      { icon: Users, label: 'Listado de Socios', path: '/socios' },
      { icon: FolderOpen, label: 'Expedientes', path: '/expedientes' },
      { icon: FileText, label: 'Actas', path: '/actas' },
    ],
  },
  {
    type: 'group', key: 'flota', icon: CarFront, label: 'Flota',
    items: [
      { icon: CarFront, label: 'Vehículos', path: '/vehiculos' },
      { icon: Wrench, label: 'Mantenimiento', path: '/mantenimiento' },
      { icon: ClipboardCheck, label: 'Revisiones', path: '/revisiones' },
    ],
  },
  {
    type: 'group', key: 'contabilidad', icon: DollarSign, label: 'Contabilidad',
    items: [
      { icon: DollarSign, label: 'Aportaciones', path: '/aportaciones' },
      { icon: BookOpen, label: 'Libros Contables', path: '/libros-contables' },
    ],
  },
  {
    type: 'group', key: 'administracion', icon: Settings, label: 'Administración', adminOnly: true,
    items: [
      { icon: UserPlus, label: 'Usuarios', path: '/usuarios' },
      { icon: Settings, label: 'Configuración', path: '/configuracion' },
      { icon: History, label: 'Auditoría', path: '/auditoria' },
    ],
  },
];

const findGroupKeyForPath = (pathname) => MENU_STRUCTURE.find(
  (entry) => entry.type === 'group' && entry.items.some((item) => item.path === pathname)
)?.key ?? null;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [openGroup, setOpenGroup] = useState(() => findGroupKeyForPath(location.pathname));
  const [isDark, setIsDark] = useState(() => getTheme() === 'dark');

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Si el tema se cambia desde otro lado (ej. el interruptor en
  // Configuración), este boton se actualiza solo para no quedar desincronizado.
  useEffect(() => {
    const handleThemeChanged = (e) => setIsDark(e.detail.theme === 'dark');
    window.addEventListener('theme-changed', handleThemeChanged);
    return () => window.removeEventListener('theme-changed', handleThemeChanged);
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(next === 'dark');
    setTheme(next);
  };

  // Si el usuario llega por URL directa (o navega) a una pantalla dentro de
  // un grupo, ese grupo se abre solo para que siempre vea donde esta parado.
  useEffect(() => {
    const groupKey = findGroupKeyForPath(location.pathname);
    if (groupKey) setOpenGroup(groupKey);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const closeOnMobile = () => window.innerWidth < 768 && setIsSidebarOpen(false);

  const toggleGroup = (key) => {
    // Con el menu colapsado no hay espacio para mostrar sub-opciones:
    // expandimos el menu completo y de una vez el grupo pedido.
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      setOpenGroup(key);
      return;
    }
    setOpenGroup((current) => (current === key ? null : key));
  };

  const menu = MENU_STRUCTURE.filter((entry) => !entry.adminOnly || user?.role === 'admin');

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* BARRA LATERAL: fija en todos los tamaños de pantalla, no se mueve al hacer scroll del contenido */}
      <aside className={`${isSidebarOpen ? 'translate-x-0 md:w-64' : '-translate-x-full md:translate-x-0 md:w-20'} fixed inset-y-0 left-0 w-72 bg-[#FFCC00] text-slate-900 transition-all duration-300 flex flex-col flex-shrink-0 z-30 shadow-lg`}>
        <div className="h-20 md:h-24 flex items-center justify-between px-4">
          <div className={`flex items-center overflow-hidden transition-all ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
            <img src={logoRapitaxi} alt="RapiTaxi" className="w-10 h-10 mr-3 flex-shrink-0 rounded-full object-cover shadow-sm" />
            <div>
              <h1 className="font-extrabold text-xl tracking-tight leading-none">RAPITAXI</h1>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mt-0.5">Panel Administrativo</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-yellow-500 transition-colors flex-shrink-0">
            {isSidebarOpen ? <X className="w-6 h-6 md:hidden" /> : <Menu className="w-6 h-6 md:hidden" />}
            <Menu className="hidden w-6 h-6 md:block" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-x-hidden">
          {menu.map((entry) => {
            if (entry.type === 'link') {
              const isActive = location.pathname === entry.path;
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  onClick={closeOnMobile}
                  className={`flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 whitespace-nowrap
                    ${isActive ? 'bg-slate-900 text-yellow-400 shadow-md' : 'text-slate-800 hover:bg-yellow-500 font-medium'}`}
                >
                  <entry.icon className={`w-5 h-5 flex-shrink-0 ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                  <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                    {entry.label}
                  </span>
                </Link>
              );
            }

            const isGroupActive = entry.items.some((item) => item.path === location.pathname);
            const isOpen = isSidebarOpen && openGroup === entry.key;

            return (
              <div key={entry.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.key)}
                  className={`flex items-center w-full px-3 py-3.5 rounded-xl transition-all duration-200 whitespace-nowrap
                    ${isGroupActive ? 'bg-slate-900 text-yellow-400 shadow-md' : 'text-slate-800 hover:bg-yellow-500 font-medium'}`}
                >
                  <entry.icon className={`w-5 h-5 flex-shrink-0 ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                  <span className={`flex-1 text-left transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                    {entry.label}
                  </span>
                  {isSidebarOpen && (
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {entry.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={closeOnMobile}
                          className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 whitespace-nowrap
                            ${isActive ? 'bg-slate-900 text-yellow-400' : 'text-slate-700 hover:bg-yellow-500/70 font-medium'}`}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0 mr-2.5" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4">
          <button onClick={handleLogout} className={`flex items-center w-full px-3 py-3 text-slate-800 hover:bg-yellow-500 rounded-xl font-bold transition-all whitespace-nowrap ${!isSidebarOpen && 'justify-center'}`}>
            <LogOut className={`w-5 h-5 flex-shrink-0 ${isSidebarOpen ? 'mr-3' : ''}`} />
            <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Salir</span>
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL: Ahora dividido en TopBar y el Outlet.
          El margen izquierdo compensa que el aside ahora es 'fixed' (fuera del flujo). */}
      <main className={`min-w-0 flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>

        {/* NUEVA BARRA SUPERIOR (TOP BAR): fondo y borde propios para que se
            distinga del contenido de abajo, en vez de verse como una sola
            pantalla continua. */}
        <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between md:justify-end px-4 sm:px-6 lg:px-8 flex-shrink-0 z-10 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 text-slate-900 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* AQUÍ VA TU COMPONENTE DE CAMPANITA */}
            <NotificacionesBell />

            {/* Opcional: Info del usuario */}
            <div className="hidden md:flex flex-col text-right ml-2 border-l border-slate-200 pl-4">
              <span className="text-sm font-bold text-slate-800">{user?.name || 'Administración'}</span>
              <span className="text-xs text-slate-500 font-medium capitalize">{user?.role || 'En línea'}</span>
            </div>
          </div>
        </header>

        {/* CONTENIDO DINÁMICO (LAS PANTALLAS). "panel-scroll-area" es el
            gancho que usan las pantallas imprimibles (ver ActasScreen) para
            anular este overflow/altura al imprimir; si no, el navegador
            recorta todo lo que esta fuera de esta "ventana" con scroll y la
            hoja impresa sale en blanco. */}
        <div className="flex-1 overflow-y-auto panel-scroll-area">
          <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Outlet />
          </div>
        </div>

      </main>
    </div>
  );
};

export default MainLayout;
