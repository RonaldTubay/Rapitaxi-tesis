<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;
use App\Http\Concerns\ListadoDeTabla;

class AuditoriaController extends Controller
{
    use ListadoDeTabla;

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'id' => 'id',
        'created_at' => 'created_at',
        'log_name' => 'log_name',
        'event' => 'event',
    ];

    // Historial de quien creo/edito/elimino/reactivo cada registro del
    // sistema. Solo el admin puede verlo (se configura asi en las rutas).
    public function index(Request $request)
    {
        $query = Activity::with('causer');

        if ($request->filled('modulo')) {
            $query->where('log_name', $request->modulo);
        }

        if ($request->filled('evento')) {
            $query->where('event', $request->evento);
        }

        // El ayudante compartido acota tambien por abajo: aqui `?per_page=0`
        // devolvia una pagina vacia y la pantalla se veia rota sin motivo.
        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'id');

        $actividad = $query->paginate($this->porPagina($request))->through(function (Activity $log) {
            // ip/user_agent viajan mezclados con el resto de las propiedades
            // (los agrega TapsActivityWithRequestMeta en cada modelo); se
            // separan aqui para no confundirlos con el diff de atributos.
            $cambios = $log->properties->except(['ip', 'user_agent']);

            return [
                'id' => $log->id,
                'modulo' => $log->log_name,
                'evento' => $log->event,
                'descripcion' => $log->description,
                'sujeto_tipo' => $log->subject_type ? class_basename($log->subject_type) : null,
                'sujeto_id' => $log->subject_id,
                'usuario' => $log->causer?->name,
                'usuario_email' => $log->causer?->email,
                'ip' => $log->properties->get('ip'),
                'user_agent' => $log->properties->get('user_agent'),
                'cambios' => $cambios,
                'fecha' => $log->created_at,
            ];
        });

        return response()->json($actividad, 200);
    }
}
