import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

/**
 * Los datos de la compania (razon social, RUC, permiso de operacion, firmas).
 *
 * Estaban escritos a mano en el dashboard y en el cuadro maestro, asi que
 * instalarlo en otra cooperativa obligaba a editar el codigo fuente.
 *
 * No cambian durante una sesion y los piden varias pantallas por separado: se
 * traen una vez y se comparten, en vez de una peticion por pantalla.
 */
let cache = null;
let enVuelo = null;

export const obtenerEmpresa = () => {
  if (cache) return Promise.resolve(cache);

  if (!enVuelo) {
    enVuelo = apiClient.get('/empresa')
      .then((datos) => {
        cache = datos;
        return datos;
      })
      .finally(() => {
        enVuelo = null;
      });
  }

  return enVuelo;
};

/**
 * Tras guardar en Ajustes hay que olvidar lo cacheado, o el encabezado seguiria
 * mostrando la razon social anterior hasta recargar la pagina.
 */
export const recordarEmpresa = (datos = null) => {
  cache = datos;
};

export const useEmpresa = () => {
  const [empresa, setEmpresa] = useState(cache);

  useEffect(() => {
    let vigente = true;

    obtenerEmpresa()
      .then((datos) => {
        if (vigente) setEmpresa(datos);
      })
      // Un fallo aqui no debe tumbar la pantalla: cada una tiene su texto de
      // respaldo para el encabezado.
      .catch(() => {});

    return () => {
      vigente = false;
    };
  }, []);

  return empresa;
};
