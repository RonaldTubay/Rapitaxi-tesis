<?php

namespace App\Http\Controllers\Api;

use App\Support\Calendario;
use App\Http\Controllers\Controller;
use App\Models\Expediente;
use App\Models\Socio;
use App\Models\Traspaso;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * El historial de a quien pertenecio cada cupo.
 *
 * Registrar un traspaso es lo UNICO que cambia el dueño de una unidad: el
 * formulario de vehiculos ya no acepta `socio_id` en la edicion. Si lo
 * aceptara, se podria cambiar el dueño sin dejar rastro y el historial diria
 * una cosa mientras la unidad dice otra.
 */
class TraspasoController extends Controller
{
    /** El historial de una unidad, del traspaso mas reciente al mas antiguo. */
    public function index($vehiculoId)
    {
        $vehiculo = Vehiculo::with('socio:id,nombre,cedula')->find($vehiculoId);

        if (! $vehiculo) {
            return response()->json(['message' => 'Unidad no encontrada.'], 404);
        }

        $traspasos = Traspaso::where('vehiculo_id', $vehiculo->id)
            ->with([
                'socioAnterior:id,nombre,cedula',
                'socioNuevo:id,nombre,cedula',
                'registradoPor:id,name',
                'expediente:id,nombre_documento,tipo_expediente',
            ])
            ->orderByDesc('fecha_traspaso')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'unidad' => [
                'id' => $vehiculo->id,
                'numero_vehiculo' => $vehiculo->numero_vehiculo,
                'placa' => $vehiculo->placa,
                'socio_actual' => $vehiculo->socio,
            ],
            'traspasos' => $traspasos,
        ], 200);
    }

    public function store(Request $request, $vehiculoId)
    {
        $vehiculo = Vehiculo::find($vehiculoId);

        if (! $vehiculo) {
            return response()->json(['message' => 'Unidad no encontrada.'], 404);
        }

        $ultimo = Traspaso::where('vehiculo_id', $vehiculo->id)
            ->orderByDesc('fecha_traspaso')
            ->orderByDesc('id')
            ->first();

        $validados = $request->validate([
            'socio_nuevo_id' => [
                'required',
                Rule::exists('socios', 'id')->whereNull('deleted_at'),
                // Traspasar un cupo al mismo socio que ya lo tiene no es un
                // traspaso: es un registro que ensucia el historial.
                Rule::notIn([$vehiculo->socio_id]),
            ],
            // No puede ser anterior al traspaso previo: el historial de un cupo
            // es una linea de tiempo, y dos fechas cruzadas lo vuelven ilegible.
            'fecha_traspaso' => [
                'required', 'date', 'before_or_equal:' . Calendario::hoyString(),
                ...($ultimo ? ['after_or_equal:' . $ultimo->fecha_traspaso->toDateString()] : []),
            ],
            'numero_resolucion' => 'nullable|string|max:60',
            // Un cupo no cambia de dueño de palabra: el acta es la prueba. Pero
            // de las 66 carpetas no todas tienen el documento digitalizado, y un
            // campo obligatorio a secas obligaria a inventar datos para avanzar.
            // Por eso se puede declarar que no hay acta, diciendo por que.
            'sin_acta' => 'sometimes|boolean',
            'expediente_id' => [
                Rule::requiredIf(! $request->boolean('sin_acta')),
                'nullable',
                Rule::exists('expedientes', 'id'),
            ],
            'observaciones' => [
                Rule::requiredIf($request->boolean('sin_acta')),
                'nullable', 'string', 'max:500',
            ],
        ], [
            'socio_nuevo_id.not_in' => 'Esa unidad ya pertenece a ese socio.',
            'fecha_traspaso.after_or_equal' => 'La fecha no puede ser anterior al último traspaso registrado.',
            'fecha_traspaso.before_or_equal' => 'La fecha del traspaso no puede ser futura.',
            'expediente_id.required' => 'Adjunta el acta de cambio de socio, o marca que no está digitalizada.',
            'observaciones.required' => 'Si el traspaso no tiene acta, explica por qué queda sin respaldo.',
        ]);

        // La carta de cesion tiene que ser del socio que entrega o del que
        // recibe; si no, se estaria adjuntando el documento de otra persona.
        if (! empty($validados['expediente_id'])) {
            $expediente = Expediente::find($validados['expediente_id']);
            $duenos = array_filter([$vehiculo->socio_id, (int) $validados['socio_nuevo_id']]);

            if (! $expediente || ! in_array((int) $expediente->socio_id, $duenos, true)) {
                return response()->json([
                    'message' => 'El documento debe pertenecer al socio que entrega o al que recibe la unidad.',
                ], 422);
            }
        }

        $traspaso = DB::transaction(function () use ($request, $vehiculo, $validados) {
            $traspaso = Traspaso::create([
                'vehiculo_id' => $vehiculo->id,
                'socio_anterior_id' => $vehiculo->socio_id,
                'socio_nuevo_id' => $validados['socio_nuevo_id'],
                'fecha_traspaso' => $validados['fecha_traspaso'],
                'numero_resolucion' => $validados['numero_resolucion'] ?? null,
                'observaciones' => $validados['observaciones'] ?? null,
                'expediente_id' => $validados['expediente_id'] ?? null,
                'registrado_por' => $request->user()?->id,
            ]);

            // El cupo cambia de manos en la misma transaccion: si una de las dos
            // escrituras fallara, quedaria un historial que no coincide con el
            // dueño de la unidad.
            $vehiculo->socio_id = $validados['socio_nuevo_id'];
            $vehiculo->save();

            return $traspaso;
        });

        $traspaso->load(['socioAnterior:id,nombre,cedula', 'socioNuevo:id,nombre,cedula']);

        return response()->json([
            'message' => 'Traspaso registrado. La unidad quedó a nombre de ' . $traspaso->socioNuevo->nombre . '.',
            'traspaso' => $traspaso,
        ], 201);
    }

    /** Los cupos que un socio recibio o entrego, para su expediente. */
    public function porSocio($socioId)
    {
        $socio = Socio::find($socioId);

        if (! $socio) {
            return response()->json(['message' => 'Socio no encontrado.'], 404);
        }

        $traspasos = Traspaso::where('socio_nuevo_id', $socio->id)
            ->orWhere('socio_anterior_id', $socio->id)
            ->with([
                'vehiculo:id,numero_vehiculo,placa',
                'socioAnterior:id,nombre',
                'socioNuevo:id,nombre',
            ])
            ->orderByDesc('fecha_traspaso')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Traspaso $t) => [
                'id' => $t->id,
                'fecha_traspaso' => $t->fecha_traspaso?->toDateString(),
                'numero_resolucion' => $t->numero_resolucion,
                'unidad' => $t->vehiculo,
                'direccion' => $t->socio_nuevo_id === $socio->id ? 'Recibió' : 'Entregó',
                'contraparte' => $t->socio_nuevo_id === $socio->id
                    ? $t->socioAnterior?->nombre
                    : $t->socioNuevo?->nombre,
            ]);

        return response()->json($traspasos, 200);
    }
}
