import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';
import { getExpedientes, getMantenimientos, getSocios, getVehiculos } from '../services/api';

function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socios, setSocios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [expedientes, setExpedientes] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const [sociosRes, vehiculosRes, mantenimientosRes, expedientesRes] = await Promise.all([
        getSocios(),
        getVehiculos(),
        getMantenimientos(),
        getExpedientes(),
      ]);

      setSocios(Array.isArray(sociosRes) ? sociosRes : []);
      setVehiculos(Array.isArray(vehiculosRes) ? vehiculosRes : []);
      setMantenimientos(Array.isArray(mantenimientosRes) ? mantenimientosRes : []);
      setExpedientes(Array.isArray(expedientesRes?.data) ? expedientesRes.data : []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const metricas = useMemo(() => {
    const totalSocios = socios.length;
    const vehiculosActivos = vehiculos.filter((vehiculo) => String(vehiculo.estado || '').toLowerCase() === 'operativo').length;
    const vehiculosEnMantenimiento = vehiculos.filter((vehiculo) => String(vehiculo.estado || '').toLowerCase() === 'mantenimiento').length;
    const mantenimientosPendientes = mantenimientos.filter((m) => m.estado === 'Pendiente' || m.estado === 'En Proceso').length;

    const hoy = new Date();
    const alertasDesgaste = vehiculos.filter((vehiculo) => Number(vehiculo.desgaste || 0) >= 80).length;
    const alertasProximo = vehiculos.filter((vehiculo) => {
      if (!vehiculo.prox_mantenimiento) return false;
      const fecha = new Date(vehiculo.prox_mantenimiento);
      const diff = (fecha - hoy) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;

    return {
      totalSocios,
      vehiculosActivos,
      vehiculosEnMantenimiento,
      mantenimientosPendientes,
      alertasActivas: alertasDesgaste + alertasProximo,
    };
  }, [socios, vehiculos, mantenimientos]);

  const recientesData = useMemo(() => {
    return [...mantenimientos]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 5)
      .map((item) => ({
        id: item.identificador_vehiculo || item.vehiculo?.placa || `VEH-${item.vehiculo_id}`,
        tarea: item.tipo,
        fecha: item.fecha,
        costo: new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(item.costo || 0)),
        estado: item.estado,
      }));
  }, [mantenimientos]);

  const proximosData = useMemo(() => {
    const hoy = new Date();
    return [...vehiculos]
      .filter((vehiculo) => vehiculo.prox_mantenimiento)
      .sort((a, b) => new Date(a.prox_mantenimiento) - new Date(b.prox_mantenimiento))
      .slice(0, 5)
      .map((item) => {
        const fecha = new Date(item.prox_mantenimiento);
        const diff = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
        return {
          id: item.numero_vehicular || item.placa || `VEH-${item.id}`,
          tarea: diff < 0 ? 'Mantenimiento vencido' : 'Mantenimiento preventivo',
          fecha: item.prox_mantenimiento,
        };
      });
  }, [vehiculos]);

  const expedientesAbiertos = expedientes.filter((exp) => String(exp.estado || '').toLowerCase() === 'abierto').length;
  const totalFlota = vehiculos.length;
  const vehiculosFueraServicio = Math.max(totalFlota - metricas.vehiculosActivos - metricas.vehiculosEnMantenimiento, 0);
  const porcentajeOperativos = totalFlota ? Math.round((metricas.vehiculosActivos / totalFlota) * 100) : 0;
  const porcentajeMantenimiento = totalFlota ? Math.round((metricas.vehiculosEnMantenimiento / totalFlota) * 100) : 0;
  const porcentajeFueraServicio = totalFlota ? Math.round((vehiculosFueraServicio / totalFlota) * 100) : 0;

  const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('es-EC', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(parsed);
  };

  const statCards = [
    {
      title: 'Total Socios',
      value: String(metricas.totalSocios),
      hint: 'Registros en la base de datos',
      icon: '👥',
    },
    {
      title: 'Vehículos Activos',
      value: String(metricas.vehiculosActivos),
      hint: 'Estado operativo',
      icon: '🚖',
    },
    {
      title: 'Mantenimientos Pendientes',
      value: String(metricas.mantenimientosPendientes),
      hint: 'Pendiente o en proceso',
      icon: '🔧',
    },
    {
      title: 'Alertas Activas',
      value: String(metricas.alertasActivas + expedientesAbiertos),
      hint: 'Condiciones por atender',
      icon: '⚠️',
    },
  ];

  const recentMaintenance = recientesData.length > 0 ? recientesData : [];
  const upcomingMaintenance = proximosData.length > 0 ? proximosData : [];

  return (
    <>
      <header className="header">
        <div className="header-title">
          <h2>Dashboard</h2>
          <p>Resumen general del sistema RAPITAXI</p>
        </div>
      </header>

      {error && <p className="error" style={{ marginBottom: '14px' }}>{error}</p>}
      {loading && <p style={{ marginBottom: '14px', color: '#64748b' }}>Cargando indicadores...</p>}

      <div className="kpi-row-4">
        {statCards.map((stat) => (
          <div className="kpi-card" key={stat.title}>
            <div>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>{stat.title}</p>
              <h3 style={{ fontSize: '32px', color: '#0f172a' }}>{stat.value}</h3>
              <p className="kpi-trend trend-up">{stat.hint}</p>
            </div>
            <div className="kpi-icon yellow">{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dash-section">
          <h3>Mantenimientos Recientes</h3>
          {recentMaintenance.length === 0 && <p style={{ color: '#64748b' }}>No hay mantenimientos registrados.</p>}
          {recentMaintenance.map((item, index) => (
            <div className="dash-list-item" key={index}>
              <div className="dash-item-left">
                <div className="dash-item-icon">🚖</div>
                <div className="dash-item-text">
                  <h4>{item.id}</h4>
                  <p>{item.tarea}<br />{formatDate(item.fecha)}</p>
                </div>
              </div>
              <div className="dash-item-right">
                <span className="price">{item.costo}</span>
                <span className={`status-badge ${String(item.estado).toLowerCase().replace(/\s+/g, '-')}`}>
                  {item.estado}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="dash-section">
          <h3>Próximos Mantenimientos</h3>
          {upcomingMaintenance.length === 0 && <p style={{ color: '#64748b' }}>No hay mantenimientos próximos.</p>}
          {upcomingMaintenance.map((item, index) => (
            <div className="dash-list-item" key={index}>
              <div className="dash-item-left">
                <div className="dash-item-icon orange">🔧</div>
                <div className="dash-item-text">
                  <h4>{item.id}</h4>
                  <p>{item.tarea}</p>
                </div>
              </div>
              <div className="dash-item-right" style={{ justifyContent: 'center' }}>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Fecha:</p>
                <span className="price" style={{ fontWeight: 'normal' }}>{formatDate(item.fecha)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-section" style={{ marginTop: '24px' }}>
        <h3>Estado de la Flota</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Operativos</span>
              <span className="text-sm text-gray-900">{porcentajeOperativos}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${porcentajeOperativos}%`, height: '100%', background: '#16a34a' }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{metricas.vehiculosActivos} de {totalFlota} vehículos</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">En Mantenimiento</span>
              <span className="text-sm text-gray-900">{porcentajeMantenimiento}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${porcentajeMantenimiento}%`, height: '100%', background: '#ea580c' }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{metricas.vehiculosEnMantenimiento} vehículos</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Fuera de Servicio</span>
              <span className="text-sm text-gray-900">{porcentajeFueraServicio}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${porcentajeFueraServicio}%`, height: '100%', background: '#b91c1c' }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{vehiculosFueraServicio} vehículos</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default DashboardScreen;