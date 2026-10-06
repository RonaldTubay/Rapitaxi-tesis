// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import ProtectedRoute from './ProtectedRoute';

vi.mock('../features/auth/AuthContext', () => ({ useAuth: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const montar = () => render(
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route index element={<p>Contenido privado</p>} />
      </Route>
      <Route path="/admin/login" element={<p>Inicio de sesión</p>} />
    </Routes>
  </MemoryRouter>,
);

it('redirige al login si no hay sesión', () => {
  useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, role: null });
  montar();
  expect(screen.getByText('Inicio de sesión')).toBeTruthy();
  expect(screen.queryByText('Contenido privado')).toBeNull();
});

it('no muestra el contenido de administración a un socio autenticado', () => {
  useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, role: 'socio' });
  montar();
  expect(screen.queryByText('Contenido privado')).toBeNull();
  expect(screen.queryByText('Inicio de sesión')).toBeNull();
});
