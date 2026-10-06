import { useCallback, useEffect, useState } from 'react';
import Paginacion from '../components/Paginacion';
import ColumnaOrdenable from '../components/ColumnaOrdenable';
import { AlertCircle, Edit, Loader2, Plus, Save, Search, Trash2, UserPlus, X } from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { limitText } from '../utils/inputFormatters';
import { apiClient, ApiError } from '../lib/apiClient';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'operador',
};

const UsuariosScreen = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const getErrorMessage = (err, fallback = 'No se pudo completar la accion.') => {
    if (!(err instanceof ApiError)) return 'Error de conexion con el servidor.';

    if (err.data?.errors) {
      const labels = { name: 'Nombre', email: 'Correo', password: 'Contrasena', role: 'Rol' };
      return Object.entries(err.data.errors)
        .map(([field, messages]) => `${labels[field] || field}: ${messages.join(' ')}`)
        .join(' ');
    }

    return err.data?.message || err.message || fallback;
  };

  // El servidor pagina y ordena.
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [meta, setMeta] = useState(null);
  const [orden, setOrden] = useState({ campo: 'name', direccion: 'asc' });

  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(pagina),
        per_page: String(porPagina),
        sort: orden.campo,
        dir: orden.direccion,
      });
      const { data, ...paginacion } = await apiClient.get(`/usuarios?${params}`);
      setUsuarios(data);
      setMeta(paginacion);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar los usuarios.'));
    } finally {
      setIsLoading(false);
    }
  }, [pagina, porPagina, orden]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  // Reordenar o cambiar el tamaño de pagina vuelve al principio.
  const handleOrdenar = (nuevo) => { setOrden(nuevo); setPagina(1); };
  const handleTamano = (n) => { setPorPagina(n); setPagina(1); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      name: (input) => limitText(input, 80),
      email: (input) => limitText(input, 100).toLowerCase(),
      password: (input) => limitText(input, 100),
    };

    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (usuario) => {
    setEditingId(usuario.id);
    setFormData({ name: usuario.name || '', email: usuario.email || '', password: '', role: usuario.role || 'operador' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    const isEditing = editingId !== null;
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
    };

    if (isEditing && payload.password.trim() === '') delete payload.password;

    try {
      const data = isEditing
        ? await apiClient.put(`/usuarios/${editingId}`, payload)
        : await apiClient.post('/usuarios', payload);

      if (isEditing) {
        setUsuarios(usuarios.map((usuario) => (usuario.id === editingId ? data.usuario : usuario)));
        showSuccessToast('Usuario actualizado exitosamente.');
      } else {
        setUsuarios([data.usuario, ...usuarios]);
        showSuccessToast('Usuario creado exitosamente.');
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Error al guardar el usuario.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (usuario) => {
    if (!(await confirmDialog(`¿Eliminar el usuario ${usuario.email}?`))) return;

    try {
      await apiClient.delete(`/usuarios/${usuario.id}`);
      setUsuarios(usuarios.filter((item) => item.id !== usuario.id));
      showSuccessToast('Usuario eliminado exitosamente.');
    } catch (err) {
      showErrorToast(getErrorMessage(err, 'Error al eliminar el usuario.'));
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const query = searchTerm.toLowerCase();
    return usuario.name.toLowerCase().includes(query) || usuario.email.toLowerCase().includes(query);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center text-2xl font-bold text-slate-800 sm:text-3xl">
            <UserPlus className="mr-3 h-8 w-8 text-slate-700" /> Usuarios del Sistema
          </h2>
          <p className="mt-1 text-slate-500">Administra los accesos al panel administrativo.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar usuario..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-yellow-400 sm:w-72" />
          </div>
          <button onClick={openCreateModal} className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 font-bold text-yellow-400 shadow-md transition-colors hover:bg-slate-800 sm:w-auto">
            <Plus className="mr-2 h-5 w-5" /> Nuevo Usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start rounded-r-lg border-l-4 border-red-500 bg-red-50 p-4">
          <AlertCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <ColumnaOrdenable campo="name" orden={orden} onOrdenar={handleOrdenar}>Nombre</ColumnaOrdenable>
                <ColumnaOrdenable campo="email" orden={orden} onOrdenar={handleOrdenar}>Correo</ColumnaOrdenable>
                <th className="p-4">Rol</th>
                <ColumnaOrdenable campo="created_at" orden={orden} onOrdenar={handleOrdenar}>Creado</ColumnaOrdenable>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-yellow-500" /> Cargando...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No se encontraron usuarios.</td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{usuario.name}</td>
                    <td className="p-4 font-medium">{usuario.email}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        usuario.role === 'admin' ? 'bg-slate-900 text-yellow-400' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ROLE_LABELS[usuario.role] || usuario.role}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">{new Date(usuario.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(usuario)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Editar">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(usuario)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion meta={meta} onCambiarPagina={setPagina} onCambiarTamano={handleTamano} />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 p-4 sm:p-6">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="h-6 w-6 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
              {formError && (
                <div className="flex items-center rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">
                  <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" /> {formError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Nombre</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required maxLength="80" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Correo</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required maxLength="100" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Rol</label>
                <select name="role" value={formData.role} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-yellow-400">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">El administrador tiene acceso total, incluida esta pantalla. El operador no puede gestionar usuarios ni configuración.</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400">{editingId ? 'Nueva contrasena (opcional)' : 'Contrasena'}</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingId} minLength="8" maxLength="100" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-2xl bg-slate-900 py-4 font-bold text-yellow-400 shadow-lg transition-all hover:bg-slate-800">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} Guardar Usuario
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosScreen;
