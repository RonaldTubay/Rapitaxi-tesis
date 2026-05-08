import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';

// Importamos tus pantallas y componentes
import LoginScreen from './screens/LoginScreen'; 
import DashboardScreen from './screens/DashboardScreen';
import SociosScreen from './screens/SociosScreen';
import VehiculosScreen from './screens/VehiculosScreen';
import MantenimientoScreen from './screens/MantenimientoScreen';
import LibrosContablesScreen from './screens/LibrosContablesScreen';
import RevisionForm from './components/RevisionForm';
import ExpedienteForm from './components/ExpedienteForm';
import ActaView from './components/ActaView';
import './App.css'; 

function App() {
  // Verificamos si existe el token en el almacenamiento local
  const isAuthenticated = !!localStorage.getItem('token');

  // Función para limpiar la sesión
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login'; // Recarga para resetear el estado de la app
  };

  return (
    <BrowserRouter>
      {/* CASO 1: USUARIO NO AUTENTICADO */}
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          {/* Cualquier otra ruta lo manda al login si no está logueado */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        /* CASO 2: USUARIO AUTENTICADO (Muestra Sidebar + Contenido) */
        <div className="dashboard-container">
          
          {/* === BARRA LATERAL (SIDEBAR) === */}
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-icon">🚖</span>
                <div className="brand-text">
                  <h1>RAPITAXI</h1>
                  <p>Sistema de Gestión</p>
                </div>
              </div>

              <nav className="nav-menu">
                <NavLink 
                  to="/dashboard" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>📊</span> Dashboard
                </NavLink>
                
                <NavLink 
                  to="/socios" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>👥</span> Socios
                </NavLink>
                
                <NavLink 
                  to="/vehiculos" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>🚘</span> Vehículos
                </NavLink>
                
                <NavLink 
                  to="/mantenimiento" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>🔧</span> Mantenimiento
                </NavLink>

                <NavLink 
                  to="/revisiones" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>📝</span> Revisiones
                </NavLink>

                <NavLink 
                  to="/expedientes" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>📁</span> Expedientes
                </NavLink>

                <NavLink 
                  to="/libros-contables" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>📚</span> Libros Contables
                </NavLink>

                <NavLink 
                  to="/acta" 
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                >
                  <span>📄</span> Acta
                </NavLink>
              </nav>
            </div>

            {/* Botón de cerrar sesión funcional */}
            <button onClick={handleLogout} className="nav-item logout-btn" style={{ width: '100%', cursor: 'pointer' }}>
              <span>🚪</span> Cerrar Sesión
            </button>
          </aside>

          {/* === CONTENIDO PRINCIPAL === */}
          <main className="main-content">
            <Routes>
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/socios" element={<SociosScreen />} />
              <Route path="/vehiculos" element={<VehiculosScreen />} />
              <Route path="/mantenimiento" element={<MantenimientoScreen />} />
              <Route path="/revisiones" element={<RevisionForm />} />
              <Route path="/expedientes" element={<ExpedienteForm />} />
              <Route path="/libros-contables" element={<LibrosContablesScreen />} />
              <Route path="/acta" element={<ActaView />} />
              
              {/* Redirecciones de seguridad estando logueado */}
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;