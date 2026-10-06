<?php

namespace App\Http\Controllers\Api;

use App\Support\Calendario;
use App\Http\Controllers\Controller;
use App\Models\Revision;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Http\Concerns\ListadoDeTabla;

class RevisionController extends Controller
{
    use ListadoDeTabla;

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'fecha_revision' => 'fecha_revision',
        'fecha_vencimiento' => 'fecha_vencimiento',
        'tipo' => 'tipo',
        'estado' => 'estado',
    ];

    // Paginado, con la busqueda resuelta en el servidor: filtrar en el
    // navegador solo alcanzaria a la pagina que se esta viendo.
    public function index(Request $request)
    {
        $query = Revision::with('vehiculo.socio');

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('search')) {
            $termino = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($termino) {
                $q->whereRaw('LOWER(tipo) LIKE ?', [$termino])
                    ->orWhereHas('vehiculo', fn ($v) => $v
                        ->whereRaw('LOWER(placa) LIKE ?', [$termino])
                        ->orWhereRaw('LOWER(numero_vehiculo) LIKE ?', [$termino])
                        ->orWhereHas('socio', fn ($s) => $s->whereRaw('LOWER(nombre) LIKE ?', [$termino])));
            });
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'fecha_revision');

        return response()->json($query->paginate($this->porPagina($request)), 200);
    }

    public function store(Request $request)
    {
        $datos = $request->validate([
            'vehiculo_id'    => ['required', Rule::exists('vehiculos', 'id')->whereNull('deleted_at')],
            'fecha_revision' => ['required', 'date', 'after_or_equal:2000-01-01', Rule::when(in_array($request->estado, ['Aprobada', 'Rechazada'], true), ['before_or_equal:' . Calendario::hoyString()])],
            'tipo'           => 'required|string|max:80',
            'estado'         => 'required|in:Aprobada,Rechazada,Pendiente',
            // La RTV aprobada trae su fecha de caducidad impresa: sin ella no se
            // puede avisar al socio antes de que expire.
            'fecha_vencimiento' => [Rule::when($request->estado === 'Aprobada', ['required', 'date', 'after:fecha_revision']), 'nullable', 'date'],
            'observaciones'  => 'nullable|string|max:500',
        ]);

        $revision = Revision::create($datos);
        $revision->load('vehiculo.socio');

        return response()->json([
            'message' => 'Revisión registrada con éxito.',
            'revision' => $revision
        ], 201);
    }

    public function show($id)
    {
        $revision = Revision::with('vehiculo.socio')->find($id);
        if (!$revision) {
            return response()->json(['message' => 'Revisión no encontrada.'], 404);
        }
        return response()->json($revision, 200);
    }

    public function update(Request $request, $id)
    {
        $revision = Revision::find($id);
        if (!$revision) {
            return response()->json(['message' => 'Revisión no encontrada.'], 404);
        }

        $datos = $request->validate([
            'vehiculo_id'    => ['required', Rule::exists('vehiculos', 'id')->whereNull('deleted_at')],
            'fecha_revision' => ['required', 'date', 'after_or_equal:2000-01-01', Rule::when(in_array($request->estado, ['Aprobada', 'Rechazada'], true), ['before_or_equal:' . Calendario::hoyString()])],
            'tipo'           => 'required|string|max:80',
            'estado'         => 'required|in:Aprobada,Rechazada,Pendiente',
            // La RTV aprobada trae su fecha de caducidad impresa: sin ella no se
            // puede avisar al socio antes de que expire.
            'fecha_vencimiento' => [Rule::when($request->estado === 'Aprobada', ['required', 'date', 'after:fecha_revision']), 'nullable', 'date'],
            'observaciones'  => 'nullable|string|max:500',
        ]);

        $revision->update($datos);
        $revision->load('vehiculo.socio');

        return response()->json([
            'message' => 'Revisión actualizada con éxito.',
            'revision' => $revision
        ], 200);
    }

    public function destroy($id)
    {
        $revision = Revision::find($id);
        if (!$revision) {
            return response()->json(['message' => 'Revisión no encontrada.'], 404);
        }
        $revision->delete();
        return response()->json(['message' => 'Revisión eliminada.'], 200);
    }
}
