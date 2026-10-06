import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../apiConfig';
const NotificacionesBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const dropdownRef = useRef(null);

  // Función para calcular "Hace cuánto tiempo" pasó
  const tiempoTranscurrido = (fechaSQL) => {
    if (!fechaSQL) return '';
    const fecha = new Date(fechaSQL);
    const ahora = new Date();
    const difMinutos = Math.floor((ahora - fecha) / 1000 / 60);
    
    if (difMinutos < 1) return 'Justo ahora';
    if (difMinutos < 60) return `Hace ${difMinutos} min`;
    const difHoras = Math.floor(difMinutos / 60);
    if (difHoras < 24) return `Hace ${difHoras} hrs`;
    return `Hace ${Math.floor(difHoras / 24)} días`;
  };

  // Traer datos reales de PostgreSQL al cargar la página
  const fetchNotificaciones = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/notificaciones`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (response.ok) {
        setNotificaciones(await response.json());
      }
    } catch (error) {
      console.error("Error al cargar notificaciones:", error);
    }
  };

  useEffect(() => {
    fetchNotificaciones();

    // Escuchamos el aviso instantáneo del formulario
    window.addEventListener('notificacion_creada', fetchNotificaciones);

    // Mantenemos también el chequeo automático cada 3 minutos
    const interval = setInterval(fetchNotificaciones, 180000);

    // Limpiamos los eventos al desmontar el componente
    return () => {
        window.removeEventListener('notificacion_creada', fetchNotificaciones);
        clearInterval(interval);
    };
    }, []);

  // Cierra el menú al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const marcarComoLeida = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/notificaciones/${id}/leer`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Actualizamos el estado visual sin recargar la página
      setNotificaciones(notificaciones.map(n => n.id === id ? { ...n, leida: 1 } : n));
    } catch (error) { console.error(error); }
  };

  const limpiarTodas = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/notificaciones/leer-todas`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotificaciones(notificaciones.map(n => ({ ...n, leida: 1 })));
    } catch (error) { console.error(error); }
  };

  const getIcono = (tipo) => {
    switch(tipo) {
      case 'urgente': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'advertencia': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  // PostgreSQL maneja los booleanos como 1 y 0 o true/false, los filtramos asegurando el tipo
  const noLeidas = notificaciones.filter(n => n.leida === 0 || n.leida === false).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        <Bell className="w-6 h-6 text-slate-600" />
        
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full border-2 border-white shadow-sm">
            {noLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-16 mt-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80 md:w-96">
          <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center">
              Notificaciones {noLeidas > 0 && <span className="ml-2 bg-yellow-400 text-slate-900 text-xs px-2 py-0.5 rounded-full">{noLeidas} nuevas</span>}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No tienes notificaciones en este momento.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notificaciones.map((notif) => {
                  const isLeida = notif.leida === 1 || notif.leida === true;
                  return (
                    <li key={notif.id} className={`p-4 hover:bg-slate-50 transition-colors flex gap-4 items-start ${!isLeida ? 'bg-blue-50/30' : 'opacity-70'}`}>
                      <div className="mt-1 flex-shrink-0">
                        {getIcono(notif.tipo)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`text-sm font-bold ${!isLeida ? 'text-slate-800' : 'text-slate-600'}`}>{notif.titulo}</p>
                          <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                            {tiempoTranscurrido(notif.created_at)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{notif.mensaje}</p>
                        
                        {!isLeida && (
                          <button 
                            onClick={() => marcarComoLeida(notif.id)}
                            className="text-[10px] text-blue-600 font-bold mt-2 hover:underline flex items-center"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar como leída
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {noLeidas > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
              <button 
                onClick={limpiarTodas}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Marcar todas como leídas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacionesBell;
