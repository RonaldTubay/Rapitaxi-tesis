import { useState, useEffect } from 'react';
import { Loader2, Upload, X, AlertCircle, Receipt, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { API_URL } from '../../apiConfig';
import { apiClient } from '../../lib/apiClient';
import { showErrorToast, showSuccessToast } from '../../utils/feedback';
import { normalizeDecimal, onlyDigits } from '../../utils/inputFormatters';

const MAX_COMPROBANTE_MB = 5;

const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ESTADO_ESTILO = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Aprobado: 'bg-green-100 text-green-700',
  Rechazado: 'bg-red-100 text-red-700',
};

const ESTADO_ICONO = {
  Pendiente: Clock,
  Aprobado: CheckCircle2,
  Rechazado: XCircle,
};

const MisAportacionesScreen = () => {
  const [aportaciones, setAportaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();
  const [formData, setFormData] = useState({ mes_pagado: mesActual, anio_pagado: anioActual, monto: '20.00' });
  const [archivo, setArchivo] = useState(null);

  const fetchAportaciones = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/mis-aportaciones');
      setAportaciones(data);
    } catch {
      showErrorToast('No se pudo cargar tu historial de aportaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAportaciones(); }, []);

  const openModal = () => {
    setFormData({ mes_pagado: mesActual, anio_pagado: anioActual, monto: '20.00' });
    setArchivo(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = { anio_pagado: (v) => onlyDigits(v, 4), monto: (v) => normalizeDecimal(v, 5) };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!archivo) { setFormError('Debes adjuntar el comprobante (foto o PDF).'); return; }

    setIsSubmitting(true);
    setFormError('');

    const data = new FormData();
    data.append('mes_pagado', formData.mes_pagado);
    data.append('anio_pagado', formData.anio_pagado);
    data.append('monto', formData.monto);
    data.append('comprobante', archivo);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/mis-aportaciones`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const result = await response.json();

      if (response.ok) {
        setAportaciones([result.aportacion, ...aportaciones]);
        setIsModalOpen(false);
        showSuccessToast(result.message);
      } else {
        setFormError(result.message || 'No se pudo enviar el comprobante.');
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const estaAlDia = aportaciones.some((a) => a.mes_pagado === mesActual && a.anio_pagado === anioActual && a.estado === 'Aprobado');
  const pendientesCount = aportaciones.filter((a) => a.estado === 'Pendiente').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mis Aportaciones</h2>
          <p className="text-slate-500 text-sm mt-1">Sube tu comprobante cada mes. Quedará "Pendiente" hasta que el administrador lo confirme.</p>
        </div>
        <button onClick={openModal} className="bg-slate-900 text-yellow-400 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md whitespace-nowrap">
          <Upload className="w-5 h-5 mr-2" /> Subir Comprobante
        </button>
      </div>

      {/* Resumen rapido: lo primero que quiere saber el socio es si esta al dia.
          3 columnas en desktop para no dejar tarjetas sueltas con espacio vacio,
          1 sola en movil. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm border ${
          estaAlDia ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
        }`}>
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${estaAlDia ? 'bg-green-500' : 'bg-red-500'}`}>
            {estaAlDia ? <CheckCircle2 className="w-6 h-6 text-white" /> : <XCircle className="w-6 h-6 text-white" />}
          </div>
          <div>
            <p className={`font-extrabold ${estaAlDia ? 'text-green-700' : 'text-red-700'}`}>
              {estaAlDia ? 'Al día' : 'En mora'}
            </p>
            <p className="text-xs text-slate-500">{NOMBRES_MESES[mesActual - 1]} {anioActual}</p>
          </div>
        </div>
        <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-amber-100 bg-amber-50">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-extrabold text-amber-700">{pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-500">Esperando revisión del administrador</p>
          </div>
        </div>
        <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-slate-100 bg-white sm:col-span-2 lg:col-span-1">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900">
            <Receipt className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="font-extrabold text-slate-800">{aportaciones.length} en total</p>
            <p className="text-xs text-slate-500">Comprobantes subidos históricamente</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-semibold">
                <th className="p-4">Periodo</th>
                <th className="p-4">Monto</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {isLoading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400"><Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" />Cargando...</td></tr>
              ) : aportaciones.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400"><Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />Aún no has subido ningún comprobante.</td></tr>
              ) : aportaciones.map((a) => {
                const IconoEstado = ESTADO_ICONO[a.estado];
                return (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className="flex items-center font-semibold text-slate-700">
                      <Calendar className="w-4 h-4 mr-1.5 text-slate-400" /> {NOMBRES_MESES[a.mes_pagado - 1]} {a.anio_pagado}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-800">${parseFloat(a.monto).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${ESTADO_ESTILO[a.estado] || 'bg-slate-100 text-slate-600'}`}>
                      {IconoEstado && <IconoEstado className="w-3.5 h-3.5 mr-1" />} {a.estado}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-500 max-w-xs">
                    {a.estado === 'Rechazado' && a.motivo_rechazo ? (
                      <span className="text-red-600">{a.motivo_rechazo}</span>
                    ) : a.estado === 'Pendiente' ? (
                      'Esperando revisión del administrador.'
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Subir Comprobante</h3>
                <p className="text-slate-500 mt-1 text-sm">Adjunta la foto o PDF del depósito/transferencia.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 pt-4 sm:p-6 sm:pt-4 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Mes que pagas</label>
                  <select name="mes_pagado" value={formData.mes_pagado} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700">
                    {NOMBRES_MESES.map((mes, i) => <option key={i + 1} value={i + 1}>{mes}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Año</label>
                  <input type="text" name="anio_pagado" value={formData.anio_pagado} onChange={handleInputChange} required inputMode="numeric" maxLength="4" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Monto ($)</label>
                <input type="text" inputMode="decimal" name="monto" value={formData.monto} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 font-bold text-green-700" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Comprobante (PDF, JPG o PNG, máx. {MAX_COMPROBANTE_MB} MB)</label>
                <input
                  type="file" accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const elegido = e.target.files[0] || null;
                    if (elegido && elegido.size > MAX_COMPROBANTE_MB * 1024 * 1024) {
                      setFormError(`El archivo pesa ${(elegido.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_COMPROBANTE_MB} MB.`);
                      e.target.value = '';
                      setArchivo(null);
                      return;
                    }
                    setFormError('');
                    setArchivo(elegido);
                  }}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
                />
                {/* Sin el atributo "capture": el celular ofrece elegir entre
                    tomar una foto nueva o escoger una de la galeria/archivos,
                    en vez de forzar solo la camara. */}
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'
                }`}
              >
                {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-5 h-5 mr-2" /> Enviar Comprobante</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MisAportacionesScreen;
