import { useCallback, useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Loader2, AlertCircle, X, Save, KeyRound, UserCheck, UserX, UserSearch, RotateCcw, Archive } from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { limitText, onlyDigits } from '../utils/inputFormatters';
import { apiClient, ApiError } from '../lib/apiClient';
import { useAuth } from '../features/auth/AuthContext';
import { isValidCedulaEc, isValidEmail, isValidNombrePersona, isValidTelefonoEc } from '../utils/validators';
import Paginacion from '../components/Paginacion';
import ColumnaOrdenable from '../components/ColumnaOrdenable';

const SociosScreen = () => {
  // ==========================================
  // ESTADOS
  // ==========================================
  const { role } = useAuth();
  const puedeGestionarCuentas = role === 'admin';
  const [socios, setSocios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // El servidor pagina y ordena: esta tabla crece con cada socio nuevo, y
  // ordenar en el navegador solo reacomodaria la pagina visible.
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [meta, setMeta] = useState(null);
  const [orden, setOrden] = useState({ campo: 'id', direccion: 'desc' });
  const [verEliminados, setVerEliminados] = useState(false);
  const [isRestaurando, setIsRestaurando] = useState(null);

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  // Se guarda el estado con el que abrio el modal para detectar si el
  // cambio actual es una transicion Activo -> Inactivo (eso exige motivo).
  const [editingEstadoOriginal, setEditingEstadoOriginal] = useState(null);
  const [motivoBaja, setMotivoBaja] = useState('');

  // Modal de confirmacion para eliminar (pide motivo obligatorio)
  const [socioAEliminar, setSocioAEliminar] = useState(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [isEliminando, setIsEliminando] = useState(false);

  // Estado inicial limpio (sin datos de vehículo)
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    correo: '',
    direccion: '',
    estado: 'Activo',
    observaciones: ''
  });

  // Modal de cuenta de acceso del socio
  const [cuentaSocio, setCuentaSocio] = useState(null);
  const [cuentaForm, setCuentaForm] = useState({ email: '', password: '' });
  const [cuentaError, setCuentaError] = useState('');
  const [isCuentaSubmitting, setIsCuentaSubmitting] = useState(false);

  // Buscador dedicado para localizar al socio antes de crearle la cuenta
  const [isBuscadorOpen, setIsBuscadorOpen] = useState(false);
  const [buscadorQuery, setBuscadorQuery] = useState('');
  const [buscadorResultados, setBuscadorResultados] = useState([]);
  const [buscadorLoading, setBuscadorLoading] = useState(false);
  const [buscadorHaBuscado, setBuscadorHaBuscado] = useState(false);

  // ==========================================
  // FUNCIONES DE API
  // ==========================================
  const fetchSocios = useCallback(async (query = '', eliminados = verEliminados) => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const base = eliminados ? `${API_URL}/socios/eliminados` : `${API_URL}/socios`;

      const params = new URLSearchParams({
        page: String(pagina),
        per_page: String(porPagina),
        sort: orden.campo,
        dir: orden.direccion,
      });
      if (query.trim()) params.set('search', query.trim());

      const response = await fetch(`${base}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const { data, ...paginacion } = await response.json();
        setSocios(data);
        setMeta(paginacion);
      } else {
        setError('Error al cargar los socios.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [verEliminados, pagina, porPagina, orden]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSocios(searchTerm, verEliminados);
    }, searchTerm ? 500 : 0);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchSocios, searchTerm, verEliminados]);

  // Quedarse en la pagina 7 despues de buscar algo que solo tiene dos
  // resultados mostraria una tabla vacia sin explicacion, asi que todo lo que
  // cambia el conjunto de filas vuelve al principio.
  const handleOrdenar = (nuevo) => { setOrden(nuevo); setPagina(1); };
  const handleTamano = (n) => { setPorPagina(n); setPagina(1); };
  const handleBuscar = (valor) => { setSearchTerm(valor); setPagina(1); };
  const handleVerEliminados = () => { setVerEliminados((v) => !v); setPagina(1); };

  const handleRestaurar = async (socio) => {
    if (!(await confirmDialog(`¿Reactivar a ${socio.nombre} con todo su historial?`))) return;
    setIsRestaurando(socio.id);
    try {
      await apiClient.put(`/socios/${socio.id}/restaurar`);
      setSocios((prev) => prev.filter((s) => s.id !== socio.id));
      showSuccessToast('Socio reactivado exitosamente.');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'No se pudo reactivar el socio.');
    } finally {
      setIsRestaurando(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      nombre: (input) => limitText(input, 80),
      cedula: (input) => onlyDigits(input, 10),
      telefono: (input) => onlyDigits(input, 10),
      correo: (input) => limitText(input, 100),
      direccion: (input) => limitText(input, 150),
      observaciones: (input) => limitText(input, 500),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const openCreateModal = () => {
    setFormData({
      nombre: '', cedula: '', telefono: '', correo: '',
      direccion: '', estado: 'Activo', observaciones: ''
    });
    setEditingId(null);
    setEditingEstadoOriginal(null);
    setMotivoBaja('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (socio) => {
    setFormData({
      nombre: socio.nombre,
      cedula: socio.cedula || '',
      telefono: socio.telefono || '',
      correo: socio.correo || '',
      direccion: socio.direccion || '',
      estado: socio.estado,
      observaciones: socio.observaciones || ''
    });
    setEditingId(socio.id);
    setEditingEstadoOriginal(socio.estado);
    setMotivoBaja('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Solo al editar (no al crear) y solo cuando de verdad se esta pasando
  // de Activo a Inactivo en este mismo guardado.
  const requiereMotivoBaja = editingId !== null && editingEstadoOriginal === 'Activo' && formData.estado === 'Inactivo';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    if (requiereMotivoBaja && motivoBaja.trim() === '') {
      setFormError('Debes indicar el motivo para dar de baja al socio.');
      setIsSubmitting(false);
      return;
    }

    if (!isValidNombrePersona(formData.nombre)) {
      setFormError('El nombre debe tener solo letras y espacios (sin números), entre 3 y 80 caracteres.');
      setIsSubmitting(false);
      return;
    }

    if (!isValidCedulaEc(formData.cedula.trim())) {
      setFormError('La cédula es obligatoria y debe ser válida: revisa que los 10 dígitos estén bien escritos.');
      setIsSubmitting(false);
      return;
    }

    if (!isValidTelefonoEc(formData.telefono.trim())) {
      setFormError('El teléfono es obligatorio: deben ser 10 dígitos y empezar en 0.');
      setIsSubmitting(false);
      return;
    }

    if (!isValidEmail(formData.correo.trim())) {
      setFormError('El correo es obligatorio y debe tener un formato válido.');
      setIsSubmitting(false);
      return;
    }

    const dataToSend = {
      ...formData,
      cedula: formData.cedula.trim() === '' ? null : formData.cedula,
      telefono: formData.telefono.trim() === '' ? null : formData.telefono,
      correo: formData.correo.trim() === '' ? null : formData.correo,
      direccion: formData.direccion.trim() === '' ? null : formData.direccion,
      observaciones: formData.observaciones.trim() === '' ? null : formData.observaciones,
      ...(requiereMotivoBaja ? { motivo_baja: motivoBaja } : {}),
    };

    const isEditing = editingId !== null;
    const url = isEditing ? `${API_URL}/socios/${editingId}` : `${API_URL}/socios`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditing) {
          setSocios(socios.map(s => s.id === editingId ? data.socio : s));
          showSuccessToast('Socio actualizado exitosamente.');
        } else {
          setSocios([data.socio, ...socios]);
          showSuccessToast('Socio registrado exitosamente.');
          window.dispatchEvent(new Event('notificacion_creada'));
        }
        setIsModalOpen(false);
      } else {
        if (data.errors) {
          setFormError(Object.values(data.errors)[0][0]);
        } else {
          setFormError(data.message || 'Error al guardar.');
        }
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEliminarModal = (socio) => {
    setSocioAEliminar(socio);
    setMotivoEliminar('');
  };

  const handleConfirmarEliminar = async (e) => {
    e.preventDefault();
    setIsEliminando(true);
    try {
      await apiClient.delete(`/socios/${socioAEliminar.id}`, { body: { motivo_baja: motivoEliminar } });
      setSocios(socios.filter((s) => s.id !== socioAEliminar.id));
      showSuccessToast('Socio eliminado exitosamente.');
      setSocioAEliminar(null);
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Error de conexión.');
    } finally {
      setIsEliminando(false);
    }
  };

  const openCuentaModal = (socio) => {
    setCuentaSocio(socio);
    setCuentaForm({ email: socio.correo || '', password: '' });
    setCuentaError('');
  };

  const closeCuentaModal = () => {
    setCuentaSocio(null);
    setCuentaError('');
  };

  const handleCrearCuenta = async (e) => {
    e.preventDefault();
    setIsCuentaSubmitting(true);
    setCuentaError('');

    try {
      const data = await apiClient.post(`/socios/${cuentaSocio.id}/cuenta`, cuentaForm);
      setSocios(socios.map((s) => (s.id === cuentaSocio.id ? data.socio : s)));
      showSuccessToast('Cuenta de acceso creada exitosamente.');
      closeCuentaModal();
    } catch (err) {
      const message = err instanceof ApiError
        ? Object.values(err.data?.errors || {})[0]?.[0] || err.message
        : 'Error de conexión.';
      setCuentaError(message);
    } finally {
      setIsCuentaSubmitting(false);
    }
  };

  const handleToggleCuenta = async (socio) => {
    const activar = !socio.cuenta_activa;
    const confirmMessage = activar
      ? `¿Reactivar el acceso de ${socio.nombre}?`
      : `¿Dar de baja el acceso de ${socio.nombre}? No podrá iniciar sesión hasta que lo reactives.`;

    if (!(await confirmDialog(confirmMessage))) return;

    try {
      const data = await apiClient.put(`/socios/${socio.id}/cuenta/estado`, { activa: activar });
      setSocios(socios.map((s) => (s.id === socio.id ? data.socio : s)));
      showSuccessToast(activar ? 'Cuenta activada exitosamente.' : 'Cuenta desactivada exitosamente.');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Error de conexión.');
    }
  };

  const openBuscador = () => {
    setBuscadorQuery('');
    setBuscadorResultados([]);
    setBuscadorHaBuscado(false);
    setIsBuscadorOpen(true);
  };

  const closeBuscador = () => setIsBuscadorOpen(false);

  // Al abrir el buscador se trae la lista completa de una vez (no hace falta
  // esperar a que se escriba nada); despues, digitar solo filtra en el
  // navegador, sin volver a pedirle nada al servidor por cada letra.
  useEffect(() => {
    if (!isBuscadorOpen) return;

    setBuscadorLoading(true);
    apiClient.get('/socios?select=1')
      .then((data) => setBuscadorResultados(data))
      .catch(() => setBuscadorResultados([]))
      .finally(() => {
        setBuscadorHaBuscado(true);
        setBuscadorLoading(false);
      });
  }, [isBuscadorOpen]);

  const buscadorMostrados = buscadorResultados.filter((socio) => {
    const query = buscadorQuery.trim().toLowerCase();
    if (query === '') return true;
    return (socio.nombre || '').toLowerCase().includes(query) || (socio.cedula || '').includes(query);
  });

  const handleSeleccionarDeBuscador = (socio) => {
    if (socio.user_id) return; // ya tiene cuenta, no hacemos nada al hacer click
    closeBuscador();
    openCuentaModal(socio);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 relative">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Gestión de Socios</h2>
          <p className="text-slate-500 mt-1">Administra los accionistas, control de estados financieros y observaciones.</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" value={searchTerm} onChange={(e) => handleBuscar(e.target.value)}
              placeholder="Buscar socio, cédula..." 
              className="w-full sm:w-72 pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            />
          </div>
          {puedeGestionarCuentas && (
            <button onClick={openBuscador} className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
              <UserSearch className="w-5 h-5 mr-2" /> Crear Cuenta de Socio
            </button>
          )}
          <button
            onClick={handleVerEliminados}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl font-bold flex items-center justify-center transition-colors shadow-sm border ${
              verEliminados ? 'bg-slate-900 text-yellow-400 border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-5 h-5 mr-2" /> {verEliminados ? 'Ver Activos' : 'Ver Eliminados'}
          </button>
          {!verEliminados && (
            <button onClick={openCreateModal} className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-4 py-2 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md">
              <Plus className="w-5 h-5 mr-2" /> Nuevo Socio
            </button>
          )}
        </div>
      </div>

      {verEliminados && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg text-sm text-amber-800 font-medium">
          Mostrando socios dados de baja. Su historial de aportaciones y vehículos se conserva intacto y se recupera al reactivarlos.
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Tabla Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <ColumnaOrdenable campo="nombre" orden={orden} onOrdenar={handleOrdenar}>Nombre Accionista</ColumnaOrdenable>
                <ColumnaOrdenable campo="cedula" orden={orden} onOrdenar={handleOrdenar}>Cédula</ColumnaOrdenable>
                <th className="p-4">Contacto</th>
                <ColumnaOrdenable campo="estado" orden={orden} onOrdenar={handleOrdenar}>Estado Pago</ColumnaOrdenable>
                <th className="p-4">Cuenta de Acceso</th>
                <th className="p-4">Observaciones</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-yellow-500" />Buscando...</td>
                </tr>
              ) : socios.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">No se encontraron registros.</td>
                </tr>
              ) : (
                socios.map((socio) => (
                  <tr 
                    key={socio.id} 
                    className={`transition-colors ${socio.estado_pago_actual === 'En mora' ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="p-4 font-bold text-slate-900">{socio.nombre}</td>
                    <td className="p-4 font-medium">{socio.cedula || '---'}</td>
                    <td className="p-4 font-medium">{socio.telefono || '---'}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        socio.estado_pago_actual === 'Al día' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'
                      }`}>
                        {socio.estado_pago_actual}
                      </span>
                    </td>
                    <td className="p-4">
                      {socio.user_id ? (
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          socio.cuenta_activa ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {socio.cuenta_activa ? 'Activa' : 'Dada de baja'}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Sin cuenta</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs truncate">
                      {socio.observaciones ? (
                        <span className="text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 block truncate" title={socio.observaciones}>
                          {socio.observaciones}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Sin observaciones</span>
                      )}
                    </td>
                    <td className="p-4 flex justify-center space-x-2">
                      {verEliminados ? (
                        <button
                          onClick={() => handleRestaurar(socio)}
                          disabled={isRestaurando === socio.id}
                          title="Reactivar socio"
                          className="px-3 py-1.5 text-xs font-bold rounded-lg flex items-center text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          {isRestaurando === socio.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                          Reactivar
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openEditModal(socio)} title="Editar" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                          {puedeGestionarCuentas && (
                            socio.user_id ? (
                              <button
                                onClick={() => handleToggleCuenta(socio)}
                                title={socio.cuenta_activa ? 'Dar de baja la cuenta' : 'Reactivar la cuenta'}
                                className={`p-2 rounded-lg transition-colors ${
                                  socio.cuenta_activa ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {socio.cuenta_activa ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
                            ) : (
                              <button onClick={() => openCuentaModal(socio)} title="Crear cuenta de acceso" className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )
                          )}
                          <button onClick={() => openEliminarModal(socio)} title="Eliminar" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion meta={meta} onCambiarPagina={setPagina} onCambiarTamano={handleTamano} />
      </div>

      {/* MODAL DE REGISTRO / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{editingId ? 'Editar Socio' : 'Registrar Nuevo Socio'}</h3>
                <p className="text-slate-500 mt-1">Complete la información personal y de contacto del socio</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 pt-4 sm:p-6 sm:pt-4">
              {formError && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{formError}</div>
              )}

              <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Nombre Completo</label>
                    <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} required maxLength="80" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" placeholder="Ej. Juan Pérez" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Cédula</label>
                    <input type="text" name="cedula" value={formData.cedula} onChange={handleInputChange} required inputMode="numeric" pattern="[0-9]{10}" maxLength="10" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" placeholder="Cedula de 10 digitos" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Estado de Afiliación</label>
                    <select name="estado" value={formData.estado} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 bg-white">
                      <option value="Activo">🟢 Activo</option>
                      <option value="Inactivo">🔴 Inactivo</option>
                    </select>
                  </div>
                </div>

                {requiereMotivoBaja && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-amber-800 mb-1">Motivo de la baja (obligatorio)</label>
                    <textarea
                      value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)}
                      required rows="2" maxLength="300"
                      placeholder="Ej. Vendió su cupo a otro socio / Se retiró voluntariamente de la cooperativa..."
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 resize-none"
                    />
                    <p className="text-xs text-amber-700 mt-1">Se guardará en las observaciones del socio, con la fecha de hoy.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Teléfono</label>
                    <input type="text" name="telefono" value={formData.telefono} onChange={handleInputChange} required inputMode="numeric" pattern="[0-9]{10}" maxLength="10" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" placeholder="Telefono de 10 digitos" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Correo</label>
                    <input type="email" name="correo" value={formData.correo} onChange={handleInputChange} required maxLength="100" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" placeholder="correo@ejemplo.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Dirección (Opcional)</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} maxLength="150" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700" placeholder="Dirección completa" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Observaciones del Expediente (Opcional)</label>
                  <textarea 
                    name="observaciones" value={formData.observaciones} onChange={handleInputChange} rows="2" maxLength="500"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 resize-none"
                    placeholder="Ej. Vendió el puesto a X persona / Cupo retirado provisionalmente..."
                  />
                </div>

              </div>

              <div className="mt-6">
                <button 
                  type="submit" disabled={isSubmitting}
                  className={`w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center transition-colors shadow-md
                    ${isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'}`}
                >
                  {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5 mr-2" /> {editingId ? 'Guardar Cambios' : 'Registrar Socio'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUSCADOR: localizar al socio antes de crearle la cuenta */}
      {isBuscadorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Crear Cuenta de Socio</h3>
                <p className="text-slate-500 mt-1 text-sm">Busca al socio por nombre o cédula. Debe estar registrado en el sistema.</p>
              </div>
              <button onClick={closeBuscador} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-4 pt-2 sm:p-6 sm:pt-2">
              <div className="relative mb-4">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" autoFocus value={buscadorQuery} onChange={(e) => setBuscadorQuery(e.target.value)}
                  placeholder="Nombre o cédula del socio..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-slate-50"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {buscadorLoading ? (
                  <div className="text-center text-slate-500 py-6"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />Cargando socios...</div>
                ) : buscadorHaBuscado && buscadorMostrados.length === 0 ? (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 font-medium">
                      {buscadorQuery.trim() === '' ? 'No hay socios registrados todavía.' : 'Este socio no está registrado en el sistema. Regístralo primero con "Nuevo Socio".'}
                    </p>
                  </div>
                ) : (
                  buscadorMostrados.map((socio) => (
                    <button
                      key={socio.id}
                      type="button"
                      onClick={() => handleSeleccionarDeBuscador(socio)}
                      disabled={Boolean(socio.user_id)}
                      className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        socio.user_id ? 'border-slate-100 bg-slate-50 cursor-not-allowed' : 'border-slate-200 hover:border-yellow-400 hover:bg-yellow-50'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{socio.nombre}</p>
                        <p className="text-xs text-slate-500">{socio.cedula || 'Sin cédula registrada'}</p>
                      </div>
                      {socio.user_id ? (
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${socio.cuenta_activa ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                          {socio.cuenta_activa ? 'Ya tiene cuenta' : 'Cuenta dada de baja'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">Sin cuenta</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CREACIÓN DE CUENTA DE ACCESO */}
      {cuentaSocio && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Crear Cuenta de Acceso</h3>
                <p className="text-slate-500 mt-1 text-sm">Para {cuentaSocio.nombre}. El socio usará estas credenciales para su portal.</p>
              </div>
              <button onClick={closeCuentaModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleCrearCuenta} className="p-4 pt-4 sm:p-6 sm:pt-4 space-y-4">
              {cuentaError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{cuentaError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Correo de acceso</label>
                <input
                  type="email" required maxLength="100"
                  value={cuentaForm.email}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                  placeholder="socio@correo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Contraseña inicial</label>
                <input
                  type="password" required minLength="8" maxLength="100"
                  value={cuentaForm.password}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <button
                type="submit" disabled={isCuentaSubmitting}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md
                  ${isCuentaSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#FFCC00] text-slate-900 hover:bg-yellow-500'}`}
              >
                {isCuentaSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando...</> : <><KeyRound className="w-5 h-5 mr-2" /> Crear Cuenta</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ELIMINAR: pide el motivo antes de confirmar */}
      {socioAEliminar && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-start p-4 pb-2 sm:p-6 sm:pb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Eliminar Socio</h3>
                <p className="text-slate-500 mt-1 text-sm">
                  {socioAEliminar.nombre} podrá reactivarse después desde "Ver Eliminados", con su historial intacto.
                </p>
              </div>
              <button onClick={() => setSocioAEliminar(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleConfirmarEliminar} className="p-4 pt-4 sm:p-6 sm:pt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo de la eliminación</label>
                <textarea
                  value={motivoEliminar} onChange={(e) => setMotivoEliminar(e.target.value)}
                  required maxLength="300" rows="3" autoFocus
                  placeholder="Ej. Registro duplicado / Nunca llegó a afiliarse..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-slate-700 resize-none"
                />
              </div>
              <button
                type="submit" disabled={isEliminando}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md ${
                  isEliminando ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isEliminando ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Eliminando...</> : <><Trash2 className="w-5 h-5 mr-2" /> Confirmar Eliminación</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SociosScreen;
