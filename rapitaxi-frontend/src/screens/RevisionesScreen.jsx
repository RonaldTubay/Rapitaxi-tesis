import { useCallback, useState, useEffect } from 'react';
import { hoyLocal } from '../utils/fechas';
import {
  Search, Edit, Trash2, Loader2, AlertCircle,
  X, Save, Plus, Calendar, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { limitText } from '../utils/inputFormatters';
import Paginacion from '../components/Paginacion';
import ColumnaOrdenable from '../components/ColumnaOrdenable';

const RevisionesScreen = () => {
  // ==========================================
  // ESTADOS
  // ==========================================
  const [revisiones, setRevisiones] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // La busqueda y la paginacion las resuelve el servidor: filtrar en el
  // navegador solo alcanzaria a la pagina que se esta viendo.
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [orden, setOrden] = useState({ campo: 'fecha_revision', direccion: 'desc' });
  const [meta, setMeta] = useState(null);

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const fechaHoy = hoyLocal();

  // Lista de trámites por defecto
  const TIPOS_TRAMITE = [
    'RTV Manta', 
    'Renovación de Matrícula', 
    'Inspección ANT', 
    'Permiso de Operación', 
    'Cambio de Especie'
  ];

  const [formData, setFormData] = useState({
    vehiculo_id: '',
    fecha_revision: fechaHoy,
    fecha_vencimiento: '',
    tipo: 'RTV Manta',
    tipo_personalizado: '', // <-- Nuevo estado para guardar lo que escriba el usuario
    estado: 'Aprobada',
    observaciones: ''
  });

  // ==========================================
  // FUNCIONES DE API
  // ==========================================
  // sigueVigente() descarta una respuesta que llega tarde: si el usuario ya
  // cambio de pagina o de busqueda, aplicarla mostraria datos equivocados.
  const fetchData = useCallback(async (sigueVigente = () => true) => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` };

      const params = new URLSearchParams({
        page: String(pagina),
        per_page: String(porPagina),
        sort: orden.campo,
        dir: orden.direccion,
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const resRevisiones = await fetch(`${API_URL}/revisiones?${params}`, { headers });

      if (!sigueVigente()) return;

      if (resRevisiones.ok) {
        const { data, ...paginacion } = await resRevisiones.json();
        setRevisiones(data);
        setMeta(paginacion);
      } else {
        setError('Error al cargar la bitácora de revisiones.');
      }
    } catch {
      if (sigueVigente()) setError('Error de conexión con el servidor.');
    } finally {
      if (sigueVigente()) setIsLoading(false);
    }
  }, [pagina, porPagina, orden, searchTerm]);

  // Al escribir en el buscador se espera medio segundo antes de consultar,
  // para no disparar una peticion por cada tecla.
  // Los vehiculos alimentan el selector del formulario: no cambian al pasar
  // de pagina, asi que se piden una sola vez al entrar.
  useEffect(() => {
    fetch(`${API_URL}/vehiculos?select=1`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehiculos)
      .catch(() => setVehiculos([]));
  }, []);

  useEffect(() => {
    let vigente = true;
    const temporizador = setTimeout(() => { fetchData(() => vigente); }, searchTerm ? 500 : 0);
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [fetchData, searchTerm]);

  // Una busqueda nueva siempre arranca en la primera pagina. Reordenar o
  // cambiar el tamaño de pagina, tambien.
  const handleBuscar = (valor) => {
    setSearchTerm(valor);
    setPagina(1);
  };

  const handleOrdenar = (nuevo) => { setOrden(nuevo); setPagina(1); };
  const handleTamano = (n) => { setPorPagina(n); setPagina(1); };

  // ==========================================
  // MANEJADORES DE EVENTOS
  // ==========================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      tipo_personalizado: (input) => limitText(input, 80),
      observaciones: (input) => limitText(input, 500),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const openCreateModal = () => {
    setFormData({ 
      vehiculo_id: '', fecha_revision: fechaHoy, fecha_vencimiento: '', tipo: 'RTV Manta',
      tipo_personalizado: '', estado: 'Aprobada', observaciones: ''
    });
    setEditingId(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rev) => {
    // Verificamos si el trámite que viene de la BD está en nuestra lista fija
    const esTramiteFijo = TIPOS_TRAMITE.includes(rev.tipo);

    setFormData({
      vehiculo_id: rev.vehiculo_id,
      fecha_revision: rev.fecha_revision,
      fecha_vencimiento: rev.fecha_vencimiento || '',
      tipo: esTramiteFijo ? rev.tipo : 'Otro', // Si no está en la lista, marcamos "Otro"
      tipo_personalizado: esTramiteFijo ? '' : rev.tipo, // Y ponemos el texto en la cajita
      estado: rev.estado,
      observaciones: rev.observaciones || ''
    });
    setEditingId(rev.id);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    // Preparamos los datos limpios para Laravel
    const payload = {
      vehiculo_id: formData.vehiculo_id,
      fecha_revision: formData.fecha_revision,
      // Si eligió "Otro", mandamos lo que escribió, si no, mandamos la opción del selector
      tipo: formData.tipo === 'Otro' ? formData.tipo_personalizado : formData.tipo,
      estado: formData.estado,
      observaciones: formData.observaciones
    };

    // Validación extra si eligió "Otro" pero lo dejó vacío
    if (formData.tipo === 'Otro' && payload.tipo.trim() === '') {
      setFormError('Debe especificar el nombre del trámite.');
      setIsSubmitting(false);
      return;
    }

    const isEditing = editingId !== null;
    const url = isEditing ? `${API_URL}/revisiones/${editingId}` : `${API_URL}/revisiones`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditing) {
          setRevisiones(revisiones.map(r => r.id === editingId ? data.revision : r));
          showSuccessToast('Tramite legal actualizado exitosamente.');
        } else {
          setRevisiones([data.revision, ...revisiones]);
          showSuccessToast('Tramite legal registrado exitosamente.');
        }
        setIsModalOpen(false);
      } else {
        setFormError(data.message || 'Error al guardar la revisión.');
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('¿Eliminar este registro legal permanentemente?'))) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/revisiones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setRevisiones(revisiones.filter(r => r.id !== id));
        showSuccessToast('Tramite legal eliminado exitosamente.');
      }
    } catch { showErrorToast('Error de conexión.'); }
  };

  // El filtrado lo hace el servidor (ver fetchData): la lista ya llega filtrada.
  const revisionesFiltradas = revisiones;

  const getEstadoBadge = (estado) => {
    switch(estado) {
      case 'Aprobada': return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center w-max"><CheckCircle className="w-3 h-3 mr-1"/> Aprobada</span>;
      case 'Rechazada': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center w-max"><XCircle className="w-3 h-3 mr-1"/> Rechazada</span>;
      case 'Pendiente': return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold flex items-center w-max"><Clock className="w-3 h-3 mr-1"/> Pendiente</span>;
      default: return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Control de RTV y Legal</h2>
          <p className="text-slate-500 mt-1">Bitácora de revisiones vehiculares, permisos y trámites con la ANT/GAD.</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" value={searchTerm} onChange={(e) => handleBuscar(e.target.value)}
              placeholder="Buscar unidad, placa o trámite..." 
              className="w-full sm:w-72 pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            />
          </div>
          <button onClick={openCreateModal} className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md">
            <Plus className="w-5 h-5 mr-2" /> Registrar Trámite
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <ColumnaOrdenable campo="fecha_revision" orden={orden} onOrdenar={handleOrdenar}>Fecha</ColumnaOrdenable>
                <th className="p-4">Unidad / Placa</th>
                <ColumnaOrdenable campo="tipo" orden={orden} onOrdenar={handleOrdenar}>Trámite Legal</ColumnaOrdenable>
                <ColumnaOrdenable campo="estado" orden={orden} onOrdenar={handleOrdenar}>Estado</ColumnaOrdenable>
                <th className="p-4">Resolución / Observaciones</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {isLoading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-yellow-500" />Cargando trámites...</td></tr>
              ) : revisionesFiltradas.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">No hay trámites legales registrados.</td></tr>
              ) : (
                revisionesFiltradas.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        {new Date(rev.fecha_revision).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">Vehi: {rev.vehiculo?.numero_vehiculo}</div>
                      <div className="text-xs text-slate-500 font-mono">Placa: {rev.vehiculo?.placa}</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                        {/* Se renderiza el tipo tal como viene de la BD */}
                        {rev.tipo} 
                    </td>
                    <td className="p-4">{getEstadoBadge(rev.estado)}</td>
                    <td className="p-4 max-w-xs truncate text-xs text-slate-500">{rev.observaciones || <span className="italic opacity-50">Sin observaciones</span>}</td>
                    <td className="p-4 flex justify-center space-x-2">
                      <button onClick={() => openEditModal(rev)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(rev.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion meta={meta} onCambiarPagina={setPagina} onCambiarTamano={handleTamano} />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{editingId ? 'Editar Trámite' : 'Registrar Trámite Legal'}</h3>
                <p className="text-slate-500 mt-1">Bitácora de revisiones y documentos habilitantes</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 pt-4 sm:p-6 sm:pt-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {formError && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{formError}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Vehículo</label>
                  <select name="vehiculo_id" value={formData.vehiculo_id} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                    <option value="" disabled>-- Seleccione la unidad --</option>
                    {vehiculos.map(v => (
                      <option key={v.id} value={v.id}>{v.numero_vehiculo} | Placa: {v.placa} ({v.socio?.nombre})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Fecha del Trámite</label>
                    <input type="date" name="fecha_revision" value={formData.fecha_revision} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400" />

                    {/* Sin esta fecha no se puede avisar al socio antes de que
                        caduque la revisión. Solo aplica a las aprobadas. */}
                    {formData.estado === 'Aprobada' && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-800 mb-1">Válida hasta</label>
                        <input
                          type="date" name="fecha_vencimiento" value={formData.fecha_vencimiento}
                          onChange={handleInputChange} required min={formData.fecha_revision}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                        <p className="text-xs text-slate-400 mt-1">El socio verá el aviso 30 días antes.</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Selector y campo dinámico */}
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">Tipo de Trámite</label>
                      <select name="tipo" value={formData.tipo} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        {TIPOS_TRAMITE.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="Otro">Otro (Especificar)</option>
                      </select>
                    </div>
                    
                    {/* Campo de texto que aparece mágicamente si elige "Otro" */}
                    {formData.tipo === 'Otro' && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <input 
                          type="text" name="tipo_personalizado" value={formData.tipo_personalizado} onChange={handleInputChange}
                          required maxLength="80" placeholder="Especifique..." className="w-full px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Estado de Resolución</label>
                  <select name="estado" value={formData.estado} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold">
                    <option value="Aprobada">🟢 Aprobada / Vigente</option>
                    <option value="Pendiente">🟡 En Trámite / Pendiente</option>
                    <option value="Rechazada">🔴 Rechazada / Observada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Observaciones / Detalles</label>
                  <textarea name="observaciones" value={formData.observaciones} onChange={handleInputChange} rows="2" maxLength="500" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" placeholder="Ej. Trámite ingresado el día de hoy / Especie pendiente de entrega..." />
                </div>
              </div>

              <div className="mt-6">
                <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-colors ${isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500 shadow-md'}`}>
                  {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Guardando...</> : <><Save className="w-6 h-6 mr-2" /> Guardar Registro Legal</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionesScreen;
