<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expediente;
use App\Models\Vehiculo;
use App\Models\ExpedienteDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Dompdf\Dompdf;
use Illuminate\Support\Str;

class ExpedienteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expediente::query()
            ->with([
                'socio:id,nombre,cedula,telefono,correo,estado',
                'vehiculo:id,numero_vehicular,placa,codigo_taxi,marca,color,anio_modelo,fecha_ultima_revision,observacion,estado',
                'elaboradoPor:id,name',
            ])
            ->orderByDesc('fecha_emision')
            ->orderByDesc('id');

        if ($request->filled('socio_id')) {
            $query->where('socio_id', (int) $request->input('socio_id'));
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado')->toString());
        }

        $periodo = $request->string('periodo')->toString();
        if ($periodo !== '') {
            switch ($periodo) {
                case 'ultimo_mes':
                    $query->whereDate('fecha_emision', '>=', now()->subMonth()->toDateString());
                    break;
                case 'mes':
                    if ($request->filled('month') && $request->filled('year')) {
                        $query->whereMonth('fecha_emision', (int) $request->input('month'));
                        $query->whereYear('fecha_emision', (int) $request->input('year'));
                    }
                    break;
                case 'anio':
                    if ($request->filled('year')) {
                        $query->whereYear('fecha_emision', (int) $request->input('year'));
                    }
                    break;
                case 'rango':
                    if ($request->filled('from')) {
                        $query->whereDate('fecha_emision', '>=', $request->string('from')->toString());
                    }
                    if ($request->filled('to')) {
                        $query->whereDate('fecha_emision', '<=', $request->string('to')->toString());
                    }
                    break;
            }
        }

        $expedientes = $query->get();

        return response()->json([
            'data' => $expedientes,
            'meta' => [
                'total' => $expedientes->count(),
                'abiertos' => $expedientes->where('estado', 'Abierto')->count(),
                'cerrados' => $expedientes->where('estado', 'Cerrado')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $modo = $request->input('modo', 'individual');

        $validated = $request->validate([
            'codigo' => ['nullable', 'string', 'max:255', 'unique:expedientes,codigo'],
            'modo' => ['nullable', 'in:individual,general,historico'],
            'socio_id' => [$modo === 'individual' ? 'required' : 'nullable', 'exists:socios,id'],
            'vehiculo_id' => [$modo === 'individual' ? 'required' : 'nullable', 'exists:vehiculos,id'],
            'elaborado_por' => ['nullable', 'exists:users,id'],
            'fecha_emision' => ['nullable', 'date'],
            'observacion_general' => ['nullable', 'string'],
            'estado' => ['nullable', 'in:Abierto,Cerrado'],
            'archivo' => [$modo === 'historico' ? 'required' : 'nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp,doc,docx', 'max:10240'],
        ]);

        if (!empty($validated['vehiculo_id']) && !empty($validated['socio_id'])) {
            $vehiculo = Vehiculo::findOrFail($validated['vehiculo_id']);
            if ((int) $vehiculo->socio_id !== (int) $validated['socio_id']) {
                return response()->json([
                    'message' => 'El vehiculo no pertenece al socio indicado.',
                ], 422);
            }
        }

        $validated['codigo'] = $validated['codigo'] ?? $this->generateCodigo();
        $validated['fecha_emision'] = $validated['fecha_emision'] ?? now()->toDateString();
        $validated['estado'] = $validated['estado'] ?? 'Abierto';
        $validated['tipo_registro'] = $modo === 'historico' ? 'cargado' : 'generado';

        if ($modo === 'historico') {
            // Accept single file 'archivo' or multiple 'archivos[]'
            $firstPath = null;
            $firstName = null;

            if ($request->hasFile('archivo')) {
                $file = $request->file('archivo');
                $path = $file->store('expedientes-historicos', 'public');
                $name = $file->getClientOriginalName();
                $firstPath = $path;
                $firstName = $name;
                // create documento record
                ExpedienteDocumento::create([
                    'expediente_id' => null, // will attach after expediente created
                    'nombre' => $name,
                    'ruta' => $path,
                    'mime' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                ]);
            }

            if ($request->hasFile('archivos')) {
                $files = $request->file('archivos');
                foreach ($files as $file) {
                    if (!$file) continue;
                    $path = $file->store('expedientes-historicos', 'public');
                    $name = $file->getClientOriginalName();
                    if (!$firstPath) {
                        $firstPath = $path;
                        $firstName = $name;
                    }
                    ExpedienteDocumento::create([
                        'expediente_id' => null,
                        'nombre' => $name,
                        'ruta' => $path,
                        'mime' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            if ($firstPath) {
                $validated['archivo_path'] = $firstPath;
                $validated['archivo_nombre'] = $firstName;
            }
        } else {
            if ($request->hasFile('archivo')) {
                $file = $request->file('archivo');
                $validated['archivo_path'] = $file->store('expedientes-historicos', 'public');
                $validated['archivo_nombre'] = $file->getClientOriginalName();
            }
        }

        unset($validated['modo']);
        unset($validated['archivo']);

        $expediente = Expediente::create($validated)->load([
            'socio',
            'vehiculo',
            'elaboradoPor',
        ]);

        // Attach any documentos created earlier (with expediente_id null)
        if ($modo === 'historico') {
            ExpedienteDocumento::whereNull('expediente_id')->where('ruta', 'like', 'expedientes-historicos/%')->update(['expediente_id' => $expediente->id]);
        }

        return response()->json([
            'message' => 'Expediente creado correctamente.',
            'data' => $expediente,
        ], 201);
    }

    public function archivo(Expediente $expediente)
    {
        if (empty($expediente->archivo_path) || !Storage::disk('public')->exists($expediente->archivo_path)) {
            return response()->json([
                'message' => 'Este expediente no tiene archivo cargado.',
            ], 404);
        }

        return Storage::disk('public')->download(
            $expediente->archivo_path,
            $expediente->archivo_nombre ?: basename($expediente->archivo_path)
        );
    }

    /** List documents for an expediente */
    public function documentos(Expediente $expediente)
    {
        $docs = ExpedienteDocumento::where('expediente_id', $expediente->id)->get();
        return response()->json(['data' => $docs]);
    }

    /** Download a specific documento */
    public function documentoDownload(Expediente $expediente, $documentoId)
    {
        $doc = ExpedienteDocumento::where('expediente_id', $expediente->id)->where('id', $documentoId)->first();
        if (!$doc || !Storage::disk('public')->exists($doc->ruta)) {
            return response()->json(['message' => 'Documento no encontrado.'], 404);
        }

        return Storage::disk('public')->download($doc->ruta, $doc->nombre);
    }

    public function acta(Expediente $expediente): JsonResponse
    {
        $expediente->load([
            'socio',
            'elaboradoPor',
            'vehiculo.accionista',
            'vehiculo.revisionesVehiculares.registradoPor',
            'vehiculo.mantenimientos',
        ]);

        $vehiculo = $expediente->vehiculo;
        $ultimaRevision = optional($vehiculo->revisionesVehiculares)
            ->sortByDesc('fecha_revision')
            ->first();

        $acta = [
            'empresa' => 'RAPITAXI',
            'expediente_codigo' => $expediente->codigo,
            'fecha_emision' => optional($expediente->fecha_emision)->toDateString(),
            'miembro' => [
                'id' => $expediente->socio?->id,
                'nombre' => $expediente->socio?->nombre,
                'cedula' => $expediente->socio?->cedula,
                'telefono' => $expediente->socio?->telefono,
                'correo' => $expediente->socio?->correo,
                'estado' => $expediente->socio?->estado,
            ],
            'vehiculo' => [
                'id' => $vehiculo?->id,
                'numero_vehicular' => $vehiculo?->numero_vehicular,
                'placa' => $vehiculo?->placa,
                'marca' => $vehiculo?->marca,
                'color' => $vehiculo?->color,
                'anio_modelo' => $vehiculo?->anio_modelo,
                'nombre_accionista' => $vehiculo?->accionista?->nombre,
                'fecha_ultima_revision' => optional($vehiculo?->fecha_ultima_revision)->toDateString(),
                'observacion' => $vehiculo?->observacion,
                'estado' => $vehiculo?->estado,
            ],
            'revision_vehicular_actual' => [
                'fecha_revision' => optional($ultimaRevision?->fecha_revision)->toDateString(),
                'resultado' => $ultimaRevision?->resultado,
                'observacion' => $ultimaRevision?->observacion,
                'registrado_por' => $ultimaRevision?->registradoPor?->name,
            ],
            'historial_revisiones' => $vehiculo?->revisionesVehiculares
                ?->sortByDesc('fecha_revision')
                ->values()
                ->map(function ($revision) {
                    return [
                        'id' => $revision->id,
                        'fecha_revision' => optional($revision->fecha_revision)->toDateString(),
                        'resultado' => $revision->resultado,
                        'observacion' => $revision->observacion,
                        'registrado_por' => $revision->registradoPor?->name,
                    ];
                }),
            'historial_mantenimientos' => $vehiculo?->mantenimientos
                ?->sortByDesc('fecha')
                ->values()
                ->map(function ($mantenimiento) {
                    return [
                        'id' => $mantenimiento->id,
                        'tipo' => $mantenimiento->tipo,
                        'descripcion' => $mantenimiento->descripcion,
                        'fecha' => optional($mantenimiento->fecha)->toDateString(),
                        'mecanico' => $mantenimiento->mecanico,
                        'kilometraje_actual' => $mantenimiento->kilometraje_actual,
                        'costo' => $mantenimiento->costo,
                        'estado' => $mantenimiento->estado,
                    ];
                }),
            'elaborado_por' => $expediente->elaboradoPor?->name,
            'observacion_general' => $expediente->observacion_general,
            'estado_expediente' => $expediente->estado,
        ];

        return response()->json([
            'message' => 'Acta generada correctamente.',
            'data' => $acta,
        ]);
    }

    /**
     * Genera la acta en PDF usando una vista Blade, la guarda en storage/public
     * y actualiza el expediente con la ruta del archivo.
     */
    public function generateAndStore(Request $request, Expediente $expediente): JsonResponse
    {
        $expediente->load([
            'socio',
            'elaboradoPor',
            'vehiculo.accionista',
            'vehiculo.revisionesVehiculares.registradoPor',
            'vehiculo.mantenimientos',
        ]);

        $vehiculo = $expediente->vehiculo;
        $ultimaRevision = optional($vehiculo->revisionesVehiculares)
            ->sortByDesc('fecha_revision')
            ->first();

        $acta = [
            'empresa' => 'RAPITAXI',
            'expediente_codigo' => $expediente->codigo,
            'fecha_emision' => optional($expediente->fecha_emision)->toDateString(),
            'miembro' => [
                'id' => $expediente->socio?->id,
                'nombre' => $expediente->socio?->nombre,
                'cedula' => $expediente->socio?->cedula,
                'telefono' => $expediente->socio?->telefono,
                'correo' => $expediente->socio?->correo,
                'estado' => $expediente->socio?->estado,
            ],
            'vehiculo' => [
                'id' => $vehiculo?->id,
                'numero_vehicular' => $vehiculo?->numero_vehicular,
                'placa' => $vehiculo?->placa,
                'marca' => $vehiculo?->marca,
                'color' => $vehiculo?->color,
                'anio_modelo' => $vehiculo?->anio_modelo,
                'nombre_accionista' => $vehiculo?->accionista?->nombre,
                'fecha_ultima_revision' => optional($vehiculo?->fecha_ultima_revision)->toDateString(),
                'observacion' => $vehiculo?->observacion,
                'estado' => $vehiculo?->estado,
            ],
            'revision_vehicular_actual' => [
                'fecha_revision' => optional($ultimaRevision?->fecha_revision)->toDateString(),
                'resultado' => $ultimaRevision?->resultado,
                'observacion' => $ultimaRevision?->observacion,
                'registrado_por' => $ultimaRevision?->registradoPor?->name,
            ],
            'historial_revisiones' => $vehiculo?->revisionesVehiculares
                ?->sortByDesc('fecha_revision')
                ->values()
                ->map(function ($revision) {
                    return [
                        'id' => $revision->id,
                        'fecha_revision' => optional($revision->fecha_revision)->toDateString(),
                        'resultado' => $revision->resultado,
                        'observacion' => $revision->observacion,
                        'registrado_por' => $revision->registradoPor?->name,
                    ];
                }),
            'historial_mantenimientos' => $vehiculo?->mantenimientos
                ?->sortByDesc('fecha')
                ->values()
                ->map(function ($mantenimiento) {
                    return [
                        'id' => $mantenimiento->id,
                        'tipo' => $mantenimiento->tipo,
                        'descripcion' => $mantenimiento->descripcion,
                        'fecha' => optional($mantenimiento->fecha)->toDateString(),
                        'mecanico' => $mantenimiento->mecanico,
                        'kilometraje_actual' => $mantenimiento->kilometraje_actual,
                        'costo' => $mantenimiento->costo,
                        'estado' => $mantenimiento->estado,
                    ];
                }),
            'elaborado_por' => $expediente->elaboradoPor?->name,
            'observacion_general' => $expediente->observacion_general,
            'estado_expediente' => $expediente->estado,
        ];

        // Renderizamos la vista Blade a HTML
        $html = view('expedientes.acta', ['acta' => $acta])->render();

        // Generamos PDF con Dompdf
        $dompdf = new Dompdf();
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $output = $dompdf->output();

        $filename = 'ACTA-' . Str::slug($expediente->codigo ?: 'expediente') . '-' . now()->format('YmdHis') . '.pdf';
        $path = 'expedientes/actas/' . $filename;

        Storage::disk('public')->put($path, $output);

        // Actualizamos expediente con la ruta del acta generada
        $expediente->archivo_path = $path;
        $expediente->archivo_nombre = $filename;
        $expediente->tipo_registro = 'generado';
        $expediente->save();

        $url = Storage::disk('public')->url($path);

        return response()->json([
            'message' => 'Acta generada y guardada correctamente.',
            'data' => [
                'archivo_path' => $path,
                'archivo_nombre' => $filename,
                'url' => $url,
            ],
        ]);
    }

    private function generateCodigo(): string
    {
        do {
            $codigo = 'EXP-' . now()->format('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        } while (Expediente::query()->where('codigo', $codigo)->exists());

        return $codigo;
    }
}
