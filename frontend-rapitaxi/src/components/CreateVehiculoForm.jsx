import React, { useState, useEffect } from 'react';
import { postVehiculo, updateVehiculo } from '../services/api';

const PLACA_REGEX = /^[A-Z]{3}-[0-9]{4}$/;

function CreateVehiculoForm({ initialData = null, onSaved, onCancel }) {
  const [form, setForm] = useState({
    numero_vehicular: '',
    placa: '',
    marca: '',
    color: '',
    anio_modelo: '',
    kilometraje: '',
    estado: 'Operativo',
    observacion: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      const identificador = initialData.placa || initialData.numero_vehicular || '';
      setForm((prev) => ({ ...prev, ...initialData, placa: identificador, numero_vehicular: identificador }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  function validate() {
    const e = {};
    if (!form.placa || form.placa.trim() === '') e.placa = 'Requerido';
    else if (!PLACA_REGEX.test(String(form.placa).toUpperCase())) e.placa = 'Formato inválido. Usa ABC-1234';
    if (!form.marca || form.marca.trim() === '') e.marca = 'Requerido';
    if (!form.color || form.color.trim() === '') e.color = 'Requerido';
    if (String(form.kilometraje).trim() === '') e.kilometraje = 'Requerido';
    else if (!/^\d+$/.test(String(form.kilometraje))) e.kilometraje = 'Debe ser número entero';
    if (form.anio_modelo && !/^[0-9]{4}$/.test(String(form.anio_modelo))) e.anio_modelo = 'Año inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const identificador = String(form.placa).toUpperCase();
      const payload = { ...form, placa: identificador, numero_vehicular: identificador, kilometraje: Number(form.kilometraje) };
      let result;
      if (initialData && initialData.id) {
        result = await updateVehiculo(initialData.id, payload);
      } else {
        result = await postVehiculo(payload);
      }
      onSaved && onSaved(result);
    } catch (err) {
      setErrors({ general: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>{initialData ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
      {errors.general && <div className="error">{errors.general}</div>}
      <label>Número vehicular (identificador por placa)</label>
      <input value={form.numero_vehicular} readOnly />

      <label>Placa (formato ABC-1234)</label>
      <input
        value={form.placa}
        placeholder="MBG-5877"
        onChange={(e) => {
          const value = e.target.value.toUpperCase().replace(/\s+/g, '');
          setForm({ ...form, placa: value, numero_vehicular: value });
        }}
      />
      {errors.placa && <small className="error">{errors.placa}</small>}

      <label>Marca / Modelo</label>
      <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
      {errors.marca && <small className="error">{errors.marca}</small>}

      <label>Año modelo</label>
      <input value={form.anio_modelo} onChange={(e) => setForm({ ...form, anio_modelo: e.target.value })} />
      {errors.anio_modelo && <small className="error">{errors.anio_modelo}</small>}

      <label>Color</label>
      <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      {errors.color && <small className="error">{errors.color}</small>}

      <label>Kilometraje</label>
      <input type="number" min="0" value={form.kilometraje} onChange={(e) => setForm({ ...form, kilometraje: e.target.value })} />
      {errors.kilometraje && <small className="error">{errors.kilometraje}</small>}

      <label>Estado</label>
      <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
        <option>Operativo</option>
        <option>Mantenimiento</option>
      </select>

      <label>Observación</label>
      <textarea value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} />

      <div className="form-actions">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  );
}

export default CreateVehiculoForm;
