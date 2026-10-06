import { useEffect, useState } from 'react';
import { hoyLocal } from '../utils/fechas';
import { ArrowRightLeft, Loader2, Save, X } from 'lucide-react';
import { apiClient, ApiError } from '../lib/apiClient';
import { showSuccessToast } from '../utils/feedback';

const formatearFecha = (fecha) => (fecha ? new Date(`${fecha}T00:00:00`).toLocaleDateString() : '—');

const mensajeDeError = (err, respaldo) => {
  if (!(err instanceof ApiError)) return 'Error de conexión con el servidor.';
  if (err.data?.errors) {
    return Object.values(err.data.errors).flat().join(' ');
  }
  return err.data?.message || respaldo;
};

/**
 * Historial de a quien pertenecio un cupo, y el formulario para traspasarlo.
 *
 * Es la unica forma de cambiar el dueño de una unidad: el formulario de
 * vehiculos ya no lo permite, para que el historial no pueda quedar mintiendo.
 */
const TraspasoDeCupo = ({ vehiculo, socios, onCerrar, onTraspasoHecho }) => {
  const [historial, setHistorial] = useState([]);
  const [socioActual, setSocioActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Subirlo vuelve a disparar el efecto de carga.
  const [recargas, setRecargas] = useState(0);

  const [formulario, setFormulario] = useState({
    socio_nuevo_id: '',
    fecha_traspaso: hoyLocal(),
    numero_resolucion: '',
    observaciones: '',
    expediente_id: '',
    sin_acta: false,
  });

  // Un cupo no cambia de dueño de palabra: el acta es la prueba. Se ofrecen
  // las del socio que entrega y las del que recibe, que son las unicas que el
  // servidor acepta.
  const [actas, setActas] = useState([]);

  // La carga vive dentro del efecto y el estado se toca solo en los callbacks:
  // asi no hay setState sincrono al montar. `vigente` descarta una respuesta que
  // llegue despues de cerrar el modal, que si no avisaria sobre algo ya cerrado.
  useEffect(() => {
    let vigente = true;

    apiClient.get(`/vehiculos/${vehiculo.id}/traspasos`)
      .then((datos) => {
        if (!vigente) return;
        setHistorial(datos.traspasos || []);
        setSocioActual(datos.unidad?.socio_actual || null);
      })
      .catch(() => { if (vigente) setError('No se pudo cargar el historial de la unidad.'); })
      .finally(() => { if (vigente) setCargando(false); });

    Promise.all([
      apiClient.get('/expedientes?tipo=cambio_socio'),
      apiClient.get('/expedientes?tipo=cesion'),
    ])
      .then(([cambios, cesiones]) => { if (vigente) setActas([...cambios, ...cesiones]); })
      .catch(() => {});

    return () => { vigente = false; };
  }, [vehiculo.id, recargas]);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      const respuesta = await apiClient.post(`/vehiculos/${vehiculo.id}/traspasos`, {
        ...formulario,
        numero_resolucion: formulario.numero_resolucion.trim() || null,
        observaciones: formulario.observaciones.trim() || null,
        expediente_id: formulario.sin_acta ? null : (formulario.expediente_id || null),
      });
      showSuccessToast(respuesta.message || 'Traspaso registrado.');
      setFormulario((f) => ({ ...f, socio_nuevo_id: '', numero_resolucion: '', observaciones: '', expediente_id: '', sin_acta: false }));
      setRecargas((n) => n + 1);
      onTraspasoHecho?.();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar el traspaso.'));
    } finally {
      setEnviando(false);
    }
  };

  // El dueño actual no puede recibir su propia unidad.
  const candidatos = socios.filter((s) => s.id !== (socioActual?.id ?? vehiculo.socio_id));

  // El servidor solo acepta el acta si es del que entrega o del que recibe.
  const implicados = [socioActual?.id ?? vehiculo.socio_id, Number(formulario.socio_nuevo_id)];
  const actasCandidatas = actas.filter((a) => implicados.includes(a.socio_id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="flex items-center text-lg font-bold text-slate-800">
              <ArrowRightLeft className="mr-2 h-5 w-5 text-yellow-500" />
              Traspaso de la unidad {vehiculo.numero_vehiculo}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Placa {vehiculo.placa} · Hoy pertenece a{' '}
              <span className="font-semibold text-slate-700">{socioActual?.nombre ?? '—'}</span>
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5">
          <form onSubmit={enviar} className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-bold text-slate-700">Registrar un traspaso</p>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Nuevo socio
                <select
                  required
                  value={formulario.socio_nuevo_id}
                  onChange={(e) => setFormulario((f) => ({ ...f, socio_nuevo_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Selecciona a quién pasa la unidad…</option>
                  {candidatos.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre} {s.cedula ? `(C.I: ${s.cedula})` : ''}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Fecha del acta
                <input
                  type="date"
                  required
                  max={hoyLocal()}
                  value={formulario.fecha_traspaso}
                  onChange={(e) => setFormulario((f) => ({ ...f, fecha_traspaso: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                N° de resolución
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Opcional"
                  value={formulario.numero_resolucion}
                  onChange={(e) => setFormulario((f) => ({ ...f, numero_resolucion: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 sm:col-span-2">
                Acta de cambio de socio
                {formulario.sin_acta ? (
                  <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-normal normal-case text-amber-700">
                    Quedará registrado como un traspaso sin respaldo documental. El panel lleva la cuenta.
                  </p>
                ) : (
                  <select
                    value={formulario.expediente_id}
                    onChange={(e) => setFormulario((f) => ({ ...f, expediente_id: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="">-- Selecciona el documento --</option>
                    {actasCandidatas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre_documento} ({a.tipo_etiqueta})
                      </option>
                    ))}
                  </select>
                )}
                <span className="mt-1 flex items-center gap-2 text-[11px] font-normal normal-case text-slate-500">
                  <input
                    type="checkbox"
                    checked={formulario.sin_acta}
                    onChange={(e) => setFormulario((f) => ({ ...f, sin_acta: e.target.checked, expediente_id: '' }))}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  No está digitalizada
                </span>
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Observaciones
                <input
                  type="text"
                  maxLength={500}
                  placeholder={formulario.sin_acta ? '¿Por qué no hay acta?' : 'Opcional'}
                  required={formulario.sin_acta}
                  value={formulario.observaciones}
                  onChange={(e) => setFormulario((f) => ({ ...f, observaciones: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 font-bold text-yellow-400 shadow-md hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
            >
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Registrar traspaso
            </button>
          </form>

          <p className="mb-3 text-sm font-bold text-slate-700">Historial de la unidad</p>

          {cargando ? (
            <div className="py-8 text-center text-slate-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-500" />
              Cargando historial…
            </div>
          ) : historial.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Esta unidad todavía no tiene movimientos registrados.</p>
          ) : (
            <ol className="space-y-3">
              {historial.map((t) => (
                <li key={t.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-800">
                      {t.socio_anterior
                        ? <>De <span className="text-slate-600">{t.socio_anterior.nombre}</span> a <span className="text-slate-900">{t.socio_nuevo?.nombre}</span></>
                        : <>Asignación inicial a <span className="text-slate-900">{t.socio_nuevo?.nombre}</span></>}
                    </p>
                    <span className="text-xs font-bold text-slate-500">{formatearFecha(t.fecha_traspaso)}</span>
                  </div>
                  {(t.numero_resolucion || t.observaciones) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t.numero_resolucion && <>Resolución {t.numero_resolucion}. </>}
                      {t.observaciones}
                    </p>
                  )}
                  {t.registrado_por?.name && (
                    <p className="mt-1 text-[11px] text-slate-400">Registrado por {t.registrado_por.name}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraspasoDeCupo;
