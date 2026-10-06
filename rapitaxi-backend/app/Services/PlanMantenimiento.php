<?php

namespace App\Services;

use App\Models\ConfiguracionMantenimiento;
use App\Models\Mantenimiento;
use App\Models\Vehiculo;
use App\Support\Calendario;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Calcula, para cada unidad, cuando le toca el proximo mantenimiento de
 * cada tipo. La cuenta es solo por tiempo (fecha del ultimo trabajo +
 * frecuencia configurada), porque el sistema no conoce el kilometraje de
 * una unidad entre un mantenimiento y otro.
 *
 * Solo cuentan los mantenimientos aprobados por el staff: un registro que
 * subio el socio y todavia nadie confirmo no pone la unidad al dia.
 */
class PlanMantenimiento
{
    public const VENCIDO = 'Vencido';
    public const POR_VENCER = 'Por vencer';
    public const AL_DIA = 'Al día';
    public const SIN_REGISTRO = 'Sin registro';

    // De mas urgente a menos: define el resumen de una unidad con varios tipos.
    private const PRIORIDAD = [self::VENCIDO, self::SIN_REGISTRO, self::POR_VENCER, self::AL_DIA];

    /**
     * @param  Collection<int, Vehiculo>  $vehiculos
     * @return array<int, array<string, mixed>>
     */
    public function paraVehiculos(Collection $vehiculos): array
    {
        $configuraciones = ConfiguracionMantenimiento::orderBy('tipo_mantenimiento')->get();

        if ($vehiculos->isEmpty()) {
            return [];
        }

        $ultimos = $this->ultimosAprobadosPorVehiculoYTipo($vehiculos->pluck('id')->all());

        return $vehiculos->map(function (Vehiculo $vehiculo) use ($configuraciones, $ultimos) {
            $items = $configuraciones
                ->map(fn (ConfiguracionMantenimiento $config) => $this->evaluar(
                    $config,
                    $ultimos[$vehiculo->id][$config->tipo_mantenimiento] ?? null
                ))
                ->values()
                ->all();

            return [
                'id' => $vehiculo->id,
                'numero_vehiculo' => $vehiculo->numero_vehiculo,
                'placa' => $vehiculo->placa,
                'marca' => $vehiculo->marca,
                'tipo_vehiculo' => $vehiculo->tipo_vehiculo,
                'matricula' => [
                    'fecha_caducidad' => $vehiculo->fecha_caducidad_matricula?->toDateString(),
                    'estado' => $vehiculo->estado_matricula,
                    'dias_para_vencer' => $vehiculo->dias_para_vencer_matricula,
                ],
                'habilitacion' => [
                    'fecha_caducidad' => $vehiculo->fecha_caducidad_habilitacion?->toDateString(),
                    'estado' => $vehiculo->estado_habilitacion,
                    'dias_para_vencer' => $vehiculo->dias_para_vencer_habilitacion,
                ],
                'resumen' => $this->resumen($items),
                'mantenimientos' => $items,
            ];
        })->all();
    }

    /** Fecha del ultimo mantenimiento aprobado de cada vehiculo, por tipo. */
    private function ultimosAprobadosPorVehiculoYTipo(array $vehiculoIds): array
    {
        return Mantenimiento::query()
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->where('estado', 'Completado')
            ->where('revision_estado', 'Aprobado')
            ->orderBy('fecha_mantenimiento')
            ->get(['vehiculo_id', 'tipo_mantenimiento', 'fecha_mantenimiento'])
            // Al recorrer de la mas vieja a la mas nueva, la ultima asignacion
            // de cada combinacion queda siendo la fecha mas reciente.
            ->reduce(function (array $acumulado, Mantenimiento $m) {
                $acumulado[$m->vehiculo_id][$m->tipo_mantenimiento] = $m->fecha_mantenimiento;

                return $acumulado;
            }, []);
    }

    private function evaluar(ConfiguracionMantenimiento $config, $ultimaFecha): array
    {
        $base = [
            'tipo' => $config->tipo_mantenimiento,
            'meses_frecuencia' => $config->meses_frecuencia,
            'ultima_fecha' => null,
            'proxima_fecha' => null,
            'dias_restantes' => null,
        ];

        if (! $ultimaFecha) {
            return $base + ['estado' => self::SIN_REGISTRO];
        }

        $ultima = Carbon::parse($ultimaFecha)->startOfDay();
        $proxima = $ultima->copy()->addMonths($config->meses_frecuencia);
        $diasRestantes = Calendario::diasHasta($proxima);

        if ($diasRestantes < 0) {
            $estado = self::VENCIDO;
        } elseif ($diasRestantes <= $config->dias_anticipacion) {
            $estado = self::POR_VENCER;
        } else {
            $estado = self::AL_DIA;
        }

        return [
            'tipo' => $config->tipo_mantenimiento,
            'meses_frecuencia' => $config->meses_frecuencia,
            'ultima_fecha' => $ultima->toDateString(),
            'proxima_fecha' => $proxima->toDateString(),
            'dias_restantes' => (int) $diasRestantes,
            'estado' => $estado,
        ];
    }

    private function resumen(array $items): string
    {
        $estados = array_column($items, 'estado');

        foreach (self::PRIORIDAD as $estado) {
            if (in_array($estado, $estados, true)) {
                return $estado;
            }
        }

        return self::AL_DIA;
    }
}
