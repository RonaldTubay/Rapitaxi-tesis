// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehiculosScreen from './VehiculosScreen';

vi.mock('../utils/feedback', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

const unidad = {
  id: 7, socio_id: 3, numero_vehiculo: '012-07', placa: 'MBC-4650',
  marca: 'Chevrolet', tipo_vehiculo: 'Sedán', combustible: 'Gasolina', anio_fabricacion: 2020,
  socio: { nombre: 'Ana' }, fecha_matricula: '2025-01-01',
  fecha_caducidad_matricula: '2027-01-01', fecha_resolucion_habilitacion: '2025-02-01',
  fecha_caducidad_habilitacion: '2027-02-01',
  estado_matricula: 'Vigente', estado_habilitacion: 'Vigente',
};

const respuesta = (data) => ({ ok: true, json: async () => data });

beforeEach(() => {
  localStorage.setItem('auth_token', 'token-de-prueba');
  globalThis.fetch = vi.fn(async (url, options) => {
    if (options?.method === 'PUT') return respuesta({ vehiculo: unidad });
    if (String(url).includes('/socios?')) return respuesta([{ id: 3, nombre: 'Ana' }]);
    return respuesta({ data: [unidad], current_page: 1, last_page: 1, total: 1 });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('papeles del vehículo', () => {
  it('muestra las vigencias y carga ambas fechas al editar', async () => {
    render(<VehiculosScreen />);
    expect(await screen.findByText('Matrícula: Vigente')).toBeTruthy();
    expect(screen.getByText('Habilitación: Vigente')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar unidad 012-07' }));
    expect(screen.getByLabelText('Caducidad de matrícula').value).toBe('2027-01-01');
    expect(screen.getByLabelText('Caducidad de habilitación').value).toBe('2027-02-01');

    fireEvent.change(screen.getByLabelText('Caducidad de habilitación'), { target: { value: '2028-02-01' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Vehículo' }).closest('form'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/vehiculos/7'),
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"fecha_caducidad_habilitacion":"2028-02-01"') }),
    ));
  });
});
