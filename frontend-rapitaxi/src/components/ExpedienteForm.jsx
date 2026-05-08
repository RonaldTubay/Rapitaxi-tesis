import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle, AlertCircle, Eye, Download, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';

export default function ExpedienteForm() {
  const [socios, setSocios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [modo, setModo] = useState('individual');
  const [socioId, setSocioId] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [elaborador, setElaborador] = useState('1');
  const [observacion, setObservacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [expedientes, setExpedientes] = useState([]);
  const [meta, setMeta] = useState({ total: 0, abiertos: 0, cerrados: 0 });
  const [selectedExpediente, setSelectedExpediente] = useState(null);
  const [acta, setActa] = useState(null);
  const [loadingActa, setLoadingActa] = useState(false);
  const [uploadData, setUploadData] = useState({
    codigo: '',
    socio_id: '',
    vehiculo_id: '',
    fecha_emision: new Date().toISOString().slice(0, 10),
    observacion_general: '',
    archivos: [],
  });

  const [filtroSocio, setFiltroSocio] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroMonth, setFiltroMonth] = useState(String(new Date().getMonth() + 1));
  const [filtroYear, setFiltroYear] = useState(String(new Date().getFullYear()));
  const [filtroFrom, setFiltroFrom] = useState('');
  const [filtroTo, setFiltroTo] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchExpedientes();
  }, [filtroSocio, filtroPeriodo, filtroMonth, filtroYear, filtroFrom, filtroTo]);

  const fetchInitialData = async () => {
    try {
      const [sociosRes, vehiculosRes] = await Promise.all([
        api.getSocios(),
        api.getVehiculos(),
      ]);
      setSocios(Array.isArray(sociosRes) ? sociosRes : sociosRes.data || []);
      setVehiculos(Array.isArray(vehiculosRes) ? vehiculosRes : vehiculosRes.data || []);
      
      if (Array.isArray(sociosRes) && sociosRes.length > 0) setSocioId(sociosRes[0].id);
      if (Array.isArray(vehiculosRes) && vehiculosRes.length > 0) setVehiculoId(vehiculosRes[0].id);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('No se pudieron cargar socios y vehículos.');
    }
  };

  const fetchExpedientes = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtroSocio) params.socio_id = filtroSocio;
      if (filtroPeriodo) {
        params.periodo = filtroPeriodo;
        if (filtroPeriodo === 'mes') {
          params.month = filtroMonth;
          params.year = filtroYear;
        }
        if (filtroPeriodo === 'anio') {
          params.year = filtroYear;
        }
        if (filtroPeriodo === 'rango') {
          params.from = filtroFrom;
          params.to = filtroTo;
        }
      }

      const response = await api.getExpedientes(params);
      setExpedientes(Array.isArray(response?.data) ? response.data : []);
      setMeta(response?.meta || { total: 0, abiertos: 0, cerrados: 0 });
    } catch (err) {
      setError(err.message || 'No se pudieron consultar los expedientes.');
    } finally {
      setLoading(false);
    }
  };

  const vehiculosDelSocio = vehiculos.filter((vehiculo) => {
    if (!socioId) return true;
    return Number(vehiculo.socio_id) === Number(socioId);
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (modo === 'individual' && (!socioId || !vehiculoId)) {
      setError('Completa todos los campos requeridos');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        modo,
        socio_id: modo === 'individual' ? Number(socioId) : null,
        vehiculo_id: modo === 'individual' ? Number(vehiculoId) : null,
        elaborado_por: Number(elaborador),
        observacion_general: observacion,
      };
      const response = await api.postExpediente(payload);
      const createdExpediente = response?.data || response;
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setObservacion('');
        setShowForm(false);
      }, 2000);
      await fetchExpedientes();
      if (createdExpediente?.id) {
        await loadActa(createdExpediente.id, createdExpediente);
      }
    } catch (err) {
      setError(err.message || 'Error al crear el expediente');
    } finally {
      setLoading(false);
    }
  };

  const submitHistorico = async (e) => {
    e.preventDefault();
    setError('');
    if (!uploadData.archivos || uploadData.archivos.length === 0) {
      setError('Debes seleccionar al menos un archivo para el expediente histórico.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('modo', 'historico');
      if (uploadData.codigo.trim()) formData.append('codigo', uploadData.codigo.trim());
      if (uploadData.socio_id) formData.append('socio_id', String(Number(uploadData.socio_id)));
      if (uploadData.vehiculo_id) formData.append('vehiculo_id', String(Number(uploadData.vehiculo_id)));
      formData.append('fecha_emision', uploadData.fecha_emision);
      if (uploadData.observacion_general.trim()) formData.append('observacion_general', uploadData.observacion_general.trim());
      // attach multiple files as archivos[]
      uploadData.archivos.forEach((file) => formData.append('archivos[]', file));

      await api.uploadExpedienteHistorico(formData);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowUploadForm(false);
      }, 1800);
      setUploadData({
        codigo: '',
        socio_id: '',
        vehiculo_id: '',
        fecha_emision: new Date().toISOString().slice(0, 10),
        observacion_general: '',
        archivos: [],
      });
      await fetchExpedientes();
    } catch (err) {
      setError(err.message || 'No se pudo cargar el expediente histórico.');
    } finally {
      setLoading(false);
    }
  };

  const loadActa = async (expedienteId, expedienteBase = null, downloadAfterLoad = false) => {
    try {
      setLoadingActa(true);
      const response = await api.getActa(expedienteId);
      const data = response?.data || response;
      setSelectedExpediente(expedienteBase || expActualFromList(expedienteId));
      setActa(data);
      if (downloadAfterLoad) {
        downloadActaPdf(data);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el expediente');
    } finally {
      setLoadingActa(false);
    }
  };

  const expActualFromList = (expedienteId) => expedientes.find((item) => Number(item.id) === Number(expedienteId)) || null;

  const formatHistoryText = (item, fields) => fields
    .map((field) => item?.[field])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' · ');

  const downloadActaPdf = (actaData) => {
    if (!actaData) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);
    let cursorY = 18;

    const ensureSpace = (needed = 12) => {
      if (cursorY + needed > pageHeight - margin) {
        doc.addPage();
        cursorY = 18;
      }
    };

    const addTitle = (text) => {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(text, margin, cursorY);
      cursorY += 8;
      doc.setDrawColor(250, 204, 21);
      doc.setLineWidth(0.6);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 6;
    };

    const addSection = (title) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, cursorY);
      cursorY += 6;
    };

    const addLine = (label, value) => {
      const safeValue = value === null || value === undefined || value === '' ? 'N/A' : String(value);
      const text = `${label}: ${safeValue}`;
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * 5 + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 5 + 2;
    };

    const addBulletList = (items, formatter) => {
      if (!Array.isArray(items) || items.length === 0) {
        addLine('Sin registros', 'No disponible');
        return;
      }

      items.forEach((item, index) => {
        const line = formatter(item, index);
        const lines = doc.splitTextToSize(`• ${line}`, contentWidth);
        ensureSpace(lines.length * 5 + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(lines, margin, cursorY);
        cursorY += lines.length * 5 + 2;
      });
    };

    addTitle('RAPITAXI - ACTA DE EXPEDIENTE');
    addLine('Empresa', actaData.empresa);
    addLine('Código de expediente', actaData.expediente_codigo);
    addLine('Fecha de emisión', actaData.fecha_emision);
    addLine('Estado del expediente', actaData.estado_expediente);

    addSection('Datos del socio');
    addLine('Nombre', actaData.miembro?.nombre);
    addLine('Cédula', actaData.miembro?.cedula);
    addLine('Teléfono', actaData.miembro?.telefono);
    addLine('Correo', actaData.miembro?.correo);
    addLine('Estado', actaData.miembro?.estado);

    addSection('Datos del vehículo');
    addLine('Número vehicular', actaData.vehiculo?.numero_vehicular);
    addLine('Placa', actaData.vehiculo?.placa);
    addLine('Marca', actaData.vehiculo?.marca);
    addLine('Color', actaData.vehiculo?.color);
    addLine('Año modelo', actaData.vehiculo?.anio_modelo);
    addLine('Accionista', actaData.vehiculo?.nombre_accionista);
    addLine('Última revisión', actaData.vehiculo?.fecha_ultima_revision);
    addLine('Observación', actaData.vehiculo?.observacion);
    addLine('Estado', actaData.vehiculo?.estado);

    addSection('Revisión vehicular actual');
    addLine('Fecha de revisión', actaData.revision_vehicular_actual?.fecha_revision);
    addLine('Resultado', actaData.revision_vehicular_actual?.resultado);
    addLine('Observación', actaData.revision_vehicular_actual?.observacion);
    addLine('Registrado por', actaData.revision_vehicular_actual?.registrado_por);

    addSection('Observación general');
    addLine('Detalle', actaData.observacion_general || 'Sin observaciones generales.');
    addLine('Elaborado por', actaData.elaborado_por);

    addSection('Historial de revisiones');
    addBulletList(actaData.historial_revisiones, (revision, index) => `${index + 1}. ${revision.fecha_revision || 'Sin fecha'} | ${revision.resultado || 'Sin resultado'} | ${revision.registrado_por || 'Sin responsable'}`);

    addSection('Historial de mantenimientos');
    addBulletList(actaData.historial_mantenimientos, (mantenimiento, index) => `${index + 1}. ${mantenimiento.fecha || 'Sin fecha'} | ${mantenimiento.tipo || 'Sin tipo'} | ${mantenimiento.estado || 'Sin estado'}`);

    const fileName = `${actaData.expediente_codigo || 'expediente'}.pdf`;
    doc.save(fileName);
  };

  const generateAndSaveActa = async () => {
    if (!selectedExpediente) return;
    try {
      setLoading(true);
      const res = await api.generateAndSaveActa(selectedExpediente.id);
      // refrescar lista y abrir el archivo generado si se devuelve URL
      await fetchExpedientes();
      const url = res?.data?.url || api.getExpedienteArchivoUrl(selectedExpediente.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'No se pudo generar y guardar el acta.');
    } finally {
      setLoading(false);
    }
  };

  const openArchivoHistorico = (expedienteId) => {
    const url = api.getExpedienteArchivoUrl(expedienteId);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="main-content">
      <div className="header mb-8">
        <div className="header-title">
          <h2>Expedientes Vehiculares</h2>
          <p>Consulta y crea expedientes por socio o generales para toda la flota</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowUploadForm(!showUploadForm)} className="btn-outline">
            <Upload size={18} /> {showUploadForm ? 'Cerrar Carga' : 'Cargar Expediente Histórico'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={20} /> {showForm ? 'Cerrar' : 'Nuevo Expediente'}
          </button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: '18px' }}>
        <div className="kpi-card"><div className="kpi-info"><p>Total Expedientes</p><h3>{meta.total}</h3></div><div className="kpi-icon yellow">📁</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>Abiertos</p><h3>{meta.abiertos}</h3></div><div className="kpi-icon green">🟢</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>Cerrados</p><h3>{meta.cerrados}</h3></div><div className="kpi-icon blue">🔵</div></div>
      </div>

      <div className="search-filter-wrapper" style={{ marginBottom: '20px' }}>
        <select className="filter-btn" value={filtroSocio} onChange={(e) => setFiltroSocio(e.target.value)}>
          <option value="">Todos los socios</option>
          {socios.map((socio) => (
            <option key={socio.id} value={socio.id}>{socio.nombre}</option>
          ))}
        </select>

        <select className="filter-btn" value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
          <option value="">Todo el historial</option>
          <option value="ultimo_mes">Último mes</option>
          <option value="mes">Mes específico</option>
          <option value="anio">Año específico</option>
          <option value="rango">Rango de fechas</option>
        </select>

        {filtroPeriodo === 'mes' && (
          <>
            <select className="filter-btn" value={filtroMonth} onChange={(e) => setFiltroMonth(e.target.value)}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => <option key={m} value={String(m)}>{m}</option>)}
            </select>
            <input className="filter-btn" type="number" min="2020" max="2100" value={filtroYear} onChange={(e) => setFiltroYear(e.target.value)} />
          </>
        )}

        {filtroPeriodo === 'anio' && (
          <input className="filter-btn" type="number" min="2020" max="2100" value={filtroYear} onChange={(e) => setFiltroYear(e.target.value)} />
        )}

        {filtroPeriodo === 'rango' && (
          <>
            <input className="filter-btn" type="date" value={filtroFrom} onChange={(e) => setFiltroFrom(e.target.value)} />
            <input className="filter-btn" type="date" value={filtroTo} onChange={(e) => setFiltroTo(e.target.value)} />
          </>
        )}
      </div>

      {showForm && (
        <div className="modal" style={{ position: 'fixed', background: 'rgba(15, 23, 42, 0.5)' }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
            <h3 className="text-2xl font-bold text-[#0f172a] mb-6">Crear Nuevo Expediente</h3>

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                <CheckCircle size={18} />
                <span>Expediente creado exitosamente</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de expediente *</label>
                <select
                  value={modo}
                  onChange={(e) => setModo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white"
                >
                  <option value="individual">Individual por socio</option>
                  <option value="general">General de todos los socios</option>
                </select>
              </div>

              {modo === 'individual' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Socio *</label>
                    <select
                      value={socioId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSocioId(value);
                        const firstVehiculo = vehiculos.find((vehiculo) => Number(vehiculo.socio_id) === Number(value));
                        setVehiculoId(firstVehiculo ? String(firstVehiculo.id) : '');
                      }}
                      required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white"
                    >
                      <option value="">Selecciona un socio</option>
                      {socios.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} - {s.cedula}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Vehículo *</label>
                    <select
                      value={vehiculoId}
                      onChange={(e) => setVehiculoId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white"
                    >
                      <option value="">Selecciona un vehículo</option>
                      {vehiculosDelSocio.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.numero_vehicular || v.placa || `TAX-${v.id}`} - {v.marca}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Observaciones Generales</label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Información inicial del expediente y novedades del periodo..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] resize-none"
                  rows="4"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#0f172a] text-[#facc15] rounded-lg font-semibold hover:bg-slate-800 transition disabled:opacity-70"
                >
                  {loading ? 'Creando...' : 'Crear Expediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadForm && (
        <div className="modal" style={{ position: 'fixed', background: 'rgba(15, 23, 42, 0.5)' }}>
          <div className="modal-content" style={{ maxWidth: '620px', width: '100%' }}>
            <h3 className="text-2xl font-bold text-[#0f172a] mb-6">Cargar Expediente Histórico</h3>

            <form onSubmit={submitHistorico} className="space-y-5">
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Código (opcional)</label>
                  <input
                    value={uploadData.codigo}
                    onChange={(e) => setUploadData((prev) => ({ ...prev, codigo: e.target.value }))}
                    placeholder="EXP-HIS-001"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha de emisión</label>
                  <input
                    type="date"
                    value={uploadData.fecha_emision}
                    onChange={(e) => setUploadData((prev) => ({ ...prev, fecha_emision: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15]"
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Socio (opcional)</label>
                  <select
                    value={uploadData.socio_id}
                    onChange={(e) => setUploadData((prev) => ({ ...prev, socio_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white"
                  >
                    <option value="">Sin socio específico</option>
                    {socios.map((socio) => (
                      <option key={socio.id} value={socio.id}>{socio.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Vehículo (opcional)</label>
                  <select
                    value={uploadData.vehiculo_id}
                    onChange={(e) => setUploadData((prev) => ({ ...prev, vehiculo_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white"
                  >
                    <option value="">Sin vehículo específico</option>
                    {vehiculos.map((vehiculo) => (
                      <option key={vehiculo.id} value={vehiculo.id}>
                        {vehiculo.numero_vehicular || vehiculo.placa || `TAX-${vehiculo.id}`} - {vehiculo.marca}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Observaciones</label>
                <textarea
                  value={uploadData.observacion_general}
                  onChange={(e) => setUploadData((prev) => ({ ...prev, observacion_general: e.target.value }))}
                  placeholder="Resumen del documento histórico que se está digitalizando..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] resize-none"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Archivo del expediente *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  multiple
                  onChange={(e) => setUploadData((prev) => ({ ...prev, archivos: Array.from(e.target.files || []) }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-6 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#0f172a] text-[#facc15] rounded-lg font-semibold hover:bg-slate-800 transition disabled:opacity-70"
                >
                  {loading ? 'Cargando...' : 'Guardar Expediente Histórico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: '14px' }}>{error}</p>}
      {loading && <p style={{ marginBottom: '12px', color: '#64748b' }}>Cargando expedientes...</p>}

      <div className="grid grid-cols-1 gap-6">
        {!loading && expedientes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'white', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b' }}>
            No hay expedientes para los filtros seleccionados.
          </div>
        )}

        {expedientes.map((exp) => (
          <div key={exp.id} className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#fef08a] rounded-lg">
                  <FileText size={24} color="#a16207" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0f172a]">{exp.codigo}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {(exp.vehiculo?.numero_vehicular || exp.vehiculo?.placa || 'General')} - {(exp.socio?.nombre || 'Todos los socios')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {exp.vehiculo?.marca || 'Expediente general'}
                  </p>
                  {exp.tipo_registro === 'cargado' && (
                    <p className="text-xs mt-2" style={{ color: '#0369a1', fontWeight: 600 }}>
                      Documento histórico digitalizado
                    </p>
                  )}
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                exp.estado === 'Abierto' 
                  ? 'bg-[#dcfce7] text-[#166534]' 
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {exp.estado}
              </span>
            </div>
            <div className="text-xs text-slate-500 text-right">
              Emisión: {exp.fecha_emision}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {exp.tipo_registro === 'cargado' && exp.archivo_path && (
                <>
                  <button
                    type="button"
                    onClick={() => openArchivoHistorico(exp.id)}
                    className="px-4 py-2 rounded-lg font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                  >
                    <Eye size={16} /> Ver archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => openArchivoHistorico(exp.id)}
                    className="px-4 py-2 rounded-lg font-semibold bg-[#facc15] text-[#0f172a] hover:bg-[#eab308] transition flex items-center gap-2"
                  >
                    <Download size={16} /> Descargar archivo
                  </button>
                </>
              )}

              {exp.tipo_registro !== 'cargado' && (
                <>
              <button
                type="button"
                onClick={() => loadActa(exp.id, exp)}
                className="px-4 py-2 rounded-lg font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
              >
                <Eye size={16} /> Ver expediente
              </button>
              <button
                type="button"
                onClick={() => loadActa(exp.id, exp, true)}
                className="px-4 py-2 rounded-lg font-semibold bg-[#facc15] text-[#0f172a] hover:bg-[#eab308] transition flex items-center gap-2"
              >
                <Download size={16} /> Descargar PDF
              </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedExpediente && acta && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '960px' }}>
            <div className="header" style={{ marginBottom: '20px' }}>
              <div className="header-title">
                <h2>Expediente {acta.expediente_codigo}</h2>
                <p>
                  {selectedExpediente.socio?.nombre || selectedExpediente.miembro?.nombre || 'Expediente general'}
                </p>
              </div>
              <button className="btn-outline" onClick={() => { setSelectedExpediente(null); setActa(null); }}>
                Cerrar
              </button>
            </div>

            {loadingActa && <p style={{ color: '#64748b', marginBottom: '12px' }}>Cargando expediente...</p>}

            <div className="book-preview-panel" style={{ gridTemplateColumns: '320px 1fr' }}>
              <div className="book-preview-meta">
                <div>
                  <span>Estado</span>
                  <strong>{acta.estado_expediente || selectedExpediente.estado || 'Abierto'}</strong>
                </div>
                <div>
                  <span>Fecha de emisión</span>
                  <strong>{acta.fecha_emision || selectedExpediente.fecha_emision || 'Sin fecha'}</strong>
                </div>
                <div>
                  <span>Socio</span>
                  <strong>{acta.miembro?.nombre || 'Todos los socios'}</strong>
                </div>
                <div>
                  <span>Vehículo</span>
                  <strong>{acta.vehiculo?.numero_vehicular || acta.vehiculo?.placa || 'General'}</strong>
                </div>
              </div>

              <div className="book-preview-empty" style={{ overflow: 'auto' }}>
                <div className="book-preview-meta" style={{ marginBottom: '18px' }}>
                  <div>
                    <span>Observación general</span>
                    <strong>{acta.observacion_general || 'Sin observaciones.'}</strong>
                  </div>
                  <div>
                    <span>Elaborado por</span>
                    <strong>{acta.elaborado_por || 'No disponible'}</strong>
                  </div>
                  <div>
                    <span>Tipo de expediente</span>
                    <strong>{selectedExpediente?.socio?.nombre ? 'Individual' : 'General'}</strong>
                  </div>
                  <div>
                    <span>Registros totales</span>
                    <strong>{(acta.historial_revisiones || []).length + (acta.historial_mantenimientos || []).length}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#0f172a' }}>Historial de revisiones</h4>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(acta.historial_revisiones || []).length > 0 ? (
                      acta.historial_revisiones.map((revision) => (
                        <div key={revision.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', background: '#f8fafc' }}>
                          <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>
                            {revision.fecha_revision || 'Sin fecha'}
                          </strong>
                          <p style={{ margin: 0, color: '#334155', fontSize: '14px' }}>
                            {formatHistoryText(revision, ['resultado', 'observacion', 'registrado_por']) || 'Sin detalles disponibles.'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div style={{ border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px', color: '#64748b' }}>
                        No hay revisiones registradas.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#0f172a' }}>Historial de mantenimientos</h4>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(acta.historial_mantenimientos || []).length > 0 ? (
                      acta.historial_mantenimientos.map((mantenimiento) => (
                        <div key={mantenimiento.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', background: '#fff7ed' }}>
                          <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>
                            {mantenimiento.fecha || 'Sin fecha'}
                          </strong>
                          <p style={{ margin: 0, color: '#334155', fontSize: '14px' }}>
                            {formatHistoryText(mantenimiento, ['tipo', 'descripcion', 'mecanico', 'kilometraje_actual', 'estado']) || 'Sin detalles disponibles.'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div style={{ border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px', color: '#64748b' }}>
                        No hay mantenimientos registrados.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-outline" onClick={() => downloadActaPdf(acta)}>Descargar PDF</button>
              <button type="button" className="btn-secondary" onClick={generateAndSaveActa}>Generar y guardar acta</button>
              <button type="button" className="btn-primary" onClick={() => { setSelectedExpediente(null); setActa(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
