import { useState, useEffect } from 'react';
import { hoyLocal } from '../utils/fechas';
import { 
  Users, FolderOpen, Search, FileText,
  Upload, Trash2, Loader2, AlertCircle, X, ExternalLink,
  CheckCircle2, Clock, CalendarX2
} from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { limitText } from '../utils/inputFormatters';

const ExpedientesScreen = () => {
  // Estados para Socios (Izquierda)
  const [socios, setSocios] = useState([]);
  const [selectedSocio, setSelectedSocio] = useState(null);
  const [searchSocio, setSearchSocio] = useState('');

  // Estados para Documentos (Derecha)
  const [expedientes, setExpedientes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Estado para el Modal de Subida
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileData, setFileData] = useState({
    nombre: '', archivo: null, tipo_expediente: '', numero_documento: '',
    fecha_emision: '', fecha_vencimiento: '', vehiculo_id: '',
  });
  const [uploadError, setUploadError] = useState('');

  // Catalogo de tipos de documento y estado de completitud por socio: lo que
  // convierte el archivo digital en un expediente que se puede controlar.
  const [catalogo, setCatalogo] = useState([]);
  const [resumenPorSocio, setResumenPorSocio] = useState({});

  const tipoSeleccionado = catalogo.find((t) => t.valor === fileData.tipo_expediente);
  // La matricula y la habilitacion describen el auto: se adjuntan a la unidad
  // para que se queden con ella cuando el cupo cambie de dueño.
  const esDeUnidad = tipoSeleccionado?.ambito === 'vehiculo';
  const unidadesDelSocio = selectedSocio?.vehiculos ?? [];
  // El id llega como texto desde el formulario y como numero desde la API:
  // comparar sin convertir mostraba "unidad otra unidad" al recien subirlo.
  const nombreDeUnidad = (id) =>
    unidadesDelSocio.find((u) => Number(u.id) === Number(id))?.numero_vehiculo ?? 'otra unidad';
  const resumenActual = selectedSocio ? resumenPorSocio[selectedSocio.id] : null;

  const ESTILO_VIGENCIA = {
    'Vigente': { chip: 'bg-green-100 text-green-700', icono: CheckCircle2 },
    'Por vencer': { chip: 'bg-amber-100 text-amber-700', icono: Clock },
    'Vencido': { chip: 'bg-red-100 text-red-700', icono: CalendarX2 },
  };

  const cargarResumen = () => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${API_URL}/expedientes/resumen`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : { socios: [] }))
      .then((data) => {
        setResumenPorSocio(Object.fromEntries((data.socios ?? []).map((s) => [s.socio_id, s])));
      })
      .catch(() => setResumenPorSocio({}));
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API_URL}/expedientes/catalogo`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : { tipos: [] }))
      .then((data) => setCatalogo(data.tipos ?? []))
      .catch(() => setCatalogo([]));

    cargarResumen();
  }, []);

  // ==========================================
  // CARGAR SOCIOS
  // ==========================================
  useEffect(() => {
    const fetchSocios = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/socios?select=1`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSocios(data);
        }
      } catch (err) { console.error(err); }
    };
    fetchSocios();
  }, []);

  // ==========================================
  // CARGAR EXPEDIENTES DEL SOCIO SELECCIONADO
  // ==========================================
  useEffect(() => {
    if (selectedSocio) {
      const fetchExpedientes = async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('auth_token');
          const response = await fetch(`${API_URL}/expedientes?socio_id=${selectedSocio.id}&incluir_unidades=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setExpedientes(data);
          }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
      };
      fetchExpedientes();
    }
  }, [selectedSocio]);

  // ==========================================
  // SUBIR ARCHIVO (FORM DATA)
  // ==========================================
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileData.archivo) return setUploadError('Debe seleccionar un archivo.');
    
    setIsUploading(true);
    setUploadError('');

    // FormData es OBLIGATORIO para enviar archivos físicos
    if (!fileData.tipo_expediente) return setUploadError('Debe indicar qué documento es.');
    if (tipoSeleccionado?.vence && !fileData.fecha_vencimiento) {
      return setUploadError('Este documento caduca: indica su fecha de vencimiento.');
    }
    if (esDeUnidad && !fileData.vehiculo_id) {
      return setUploadError('Este documento es del vehículo: indica de qué unidad.');
    }

    const formData = new FormData();
    if (esDeUnidad) {
      formData.append('vehiculo_id', fileData.vehiculo_id);
    } else {
      formData.append('socio_id', selectedSocio.id);
    }
    formData.append('nombre_documento', fileData.nombre);
    formData.append('tipo_expediente', fileData.tipo_expediente);
    formData.append('archivo', fileData.archivo);
    if (fileData.numero_documento) formData.append('numero_documento', fileData.numero_documento);
    if (fileData.fecha_emision) formData.append('fecha_emision', fileData.fecha_emision);
    if (fileData.fecha_vencimiento) formData.append('fecha_vencimiento', fileData.fecha_vencimiento);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/expedientes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // NO poner Content-Type, el navegador lo hará solo
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setExpedientes([data.expediente, ...expedientes]);
        setIsModalOpen(false);
        setFileData({ nombre: '', archivo: null, tipo_expediente: '', numero_documento: '', fecha_emision: '', fecha_vencimiento: '', vehiculo_id: '' });
        cargarResumen();
        showSuccessToast('Documento subido exitosamente.');
      } else {
        const error = await response.json().catch(() => null);
        const primerError = error?.errors ? Object.values(error.errors)[0][0] : null;
        setUploadError(primerError || error?.message || 'Error al subir el archivo. Intente con un formato válido.');
      }
    } catch {
      setUploadError('Error de conexión.');
    } finally { setIsUploading(false); }
  };

  const deleteDocument = async (id) => {
    if (!(await confirmDialog('¿Eliminar este documento permanentemente?'))) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/expedientes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setExpedientes(expedientes.filter(e => e.id !== id));
        showSuccessToast('Documento eliminado exitosamente.');
      }
    } catch { showErrorToast('Error al eliminar.'); }
  };

  // El backend devuelve un enlace temporal (5 min) que apunta directo al
  // bucket en R2: el navegador abre el archivo ahi, no pasa por nuestro servidor.
  const downloadDocument = async (doc) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/expedientes/${doc.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('No se pudo abrir el documento.');
      }

      const { url } = await response.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showErrorToast('No se pudo abrir el documento.');
    }
  };

  // Filtrado de lista lateral
  const sociosFiltrados = socios.filter(s => 
    (s.nombre || '').toLowerCase().includes(searchSocio.toLowerCase()) || 
    (s.vehiculos?.[0]?.numero_vehiculo ?? '').toString().includes(searchSocio)
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col bg-slate-50 overflow-hidden md:h-full md:min-h-0 md:flex-row">
      
      {/* PANEL IZQUIERDO: LISTA DE SOCIOS */}
      <aside className="h-80 w-full bg-white border-b border-slate-200 flex flex-col md:h-auto md:w-80 md:border-b-0 md:border-r">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-yellow-500" /> Socios
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" placeholder="Buscar..." value={searchSocio} onChange={(e) => setSearchSocio(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sociosFiltrados.map(socio => (
            <button 
              key={socio.id}
              onClick={() => setSelectedSocio(socio)}
              className={`w-full p-4 flex items-center text-left border-b border-slate-50 transition-colors
                ${selectedSocio?.id === socio.id ? 'bg-yellow-50 border-r-4 border-r-yellow-500' : 'hover:bg-slate-50'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500 mr-3">
                {socio.vehiculos?.[0]?.numero_vehiculo ?? ''}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-slate-800 text-sm truncate">{socio.nombre}</p>
                <p className="text-xs text-slate-400">{socio.vehiculos?.[0]?.placa ?? ''}</p>
              </div>
              {/* De un vistazo: a quien le falta documentacion obligatoria */}
              {resumenPorSocio[socio.id] && (
                <span
                  title={resumenPorSocio[socio.id].completo
                    ? 'Expediente completo'
                    : `Faltan ${resumenPorSocio[socio.id].faltantes.length} documentos obligatorios`}
                  className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    resumenPorSocio[socio.id].completo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {resumenPorSocio[socio.id].obligatorios_presentes}/{resumenPorSocio[socio.id].obligatorios_totales}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* PANEL DERECHO: CARPETA VIRTUAL */}
      <main className="min-h-0 flex-1 flex flex-col overflow-hidden">
        {selectedSocio ? (
          <>
            <header className="p-4 sm:p-6 bg-white border-b border-slate-200 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center shadow-sm">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center">
                  <FolderOpen className="w-6 h-6 mr-3 text-yellow-500" />
                  Expediente de {selectedSocio.nombre}
                </h2>
                <p className="text-sm text-slate-500">Unidad: {selectedSocio.vehiculos?.[0]?.numero_vehiculo ?? ''} | Placa: {selectedSocio.vehiculos?.[0]?.placa ?? ''}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-all shadow-md"
              >
                <Upload className="w-5 h-5 mr-2" /> Subir Documento
              </button>
            </header>

            {/* Que le falta a este expediente: la pregunta que antes habia que
                responder hojeando la carpeta fisica. */}
            {resumenActual && !resumenActual.completo && (
              <div className="border-b border-red-100 bg-red-50 px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                  {resumenActual.faltantes.length > 0 && (
                    <span className="font-semibold text-red-800">
                      Faltan: {resumenActual.faltantes.map((f) => f.etiqueta).join(', ')}.
                    </span>
                  )}
                  {resumenActual.vencidos.length > 0 && (
                    <span className="font-semibold text-red-800">
                      Vencidos: {resumenActual.vencidos.map((v) => v.etiqueta).join(', ')}.
                    </span>
                  )}
                </div>
              </div>
            )}

            {resumenActual?.completo && resumenActual.por_vencer.length > 0 && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  <span className="font-semibold text-amber-800">
                    Por vencer: {resumenActual.por_vencer.map((d) => `${d.etiqueta} (${d.dias_para_vencer} días)`).join(', ')}.
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-yellow-500" />
                  <p>Abriendo archivador...</p>
                </div>
              ) : expedientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium">La carpeta está vacía</p>
                  <p className="text-sm">Empieza subiendo la matrícula o cédula del socio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                  {expedientes.map(doc => (
                    <div key={doc.id} className="group bg-white p-4 rounded-2xl border border-slate-200 hover:shadow-xl transition-all relative">
                      <div className="aspect-square bg-slate-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                        {['jpg', 'jpeg', 'png'].includes(doc.tipo_documento.toLowerCase()) ? (
                          <img src={doc.url_archivo} alt="doc" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-12 h-12 text-blue-500" />
                        )}
                      </div>
                      <p className="font-bold text-slate-800 text-xs truncate mb-0.5">{doc.nombre_documento}</p>
                      <p className="text-[10px] text-slate-500 font-semibold truncate mb-1.5">
                        {doc.tipo_etiqueta}
                        {doc.vehiculo_id && (
                          <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-600">
                            unidad {nombreDeUnidad(doc.vehiculo_id)}
                          </span>
                        )}
                      </p>

                      {/* Vigencia: lo que permite saber que documentos caducaron */}
                      {doc.estado_vigencia !== 'Sin vencimiento' && (() => {
                        const estilo = ESTILO_VIGENCIA[doc.estado_vigencia] ?? ESTILO_VIGENCIA['Vigente'];
                        const Icono = estilo.icono;
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold mb-1 ${estilo.chip}`}>
                            <Icono className="w-3 h-3 mr-1" />
                            {doc.estado_vigencia === 'Vencido'
                              ? `Venció hace ${Math.abs(doc.dias_para_vencer)} d`
                              : doc.estado_vigencia === 'Por vencer'
                                ? `Vence en ${doc.dias_para_vencer} d`
                                : 'Vigente'}
                          </span>
                        );
                      })()}

                      <p className="text-[10px] text-slate-400 uppercase font-bold">{doc.tipo_documento} • {new Date(doc.created_at).toLocaleDateString()}</p>
                      
                      {/* Acciones flotantes */}
                      <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadDocument(doc)} className="p-1.5 bg-white shadow-md rounded-lg text-blue-600 hover:bg-blue-50" title="Descargar documento">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteDocument(doc.id)} className="p-1.5 bg-white shadow-md rounded-lg text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="bg-white p-10 rounded-full shadow-inner mb-6">
              <FolderOpen className="w-20 h-20 opacity-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-600">Gestión de Expedientes</h3>
            <p className="max-w-xs text-center mt-2">Selecciona un socio de la lista izquierda para ver sus documentos digitalizados.</p>
          </div>
        )}
      </main>

      {/* MODAL DE SUBIDA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-4 sm:p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Subir Documento</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleUpload} className="p-4 sm:p-6 space-y-4">
              {uploadError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> {uploadError}</div>}
              
              <div>
                <label className="block text-sm font-bold mb-2">Nombre del Documento</label>
                <input 
                  type="text" required maxLength="80" value={fileData.nombre} onChange={(e) => setFileData({...fileData, nombre: limitText(e.target.value, 80)})}
                  placeholder="Ej: Matrícula 2026" className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              {/* Clasificar el documento es lo que permite despues saber que
                  falta en un expediente y que esta por caducar. */}
              <div>
                <label className="block text-sm font-bold mb-2">¿Qué documento es?</label>
                <select
                  required value={fileData.tipo_expediente}
                  onChange={(e) => setFileData({ ...fileData, tipo_expediente: e.target.value, fecha_vencimiento: '', vehiculo_id: '' })}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="" disabled>-- Selecciona el tipo --</option>
                  {catalogo.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}{t.obligatorio ? ' (obligatorio)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* La matricula y la habilitacion son del auto: hay que decir de cual. */}
              {esDeUnidad && (
                <div>
                  <label className="block text-sm font-bold mb-2">¿De qué unidad?</label>
                  {unidadesDelSocio.length === 0 ? (
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Este socio no tiene ninguna unidad registrada. Registra primero el vehículo:
                      este documento describe el auto, no a la persona.
                    </p>
                  ) : (
                    <>
                      <select
                        required value={fileData.vehiculo_id}
                        onChange={(e) => setFileData({ ...fileData, vehiculo_id: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="" disabled>-- Selecciona la unidad --</option>
                        {unidadesDelSocio.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.numero_vehiculo} · {u.placa}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-400">
                        Se queda con la unidad: si el cupo cambia de socio, el documento sigue ahí.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">N° de documento <span className="font-normal text-slate-400">(opcional)</span></label>
                  <input
                    type="text" maxLength="60" value={fileData.numero_documento}
                    onChange={(e) => setFileData({ ...fileData, numero_documento: limitText(e.target.value, 60) })}
                    placeholder="Ej: 011-HV-013-DTTTSV-2025"
                    className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Fecha de emisión <span className="font-normal text-slate-400">(opcional)</span></label>
                  <input
                    type="date" max={hoyLocal()} value={fileData.fecha_emision}
                    onChange={(e) => setFileData({ ...fileData, fecha_emision: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 text-sm"
                  />
                </div>
              </div>

              {tipoSeleccionado?.vence && (
                <div>
                  <label className="block text-sm font-bold mb-2">Fecha de vencimiento</label>
                  <input
                    type="date" required min={hoyLocal()} value={fileData.fecha_vencimiento}
                    onChange={(e) => setFileData({ ...fileData, fecha_vencimiento: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Este documento caduca. El sistema avisará 30 días antes del vencimiento.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold mb-2">Seleccionar Archivo (PDF o Imagen)</label>
                <div className="relative group">
                  <input 
                    type="file" required accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFileData({...fileData, archivo: e.target.files[0]})}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center group-hover:border-yellow-400 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300 group-hover:text-yellow-500" />
                    <p className="text-xs text-slate-500">{fileData.archivo ? fileData.archivo.name : "Haga clic o arrastre aquí"}</p>
                  </div>
                </div>
              </div>

              <button 
                type="submit" disabled={isUploading}
                className="w-full py-4 bg-slate-900 text-yellow-400 rounded-2xl font-bold hover:bg-slate-800 transition-all flex justify-center items-center"
              >
                {isUploading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Subiendo...</> : "Empezar Subida"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpedientesScreen;
