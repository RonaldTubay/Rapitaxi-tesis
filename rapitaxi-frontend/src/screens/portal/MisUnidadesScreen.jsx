import { useState, useEffect } from 'react';
import { hoyLocal } from '../../utils/fechas';
import { Loader2, CarFront, AlertTriangle, CheckCircle2, Clock, Upload, X, AlertCircle, FileQuestion, Wrench, Calendar } from 'lucide-react';
import { API_URL } from '../../apiConfig';
import { apiClient } from '../../lib/apiClient';
import { showSuccessToast } from '../../utils/feedback';
import { limitText, onlyDigits } from '../../utils/inputFormatters';

const MAX_RESPALDO_MB = 5;

// Mismos nombres que devuelve el backend (App\Services\PlanMantenimiento).
const ESTILO_ESTADO = {
  'Vencido': { chip: 'bg-red-100 text-red-700', punto: 'bg-red-500', icono: AlertTriangle, texto: 'text-red-600' },
  'Sin registro': { chip: 'bg-amber-100 text-amber-700', punto: 'bg-amber-500', icono: FileQuestion, texto: 'text-amber-600' },
  'Por vencer': { chip: 'bg-amber-100 text-amber-700', punto: 'bg-amber-400', icono: Clock, texto: 'text-amber-600' },
  'Al día': { chip: 'bg-green-100 text-green-700', punto: 'bg-green-500', icono: CheckCircle2, texto: 'text-green-600' },
};

const estiloDe = (estado) => ESTILO_ESTADO[estado] || ESTILO_ESTADO['Al día'];

const formatearFecha = (fecha) => (fecha ? new Date(`${fecha}T00:00:00`).toLocaleDateString() : '—');

// Un dia no son "1 días": el singular se decide en un solo lugar.
const dias = (n) => (Math.abs(n) === 1 ? 'día' : 'días');

const AvisoDocumento = ({ nombre, documento }) => {
  const estado = documento?.estado || 'Sin registrar';
  const vencida = estado === 'Vencida';
  const porVencer = estado === 'Por vencer';
  const estilo = vencida ? 'bg-red-50 border-red-100 text-red-700' : porVencer || estado === 'Sin registrar'
    ? 'bg-amber-50 border-amber-100 text-amber-700'
    : 'bg-green-50 border-green-100 text-green-700';
  const texto = vencida
    ? `venció hace ${Math.abs(documento.dias_para_vencer)} ${dias(documento.dias_para_vencer)}`
    : porVencer
      ? documento.dias_para_vencer === 0 ? 'vence hoy' : `vence en ${documento.dias_para_vencer} ${dias(documento.dias_para_vencer)}`
      : estado === 'Sin registrar' ? 'sin fecha de caducidad registrada' : `vigente hasta ${formatearFecha(documento.fecha_caducidad)}`;

  return (
    <div className={`border-b px-5 py-2.5 text-xs font-semibold ${estilo}`}>
      {nombre}: {texto}
    </div>
  );
};

// "vencido hace 12 días" se entiende mejor que un número suelto.
const textoPlazo = (item) => {
  if (item.estado === 'Sin registro') return 'Nunca se ha registrado este trabajo';
  if (item.dias_restantes === null) return '';
  if (item.dias_restantes < 0) return `Vencido hace ${Math.abs(item.dias_restantes)} ${dias(item.dias_restantes)}`;
  if (item.dias_restantes === 0) return 'Vence hoy';
  return `${item.dias_restantes === 1 ? 'Falta' : 'Faltan'} ${item.dias_restantes} ${dias(item.dias_restantes)}`;
};

const MisUnidadesScreen = () => {
  const [unidades, setUnidades] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [unidadActiva, setUnidadActiva] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({ tipo_mantenimiento: '', fecha_mantenimiento: '', kilometraje_actual: '', naturaleza: 'Preventivo', observaciones: '' });
  const [archivo, setArchivo] = useState(null);

  const cargarUnidades = () => apiClient.get('/mis-unidades')
    .then((data) => {
      setUnidades(data.unidades || []);
      setTipos(data.tipos_mantenimiento || []);
      setError('');
    })
    .catch(() => setError('No se pudo cargar la información de tus unidades.'));

  useEffect(() => {
    cargarUnidades().finally(() => setIsLoading(false));
  }, []);

  const abrirModal = (unidad, tipoSugerido = '') => {
    setUnidadActiva(unidad);
    setFormData({
      tipo_mantenimiento: tipoSugerido || tipos[0] || '',
      fecha_mantenimiento: hoyLocal(),
      kilometraje_actual: '',
      naturaleza: 'Preventivo',
      observaciones: '',
    });
    setArchivo(null);
    setFormError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      kilometraje_actual: (input) => onlyDigits(input, 7),
      observaciones: (input) => limitText(input, 800),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const handleArchivo = (e) => {
    const elegido = e.target.files[0] || null;
    if (elegido && elegido.size > MAX_RESPALDO_MB * 1024 * 1024) {
      setFormError(`El archivo pesa ${(elegido.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_RESPALDO_MB} MB.`);
      e.target.value = '';
      setArchivo(null);
      return;
    }
    setFormError('');
    setArchivo(elegido);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!archivo) { setFormError('Debes adjuntar el respaldo del trabajo (factura, orden de taller o foto).'); return; }

    setIsSubmitting(true);
    setFormError('');

    const data = new FormData();
    Object.entries(formData).forEach(([clave, valor]) => data.append(clave, valor));
    data.append('comprobante', archivo);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/mis-unidades/${unidadActiva.id}/mantenimientos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: data,
      });
      const result = await response.json();

      if (response.ok) {
        setUnidadActiva(null);
        showSuccessToast(result.message);
        cargarUnidades();
      } else {
        const primerError = result.errors ? Object.values(result.errors)[0][0] : null;
        setFormError(primerError || result.message || 'No se pudo enviar el registro.');
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setIsSubmitting(false);
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
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Mis Unidades</h2>
        <p className="text-slate-500 text-sm mt-1">
          Aquí ves cuándo le toca el próximo mantenimiento a cada unidad. Cuando lo hagas, regístralo y adjunta el respaldo;
          quedará pendiente hasta que el administrador lo confirme.
        </p>
      </div>

      {unidades.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 text-center py-16">
          <CarFront className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm">No tienes unidades registradas a tu nombre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {unidades.map((unidad) => {
            const estiloUnidad = estiloDe(unidad.resumen);
            const IconoUnidad = estiloUnidad.icono;

            return (
              <div key={unidad.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Encabezado: identifica CUAL unidad es, que es lo que importa
                    cuando el socio tiene mas de una. */}
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900">
                      <CarFront className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800">Unidad {unidad.numero_vehiculo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 rounded border-2 border-slate-800 bg-yellow-300 text-slate-900 text-[11px] font-extrabold tracking-wider font-mono">
                          {unidad.placa}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{unidad.marca} · {unidad.tipo_vehiculo}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${estiloUnidad.chip}`}>
                    <IconoUnidad className="w-4 h-4 mr-1.5" /> {unidad.resumen}
                  </span>
                </div>

                {/* Revisión técnica: el aviso llega antes de que caduque, no
                    cuando el socio ya está circulando sin ella. */}
                {unidad.revision_tecnica && unidad.revision_tecnica.estado !== 'Sin vigencia' && (() => {
                  const rtv = unidad.revision_tecnica;
                  const estilo = rtv.estado === 'Vencida'
                    ? { caja: 'bg-red-50 border-red-100', texto: 'text-red-700', Icono: AlertTriangle }
                    : rtv.estado === 'Por vencer'
                      ? { caja: 'bg-amber-50 border-amber-100', texto: 'text-amber-700', Icono: Clock }
                      : { caja: 'bg-green-50 border-green-100', texto: 'text-green-700', Icono: CheckCircle2 };

                  return (
                    <div className={`flex items-center gap-2 border-b px-5 py-3 ${estilo.caja}`}>
                      <estilo.Icono className={`h-4 w-4 flex-shrink-0 ${estilo.texto}`} />
                      <p className={`text-xs font-semibold ${estilo.texto}`}>
                        Revisión técnica (RTV):{' '}
                        {rtv.estado === 'Vencida'
                          ? `vencida hace ${Math.abs(rtv.dias_para_vencer)} ${dias(rtv.dias_para_vencer)}`
                          : rtv.estado === 'Por vencer'
                            ? `vence en ${rtv.dias_para_vencer} ${dias(rtv.dias_para_vencer)}`
                            : `vigente hasta ${formatearFecha(rtv.fecha_vencimiento)}`}
                      </p>
                    </div>
                  );
                })()}

                <AvisoDocumento nombre="Matrícula" documento={unidad.matricula} />
                <AvisoDocumento nombre="Habilitación" documento={unidad.habilitacion} />

                <div className="divide-y divide-slate-50">
                  {unidad.mantenimientos.map((item) => {
                    const estilo = estiloDe(item.estado);
                    const pendiente = unidad.pendientes_revision?.some((p) => p.tipo_mantenimiento === item.tipo);

                    return (
                      <div key={item.tipo} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${estilo.punto}`} />
                            <p className="font-semibold text-slate-700 text-sm">{item.tipo}</p>
                            <span className="text-[11px] text-slate-400">cada {item.meses_frecuencia} meses</span>
                          </div>
                          <p className={`text-xs mt-1 ml-4 font-medium ${estilo.texto}`}>{textoPlazo(item)}</p>
                          {item.ultima_fecha && (
                            <p className="text-[11px] text-slate-400 mt-0.5 ml-4">
                              Último: {formatearFecha(item.ultima_fecha)} · Próximo: {formatearFecha(item.proxima_fecha)}
                            </p>
                          )}
                        </div>

                        {pendiente ? (
                          <span className="inline-flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                            <Clock className="w-3.5 h-3.5 mr-1" /> En revisión
                          </span>
                        ) : (
                          <button
                            onClick={() => abrirModal(unidad, item.tipo)}
                            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Registrar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {unidad.rechazados?.length > 0 && (
                  <div className="px-5 py-3 bg-red-50 border-t border-red-100">
                    {unidad.rechazados.map((rechazado) => (
                      <p key={rechazado.id} className="text-xs text-red-700">
                        <span className="font-bold">{rechazado.tipo_mantenimiento} rechazado:</span> {rechazado.motivo_rechazo}
                      </p>
                    ))}
                  </div>
                )}

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={() => abrirModal(unidad)}
                    className="w-full bg-slate-900 text-yellow-400 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-colors text-sm"
                  >
                    <Wrench className="w-4 h-4 mr-2" /> Registrar mantenimiento
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unidadActiva && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-900">Registrar mantenimiento</h3>
                <p className="text-slate-500 mt-1 text-sm">
                  Unidad {unidadActiva.numero_vehiculo} · {unidadActiva.placa}
                </p>
              </div>
              <button onClick={() => setUnidadActiva(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 pt-4 sm:p-6 sm:pt-4 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />{formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Trabajo realizado</label>
                <select name="tipo_mantenimiento" value={formData.tipo_mantenimiento} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                  {tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Fecha</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date" name="fecha_mantenimiento" value={formData.fecha_mantenimiento} onChange={handleInputChange}
                      required max={hoyLocal()}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Kilometraje</label>
                  <input
                    type="text" name="kilometraje_actual" value={formData.kilometraje_actual} onChange={handleInputChange}
                    required inputMode="numeric" maxLength="7" placeholder="Ej. 85000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">¿Por qué se hizo?</label>
                <select
                  name="naturaleza" value={formData.naturaleza} onChange={handleInputChange} required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                >
                  <option value="Preventivo">Mantenimiento planificado</option>
                  <option value="Correctivo">Se dañó algo (falla)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">¿Qué se le hizo a la unidad?</label>
                <textarea
                  name="observaciones" value={formData.observaciones} onChange={handleInputChange}
                  required rows="3" maxLength="800" placeholder="Ej. Cambio de aceite 20W-50 y filtros de aceite y aire."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Respaldo del trabajo (PDF, JPG o PNG, máx. {MAX_RESPALDO_MB} MB)
                </label>
                <input
                  type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleArchivo}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
                />
                <p className="text-xs text-slate-400 mt-1">Factura, orden de taller o una foto del comprobante.</p>
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'
                }`}
              >
                {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-5 h-5 mr-2" /> Enviar registro</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MisUnidadesScreen;
