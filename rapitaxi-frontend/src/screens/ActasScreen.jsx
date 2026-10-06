import { useState } from 'react';
import { FileText, Printer, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showSuccessToast } from '../utils/feedback';
import { useEmpresa } from '../hooks/useEmpresa';

// Cachea el ultimo cuadro maestro generado en esta pestana. Asi, si el
// usuario navega a otra pantalla y regresa, ve el mismo reporte de inmediato
// en vez de tener que volver a consultarlo a la base de datos.
const CACHE_KEY = 'rapitaxi_cuadro_maestro';

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (data) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, generatedAt: new Date().toISOString() }));
  } catch {
    // sessionStorage puede fallar en modos privados; no es critico, simplemente no cacheamos.
  }
};

const ActasScreen = () => {
  const empresa = useEmpresa();
  const [data, setData] = useState(() => readCache()?.data || []);
  const [generatedAt, setGeneratedAt] = useState(() => readCache()?.generatedAt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generarPrevisualizacion = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/reportes/cuadro-maestro`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const reporte = await response.json();
        setData(reporte);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        writeCache(reporte);
        showSuccessToast('Cuadro maestro cargado exitosamente.');
      } else {
        const errorData = await response.json();
        console.error("DETALLE DEL ERROR:", errorData);

        setError(errorData.message || 'No se pudo generar el cuadro maestro. Intenta nuevamente o revisa las aportaciones registradas.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-slate-50 min-h-full relative">
      
      {/* =========================================
          SECCIÓN NO IMPRIMIBLE: Controles (Dashboard)
          ========================================= */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Generador de Reportes</h2>
            <p className="text-slate-500 mt-1">Generación de documentos oficiales y matriz de flota.</p>
            {generatedAt && (
              <p className="mt-1 text-xs text-slate-400">
                Generado el {new Date(generatedAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
            <button
              onClick={generarPrevisualizacion} disabled={loading}
              className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-6 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-all shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : data.length > 0 ? (
                <RefreshCw className="w-5 h-5 mr-2" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              {data.length > 0 ? 'Actualizar Cuadro Maestro' : 'Cargar Cuadro Maestro'}
            </button>
            {data.length > 0 && (
              <button 
                onClick={handlePrint}
                className="w-full sm:w-auto bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-green-700 transition-all shadow-md"
              >
                <Printer className="w-5 h-5 mr-2" /> Imprimir / PDF
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-center border border-red-100">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> 
            <span className="font-mono text-sm break-all">{error}</span>
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-20 text-center text-slate-400">
             <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
             <p className="text-lg font-medium">No hay una previsualización activa.</p>
             <p className="text-sm">Haz clic en el botón oscuro para cargar la matriz de flota actual.</p>
          </div>
        )}
      </div>

      {/* =========================================
          SECCIÓN IMPRIMIBLE: El Documento Oficial
          ========================================= */}
      {data.length > 0 && (
        <div className="bg-white shadow-xl p-4 sm:p-8 md:p-12 rounded-3xl mx-auto max-w-6xl overflow-x-auto print:shadow-none print:p-0 print:w-full print:m-0 print:overflow-visible">
          
          {/* Encabezado oficial */}
          <div className="text-center mb-8 border-b-2 border-slate-900 pb-4">
            <h1 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-900">
              {empresa?.razon_social || 'Compañía de taxis'}
            </h1>
            {(empresa?.ruc || empresa?.permiso_operacion) && (
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                {empresa.ruc && <>RUC: {empresa.ruc}</>}
                {empresa.ruc && empresa.permiso_operacion && ' · '}
                {empresa.permiso_operacion && <>Permiso de operación: {empresa.permiso_operacion}</>}
              </p>
            )}
            <p className="text-sm font-bold text-slate-600 mt-1">CUADRO MAESTRO DE FLOTA VEHICULAR</p>
            {(empresa?.parroquia || empresa?.ciudad || empresa?.tipo_servicio) && (
              <p className="text-[11px] text-slate-500 mt-1">
                {[empresa.parroquia, empresa.ciudad, empresa.provincia].filter(Boolean).join(' · ')}
                {(empresa.clase_transporte || empresa.ambito_servicio || empresa.tipo_servicio) && (
                  <>
                    {' — '}
                    {[empresa.clase_transporte, empresa.ambito_servicio, empresa.tipo_servicio].filter(Boolean).join(' · ')}
                  </>
                )}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1 italic print:hidden">Generado el: {new Date().toLocaleString()}</p>
          </div>

          <table className="w-full min-w-[900px] border-collapse border border-slate-900 text-xs print:min-w-0">
            <thead>
              <tr className="bg-slate-100 print:bg-gray-200">
                <th className="border border-slate-900 p-2 text-center uppercase">N° Vehi</th>
                <th className="border border-slate-900 p-2 text-center uppercase">Placa</th>
                <th className="border border-slate-900 p-2 text-left uppercase">Nombre Accionista</th>
                <th className="border border-slate-900 p-2 text-center uppercase">Año Model</th>
                <th className="border border-slate-900 p-2 text-center uppercase">Ult. Revision</th>
                <th className="border border-slate-900 p-2 text-center uppercase">Aportaciones</th>
                <th className="border border-slate-900 p-2 text-left uppercase">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-900 p-2 font-bold text-center">{row.numero_vehiculo || '---'}</td>
                  <td className="border border-slate-900 p-2 font-mono text-center">{row.placa || '---'}</td>
                  <td className="border border-slate-900 p-2 font-medium">{row.accionista}</td>
                  <td className="border border-slate-900 p-2 text-center">{row.anio_model || '---'}</td>
                  <td className="border border-slate-900 p-2 text-center text-slate-600 uppercase">
                    {row.fecha_ult_revision 
                      ? new Date(row.fecha_ult_revision).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) 
                      : 'Sin RTV'}
                  </td>
                  <td className={`border border-slate-900 p-2 text-center font-bold uppercase print:text-black ${row.estado_aportacion === 'Al día' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.estado_aportacion}
                  </td>
                  <td className="border border-slate-900 p-2 italic text-[10px]">{row.observaciones || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Firmas al pie (Solo visibles en impresión o PDF) */}
          <div className="mt-24 flex justify-around print:flex hidden">
            <div className="text-center">
              <div className="w-48 border-t border-slate-900 mb-2 mx-auto"></div>
              {empresa?.gerente && <p className="text-[10px]">{empresa.gerente}</p>}
              <p className="text-[10px] font-bold">GERENCIA GENERAL</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-t border-slate-900 mb-2 mx-auto"></div>
              {empresa?.secretario && <p className="text-[10px]">{empresa.secretario}</p>}
              <p className="text-[10px] font-bold">SECRETARÍA</p>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS GLOBALES PARA LA IMPRESIÓN */}
      <style>{`
        @media print {
          html, body { background: white !important; margin: 0; padding: 0; height: auto !important; overflow: visible !important; }
          aside, nav, header { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; }
          /* El area con scroll del panel (ver MainLayout) recorta todo lo
             que no cabe en la pantalla; sin esto la hoja sale en blanco. */
          .panel-scroll-area { overflow: visible !important; height: auto !important; }
          .print\\:hidden { display: none !important; }
          .print\\:flex { display: flex !important; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
};

export default ActasScreen;
