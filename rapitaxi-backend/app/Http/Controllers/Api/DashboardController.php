<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expediente;
use App\Models\Mantenimiento;
use App\Models\Revision;
use App\Models\Empresa;
use App\Models\Socio;
use App\Models\Vehiculo;
use App\Support\Calendario;
use Carbon\Carbon;

class DashboardController extends Controller
{
    // Cada revision aprobada guarda hasta cuando vale, que es lo que dice el
    // certificado. Esta ventana es solo el respaldo para las revisiones que se
    // cargaron antes de que existiera esa columna: de esas lo unico que se puede
    // deducir es que una RTV dura alrededor de un año.
    private const MESES_VIGENCIA_SIN_FECHA = 12;

    // Una unidad que lleva mas de medio año sin ningun mantenimiento
    // registrado es la que hay que ir a revisar: el socio paga sus propios
    // trabajos, pero la compañia necesita saber que la unidad sigue operativa.
    private const MESES_SIN_MANTENIMIENTO = 6;

    public function stats()
    {
        // El dia de la cooperativa, no el de UTC (ver App\Support\Calendario).
        $hoy = Calendario::hoy();

        $sociosActivos = Socio::where('estado', 'Activo')->count();
        $flotaTotal = Vehiculo::count();

        // Trabajo pendiente en un vehiculo dado de baja ya no importa.
        $mantenimientosPendientes = Mantenimiento::whereIn('estado', ['Programado', 'En Proceso'])
            ->whereHas('vehiculo')
            ->count();

        // Unidades que no tienen ningun mantenimiento completado dentro de la
        // ventana: incluye tambien a las que nunca registraron ninguno.
        $unidadesSinMantenimiento = Vehiculo::whereDoesntHave('mantenimientos', function ($query) use ($hoy) {
            $query->where('estado', 'Completado')
                ->where('fecha_mantenimiento', '>=', $hoy->copy()->subMonths(self::MESES_SIN_MANTENIMIENTO)->toDateString());
        })->count();

        // Una unidad esta al dia si alguna de sus revisiones aprobadas sigue
        // vigente. Se mira la fecha de vencimiento real; solo si falta se cae a la
        // ventana de doce meses. Antes se usaba siempre la ventana, asi que una
        // unidad con la RTV vencida hace poco contaba como al dia y una con el
        // certificado todavia vigente pero revisado hace mas de un año no contaba.
        $vehiculosAlDia = Revision::where('estado', 'Aprobada')
            ->whereHas('vehiculo')
            ->where(function ($query) use ($hoy) {
                $query->where('fecha_vencimiento', '>=', $hoy->toDateString())
                    ->orWhere(function ($sinFecha) use ($hoy) {
                        $sinFecha->whereNull('fecha_vencimiento')
                            ->where('fecha_revision', '>=', $hoy->copy()->subMonths(self::MESES_VIGENCIA_SIN_FECHA)->toDateString());
                    });
            })
            ->distinct()
            ->count('vehiculo_id');

        // Solo los datos que la pantalla muestra: sin ruta del respaldo,
        // ni cedula, telefono u observaciones del socio.
        $actividadReciente = Mantenimiento::with('vehiculo.socio')
            ->whereHas('vehiculo')
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->map(fn (Mantenimiento $m) => [
                'id' => $m->id,
                'tipo_mantenimiento' => $m->tipo_mantenimiento,
                'estado' => $m->estado,
                'fecha_mantenimiento' => $m->fecha_mantenimiento,
                'vehiculo' => [
                    'numero_vehiculo' => $m->vehiculo->numero_vehiculo,
                    'socio' => ['nombre' => $m->vehiculo->socio?->nombre],
                ],
            ]);

        // El control de vencimientos es el eje del proyecto, pero hasta ahora el
        // sistema los calculaba y no se los decia a nadie: habia que entrar a
        // Expedientes y revisar socio por socio. Esto lo pone en la pantalla de
        // inicio, que es lo que el staff mira cada mañana.
        $documentos = Expediente::whereNotNull('fecha_vencimiento')
            ->with('socio:id,nombre')
            ->whereHas('socio')
            ->get();

        $porEstado = fn (string $estado) => $documentos
            ->filter(fn (Expediente $e) => $e->estado_vigencia === $estado)
            ->sortBy('fecha_vencimiento')
            ->map(fn (Expediente $e) => [
                'id' => $e->id,
                'socio_id' => $e->socio_id,
                'socio' => $e->socio?->nombre,
                'etiqueta' => $e->tipo_etiqueta,
                'fecha_vencimiento' => $e->fecha_vencimiento?->toDateString(),
                'dias_para_vencer' => $e->dias_para_vencer,
            ])
            ->values();

        $vencidos = $porEstado(Expediente::VENCIDO);
        $porVencer = $porEstado(Expediente::POR_VENCER);

        // Cupos que cambiaron de dueño sin acta digitalizada. No se bloquea el
        // registro, porque hay traspasos reales cuyo documento no existe en las
        // carpetas; se cuenta, para que el hueco sea una tarea visible y no un
        // dato perdido. La asignacion inicial no cuenta: no hay acta que pedir.
        $traspasosSinActa = \App\Models\Traspaso::whereNull('expediente_id')
            ->whereNotNull('socio_anterior_id')
            ->count();

        // El permiso de operacion de la compania: el unico vencimiento que no
        // afecta a un socio sino a todos.
        $empresa = Empresa::actual();

        return response()->json([
            'kpis' => [
                'socios_activos' => $sociosActivos,
                'flota_total' => $flotaTotal,
                'vehiculos_al_dia' => $vehiculosAlDia,
                'taller_pendientes' => $mantenimientosPendientes,
                'unidades_sin_mantenimiento' => $unidadesSinMantenimiento,
                'meses_sin_mantenimiento' => self::MESES_SIN_MANTENIMIENTO,
                'documentos_vencidos' => $vencidos->count(),
                'documentos_por_vencer' => $porVencer->count(),
                'traspasos_sin_respaldo' => $traspasosSinActa,
            ],
            // Solo los primeros: la pantalla muestra una lista corta y enlaza al
            // modulo para ver el resto.
            'documentos' => [
                'vencidos' => $vencidos->take(5),
                'por_vencer' => $porVencer->take(5),
                'dias_aviso' => Expediente::DIAS_AVISO_VENCIMIENTO,
            ],
            'permiso_operacion' => [
                'numero' => $empresa->permiso_operacion,
                'fecha_caducidad' => $empresa->fecha_caducidad_permiso?->toDateString(),
                'estado' => $empresa->estado_permiso,
                'dias_para_vencer' => $empresa->dias_para_vencer_permiso,
            ],
            'actividad_reciente' => $actividadReciente,
        ], 200);
    }
}
