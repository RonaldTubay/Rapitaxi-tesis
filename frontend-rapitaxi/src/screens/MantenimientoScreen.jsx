import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../App.css';
import {
  getMantenimientos,
  getVehiculos,
  postMantenimiento,
  updateMantenimientoEstado,
  uploadMantenimientoComprobante,
} from '../services/api';

function MantenimientoScreen() {
  const [registros, setRegistros] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingId, setUploadingId] = useState(null);

  const fileInputs = useRef({});

  const [form, setForm] = useState({
    vehiculo_id: '',
    tipo: '',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    mecanico: '',
    kilometraje_actual: '',
    costo: '',
    estado: 'Pendiente',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (params = {}) => {
    try {
      setLoading(true);
      setError('');
      const [mantenimientosRes, vehiculosRes] = await Promise.all([
        getMantenimientos(params),
        getVehiculos(),
      ]);

      setRegistros(Array.isArray(mantenimientosRes) ? mantenimientosRes : []);
      setVehiculos(Array.isArray(vehiculosRes) ? vehiculosRes : []);
      if (!form.vehiculo_id && Array.isArray(vehiculosRes) && vehiculosRes.length > 0) {
        setForm((prev) => ({ ...prev, vehiculo_id: String(vehiculosRes[0].id) }));
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistros = useMemo(() => {
    const term = search.trim().toLowerCase();
    return registros.filter((reg) => {
      const estadoOk = !estadoFilter || reg.estado === estadoFilter;
      if (!estadoOk) return false;

      if (!term) return true;
      const identity = String(reg.identificador_vehiculo || reg.vehiculo?.placa || '').toLowerCase();
      return (
        identity.includes(term)
        || String(reg.tipo || '').toLowerCase().includes(term)
        || String(reg.mecanico || '').toLowerCase().includes(term)
        || String(reg.descripcion || '').toLowerCase().includes(term)
      );
    });
  }, [registros, search, estadoFilter]);

  const totalCompletados = registros.filter((r) => r.estado === 'Completado').length;
  const totalProceso = registros.filter((r) => r.estado === 'En Proceso').length;
  const totalPendiente = registros.filter((r) => r.estado === 'Pendiente').length;
  const totalCosto = registros.reduce((acc, r) => acc + Number(r.costo || 0), 0);
  const displayEstado = (estado) => (estado === 'Pendiente' ? 'Programado' : estado);

  const updateEstado = async (id, estado) => {
    try {
      setError('');
      const response = await updateMantenimientoEstado(id, estado);
      const updated = response?.data || response;
      setRegistros((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setSuccess('Estado actualizado correctamente.');
      setTimeout(() => setSuccess(''), 1800);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      setSuccess('');
      const payload = {
        vehiculo_id: Number(form.vehiculo_id),
        tipo: form.tipo,
        descripcion: form.descripcion,
        fecha: form.fecha,
        mecanico: form.mecanico,
        kilometraje_actual: Number(form.kilometraje_actual),
        costo: Number(form.costo),
        estado: form.estado,
      };

      await postMantenimiento(payload);
      setShowForm(false);
      setForm((prev) => ({
        ...prev,
        tipo: '',
        descripcion: '',
        mecanico: '',
        kilometraje_actual: '',
        costo: '',
        estado: 'Pendiente',
      }));
      await loadData({ estado: estadoFilter, search });
      setSuccess('Mantenimiento programado correctamente.');
      setTimeout(() => setSuccess(''), 1800);
    } catch (err) {
      setError(err.message || 'No se pudo registrar el mantenimiento');
    }
  };

  const handleComprobante = async (record, file) => {
    if (!file) return;
    try {
      setUploadingId(record.id);
      setError('');
      const response = await uploadMantenimientoComprobante(record.id, file);
      const updated = response?.data || response;
      setRegistros((prev) => prev.map((item) => (item.id === record.id ? updated : item)));
      setSuccess('Comprobante subido correctamente.');
      setTimeout(() => setSuccess(''), 1800);
    } catch (err) {
      setError(err.message || 'No se pudo subir el comprobante');
    } finally {
      setUploadingId(null);
    }
  };

  const statusClass = (estado) => String(estado || '').toLowerCase().replace(/\s+/g, '-');
  const formatMoney = (amount) => new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

  return (
    <>
      <header className="header">
        <div className="header-title">
          <h2>Control de Mantenimiento</h2>
          <p>Gestión del historial de mantenimiento vehicular</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span>+</span> Programar Mantenimiento
        </button>
      </header>

      {error && <p className="error" style={{ marginBottom: '14px' }}>{error}</p>}
      {success && <p style={{ marginBottom: '14px', color: '#166534', fontWeight: '600' }}>{success}</p>}

      <div className="kpi-row-4">
        <div className="kpi-card">
          <div className="kpi-info"><p>Completados</p><h3>{totalCompletados}</h3></div>
          <div className="kpi-icon green">☑️</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-info"><p>En Proceso</p><h3>{totalProceso}</h3></div>
          <div className="kpi-icon blue">🔧</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-info"><p>Programados</p><h3>{totalPendiente}</h3></div>
          <div className="kpi-icon orange">📅</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-info"><p>Costo Total</p><h3>{formatMoney(totalCosto)}</h3></div>
          <div className="kpi-icon yellow">💲</div>
        </div>
      </div>

      <div className="search-filter-wrapper">
        <div className="search-container">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Buscar por vehículo, tipo o mecánico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-btn"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En Proceso">En Proceso</option>
          <option value="Completado">Completado</option>
        </select>
      </div>

      <div>
        {loading && <p style={{ color: '#64748b', marginBottom: '12px' }}>Cargando mantenimientos...</p>}
        {!loading && filteredRegistros.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: 'white', color: '#64748b' }}>
            No hay mantenimientos para los filtros seleccionados.
          </div>
        )}

        {filteredRegistros.map((reg) => (
          <div className="m-card" key={reg.id}>
            <div className="m-card-header">
              <div className="m-card-title-group">
                <div className="m-icon">🔧</div>
                <div className="m-title">
                  <h4>{reg.identificador_vehiculo || reg.vehiculo?.placa || `VEH-${reg.vehiculo_id}`} - {reg.tipo}</h4>
                  <p>{reg.descripcion}</p>
                </div>
              </div>
              
              <div className="m-card-actions">
                <span className={`status-badge ${statusClass(reg.estado)}`}>
                  {displayEstado(reg.estado)}
                </span>
                {reg.estado === 'En Proceso' && (
                  <button className="btn-success" onClick={() => updateEstado(reg.id, 'Completado')}>Completar</button>
                )}
                {reg.estado === 'Pendiente' && (
                  <button className="btn-outline" style={{ flex: 'none', padding: '8px 12px' }} onClick={() => updateEstado(reg.id, 'En Proceso')}>
                    Iniciar
                  </button>
                )}
              </div>
            </div>

            <div className="m-card-details">
              <div className="m-detail-col">
                <p>Fecha</p>
                <p>{reg.fecha}</p>
              </div>
              <div className="m-detail-col">
                <p>Mecánico</p>
                <p>{reg.mecanico}</p>
              </div>
              <div className="m-detail-col">
                <p>Kilometraje</p>
                <p>{new Intl.NumberFormat('es-EC').format(Number(reg.kilometraje_actual || 0))} km</p>
              </div>
              <div className="m-detail-col">
                <p>Costo</p>
                <p>{formatMoney(reg.costo)}</p>
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '64px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                {reg.comprobante_url ? `Comprobante: ${reg.comprobante_nombre || 'Subido'}` : 'Sin comprobante cargado'}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {reg.comprobante_url && (
                  <a href={reg.comprobante_url} target="_blank" rel="noreferrer" className="btn-outline" style={{ flex: 'none', padding: '8px 12px' }}>
                    Ver Comprobante
                  </a>
                )}
                <input
                  ref={(node) => { fileInputs.current[reg.id] = node; }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleComprobante(reg, e.target.files?.[0])}
                />
                <button
                  className="btn-outline"
                  style={{ flex: 'none', padding: '8px 12px' }}
                  onClick={() => fileInputs.current[reg.id]?.click()}
                  disabled={uploadingId === reg.id}
                >
                  {uploadingId === reg.id ? 'Subiendo...' : 'Subir Comprobante'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <form className="form-card" onSubmit={submit}>
              <h3>Programar mantenimiento</h3>

              <label>Vehículo</label>
              <select
                value={form.vehiculo_id}
                onChange={(e) => setForm((prev) => ({ ...prev, vehiculo_id: e.target.value }))}
                required
              >
                <option value="">Selecciona vehículo</option>
                {vehiculos.map((vehiculo) => (
                  <option key={vehiculo.id} value={vehiculo.id}>
                    {vehiculo.numero_vehicular || vehiculo.placa || `VEH-${vehiculo.id}`} - {vehiculo.marca}
                  </option>
                ))}
              </select>

              <label>Tipo de mantenimiento</label>
              <input
                value={form.tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
                required
              />

              <label>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              />

              <label>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                required
              />

              <label>Mecánico</label>
              <input
                value={form.mecanico}
                onChange={(e) => setForm((prev) => ({ ...prev, mecanico: e.target.value }))}
                required
              />

              <label>Kilometraje actual</label>
              <input
                type="number"
                min="0"
                value={form.kilometraje_actual}
                onChange={(e) => setForm((prev) => ({ ...prev, kilometraje_actual: e.target.value }))}
                required
              />

              <label>Costo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costo}
                onChange={(e) => setForm((prev) => ({ ...prev, costo: e.target.value }))}
                required
              />

              <label>Estado</label>
              <select
                value={form.estado}
                onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completado">Completado</option>
              </select>

              <div className="form-actions">
                <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MantenimientoScreen;