import React, { useState, useEffect } from 'react';
import '../App.css';
import CreateVehiculoForm from '../components/CreateVehiculoForm';
import { getVehiculos, deleteVehiculo } from '../services/api';

const vehiculosData = [
  { id: 'TAX-001', marca: 'Toyota Corolla 2023', color: 'Blanco', conductor: 'Carlos Ramírez González', kilometraje: '45.230 km', desgaste: 45, proxMantenimiento: '2026-06-15', estado: 'Operativo' },
  { id: 'TAX-045', marca: 'Honda Civic 2022', color: 'Gris', conductor: 'María López Fernández', kilometraje: '62.100 km', desgaste: 62, proxMantenimiento: '2026-05-20', estado: 'Operativo' },
  { id: 'TAX-078', marca: 'Nissan Sentra 2023', color: 'Plata', conductor: 'Juan Pérez Santos', kilometraje: '30.150 km', desgaste: 30, proxMantenimiento: '2026-07-10', estado: 'Operativo' },
  { id: 'TAX-102', marca: 'Hyundai Elantra 2021', color: 'Negro', conductor: 'Ana Martínez Díaz', kilometraje: '85.400 km', desgaste: 85, proxMantenimiento: '2026-04-25', estado: 'Mantenimiento' }
];

function VehiculosScreen() {
  const [vehiculos, setVehiculos] = useState(vehiculosData);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);
  const filteredVehiculos = vehiculos.filter((vehiculo) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const identificador = String(vehiculo.numero_vehicular || vehiculo.placa || vehiculo.id || '').toLowerCase();
    const placa = String(vehiculo.placa || '').toLowerCase();
    const marca = String(vehiculo.marca || '').toLowerCase();
    const conductor = String(vehiculo.conductor || '').toLowerCase();

    return identificador.includes(term) || placa.includes(term) || marca.includes(term) || conductor.includes(term);
  });

  const totalVehiculos = filteredVehiculos.length;
  const totalOperativos = filteredVehiculos.filter((v) => String(v.estado || '').toLowerCase() === 'operativo').length;
  const totalMantenimiento = filteredVehiculos.filter((v) => String(v.estado || '').toLowerCase() === 'mantenimiento').length;

  useEffect(() => {
    async function load() {
      try {
        const data = await getVehiculos();
        if (Array.isArray(data)) setVehiculos(data);
      } catch (err) {
        console.error('No se pudieron cargar vehículos', err);
      }
    }
    load();
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-title">
          <h2>Gestión de Vehículos</h2>
          <p>Control y administración de la flota vehicular</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <span>+</span> Nuevo Vehículo
        </button>
      </header>

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-info"><p>Total Vehículos</p><h3>{totalVehiculos}</h3></div><div className="kpi-icon yellow">🚖</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>En Operación</p><h3>{totalOperativos}</h3></div><div className="kpi-icon green">🚘</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>En Mantenimiento</p><h3>{totalMantenimiento}</h3></div><div className="kpi-icon blue">🚙</div></div>
      </div>

      <div className="search-container">
        <span>🔍</span>
        <input
          type="text"
          placeholder="Buscar por Nº vehicular, placa, marca o conductor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="vehicles-grid">
        {filteredVehiculos.map((vehiculo) => (
          <div className="v-card" key={vehiculo.id}>
            <div className="v-header">
              <div className="v-header-left">
                <div className="v-icon">🚖</div>
                <div className="v-title"><h4>{vehiculo.numero_vehicular || vehiculo.placa || vehiculo.id}</h4><p>{vehiculo.marca} <br/> Color: {vehiculo.color}</p></div>
              </div>
              <span className={`status-badge ${vehiculo.estado.toLowerCase()}`}>{vehiculo.estado}</span>
            </div>
            <div className="v-details">
              <div className="v-detail-item"><span>👤</span> {vehiculo.conductor}</div>
              <div className="v-detail-item"><span>⛽</span> Kilometraje: {vehiculo.kilometraje}</div>
            </div>
            <div className="v-progress-section">
              <div className="v-progress-labels"><span>Desgaste</span><span>{vehiculo.desgaste}%</span></div>
              <div className="v-progress-bar"><div className="v-progress-fill" style={{ width: `${vehiculo.desgaste}%` }}></div></div>
            </div>
            <div className="v-detail-item" style={{ marginBottom: '20px' }}><span>📅</span> Próximo mant.: {vehiculo.proxMantenimiento}</div>
            <div className="v-actions">
              <button className="btn-outline" onClick={() => { setSelectedVehiculo(vehiculo); setShowDetailModal(true); }}><span>👁️</span> Ver Detalles</button>
              <button className="btn-icon" onClick={() => { setEditing(vehiculo); setShowForm(true); }}>✏️</button>
              <button className="btn-icon danger" onClick={async () => {
                if (!confirm('¿Eliminar vehículo? Esta acción es irreversible.')) return;
                try {
                  await deleteVehiculo(vehiculo.id);
                  setVehiculos((prev) => prev.filter(v => v.id !== vehiculo.id));
                } catch (err) { alert('Error al eliminar'); }
              }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <CreateVehiculoForm initialData={editing} onCancel={() => setShowForm(false)} onSaved={(saved) => {
              setShowForm(false);
              // If the API returned an object with id, refresh the list simply
              if (saved && saved.id) {
                // reload list quickly
                getVehiculos().then(data => { if (Array.isArray(data)) setVehiculos(data); });
              }
            }} />
          </div>
        </div>
      )}

        {showDetailModal && selectedVehiculo && (
          <div className="modal">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>Detalles del Vehículo</h2>
                <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f1fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#059669', textTransform: 'uppercase', marginBottom: '8px' }}>Número Vehicular</p>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{selectedVehiculo.numero_vehicular || selectedVehiculo.placa || selectedVehiculo.id}</h3>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#d97706', textTransform: 'uppercase', marginBottom: '8px' }}>Estado</p>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{selectedVehiculo.estado}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Marca y Modelo</p>
                  <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>{selectedVehiculo.marca}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Color</p>
                  <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>{selectedVehiculo.color}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Conductor Asignado</p>
                  <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>👤 {selectedVehiculo.conductor}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Kilometraje</p>
                  <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>⛽ {selectedVehiculo.kilometraje}</p>
                </div>
              </div>

              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Nivel de Desgaste</p>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: selectedVehiculo.desgaste > 70 ? '#b91c1c' : selectedVehiculo.desgaste > 50 ? '#ea580c' : '#16a34a' }}>{selectedVehiculo.desgaste}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: selectedVehiculo.desgaste > 70 ? '#ef4444' : selectedVehiculo.desgaste > 50 ? '#f97316' : '#22c55e', width: `${selectedVehiculo.desgaste}%`, transition: 'width 0.3s' }}></div>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '24px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#0284c7', textTransform: 'uppercase', marginBottom: '8px' }}>📅 Próximo Mantenimiento</p>
                <p style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{selectedVehiculo.proxMantenimiento}</p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn-outline" onClick={() => setShowDetailModal(false)}>Cerrar</button>
                <button className="btn-primary" onClick={() => { setShowDetailModal(false); setEditing(selectedVehiculo); setShowForm(true); }}>✏️ Editar</button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default VehiculosScreen;