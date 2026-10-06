import { API_URL } from '../apiConfig';

const AUTH_TOKEN_KEY = 'auth_token';

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
export const setAuthToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Wrapper unico sobre fetch para toda la app: arma la URL, agrega headers
 * (incluido el token si existe), parsea JSON y normaliza los errores.
 * Cualquier cambio futuro al manejo de auth/errores se hace aqui una sola vez.
 */
const request = async (path, { method = 'GET', body, headers, unauthenticatedOn401 = true } = {}) => {
  const token = getAuthToken();

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && unauthenticatedOn401) {
      clearAuthToken();
    }

    throw new ApiError(data?.message || 'Ocurrio un error al procesar la solicitud.', {
      status: response.status,
      data,
    });
  }

  return data;
};

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export { ApiError };
