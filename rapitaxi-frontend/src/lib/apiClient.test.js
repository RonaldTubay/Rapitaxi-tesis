// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient, setAuthToken } from './apiClient';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('envía el token y el cuerpo JSON en una petición autenticada', async () => {
  setAuthToken('token-de-prueba');
  globalThis.fetch = vi.fn(async () => ({
    ok: true, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ id: 1 }),
  }));

  await expect(apiClient.post('/vehiculos', { placa: 'MBC-4650' })).resolves.toEqual({ id: 1 });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/vehiculos'), expect.objectContaining({
    method: 'POST', body: '{"placa":"MBC-4650"}',
    headers: expect.objectContaining({ Authorization: 'Bearer token-de-prueba' }),
  }));
});

it('elimina el token al recibir 401 y conserva el mensaje de la API', async () => {
  setAuthToken('token-caducado');
  globalThis.fetch = vi.fn(async () => ({
    ok: false, status: 401, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ message: 'Sesión caducada' }),
  }));

  await expect(apiClient.get('/vehiculos')).rejects.toMatchObject({ status: 401, message: 'Sesión caducada' });
  expect(localStorage.getItem('auth_token')).toBeNull();
});
