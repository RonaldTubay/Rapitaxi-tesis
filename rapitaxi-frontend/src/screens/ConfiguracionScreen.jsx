import { useState, useEffect } from 'react';
import { Settings, BellRing, Wrench, Save, Loader2, Building2 } from 'lucide-react';
import { areToastsEnabled, setToastsEnabled, showSuccessToast, showErrorToast } from '../utils/feedback';
import { apiClient, ApiError } from '../lib/apiClient';
import { onlyDigits } from '../utils/inputFormatters';
import { obtenerEmpresa, recordarEmpresa } from '../hooks/useEmpresa';
import { hoyLocal } from '../utils/fechas';

// Un campo de los datos de la compania. El error llega del 422 del backend: el
// del RUC es justamente el que hay que poder leer.
const CampoEmpresa = ({ etiqueta, valor, onChange, error, ayuda, ...props }) => (
  <label className="block">
    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</span>
    <input
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`mt-1 w-full rounded-xl border px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 ${
        error
          ? 'border-red-300 bg-red-50 focus:ring-red-300'
          : 'border-slate-100 bg-slate-50 focus:ring-yellow-400'
      }`}
      {...props}
    />
    {error
      ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      : ayuda && <span className="mt-1 block text-xs text-slate-400">{ayuda}</span>}
  </label>
);

const ConfiguracionScreen = () => {
  const [toastEnabled, setToastEnabled] = useState(areToastsEnabled());
  const [empresa, setEmpresa] = useState(null);
  const [isLoadingEmpresa, setIsLoadingEmpresa] = useState(true);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [erroresEmpresa, setErroresEmpresa] = useState({});
  const [frecuencias, setFrecuencias] = useState([]);
  const [isLoadingFrecuencias, setIsLoadingFrecuencias] = useState(true);
  const [isSavingFrecuencias, setIsSavingFrecuencias] = useState(false);

  useEffect(() => {
    apiClient.get('/configuraciones-mantenimiento')
      .then((data) => setFrecuencias(data))
      .catch(() => showErrorToast('No se pudieron cargar las frecuencias de mantenimiento.'))
      .finally(() => setIsLoadingFrecuencias(false));
  }, []);

  useEffect(() => {
    obtenerEmpresa()
      .then((datos) => setEmpresa({ ...datos }))
      .catch(() => showErrorToast('No se pudieron cargar los datos de la compañía.'))
      .finally(() => setIsLoadingEmpresa(false));
  }, []);

  const handleEmpresaChange = (campo, valor) => {
    setEmpresa((actual) => ({ ...actual, [campo]: valor }));
    setErroresEmpresa((actuales) => ({ ...actuales, [campo]: undefined }));
  };

  const guardarEmpresa = async () => {
    setIsSavingEmpresa(true);
    setErroresEmpresa({});
    try {
      const data = await apiClient.put('/empresa', {
        razon_social: empresa?.razon_social ?? '',
        ruc: empresa?.ruc || null,
        permiso_operacion: empresa?.permiso_operacion || null,
        fecha_permiso_operacion: empresa?.fecha_permiso_operacion || null,
        fecha_caducidad_permiso: empresa?.fecha_caducidad_permiso || null,
        direccion: empresa?.direccion || null,
        ciudad: empresa?.ciudad || null,
        provincia: empresa?.provincia || null,
        parroquia: empresa?.parroquia || null,
        clase_transporte: empresa?.clase_transporte || null,
        ambito_servicio: empresa?.ambito_servicio || null,
        tipo_servicio: empresa?.tipo_servicio || null,
        telefono: empresa?.telefono || null,
        email: empresa?.email || null,
        gerente: empresa?.gerente || null,
        secretario: empresa?.secretario || null,
      });
      setEmpresa({ ...data.empresa });
      // Sin esto el encabezado del panel seguiria mostrando la razon social
      // anterior hasta recargar la pagina.
      recordarEmpresa(data.empresa);
      showSuccessToast(data.message);
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        setErroresEmpresa(err.data.errors);
        showErrorToast('Revisa los campos marcados.');
      } else {
        showErrorToast(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos.');
      }
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  const handleToastToggle = (enabled) => {
    setToastEnabled(enabled);
    setToastsEnabled(enabled);
    if (enabled) showSuccessToast('Notificaciones emergentes activadas.');
  };

  const handleFrecuenciaChange = (id, campo, valor) => {
    setFrecuencias((actuales) => actuales.map((config) => (
      config.id === id ? { ...config, [campo]: onlyDigits(valor, 3) } : config
    )));
  };

  const guardarFrecuencias = async () => {
    setIsSavingFrecuencias(true);
    try {
      const data = await apiClient.put('/configuraciones-mantenimiento', {
        configuraciones: frecuencias.map(({ id, meses_frecuencia, dias_anticipacion }) => ({
          id,
          meses_frecuencia: Number(meses_frecuencia),
          dias_anticipacion: Number(dias_anticipacion),
        })),
      });
      setFrecuencias(data.configuraciones);
      showSuccessToast(data.message);
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'No se pudieron guardar las frecuencias.');
    } finally {
      setIsSavingFrecuencias(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center">
          <Settings className="w-8 h-8 mr-3 text-slate-700" /> Ajustes del Sistema
        </h2>
        <p className="text-slate-500 mt-1">
          Preferencias generales de la aplicacion administrativa.
        </p>
      </div>

      {/* Datos de la compania. Estaban escritos a mano en el dashboard y en el
          cuadro maestro, asi que instalarlo en otra cooperativa obligaba a
          editar el codigo fuente. */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-4xl mb-6">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-yellow-500" /> Datos de la compañía
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Encabezan el panel y el cuadro maestro de flota. Los nombres de gerencia y secretaría salen al pie de los documentos impresos.
          </p>
        </div>

        {isLoadingEmpresa ? (
          <div className="p-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-yellow-500" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <CampoEmpresa
                  etiqueta="Razón social"
                  valor={empresa?.razon_social}
                  onChange={(v) => handleEmpresaChange('razon_social', v)}
                  error={erroresEmpresa.razon_social?.[0]}
                  ayuda="Como debe aparecer en los documentos oficiales."
                  maxLength="150"
                />
              </div>
              <CampoEmpresa
                etiqueta="RUC"
                valor={empresa?.ruc}
                onChange={(v) => handleEmpresaChange('ruc', onlyDigits(v, 13))}
                error={erroresEmpresa.ruc?.[0]}
                ayuda="13 dígitos."
                inputMode="numeric"
              />
              <CampoEmpresa
                etiqueta="Permiso de operación"
                valor={empresa?.permiso_operacion}
                onChange={(v) => handleEmpresaChange('permiso_operacion', v)}
                error={erroresEmpresa.permiso_operacion?.[0]}
                maxLength="60"
              />
              <CampoEmpresa
                etiqueta="Fecha del permiso"
                valor={empresa?.fecha_permiso_operacion}
                onChange={(v) => handleEmpresaChange('fecha_permiso_operacion', v)}
                error={erroresEmpresa.fecha_permiso_operacion?.[0]}
                type="date"
                max={hoyLocal()}
              />
              <CampoEmpresa
                etiqueta="Caduca el"
                valor={empresa?.fecha_caducidad_permiso}
                onChange={(v) => handleEmpresaChange('fecha_caducidad_permiso', v)}
                error={erroresEmpresa.fecha_caducidad_permiso?.[0]}
                ayuda="Si caduca, deja de operar la compañía entera. Se avisa con 6 meses."
                type="date"
              />
              <CampoEmpresa
                etiqueta="Dirección"
                valor={empresa?.direccion}
                onChange={(v) => handleEmpresaChange('direccion', v)}
                error={erroresEmpresa.direccion?.[0]}
                maxLength="200"
              />
              <CampoEmpresa
                etiqueta="Ciudad / cantón"
                valor={empresa?.ciudad}
                onChange={(v) => handleEmpresaChange('ciudad', v)}
                error={erroresEmpresa.ciudad?.[0]}
                maxLength="80"
              />
              <CampoEmpresa
                etiqueta="Provincia"
                valor={empresa?.provincia}
                onChange={(v) => handleEmpresaChange('provincia', v)}
                error={erroresEmpresa.provincia?.[0]}
                maxLength="60"
              />
              <CampoEmpresa
                etiqueta="Parroquia"
                valor={empresa?.parroquia}
                onChange={(v) => handleEmpresaChange('parroquia', v)}
                error={erroresEmpresa.parroquia?.[0]}
                maxLength="80"
              />
              <CampoEmpresa
                etiqueta="Clase de transporte"
                valor={empresa?.clase_transporte}
                onChange={(v) => handleEmpresaChange('clase_transporte', v)}
                error={erroresEmpresa.clase_transporte?.[0]}
                ayuda="Como figura en el acta. Ej: Comercial."
                maxLength="40"
              />
              <CampoEmpresa
                etiqueta="Ámbito del servicio"
                valor={empresa?.ambito_servicio}
                onChange={(v) => handleEmpresaChange('ambito_servicio', v)}
                error={erroresEmpresa.ambito_servicio?.[0]}
                ayuda="Ej: Intracantonal combinado."
                maxLength="60"
              />
              <CampoEmpresa
                etiqueta="Tipo de servicio"
                valor={empresa?.tipo_servicio}
                onChange={(v) => handleEmpresaChange('tipo_servicio', v)}
                error={erroresEmpresa.tipo_servicio?.[0]}
                ayuda="Ej: Taxi convencional."
                maxLength="60"
              />
              <CampoEmpresa
                etiqueta="Teléfono"
                valor={empresa?.telefono}
                onChange={(v) => handleEmpresaChange('telefono', v)}
                error={erroresEmpresa.telefono?.[0]}
                inputMode="tel"
                maxLength="20"
              />
              <CampoEmpresa
                etiqueta="Correo"
                valor={empresa?.email}
                onChange={(v) => handleEmpresaChange('email', v)}
                error={erroresEmpresa.email?.[0]}
                inputMode="email"
                maxLength="150"
              />
              <CampoEmpresa
                etiqueta="Gerente general"
                valor={empresa?.gerente}
                onChange={(v) => handleEmpresaChange('gerente', v)}
                error={erroresEmpresa.gerente?.[0]}
                ayuda="Firma al pie del cuadro maestro."
                maxLength="80"
              />
              <CampoEmpresa
                etiqueta="Secretario/a"
                valor={empresa?.secretario}
                onChange={(v) => handleEmpresaChange('secretario', v)}
                error={erroresEmpresa.secretario?.[0]}
                ayuda="Firma al pie del cuadro maestro."
                maxLength="80"
              />
            </div>

            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={guardarEmpresa}
                disabled={isSavingEmpresa}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isSavingEmpresa ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'
                }`}
              >
                {isSavingEmpresa
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
                  : <><Save className="w-5 h-5 mr-2" /> Guardar datos</>}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-4xl divide-y divide-slate-100">
        <div className="p-4 sm:p-6 bg-white flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center">
              <BellRing className="w-5 h-5 mr-2 text-yellow-500" /> Notificaciones emergentes
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Activa o desactiva los mensajes breves que aparecen al completar acciones exitosas.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3">
            <span className="text-sm font-bold text-slate-600">{toastEnabled ? 'Activadas' : 'Desactivadas'}</span>
            <input
              type="checkbox"
              checked={toastEnabled}
              onChange={(e) => handleToastToggle(e.target.checked)}
              className="sr-only peer"
            />
            <span className="relative h-7 w-12 rounded-full bg-slate-200 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#FFCC00] peer-checked:after:translate-x-5"></span>
          </label>
        </div>
      </div>

      {/* Frecuencias de mantenimiento: de aqui sale el aviso que cada socio
          ve en su portal para cada una de sus unidades. */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-4xl mt-6">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-yellow-500" /> Frecuencia de mantenimientos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada cuánto le toca a una unidad cada trabajo, y con cuántos días de anticipación avisarle al socio en su portal.
          </p>
        </div>

        {isLoadingFrecuencias ? (
          <div className="p-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-yellow-500" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
                    <th className="p-4">Tipo de trabajo</th>
                    <th className="p-4 w-48">Cada cuántos meses</th>
                    <th className="p-4 w-48">Avisar con (días)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {frecuencias.map((config) => (
                    <tr key={config.id}>
                      <td className="p-4 font-semibold text-slate-700">{config.tipo_mantenimiento}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text" inputMode="numeric" maxLength="2"
                            value={config.meses_frecuencia}
                            onChange={(e) => handleFrecuenciaChange(config.id, 'meses_frecuencia', e.target.value)}
                            className="w-20 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 font-bold text-center"
                          />
                          <span className="text-xs text-slate-400">meses</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text" inputMode="numeric" maxLength="3"
                            value={config.dias_anticipacion}
                            onChange={(e) => handleFrecuenciaChange(config.id, 'dias_anticipacion', e.target.value)}
                            className="w-20 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 font-bold text-center"
                          />
                          <span className="text-xs text-slate-400">días antes</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={guardarFrecuencias}
                disabled={isSavingFrecuencias}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isSavingFrecuencias ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'
                }`}
              >
                {isSavingFrecuencias
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
                  : <><Save className="w-5 h-5 mr-2" /> Guardar frecuencias</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfiguracionScreen;
