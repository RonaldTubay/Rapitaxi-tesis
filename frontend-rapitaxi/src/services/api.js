const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api';

async function request(path, options = {}) {
  // Obtenemos el token del localStorage
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  
  const headers = { 
    'Accept': 'application/json' 
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Si hay un token, lo añadimos a las cabeceras (Bearer Token)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  // Manejo de errores: lanzamos excepción para que el frontend pueda usar try/catch
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
    }
    const error = new Error(data?.message || res.statusText || 'Error en la petición');
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

// --- FUNCIONES DE AUTENTICACIÓN ---
export const login = (credentials) => 
  request('/login', { method: 'POST', body: JSON.stringify(credentials) });

export const logout = () => 
  request('/logout', { method: 'POST' });

// --- TUS FUNCIONES EXISTENTES ---
export const postRevision = (payload) => request('/revisiones-vehiculares', { method: 'POST', body: JSON.stringify(payload) });
export const getRevisiones = () => request('/revisiones-vehiculares');
export const postExpediente = (payload) => request('/expedientes', { method: 'POST', body: JSON.stringify(payload) });
export const uploadExpedienteHistorico = (formData) => request('/expedientes', { method: 'POST', body: formData });
export const getExpedienteDocumentos = (id) => request(`/expedientes/${id}/documentos`);
export const getExpedienteDocumentoUrl = (expId, docId) => `${BASE}/expedientes/${expId}/documentos/${docId}/download`;
export const getExpedientes = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return request(`/expedientes${qs ? `?${qs}` : ''}`);
};
export const getActa = (id) => request(`/expedientes/${id}/acta`);
export const generateAndSaveActa = (id) => request(`/expedientes/${id}/acta/generate`, { method: 'POST' });
export const getExpedienteArchivoUrl = (id) => `${BASE}/expedientes/${id}/archivo`;
export const getVehiculos = () => request('/vehiculos');
export const postVehiculo = (payload) => request('/vehiculos', { method: 'POST', body: JSON.stringify(payload) });
export const updateVehiculo = (id, payload) => request(`/vehiculos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteVehiculo = (id) => request(`/vehiculos/${id}`, { method: 'DELETE' });
export const getSocios = () => request('/socios');
export const postSocio = (payload) => request('/socios', { method: 'POST', body: JSON.stringify(payload) });
export const updateSocio = (id, payload) => request(`/socios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteSocio = (id) => request(`/socios/${id}`, { method: 'DELETE' });
export const getMantenimientos = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return request(`/mantenimientos${qs ? `?${qs}` : ''}`);
};
export const postMantenimiento = (payload) => request('/mantenimientos', { method: 'POST', body: JSON.stringify(payload) });
export const updateMantenimientoEstado = (id, estado) => request(`/mantenimientos/${id}/estado`, {
  method: 'PATCH',
  body: JSON.stringify({ estado }),
});
export const uploadMantenimientoComprobante = (id, file) => {
  const body = new FormData();
  body.append('comprobante', file);
  return request(`/mantenimientos/${id}/comprobante`, { method: 'POST', body });
};

export default { 
  login, logout, postRevision, getRevisiones, postExpediente, uploadExpedienteHistorico, getExpedientes, getActa, getExpedienteArchivoUrl,
  getVehiculos, postVehiculo, updateVehiculo, deleteVehiculo, 
  getSocios, postSocio, updateSocio, deleteSocio,
  getMantenimientos, postMantenimiento, updateMantenimientoEstado, uploadMantenimientoComprobante,
};