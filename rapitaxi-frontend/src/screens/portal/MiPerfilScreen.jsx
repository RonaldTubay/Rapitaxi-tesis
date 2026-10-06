import { useState, useEffect } from 'react';
import { Loader2, Save, CarFront, AlertCircle, Phone, Mail, MapPin, IdCard } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/apiClient';
import { showErrorToast, showSuccessToast } from '../../utils/feedback';
import { onlyDigits, limitText } from '../../utils/inputFormatters';
import { isValidEmail, isValidTelefonoEc } from '../../utils/validators';

const initialesDe = (nombre) => (nombre || '')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((palabra) => palabra[0]?.toUpperCase())
  .join('') || '?';

const MiPerfilScreen = () => {
  const [socio, setSocio] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ telefono: '', correo: '', direccion: '' });

  useEffect(() => {
    const fetchPerfil = async () => {
      setIsLoading(true);
      try {
        const data = await apiClient.get('/mi-perfil');
        setSocio(data);
        setFormData({
          telefono: data.telefono || '',
          correo: data.correo || '',
          direccion: data.direccion || '',
        });
      } catch {
        setError('No se pudo cargar tu información. Intenta de nuevo más tarde.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerfil();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      telefono: (input) => onlyDigits(input, 10),
      correo: (input) => limitText(input, 100),
      direccion: (input) => limitText(input, 150),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValidTelefonoEc(formData.telefono.trim())) {
      showErrorToast('El teléfono es obligatorio: deben ser 10 dígitos y empezar en 0.');
      return;
    }

    if (!isValidEmail(formData.correo.trim())) {
      showErrorToast('El correo es obligatorio y debe tener un formato válido.');
      return;
    }

    setIsSaving(true);
    try {
      const data = await apiClient.put('/mi-perfil', formData);
      setSocio(data.socio);
      showSuccessToast('Tus datos se actualizaron exitosamente.');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-yellow-500" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado: presenta al socio, en vez de arrancar directo con una tabla de datos */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-yellow-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-yellow-400/5 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FFCC00] text-slate-900 text-xl font-extrabold shadow-md">
            {initialesDe(socio.nombre)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate">{socio.nombre}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-semibold">
                <IdCard className="w-3.5 h-3.5 mr-1.5" /> {socio.cedula || 'Cédula no registrada'}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                socio.estado === 'Activo' ? 'bg-green-400/20 text-green-300' : 'bg-red-400/20 text-red-300'
              }`}>
                Socio {socio.estado}
              </span>
            </div>
          </div>
        </div>
        <p className="relative mt-5 text-xs text-slate-400">
          Tu nombre, cédula y estado de afiliación los administra la cooperativa — para corregirlos, contacta al administrador.
        </p>
      </div>

      {/* En pantallas grandes, contacto y vehiculos van lado a lado para no
          dejar el layout como una tira vertical angosta con espacio vacio. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* Datos de contacto: editables por el socio */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Datos de Contacto</h2>
        <p className="text-sm text-slate-400 mb-5">Mantenlos al día para que la cooperativa pueda ubicarte.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Teléfono</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text" name="telefono" value={formData.telefono} onChange={handleInputChange}
                  required inputMode="numeric" pattern="[0-9]{10}" maxLength="10"
                  placeholder="Teléfono de 10 dígitos"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Correo</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email" name="correo" value={formData.correo} onChange={handleInputChange}
                  required maxLength="100" placeholder="correo@ejemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Dirección</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text" name="direccion" value={formData.direccion} onChange={handleInputChange}
                maxLength="150" placeholder="Dirección completa"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
              />
            </div>
          </div>
          <button
            type="submit" disabled={isSaving}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
              isSaving ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'
            }`}
          >
            {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5 mr-2" /> Guardar Cambios</>}
          </button>
        </form>
      </div>

      {/* Vehículos a mi nombre: solo lectura, la placa se muestra como matricula real */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center mb-5">
          <CarFront className="w-5 h-5 mr-2 text-slate-400" /> Mis Vehículos
        </h2>
        {socio.vehiculos?.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {socio.vehiculos.map((v) => (
              <div key={v.id} className="flex items-center gap-4 border border-slate-100 rounded-xl p-4 bg-slate-50">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900">
                  <CarFront className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">Unidad {v.numero_vehiculo} · {v.marca} · {v.tipo_vehiculo}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded border-2 border-slate-800 bg-yellow-300 text-slate-900 text-xs font-extrabold tracking-wider font-mono">
                    {v.placa}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CarFront className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-slate-400 text-sm">No tienes vehículos registrados a tu nombre.</p>
          </div>
        )}
      </div>

      </div>
    </div>
  );
};

export default MiPerfilScreen;
