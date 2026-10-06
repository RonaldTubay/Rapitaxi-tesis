<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * Un solo lugar para servir los archivos privados que viven en R2.
 *
 * El bucket no es publico: a un comprobante o a una cedula escaneada no se
 * llega sin un enlace firmado. Los cuatro controladores que entregan archivos
 * repetian el plazo, la cabecera y la forma de la respuesta, asi que cambiar
 * el plazo obligaba a acordarse de los cuatro y olvidar uno pasaba inadvertido.
 */
class ArchivoPrivado
{
    /**
     * Cuanto vale un enlace firmado: alcanza para abrir el archivo, no para
     * reenviarlo a un tercero.
     */
    public const MINUTOS_DE_VIGENCIA = 5;

    /**
     * Enlace directo a R2 (el archivo no pasa por este servidor) que caduca
     * solo. `inline` hace que el navegador lo muestre en vez de descargarlo.
     */
    public static function enlaceTemporal(string $ruta, string $nombreArchivo): string
    {
        return Storage::disk('s3')->temporaryUrl(
            $ruta,
            now()->addMinutes(self::MINUTOS_DE_VIGENCIA),
            ['ResponseContentDisposition' => 'inline; filename="' . $nombreArchivo . '"']
        );
    }

    /**
     * Nombre de descarga armado desde texto que escribio una persona (el titulo
     * de un libro, el nombre de un documento): sin acentos, espacios ni comillas,
     * que es lo que rompe la cabecera o hace que el navegador corte el nombre.
     *
     * @param  string  $respaldo  Nombre a usar si al limpiar no queda nada.
     */
    public static function nombreSeguro(?string $texto, ?string $extension, string $respaldo): string
    {
        $base = trim((string) preg_replace('/[^A-Za-z0-9_-]+/', '_', trim((string) $texto)), '_');
        $base = $base !== '' ? $base : $respaldo;
        $extension = strtolower(trim((string) $extension, '.'));

        return $extension !== '' ? $base . '.' . $extension : $base;
    }
}
