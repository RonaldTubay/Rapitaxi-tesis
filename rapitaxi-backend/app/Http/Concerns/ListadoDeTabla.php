<?php

namespace App\Http\Concerns;

use Illuminate\Http\Request;

/**
 * Lo que toda tabla del panel necesita del servidor: cuantas filas por pagina
 * y por que columna ordenar.
 *
 * Va aqui y no en cada controlador porque el limite de `per_page` estaba
 * copiado en tres sitios con variaciones: uno de ellos no acotaba por abajo,
 * asi que `?per_page=0` devolvia una pagina vacia y la tabla se veia rota sin
 * que nadie entendiera por que.
 */
trait ListadoDeTabla
{
    /**
     * Cuantas filas devolver. El tope existe para que nadie se traiga la tabla
     * entera pidiendo `?per_page=999999`, que es justo el problema que la
     * paginacion viene a resolver.
     */
    protected function porPagina(Request $request, int $porDefecto = 25): int
    {
        return min(max((int) $request->input('per_page', $porDefecto), 1), 100);
    }

    /**
     * Ordena por la columna que pida el cliente, pero solo si esta en la lista
     * blanca. Sin esa lista, `?sort=` llega crudo a la consulta: se podria
     * ordenar por columnas que la respuesta no muestra (y deducir su contenido
     * viendo como se reordenan las filas) o colar SQL.
     *
     * @param  array<string, string>  $permitidas  nombre publico => columna real
     */
    protected function ordenar($query, Request $request, array $permitidas, string $porDefecto, string $direccionPorDefecto = 'desc')
    {
        $pedida = (string) $request->input('sort', '');
        $columna = $permitidas[$pedida] ?? $permitidas[$porDefecto];

        $direccion = strtolower((string) $request->input('dir', ''));
        if (! in_array($direccion, ['asc', 'desc'], true)) {
            $direccion = $pedida !== '' && isset($permitidas[$pedida]) ? 'asc' : $direccionPorDefecto;
        }

        return $query->orderBy($columna, $direccion);
    }
}
