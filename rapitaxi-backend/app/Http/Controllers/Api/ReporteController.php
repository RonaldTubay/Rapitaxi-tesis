<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use App\Models\Aportacion;
use App\Support\Calendario;
use Carbon\Carbon;

class ReporteController extends Controller
{
    public function cuadroMaestro()
    {
        try {
            $hoy = Calendario::hoy();
            $mesActual = $hoy->month;
            $anioActual = $hoy->year;

            $revisiones = DB::table('revisiones')
                ->select('vehiculo_id')
                ->selectRaw('MAX(fecha_revision) as ultima_fecha')
                ->where('estado', 'Aprobada')
                ->groupBy('vehiculo_id');

            // DB::table no aplica SoftDeletes: excluir pagos eliminados evita
            // imprimir "Al dia" para una aportacion anulada.
            $aportaciones = DB::table((new Aportacion)->getTable())
                ->select('socio_id')
                ->selectRaw('COUNT(*) as pagos_mes')
                ->whereNull('deleted_at')
                ->where('mes_pagado', $mesActual)
                ->where('anio_pagado', $anioActual)
                ->where('estado', 'Aprobado')
                ->groupBy('socio_id');

            $reporte = DB::table('socios as s')
                ->leftJoin('vehiculos as v', function ($join) {
                    $join->on('s.id', '=', 'v.socio_id')->whereNull('v.deleted_at');
                })
                ->leftJoinSub($revisiones, 'r', 'v.id', '=', 'r.vehiculo_id')
                ->leftJoinSub($aportaciones, 'a', 's.id', '=', 'a.socio_id')
                // Esta consulta es SQL crudo (no Eloquent), asi que el borrado
                // suave no se aplica solo: hay que excluirlo a mano.
                ->whereNull('s.deleted_at')
                ->select(
                    'v.numero_vehiculo',
                    'v.placa',
                    's.nombre as accionista',
                    'v.anio_fabricacion as anio_model',
                    'r.ultima_fecha as fecha_ult_revision',
                    's.observaciones',
                    // Corrección específica para motor PostgreSQL
                    DB::raw("CASE WHEN COALESCE(a.pagos_mes, 0) > 0 THEN 'Al día' ELSE 'En mora' END as estado_aportacion")
                )
                ->orderBy('v.numero_vehiculo', 'asc')
                ->get();

            return response()->json($reporte, 200);

        } catch (\Exception $e) {
            report($e);
            return response()->json([
                'message' => 'No se pudo generar el cuadro maestro. Revisa que las tablas y migraciones esten actualizadas.',
            ], 500);
        }
    }
}
