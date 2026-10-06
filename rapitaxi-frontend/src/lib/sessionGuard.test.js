// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { API_URL } from '../apiConfig';
import { installSessionGuard } from './sessionGuard';

const originalFetch = window.fetch;

afterEach(() => {
  window.fetch = originalFetch;
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

it('borra los datos del usuario anterior cuando una llamada directa recibe 401', async () => {
  window.history.replaceState(null, '', '/admin/login');
  localStorage.setItem('auth_token', 'token-caducado');
  localStorage.setItem('auth_user', JSON.stringify({ name: 'Ana' }));
  sessionStorage.setItem('rapitaxi_cuadro_maestro', 'datos privados');
  window.fetch = vi.fn(async () => ({ status: 401 }));

  installSessionGuard();
  await window.fetch(`${API_URL}/vehiculos`);

  expect(localStorage.getItem('auth_token')).toBeNull();
  expect(localStorage.getItem('auth_user')).toBeNull();
  expect(sessionStorage.getItem('rapitaxi_cuadro_maestro')).toBeNull();
});
