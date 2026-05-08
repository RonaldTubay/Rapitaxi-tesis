<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RevisionVehicular;
use App\Models\Vehiculo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RevisionVehicularController extends Controller
{
    public function index(): JsonResponse
    {
        $revisiones = RevisionVehicular::query()
            ->with([
                'vehiculo:id,numero_vehicular,placa,codigo_taxi,marca,color',
                'registradoPor:id,name',
            ])
            ->orderByDesc('fecha_revision')
            ->orderByDesc('id')
            ->get()
            ->map(function (RevisionVehicular $revision) {
                return [
                    'id' => $revision->id,
                    'vehiculo_id' => $revision->vehiculo_id,
                    'vehiculo' => $revision->vehiculo,
                    'identificador_vehiculo' => $revision->vehiculo?->numero_vehicular ?: ($revision->vehiculo?->placa ?: $revision->vehiculo?->codigo_taxi),
                    'marca_vehiculo' => $revision->vehiculo?->marca,
                    'fecha_revision' => optional($revision->fecha_revision)->toDateString(),
                    'resultado' => $revision->resultado,
                    'observacion' => $revision->observacion,
                    'registrado_por' => $revision->registradoPor?->name,
                    'created_at' => optional($revision->created_at)->toISOString(),
                ];
            });

        return response()->json($revisiones);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehiculo_id' => ['required', 'exists:vehiculos,id'],
            'registrado_por' => ['nullable', 'exists:users,id'],
            'fecha_revision' => ['required', 'date'],
            'resultado' => ['required', 'in:Aprobado,Observado,Rechazado'],
            'observacion' => ['nullable', 'string'],
        ]);

        $revision = RevisionVehicular::create($validated);

        $vehiculo = Vehiculo::findOrFail($validated['vehiculo_id']);
        if (empty($vehiculo->fecha_ultima_revision) || $validated['fecha_revision'] >= $vehiculo->fecha_ultima_revision->toDateString()) {
            $vehiculo->update([
                'fecha_ultima_revision' => $validated['fecha_revision'],
            ]);
        }

        return response()->json([
            'message' => 'Revision vehicular registrada correctamente.',
            'data' => $revision->load(['vehiculo', 'registradoPor']),
        ], 201);
    }
}
