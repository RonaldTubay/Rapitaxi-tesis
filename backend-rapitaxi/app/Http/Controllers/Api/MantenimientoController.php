<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mantenimiento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class MantenimientoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Mantenimiento::query()
            ->with('vehiculo:id,numero_vehicular,placa,codigo_taxi,marca')
            ->orderByDesc('fecha')
            ->orderByDesc('id');

        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado')->toString());
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('tipo', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%")
                    ->orWhere('mecanico', 'like', "%{$search}%")
                    ->orWhereHas('vehiculo', function ($vehiculoQuery) use ($search) {
                        $vehiculoQuery
                            ->where('numero_vehicular', 'like', "%{$search}%")
                            ->orWhere('placa', 'like', "%{$search}%")
                            ->orWhere('codigo_taxi', 'like', "%{$search}%")
                            ->orWhere('marca', 'like', "%{$search}%");
                    });
            });
        }

        $records = $query->get()->map(fn (Mantenimiento $mantenimiento) => $this->formatRecord($mantenimiento));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehiculo_id' => ['required', 'integer', 'exists:vehiculos,id'],
            'tipo' => ['required', 'string', 'max:191'],
            'descripcion' => ['nullable', 'string'],
            'fecha' => ['required', 'date'],
            'mecanico' => ['required', 'string', 'max:191'],
            'kilometraje_actual' => ['required', 'integer', 'min:0'],
            'costo' => ['required', 'numeric', 'min:0'],
            'estado' => ['nullable', Rule::in(['Completado', 'En Proceso', 'Pendiente'])],
        ]);

        $validated['estado'] = $validated['estado'] ?? 'Pendiente';

        if ($validated['estado'] === 'Completado') {
            $validated['fecha_completado'] = now()->toDateString();
        }

        $mantenimiento = Mantenimiento::create($validated)->load('vehiculo:id,numero_vehicular,placa,codigo_taxi,marca');

        return response()->json([
            'message' => 'Mantenimiento registrado correctamente.',
            'data' => $this->formatRecord($mantenimiento),
        ], 201);
    }

    public function updateEstado(Request $request, Mantenimiento $mantenimiento): JsonResponse
    {
        $validated = $request->validate([
            'estado' => ['required', Rule::in(['Completado', 'En Proceso', 'Pendiente'])],
        ]);

        $estadoAnterior = $mantenimiento->estado;
        $mantenimiento->estado = $validated['estado'];

        if ($validated['estado'] === 'Completado' && $estadoAnterior !== 'Completado') {
            $mantenimiento->fecha_completado = now()->toDateString();
        }

        $mantenimiento->save();
        $mantenimiento->load('vehiculo:id,numero_vehicular,placa,codigo_taxi,marca');

        return response()->json([
            'message' => 'Estado actualizado correctamente.',
            'data' => $this->formatRecord($mantenimiento),
        ]);
    }

    public function uploadComprobante(Request $request, Mantenimiento $mantenimiento): JsonResponse
    {
        $validated = $request->validate([
            'comprobante' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
        ]);

        if ($mantenimiento->comprobante_path) {
            Storage::disk('public')->delete($mantenimiento->comprobante_path);
        }

        $file = $validated['comprobante'];
        $path = $file->store('comprobantes-mantenimientos', 'public');

        $mantenimiento->update([
            'comprobante_path' => $path,
            'comprobante_nombre' => $file->getClientOriginalName(),
        ]);

        $mantenimiento->load('vehiculo:id,numero_vehicular,placa,codigo_taxi,marca');

        return response()->json([
            'message' => 'Comprobante subido correctamente.',
            'data' => $this->formatRecord($mantenimiento),
        ]);
    }

    private function formatRecord(Mantenimiento $mantenimiento): array
    {
        $vehiculo = $mantenimiento->vehiculo;

        return [
            'id' => $mantenimiento->id,
            'vehiculo_id' => $mantenimiento->vehiculo_id,
            'vehiculo' => $vehiculo,
            'identificador_vehiculo' => $vehiculo?->numero_vehicular ?: ($vehiculo?->placa ?: $vehiculo?->codigo_taxi),
            'tipo' => $mantenimiento->tipo,
            'descripcion' => $mantenimiento->descripcion,
            'fecha' => optional($mantenimiento->fecha)->toDateString(),
            'fecha_completado' => optional($mantenimiento->fecha_completado)->toDateString(),
            'mecanico' => $mantenimiento->mecanico,
            'kilometraje_actual' => $mantenimiento->kilometraje_actual,
            'costo' => (float) $mantenimiento->costo,
            'estado' => $mantenimiento->estado,
            'comprobante_path' => $mantenimiento->comprobante_path,
            'comprobante_nombre' => $mantenimiento->comprobante_nombre,
            'comprobante_url' => $mantenimiento->comprobante_path ? Storage::disk('public')->url($mantenimiento->comprobante_path) : null,
            'created_at' => optional($mantenimiento->created_at)->toISOString(),
            'updated_at' => optional($mantenimiento->updated_at)->toISOString(),
        ];
    }
}
