import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Autenticación
import { AuthProvider } from './features/auth/AuthContext';
import AdminLoginScreen from './features/auth/AdminLoginScreen';
import SessionIdleWatcher from './features/auth/SessionIdleWatcher';
import ProtectedRoute from './routes/ProtectedRoute';

// Las pantallas se cargan cuando se entra a ellas, no al abrir la aplicación.
// Antes el paquete traía las quince juntas: un socio que solo mira su perfil
// descargaba igual el cuadro maestro, la auditoría y la pantalla de usuarios,
// que nunca va a poder abrir.
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const SociosScreen = lazy(() => import('./screens/SociosScreen'));
const AportacionesScreen = lazy(() => import('./screens/AportacionesScreen'));
const ExpedientesScreen = lazy(() => import('./screens/ExpedientesScreen'));
const VehiculosScreen = lazy(() => import('./screens/VehiculosScreen'));
const RevisionesScreen = lazy(() => import('./screens/RevisionesScreen'));
const MantenimientoScreen = lazy(() => import('./screens/MantenimientoScreen'));
const ActasScreen = lazy(() => import('./screens/ActasScreen'));
const LibrosContablesScreen = lazy(() => import('./screens/LibrosContablesScreen'));
const ConfiguracionScreen = lazy(() => import('./screens/ConfiguracionScreen'));
const UsuariosScreen = lazy(() => import('./screens/UsuariosScreen'));
const AuditoriaScreen = lazy(() => import('./screens/AuditoriaScreen'));
const MiPerfilScreen = lazy(() => import('./screens/portal/MiPerfilScreen'));
const MisAportacionesScreen = lazy(() => import('./screens/portal/MisAportacionesScreen'));
const MisUnidadesScreen = lazy(() => import('./screens/portal/MisUnidadesScreen'));
const MisDocumentosScreen = lazy(() => import('./screens/portal/MisDocumentosScreen'));

// Importación de la Plantilla Base
import MainLayout from './components/MainLayout';
import SocioPortalLayout from './components/SocioPortalLayout';
import ToastHost from './components/ToastHost';
import ConfirmHost from './components/ConfirmHost';

// Lo que se ve el instante que tarda en llegar el trozo de la pantalla.
const CargandoPantalla = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center" role="status" aria-live="polite">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-yellow-400" />
    <span className="sr-only">Cargando…</span>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastHost />
        <ConfirmHost />
        <SessionIdleWatcher />
        <Suspense fallback={<CargandoPantalla />}>
          <Routes>
            {/* Ruta pública */}
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<AdminLoginScreen />} />

            {/* Rutas protegidas que comparten la barra lateral (solo admin/operador) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'operador']} />}>
              <Route element={<MainLayout />}>
                <Route path="/panel" element={<DashboardScreen />} />
                <Route path="/socios" element={<SociosScreen />} />
                <Route path="/aportaciones" element={<AportacionesScreen />} />
                <Route path="/expedientes" element={<ExpedientesScreen />} />
                <Route path="/vehiculos" element={<VehiculosScreen />} />
                <Route path="/revisiones" element={<RevisionesScreen />} />
                <Route path="/mantenimiento" element={<MantenimientoScreen />} />
                <Route path="/actas" element={<ActasScreen />} />
                <Route path="/libros-contables" element={<LibrosContablesScreen />} />

                {/* Solo admin: gestion de personal interno y configuracion critica */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/usuarios" element={<UsuariosScreen />} />
                  <Route path="/configuracion" element={<ConfiguracionScreen />} />
                  <Route path="/auditoria" element={<AuditoriaScreen />} />
                </Route>
              </Route>
            </Route>

            {/* Portal del socio: acceso propio, no comparte el panel de staff */}
            <Route element={<ProtectedRoute allowedRoles={['socio']} />}>
              <Route element={<SocioPortalLayout />}>
                <Route path="/portal" element={<Navigate to="/portal/perfil" replace />} />
                <Route path="/portal/perfil" element={<MiPerfilScreen />} />
                <Route path="/portal/unidades" element={<MisUnidadesScreen />} />
                <Route path="/portal/documentos" element={<MisDocumentosScreen />} />
                <Route path="/portal/aportaciones" element={<MisAportacionesScreen />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
