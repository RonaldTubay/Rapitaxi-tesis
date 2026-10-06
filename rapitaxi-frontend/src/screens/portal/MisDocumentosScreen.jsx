import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileText,
  FileWarning, Loader2, ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { showErrorToast } from '../../utils/feedback';

// Mismos nombres que devuelve el backend (App\Models\Expediente).
const ESTILO = {
  'Vencido': { chip: 'bg-red-100 text-red-700', icono: AlertTriangle, texto: 'text-red-600' },
  'Por vencer': { chip: 'bg-amber-100 text-amber-700', icono: Clock, texto: 'text-amber-600' },
  'Vigente': { chip: 'bg-green-100 text-green-700', icono: CheckCircle2, texto: 'text-green-600' },
  'Sin vencimiento': { chip: 'bg-slate-100 text-slate-600', icono: FileText, texto: 'text-slate-500' },
};

const estiloDe = (estado) => ESTILO[estado] || ESTILO['Sin vencimiento'];

const formatearFecha = (fecha) => (fecha ? new Date(`${fecha}T00:00:00`).toLocaleDateString() : '—');

const textoPlazo = (doc) => {
  if (doc.estado === 'Sin vencimiento') return 'No caduca';
  if (doc.dias_para_vencer === null) return '';
  if (doc.dias_para_vencer < 0) {
    const dias = Math.abs(doc.dias_para_vencer);
    return `Venció hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  if (doc.dias_para_vencer === 0) return 'Vence hoy';
  if (doc.dias_para_vencer <= 60) {
    return `Vence en ${doc.dias_para_vencer} ${doc.dias_para_vencer === 1 ? 'día' : 'días'}`;
  }
  // "Vence en 1096 días" no se lee; a partir de dos meses se cuenta en meses.
  const meses = Math.round(doc.dias_para_vencer / 30);
  return `Vence en ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
};

// Faltar un documento y tenerlo vencido son dos problemas distintos, y se
// arreglan distinto: uno se entrega, el otro se renueva.
const titularResumen = (resumen, cuantosFaltan) => {
  if (cuantosFaltan > 0 && resumen.vencidos > 0) return 'Te falta entregar documentos y renovar otros.';
  if (cuantosFaltan > 0) return 'A tu expediente le falta un documento obligatorio.';
  if (resumen.vencidos > 0) return 'Tienes documentos vencidos que hay que renovar.';
  if (resumen.por_vencer > 0) return 'Tu expediente está completo, pero algo está por vencer.';
  return 'Tu expediente está completo y al día.';
};

const MisDocumentosScreen = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState(null);

  useEffect(() => {
    let vigente = true;

    apiClient.get('/mis-documentos')
      .then((respuesta) => { if (vigente) setDatos(respuesta); })
      .catch(() => { if (vigente) setError('No se pudieron cargar tus documentos.'); })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, []);

  const abrir = async (doc) => {
    setDescargando(doc.id);
    try {
      const { url } = await apiClient.get(`/mis-documentos/${doc.id}/descargar`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showErrorToast('No se pudo abrir el documento. Intenta de nuevo.');
    } finally {
      setDescargando(null);
    }
  };

  if (cargando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center rounded-2xl bg-red-50 p-5 font-semibold text-red-700">
        <AlertTriangle className="mr-2 h-5 w-5" /> {error}
      </div>
    );
  }

  const { documentos = [], faltantes = [], resumen = {} } = datos || {};

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Mis Documentos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Los papeles que la compañía tiene en tu expediente y hasta cuándo valen.
        </p>
      </div>

      {/* Resumen: lo primero que el socio quiere saber es si esta en regla. */}
      <div
        className={`flex items-start gap-3 rounded-2xl border p-5 ${
          resumen.completo ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        {resumen.completo
          ? <ShieldCheck className="h-6 w-6 flex-shrink-0 text-green-600" />
          : <FileWarning className="h-6 w-6 flex-shrink-0 text-amber-600" />}
        <div>
          <p className={`font-bold ${resumen.completo ? 'text-green-800' : 'text-amber-800'}`}>
            {titularResumen(resumen, faltantes.length)}
          </p>
          <p className={`mt-0.5 text-sm ${resumen.completo ? 'text-green-700' : 'text-amber-700'}`}>
            Tienes {resumen.obligatorios_presentes} de {resumen.obligatorios_totales} documentos
            obligatorios
            {resumen.vencidos > 0 && `, ${resumen.vencidos} vencido${resumen.vencidos === 1 ? '' : 's'}`}
            {resumen.por_vencer > 0 && `, ${resumen.por_vencer} por vencer`}.
          </p>
        </div>
      </div>

      {faltantes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 font-bold text-slate-800">Te falta entregar</p>
          <ul className="space-y-2">
            {faltantes.map((f) => (
              <li key={f.tipo} className="flex items-center text-sm text-slate-600">
                <FileWarning className="mr-2 h-4 w-4 flex-shrink-0 text-amber-500" />
                {f.etiqueta}
                {f.unidad && <span className="ml-1 text-slate-400">· unidad {f.unidad}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Estos documentos se entregan en la oficina de la compañía.
          </p>
        </div>
      )}

      {documentos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-slate-200" />
          <p className="font-medium text-slate-500">Todavía no hay documentos en tu expediente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map((doc) => {
            const estilo = estiloDe(doc.estado);
            const Icono = estilo.icono;

            return (
              <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">
                        {doc.etiqueta}
                        {/* Es de su unidad, no suyo: lo ve porque tiene ese cupo hoy. */}
                        {doc.unidad && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            unidad {doc.unidad}
                          </span>
                        )}
                      </p>
                      {doc.obligatorio && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Obligatorio
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${estilo.chip}`}>
                        {doc.estado}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-500">{doc.nombre_documento}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {doc.numero_documento && <span>N.º {doc.numero_documento}</span>}
                      {doc.fecha_emision && <span>Emitido el {formatearFecha(doc.fecha_emision)}</span>}
                      {doc.fecha_vencimiento && <span>Vence el {formatearFecha(doc.fecha_vencimiento)}</span>}
                    </div>

                    {doc.estado !== 'Sin vencimiento' && (
                      <p className={`mt-2 flex items-center text-xs font-bold ${estilo.texto}`}>
                        <Icono className="mr-1 h-3.5 w-3.5" />
                        {textoPlazo(doc)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => abrir(doc)}
                    disabled={descargando === doc.id}
                    className="flex flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    {descargando === doc.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Download className="mr-2 h-4 w-4" />}
                    Ver
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MisDocumentosScreen;
