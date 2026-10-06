import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

/**
 * Cabecera de tabla que ordena. El orden lo resuelve el SERVIDOR, no el
 * navegador: ordenar aqui solo reacomodaria las filas de la pagina visible, y
 * con 200 registros repartidos en ocho paginas eso da un resultado que parece
 * roto (pulsas "mayor monto" y el mayor de todos sigue en la pagina 5).
 *
 * `campo` tiene que estar en la lista blanca del controlador; si no, el
 * servidor lo ignora y devuelve su orden por defecto.
 */
const ColumnaOrdenable = ({ campo, orden, onOrdenar, children, className = '', alinear = 'left' }) => {
  const activa = orden?.campo === campo;
  const direccion = activa ? orden.direccion : null;

  const siguiente = () => {
    if (!activa) return { campo, direccion: 'asc' };
    return { campo, direccion: direccion === 'asc' ? 'desc' : 'asc' };
  };

  const Icono = !activa ? ChevronsUpDown : direccion === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={`p-4 ${alinear === 'center' ? 'text-center' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onOrdenar(siguiente())}
        aria-label={`Ordenar por ${typeof children === 'string' ? children : campo}`}
        className={`group inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
          activa ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {children}
        <Icono
          className={`h-3.5 w-3.5 flex-shrink-0 transition-opacity ${
            activa ? 'opacity-100' : 'opacity-30 group-hover:opacity-70'
          }`}
        />
      </button>
    </th>
  );
};

export default ColumnaOrdenable;
