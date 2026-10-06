import { API_URL } from '../apiConfig';
import { clearStoredSession } from '../features/auth/authService';


/**
 * El token del backend vence (12 h). Muchas pantallas llaman a fetch
 * directamente en vez de usar apiClient, asi que este es el unico lugar que
 * ve TODAS las respuestas: si la API dice "no autenticado" con una sesion
 * guardada, se limpia y se manda al login en vez de dejar la pantalla
 * rota con errores silenciosos.
 */
export const installSessionGuard = () => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    const target = args[0];
    const url = typeof target === 'string' ? target : target?.url;
    const esLlamadaApi = typeof url === 'string' && url.startsWith(API_URL);
    const esLogin = esLlamadaApi && url.endsWith('/login');

    if (response.status === 401 && esLlamadaApi && !esLogin && localStorage.getItem('auth_token')) {
      clearStoredSession();
      if (window.location.pathname !== '/admin/login') {
        window.location.assign('/admin/login');
      }
    }

    return response;
  };
};
