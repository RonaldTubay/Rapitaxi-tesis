import { useCallback, useState, useEffect } from 'react';
import { hoyLocal } from '../utils/fechas';
import { Search, Trash2, Loader2, AlertCircle, X, Save, DollarSign, Calendar, Eye, Check, Ban } from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { normalizeDecimal, onlyDigits } from '../utils/inputFormatters';
import { apiClient, ApiError } from '../lib/apiClient';
import Paginacion from '../components/Paginacion';
import ColumnaOrdenable from '../components/ColumnaOrdenable';

const ESTADO_ESTILO = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Aprobado: 'bg-green-100 text-green-700',
  Rechazado: 'bg-red-100 text-red-700',
};

const AportacionesScreen = () => {
  // ==========================================
  // ESTADOS
  // ==========================================
  const [aportaciones, setAportaciones] = useState([]);
  const [socios, setSocios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // El servidor pagina y filtra: esta tabla crece 12 filas por socio al año.
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [orden, setOrden] = useState({ campo: 'id', direccion: 'desc' });
  const [meta, setMeta] = useState(null);
  // Se pide aparte porque el total de pendientes no puede salir de la pagina
  // que se esta viendo: uno de la pagina 3 quedaria sin revisar.
  const [pendientesCount, setPendientesCount] = useState(0);

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Revision de comprobantes subidos por el socio
  const [aportacionARechazar, setAportacionARechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [isRevisando, setIsRevisando] = useState(null);

  const fechaHoy = hoyLocal();
  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  const [formData, setFormData] = useState({
    socio_id: '',
    mes_pagado: mesActual,
    anio_pagado: anioActual,
    monto: '20.00',
    fecha_pago: fechaHoy,
    metodo_pago: 'Efectivo'
  });

  // ==========================================
  // FUNCIONES DE API
  // ==========================================
  // sigueVigente() permite descartar una respuesta que llega tarde: si el
  // usuario ya cambio de pagina o de busqueda, aplicarla mostraria datos que
  // no corresponden a lo que pidio.
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
      if (filtroEstado !== 'Todos') params.set('estado', filtroEstado);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const resAportaciones = await fetch(`${API_URL}/aportaciones?${params}`, { headers });

      if (!sigueVigente()) return;

      if (resAportaciones.ok) {
        const { data, ...paginacion } = await resAportaciones.json();
        setAportaciones(data);
        setMeta(paginacion);
      } else {
        setError('Error al cargar la información. Revisa que el servidor backend esté funcionando.');
      }
    } catch {
      if (sigueVigente()) setError('Error de conexión con el servidor.');
    } finally {
      if (sigueVigente()) setIsLoading(false);
    }
  }, [pagina, porPagina, orden, searchTerm, filtroEstado]);

  // Los socios alimentan el selector del formulario y el contador de
  // pendientes: no cambian al pasar de pagina, asi que se piden una sola vez.
  useEffect(() => {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` };

    Promise.all([
      fetch(`${API_URL}/socios?select=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_URL}/aportaciones?estado=Pendiente&per_page=1`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([listaSocios, pendientes]) => {
        setSocios(listaSocios);
        setPendientesCount(pendientes?.total ?? 0);
      })
      .catch(() => setSocios([]));
  }, []);

  // Medio segundo de espera al escribir, para no consultar en cada tecla.
  useEffect(() => {
    let vigente = true;
    const temporizador = setTimeout(() => { fetchData(() => vigente); }, searchTerm ? 500 : 0);
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [fetchData, searchTerm]);

  // Reordenar o cambiar el tamaño de pagina tambien vuelve al principio.
  const handleOrdenar = (nuevo) => { setOrden(nuevo); setPagina(1); };
  const handleTamano = (n) => { setPorPagina(n); setPagina(1); };

  // Cambiar de filtro o de busqueda siempre vuelve a la primera pagina.
  const handleBuscar = (valor) => {
    setSearchTerm(valor);
    setPagina(1);
  };

  const handleFiltroEstado = (valor) => {
    setFiltroEstado(valor);
    setPagina(1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      anio_pagado: (input) => onlyDigits(input, 4),
      monto: (input) => normalizeDecimal(input, 5),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const openCreateModal = () => {
    setFormData({
      socio_id: '', mes_pagado: mesActual, anio_pagado: anioActual,
      monto: '20.00', fecha_pago: fechaHoy, metodo_pago: 'Efectivo'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/aportaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setAportaciones([data.aportacion, ...aportaciones]);
        setIsModalOpen(false);
        showSuccessToast('Aportacion registrada exitosamente.');
      } else {
        setFormError(data.message || 'Error al guardar la aportación.');
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('¿Anular esta aportación?'))) return;
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/aportaciones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAportaciones(aportaciones.filter(a => a.id !== id));
      showSuccessToast('Aportacion anulada exitosamente.');
    } catch { showErrorToast('Error al eliminar.'); }
  };

  // El comprobante lo sirve R2 directo via una URL firmada (5 min), no pasa
  // por este servidor. Se abre en pestaña nueva con el visor del navegador.
  const verComprobante = async (id) => {
    try {
      const data = await apiClient.get(`/aportaciones/${id}/comprobante`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      showErrorToast('No se pudo abrir el comprobante.');
    }
  };

  const handleAprobar = async (aportacion) => {
    if (!(await confirmDialog(`¿Aprobar el pago de ${aportacion.socio?.nombre} por $${aportacion.monto}?`, { danger: false }))) return;
    setIsRevisando(aportacion.id);
    try {
      const data = await apiClient.put(`/aportaciones/${aportacion.id}/aprobar`);
      setAportaciones(aportaciones.map((a) => (a.id === aportacion.id ? data.aportacion : a)));
      setPendientesCount((n) => Math.max(0, n - 1));
      showSuccessToast('Comprobante aprobado exitosamente.');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'No se pudo aprobar.');
    } finally {
      setIsRevisando(null);
    }
  };

  const openRechazoModal = (aportacion) => {
    setAportacionARechazar(aportacion);
    setMotivoRechazo('');
  };

  const handleConfirmarRechazo = async (e) => {
    e.preventDefault();
    setIsRevisando(aportacionARechazar.id);
    try {
      const data = await apiClient.put(`/aportaciones/${aportacionARechazar.id}/rechazar`, { motivo_rechazo: motivoRechazo });
      setAportaciones(aportaciones.map((a) => (a.id === aportacionARechazar.id ? data.aportacion : a)));
      setPendientesCount((n) => Math.max(0, n - 1));
      showSuccessToast('Comprobante rechazado.');
      setAportacionARechazar(null);
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'No se pudo rechazar.');
    } finally {
      setIsRevisando(null);
    }
  };

  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // El filtrado y la busqueda los hace el servidor (ver fetchData).
  const aportacionesFiltradas = aportaciones;

  return (
    <div className="p-4 sm:p-6 lg:p-10 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center">
            Control de Aportaciones
            {pendientesCount > 0 && (
              <span className="ml-3 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''} de revisar
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-1">Registro de pagos mensuales y comprobantes subidos por los socios.</p>
        </div>
        <div className="mt-4 md:mt-0 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <select
            value={filtroEstado} onChange={(e) => handleFiltroEstado(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-semibold text-slate-700 shadow-sm cursor-pointer"
          >
            <option value="Todos">Todos los estados</option>
            <option value="Pendiente">🟡 Pendientes</option>
            <option value="Aprobado">🟢 Aprobados</option>
            <option value="Rechazado">🔴 Rechazados</option>
          </select>
          <div className="relative w-full sm:w-auto">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text" value={searchTerm} onChange={(e) => handleBuscar(e.target.value)}
              placeholder="Buscar socio..."
              className="w-full sm:w-72 pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            />
          </div>
          <button onClick={openCreateModal} className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md">
            <DollarSign className="w-5 h-5 mr-2" /> Registrar Aportación
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr className="border-b border-slate-100">
                <th className="p-4">Recibo</th>
                <th className="p-4">Socio</th>
                <ColumnaOrdenable campo="anio_pagado" orden={orden} onOrdenar={handleOrdenar}>Periodo</ColumnaOrdenable>
                <ColumnaOrdenable campo="fecha_pago" orden={orden} onOrdenar={handleOrdenar}>Fecha</ColumnaOrdenable>
                <ColumnaOrdenable campo="monto" orden={orden} onOrdenar={handleOrdenar}>Monto</ColumnaOrdenable>
                <ColumnaOrdenable campo="estado" orden={orden} onOrdenar={handleOrdenar}>Estado</ColumnaOrdenable>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? <tr><td colSpan="7" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-yellow-500 w-8 h-8" /></td></tr> :
                aportacionesFiltradas.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-slate-500">No hay registros de aportaciones.</td></tr>
                ) : (
                aportacionesFiltradas.map((a) => (
                  <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${a.estado === 'Pendiente' ? 'bg-amber-50/60' : ''}`}>
                    <td className="p-4 font-bold text-slate-500">#{a.id.toString().padStart(4, '0')}</td>
                    <td className="p-4 font-semibold text-slate-900">{a.socio?.nombre}</td>
                    <td className="p-4"><span className="px-3 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg">{nombresMeses[a.mes_pagado - 1]} {a.anio_pagado}</span></td>
                    <td className="p-4 flex items-center mt-2 text-slate-600"><Calendar className="w-4 h-4 mr-2" /> {a.fecha_pago}</td>
                    <td className="p-4 font-bold text-green-600">${parseFloat(a.monto).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${ESTADO_ESTILO[a.estado] || 'bg-slate-100 text-slate-600'}`}>
                        {a.estado}
                      </span>
                      {a.estado === 'Rechazado' && a.motivo_rechazo && (
                        <p className="text-[11px] text-red-500 mt-1 max-w-[160px]">{a.motivo_rechazo}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {a.comprobante_ruta && (
                          <button onClick={() => verComprobante(a.id)} title="Ver comprobante" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                        )}
                        {a.estado === 'Pendiente' && (
                          <>
                            <button
                              onClick={() => handleAprobar(a)} disabled={isRevisando === a.id} title="Aprobar"
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                            >
                              {isRevisando === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => openRechazoModal(a)} title="Rechazar" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Ban className="w-4 h-4" /></button>
                          </>
                        )}
                        <button onClick={() => handleDelete(a.id)} title="Anular" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion meta={meta} onCambiarPagina={setPagina} onCambiarTamano={handleTamano} />
      </div>

      {/* MODAL PARA REGISTRAR APORTACIÓN (Que faltaba en tu código) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Registrar Aportación</h3>
                <p className="text-slate-500 mt-1">Ingrese el pago de la cuota mensual del socio</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 pt-4 sm:p-6 sm:pt-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {formError && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{formError}</div>
              )}

              <div className="space-y-4">
                
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Seleccionar Socio</label>
                  <select name="socio_id" value={formData.socio_id} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                    <option value="" disabled>-- Elija un socio de la lista --</option>
                    {socios.map(socio => (
                      <option key={socio.id} value={socio.id}>
                        {socio.nombre} {socio.cedula ? `(C.I: ${socio.cedula})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Mes que paga</label>
                    <select name="mes_pagado" value={formData.mes_pagado} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                      {nombresMeses.map((mes, index) => (
                        <option key={index + 1} value={index + 1}>{mes}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Año</label>
                    <input type="text" name="anio_pagado" value={formData.anio_pagado} onChange={handleInputChange} required inputMode="numeric" pattern="[0-9]{4}" maxLength="4" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Monto ($)</label>
                    <input type="text" inputMode="decimal" name="monto" value={formData.monto} onChange={handleInputChange} required maxLength="8" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 font-bold text-green-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Fecha del Recibo</label>
                    <input type="date" name="fecha_pago" value={formData.fecha_pago} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Método de Pago</label>
                  <select name="metodo_pago" value={formData.metodo_pago} onChange={handleInputChange} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  type="submit" disabled={isSubmitting}
                  className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-colors
                    ${isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-md'}`}
                >
                  {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Procesando pago...</> : <><Save className="w-6 h-6 mr-2" /> Guardar Recibo</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RECHAZO: pide el motivo antes de confirmar */}
      {aportacionARechazar && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Rechazar Comprobante</h3>
                <p className="text-slate-500 mt-1 text-sm">Para {aportacionARechazar.socio?.nombre}. El socio vera este motivo y podra volver a subir uno nuevo.</p>
              </div>
              <button onClick={() => setAportacionARechazar(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleConfirmarRechazo} className="p-4 pt-4 sm:p-6 sm:pt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo del rechazo</label>
                <textarea
                  value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)}
                  required maxLength="300" rows="3" autoFocus
                  placeholder="Ej. El comprobante no corresponde al mes indicado."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 resize-none"
                />
              </div>
              <button
                type="submit" disabled={isRevisando === aportacionARechazar.id}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isRevisando === aportacionARechazar.id ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isRevisando === aportacionARechazar.id ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Rechazando...</> : <><Ban className="w-5 h-5 mr-2" /> Confirmar Rechazo</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AportacionesScreen;
