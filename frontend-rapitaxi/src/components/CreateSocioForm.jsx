import React, { useEffect, useState } from 'react';
import { postSocio, updateSocio, updateVehiculo } from '../services/api';

const emptyForm = {
  nombre: '',
  cedula: '',
  telefono: '',
  correo: '',
  fecha_ingreso: '',
  estado: 'Activo',
  vehiculo_id: '',
};

function CreateSocioForm({ initialData = null, vehiculos = [], onSaved, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [initialVehiculoId, setInitialVehiculoId] = useState('');

  useEffect(() => {
    const vehiculoAsignado = initialData
      ? vehiculos.find((vehiculo) => Number(vehiculo.socio_id) === Number(initialData.id))
      : null;

    if (initialData) {
      setForm({
        nombre: initialData.nombre || '',
        cedula: initialData.cedula || '',
        telefono: initialData.telefono || '',
        correo: initialData.correo || '',
        fecha_ingreso: initialData.fecha_ingreso || '',
        estado: initialData.estado || 'Activo',
        vehiculo_id: vehiculoAsignado ? String(vehiculoAsignado.id) : '',
      });
      setInitialVehiculoId(vehiculoAsignado ? String(vehiculoAsignado.id) : '');
    } else {
      setForm(emptyForm);
      setInitialVehiculoId('');
    }
  }, [initialData, vehiculos]);

  function validate() {
    const nextErrors = {};
    if (!form.nombre.trim()) nextErrors.nombre = 'Requerido';
    if (!form.cedula.trim()) nextErrors.cedula = 'Requerido';
    if (!form.telefono.trim()) nextErrors.telefono = 'Requerido';
    if (!form.correo.trim()) nextErrors.correo = 'Requerido';
    if (!form.fecha_ingreso) nextErrors.fecha_ingreso = 'Requerido';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.vehiculo_id;

      const result = initialData?.id
        ? await updateSocio(initialData.id, payload)
        : await postSocio(payload);

      const socioId = result?.id || result?.data?.id;
      const vehiculoId = form.vehiculo_id ? Number(form.vehiculo_id) : null;

      if (initialData?.id && initialVehiculoId && initialVehiculoId !== form.vehiculo_id) {
        await updateVehiculo(Number(initialVehiculoId), { socio_id: null });
      }

      if (vehiculoId && socioId) {
        await updateVehiculo(vehiculoId, { socio_id: socioId });
      }

      onSaved?.(result);
    } catch (error) {
      setErrors({ general: 'No se pudo guardar el socio' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>{initialData ? 'Editar Socio' : 'Nuevo Socio'}</h3>
      {errors.general && <div className="error">{errors.general}</div>}

      <label>Nombre completo</label>
      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      {errors.nombre && <small className="error">{errors.nombre}</small>}

      <label>Cédula</label>
      <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
      {errors.cedula && <small className="error">{errors.cedula}</small>}

      <label>Teléfono</label>
      <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
      {errors.telefono && <small className="error">{errors.telefono}</small>}

      <label>Correo</label>
      <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
      {errors.correo && <small className="error">{errors.correo}</small>}

      <label>Fecha de ingreso</label>
      <input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
      {errors.fecha_ingreso && <small className="error">{errors.fecha_ingreso}</small>}

      <label>Estado</label>
      <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
        <option value="Activo">Activo</option>
        <option value="Suspendido">Suspendido</option>
      </select>

      <label>Vehículo asignado</label>
      <select value={form.vehiculo_id} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })}>
        <option value="">Sin vehículo asignado</option>
        {vehiculos.map((vehiculo) => (
          <option key={vehiculo.id} value={vehiculo.id}>
            {vehiculo.numero_vehicular || vehiculo.placa || `VEH-${vehiculo.id}`} - {vehiculo.marca || 'Sin marca'}
          </option>
        ))}
      </select>

      <div className="form-actions">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  );
}

export default CreateSocioForm;
