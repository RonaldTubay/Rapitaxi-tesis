<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Support\Carbon;

/**
 * Que dia es hoy para la cooperativa.
 *
 * Las marcas de tiempo se guardan en UTC, que es lo correcto, pero los
 * vencimientos son del calendario local: una matricula que caduca el 2 de
 * octubre caduca ese dia en Montecristi, no cuando UTC cambie de dia.
 *
 * Sin un solo lugar que lo decida, el sistema calculaba los dias de dos
 * maneras: matricula y habilitacion con el dia de Ecuador, y expedientes, RTV,
 * mantenimiento y aportaciones con el de UTC. Entre las 19:00 y la medianoche
 * en Ecuador, UTC ya es el dia siguiente, asi que dos papeles que vencen la
 * misma fecha reportaban cifras distintas, y el aviso diario corrido de noche
 * se creia de otro dia y repetia los avisos.
 */
final class Calendario
{
    public const ZONA = 'America/Guayaquil';

    /** Hoy a medianoche, en la zona de la cooperativa. */
    public static function hoy(): Carbon
    {
        return Carbon::today(self::ZONA);
    }

    public static function hoyString(): string
    {
        return self::hoy()->toDateString();
    }

    /**
     * El instante en que empezo el dia de hoy, en UTC.
     *
     * Para comparar contra columnas de marca de tiempo (`created_at`), que se
     * guardan en UTC: un aviso creado a las 23:30 en Ecuador quedo registrado
     * con la fecha UTC del dia siguiente, y un `whereDate` sobre el dia local
     * no lo encontraria.
     */
    public static function inicioDeHoyEnUtc(): Carbon
    {
        return self::hoy()->copy()->utc();
    }

    /**
     * Cuantos dias faltan hasta esa fecha. Negativo si ya paso, null si no hay
     * fecha registrada.
     */
    public static function diasHasta(mixed $fecha): ?int
    {
        if (empty($fecha)) {
            return null;
        }

        // Solo interesa la parte de fecha: la hora de una columna `date` no
        // significa nada y arrastraria la zona con la que se leyo.
        $texto = $fecha instanceof DateTimeInterface
            ? $fecha->format('Y-m-d')
            : (string) $fecha;

        return (int) self::hoy()->diffInDays(Carbon::parse($texto, self::ZONA), false);
    }
}
