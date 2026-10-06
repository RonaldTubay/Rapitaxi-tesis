import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Car, Wrench, ShieldCheck, TrendingUp,
  Clock, AlertTriangle, Loader2, ArrowRight, FileWarning
} from 'lucide-react';
import { API_URL } from '../apiConfig';
import { useEmpresa } from '../hooks/useEmpresa';

// Cada tarjeta lleva a donde se gestiona ese dato. Es un enlace de verdad y no
// un onClick: asi funciona el tabulador, el lector de pantalla lo anuncia y se
// puede abrir en otra pestaña con el boton central del raton.
const TarjetaKpi = ({ a, titulo, children, icono, colorIcono, irA }) => (
  <Link
    to={a}
    className="group block bg-white rounded-3xl p-6 shadow-sm border border-slate-100 transition-all hover:shadow-md hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
  >
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{titulo}</p>
        {children}
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorIcono}`}>
        {icono}
      </div>
    </div>
    <p className="mt-4 flex items-center text-xs font-bold text-slate-400 transition-colors group-hover:text-slate-700">
      {irA}
      <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </p>
  </Link>
);

// Una columna del bloque de vencimientos. Cada fila lleva al expediente de ese
// socio: ver que algo caduca y no poder ir a arreglarlo seria a medias.
const ListaDocumentos = ({ titulo, total, documentos, tono }) => {
  const estilo = tono === 'rojo'
    ? { texto: 'text-red-600', chip: 'bg-red-100 text-red-700' }
    : { texto: 'text-amber-600', chip: 'bg-amber-100 text-amber-700' };

  return (
    <div>
      <p className="mb-3 flex items-center text-sm font-bold text-slate-600">
        {titulo}
        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${estilo.chip}`}>
          {total ?? documentos.length}
        </span>
      </p>

      {documentos.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          Ninguno.
        </p>
      ) : (
        <ul className="space-y-2">
          {documentos.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`/expedientes?socio_id=${doc.socio_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{doc.etiqueta}</span>
                  <span className="block truncate text-xs text-slate-500">{doc.socio}</span>
                </span>
                <span className={`flex-shrink-0 text-xs font-bold ${estilo.texto}`}>
                  {doc.dias_para_vencer < 0
                    ? `hace ${Math.abs(doc.dias_para_vencer)} d`
                    : `en ${doc.dias_para_vencer} d`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
const DashboardScreen = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const empresa = useEmpresa();

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });

      if (response.ok) {
        setStats(await response.json());
      } else {
        setError('Error al cargar las métricas.');
      }
    } catch { setError('Error de conexión con el servidor.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  if (isLoading) {
    return <div className="flex h-full min-h-[50vh] items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 animate-spin text-[#FFCC00]" /></div>;
  }

  if (error) {
    return <div className="p-10 text-red-500 font-bold flex items-center"><AlertTriangle className="mr-2"/> {error}</div>;
  }

  const kpis = stats?.kpis || {};
  const recientes = stats?.actividad_reciente || [];
  const documentos = stats?.documentos || {};
  const permiso = stats?.permiso_operacion || {};
  const vencidos = documentos.vencidos || [];
  const porVencer = documentos.por_vencer || [];

  // Cálculos para las barras de progreso
  const porcentajeLegal = kpis.flota_total > 0 ? Math.round((kpis.vehiculos_al_dia / kpis.flota_total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-slate-50 min-h-full">

      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Resumen Operativo</h2>
        <p className="text-slate-500 mt-1 font-medium">
          Monitoreo en tiempo real de {empresa?.razon_social || 'la compañía'}
        </p>
      </div>

      {/* El permiso de operacion no es un papel mas: si caduca, no circula la
          compania entera. Por eso va arriba y no dentro de una lista. */}
      {permiso.estado && !['Vigente', 'Sin registrar'].includes(permiso.estado) && (
        <Link
          to="/configuracion"
          className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 transition-colors sm:items-center ${
            permiso.estado === 'Vencido'
              ? 'border-red-200 bg-red-50 hover:bg-red-100'
              : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 h-5 w-5 flex-shrink-0 sm:mt-0 ${
              permiso.estado === 'Vencido' ? 'text-red-600' : 'text-amber-600'
            }`}
          />
          <span className="min-w-0">
            <span className={`block text-sm font-bold ${permiso.estado === 'Vencido' ? 'text-red-800' : 'text-amber-800'}`}>
              {permiso.estado === 'Vencido'
                ? `El permiso de operación venció hace ${Math.abs(permiso.dias_para_vencer)} días`
                : `El permiso de operación vence en ${permiso.dias_para_vencer} días`}
            </span>
            <span className="block text-xs text-slate-600">
              {permiso.numero ? `${permiso.numero} · ` : ''}
              Sin él no puede circular ninguna unidad de la compañía. Renovarlo es un trámite con el GAD y la ANT.
            </span>
          </span>
        </Link>
      )}

      {/* =========================================
          TARJETAS KPI (Key Performance Indicators)
          Cada una es un atajo al módulo que gestiona ese dato.
          ========================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        <TarjetaKpi
          a="/socios"
          titulo="Socios"
          irA="Gestionar socios"
          icono={<Users className="w-7 h-7" />}
          colorIcono="bg-blue-50 text-blue-600"
        >
          <h3 className="text-4xl font-black text-slate-800">{kpis.socios_activos}</h3>
        </TarjetaKpi>

        <TarjetaKpi
          a="/vehiculos"
          titulo="Flota Total"
          irA="Ver la flota"
          icono={<Car className="w-7 h-7" />}
          colorIcono="bg-yellow-50 text-yellow-600"
        >
          <h3 className="text-4xl font-black text-slate-800">{kpis.flota_total}</h3>
        </TarjetaKpi>

        {/* Cuenta lo Programado y lo que está En Proceso, que son dos estados
            distintos: por eso el enlace no aplica ninguno de los dos filtros,
            o la lista mostraría menos registros de los que dice el número. */}
        <TarjetaKpi
          a="/mantenimiento"
          titulo="En Taller"
          irA="Ir al taller"
          icono={<Wrench className="w-7 h-7" />}
          colorIcono="bg-orange-50 text-orange-500"
        >
          <h3 className="text-4xl font-black text-slate-800">{kpis.taller_pendientes}</h3>
        </TarjetaKpi>

        {/* Unidades descuidadas. El socio paga sus propios trabajos; lo que la
            compañía necesita vigilar es que la unidad no lleve medio año sin
            pasar por el taller. */}
        <TarjetaKpi
          a="/vehiculos"
          titulo="Sin Taller"
          irA="Revisar unidades"
          icono={<AlertTriangle className="w-7 h-7" />}
          colorIcono={kpis.unidades_sin_mantenimiento > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}
        >
          <h3 className={`text-4xl font-black ${kpis.unidades_sin_mantenimiento > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {kpis.unidades_sin_mantenimiento}
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5 leading-tight">
            +{kpis.meses_sin_mantenimiento} meses sin mantenimiento
          </p>
        </TarjetaKpi>

      </div>

      {/* Vencimientos: el eje del proyecto es el control de caducidades, asi que
          tiene que verse al entrar y no escondido dentro de Expedientes. */}
      {(vencidos.length > 0 || porVencer.length > 0) && (
        <div className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center text-lg font-bold text-slate-800 sm:text-xl">
              <FileWarning className="mr-2 h-6 w-6 text-amber-500" /> Documentos que caducan
            </h3>
            <Link
              to="/expedientes"
              className="group hidden flex-shrink-0 items-center rounded text-xs font-bold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:inline-flex"
            >
              Ir a Expedientes
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListaDocumentos
              titulo="Ya vencidos"
              total={kpis.documentos_vencidos}
              documentos={vencidos}
              tono="rojo"
            />
            <ListaDocumentos
              titulo={`Vencen en ${documentos.dias_aviso ?? 30} días o menos`}
              total={kpis.documentos_por_vencer}
              documentos={porVencer}
              tono="ambar"
            />
          </div>
        </div>
      )}

      {/* =========================================
          SEGUNDA FILA: Estado Legal y Actividad
          ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMNA IZQUIERDA: Estado de la Flota (1/3) */}
        <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-8">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-6 flex items-center">
            <ShieldCheck className="w-6 h-6 mr-2 text-green-500" /> Estatus Legal (RTV)
          </h3>

          <div className="mb-6">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-slate-600">Unidades Aprobadas</span>
              <span className="text-slate-900">{porcentajeLegal}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-1000 ${porcentajeLegal >= 80 ? 'bg-green-500' : porcentajeLegal >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${porcentajeLegal}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">
              {kpis.vehiculos_al_dia} de {kpis.flota_total} vehículos cuentan con revisión vigente.
            </p>
            <Link
              to="/revisiones"
              className="group mt-4 inline-flex items-center text-xs font-bold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 rounded"
            >
              Gestionar revisiones
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
            <h4 className="font-bold text-blue-900 mb-2 flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> Resumen Rápido</h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              El sistema se encuentra monitoreando la actividad del taller y las fechas de matriculación. Mantén actualizados los expedientes para un 100% de operatividad.
            </p>
          </div>
        </div>

        {/* COLUMNA DERECHA: Actividad Reciente del Taller (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <Clock className="w-6 h-6 mr-2 text-orange-500" /> Últimos Movimientos en Taller
            </h3>
            <Link
              to="/mantenimiento"
              className="group hidden flex-shrink-0 items-center text-xs font-bold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 rounded sm:inline-flex"
            >
              Ver todos
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {recientes.length === 0 ? (
            <div className="text-center py-10">
              <Wrench className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">No hay registros de mantenimiento recientes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cada movimiento lleva al taller con esa unidad ya buscada: es el
                  atajo mas util del tablero, porque lo normal al ver un trabajo
                  reciente es querer el historial completo de esa unidad. */}
              {recientes.map((mant) => (
                <Link
                  key={mant.id}
                  to={`/mantenimiento?search=${encodeURIComponent(mant.vehiculo?.numero_vehiculo || '')}`}
                  className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:flex-row sm:items-center"
                >

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mr-4 ${
                    mant.estado === 'Completado' ? 'bg-green-100 text-green-600' :
                    mant.estado === 'En Proceso' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    <Wrench className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-grow">
                    <h4 className="font-bold text-slate-900">
                      Unidad {mant.vehiculo?.numero_vehiculo} - {mant.tipo_mantenimiento}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Socio: {mant.vehiculo?.socio?.nombre} • {new Date(mant.fecha_mantenimiento).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="w-full text-left sm:w-auto sm:text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      mant.estado === 'Completado' ? 'bg-green-100 text-green-700' :
                      mant.estado === 'En Proceso' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {mant.estado}
                    </span>
                  </div>

                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardScreen;
