import { apiClient, setAuthToken, clearAuthToken } from '../../lib/apiClient';

const USER_STORAGE_KEY = 'auth_user';
const CUADRO_MAESTRO_CACHE_KEY = 'rapitaxi_cuadro_maestro';

export const clearStoredSession = () => {
  clearAuthToken();
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(CUADRO_MAESTRO_CACHE_KEY);
};

export const login = async ({ email, password }) => {
  const data = await apiClient.post('/login', { email, password }, { unauthenticatedOn401: false });

  // Un usuario nuevo en la misma pestana no debe ver el cuadro del anterior.
  sessionStorage.removeItem(CUADRO_MAESTRO_CACHE_KEY);
  setAuthToken(data.token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));

  return data.user;
};

export const logout = async () => {
  try {
    await apiClient.post('/logout');
  } catch {
    // Best-effort: si la llamada al servidor falla (token ya vencido, sin red, etc.)
    // igual queremos terminar la sesion localmente.
  } finally {
    clearStoredSession();
  }
};

export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
