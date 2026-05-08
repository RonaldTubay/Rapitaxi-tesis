import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';
import CreateSocioForm from '../components/CreateSocioForm';
import { deleteSocio, getSocios, getVehiculos } from '../services/api';

function SociosScreen() {
  const [socios, setSocios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [sociosData, vehiculosData] = await Promise.all([getSocios(), getVehiculos()]);
        if (Array.isArray(sociosData)) setSocios(sociosData);
        if (Array.isArray(vehiculosData)) setVehiculos(vehiculosData);
      } catch (error) {
        console.error('No se pudieron cargar socios', error);
      }
    }

    load();
  }, []);

  const vehiculosPorSocio = useMemo(() => {
    return vehiculos.reduce((accumulator, vehiculo) => {
      const socioKey = vehiculo.socio_id ? String(vehiculo.socio_id) : '';
      if (!socioKey) return accumulator;
      if (!accumulator[socioKey]) accumulator[socioKey] = [];
      accumulator[socioKey].push(vehiculo);
      return accumulator;
    }, {});
  }, [vehiculos]);

  const filteredSocios = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return socios;

    return socios.filter((socio) => {
      const vinculados = vehiculosPorSocio[String(socio.id)] || [];
      const vehiculoTexto = vinculados
        .map((vehiculo) => `${vehiculo.numero_vehicular || vehiculo.placa || ''} ${vehiculo.marca || ''}`)
        .join(' ')
        .toLowerCase();

      return [
        socio.nombre,
        socio.cedula,
        socio.telefono,
        socio.correo,
        socio.estado,
        vehiculoTexto,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [searchTerm, socios, vehiculosPorSocio]);

  const getSocioVehicles = (socioId) => vehiculosPorSocio[String(socioId)] || [];

  const formatStatus = (estado) => String(estado || 'Activo').toLowerCase();

  return (
    <>
      <header className="header">
        <div className="header-title">
          <h2>Gestión de Socios</h2>
          <p>Administración de expedientes digitales de conductores</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <span>+</span> Nuevo Socio
        </button>
      </header>

      <div className="search-container">
        <span>🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, cédula o vehículo..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="cards-list">
        {filteredSocios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'white', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📭</span>
            <h3 style={{ color: '#0f172a', fontSize: '18px', marginBottom: '8px' }}>No hay socios registrados</h3>
            <p style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
              Aún no existen registros de expedientes en la base de datos. Haz clic en "Nuevo Socio" para comenzar.
            </p>
          </div>
        ) : (
          filteredSocios.map((socio) => {
            const vehiculosSocio = getSocioVehicles(socio.id);
            const vehiculoPrincipal = vehiculosSocio[0];

            return (
            <div className="card" key={socio.id} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <h3 style={{ marginBottom: '8px' }}>{socio.nombre}</h3>
                  <p style={{ color: '#64748b', marginBottom: '4px' }}>Cédula: {socio.cedula}</p>
                  <p style={{ color: '#64748b', marginBottom: '4px' }}>Teléfono: {socio.telefono}</p>
                  <p style={{ color: '#64748b', marginBottom: '4px' }}>Correo: {socio.correo}</p>
                  <p style={{ color: '#64748b', marginBottom: '4px' }}>
                    Vehículo asignado: {vehiculoPrincipal ? (vehiculoPrincipal.numero_vehicular || vehiculoPrincipal.placa || `VEH-${vehiculoPrincipal.id}`) : 'Sin asignar'}
                  </p>
                  <p style={{ color: '#64748b' }}>Ingreso: {socio.fecha_ingreso}</p>
                </div>
                <span className={`status-badge ${formatStatus(socio.estado)}`}>{socio.estado}</span>
              </div>
              <div className="card-actions">
                <button className="btn-ghost" onClick={() => { setSelectedSocio(socio); setShowDetailModal(true); }}>👁️ Ver Detalles</button>
                <button className="btn-ghost" onClick={() => { setEditing(socio); setShowForm(true); }}>✏️ Editar</button>
                <button className="btn-ghost" onClick={async () => {
                  if (!confirm('¿Eliminar socio? Esta acción es irreversible.')) return;
                  try {
                    await deleteSocio(socio.id);
                    setSocios((prev) => prev.filter((item) => item.id !== socio.id));
                  } catch (error) {
                    alert('No se pudo eliminar el socio');
                  }
                }}>🗑️ Eliminar</button>
              </div>
            </div>
          );
          })
        )}
      </div>

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <CreateSocioForm
              initialData={editing}
              vehiculos={vehiculos}
              onCancel={() => setShowForm(false)}
              onSaved={async () => {
                setShowForm(false);
                const [sociosData, vehiculosData] = await Promise.all([getSocios(), getVehiculos()]);
                if (Array.isArray(sociosData)) setSocios(sociosData);
                if (Array.isArray(vehiculosData)) setVehiculos(vehiculosData);
              }}
            />
          </div>
        </div>
      )}

      {showDetailModal && selectedSocio && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '760px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>Detalles del Socio</h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f1fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#059669', textTransform: 'uppercase', marginBottom: '8px' }}>Nombre Completo</p>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{selectedSocio.nombre}</h3>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#d97706', textTransform: 'uppercase', marginBottom: '8px' }}>Estado</p>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{selectedSocio.estado}</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Cédula</p>
                <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>{selectedSocio.cedula}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Teléfono</p>
                <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>📱 {selectedSocio.telefono}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Correo Electrónico</p>
                <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>📧 {selectedSocio.correo}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Ingreso</p>
                <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>{selectedSocio.fecha_ingreso}</p>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#0284c7', textTransform: 'uppercase', marginBottom: '8px' }}>Vehículos asociados</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {getSocioVehicles(selectedSocio.id).length > 0 ? (
                  getSocioVehicles(selectedSocio.id).map((vehiculo) => (
                    <span key={vehiculo.id} className="status-badge badge-muted">
                      {vehiculo.numero_vehicular || vehiculo.placa || `VEH-${vehiculo.id}`} - {vehiculo.marca}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#334155' }}>Sin vehículos asignados</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowDetailModal(false)}>Cerrar</button>
              <button className="btn-primary" onClick={() => { setShowDetailModal(false); setEditing(selectedSocio); setShowForm(true); }}>✏️ Editar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SociosScreen;