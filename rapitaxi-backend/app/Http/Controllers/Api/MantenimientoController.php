<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mantenimiento;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Services\ArchivoPrivado;
use App\Http\Concerns\ListadoDeTabla;
use App\Support\Calendario;

class MantenimientoController extends Controller
{
    use ListadoDeTabla;

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'created_at' => 'created_at',
        'fecha_mantenimiento' => 'fecha_mantenimiento',
        'tipo_mantenimiento' => 'tipo_mantenimiento',
        'kilometraje_actual' => 'kilometraje_actual',
        'estado' => 'estado',
        'naturaleza' => 'naturaleza',
    ];

    /**
     * Paginado, con filtros y busqueda resueltos en el servidor.
     *
     * Parametros: ?revision=Pendiente (bandeja de lo que enviaron los socios),
     * ?estado=, ?search= y ?per_page=.
     *
     * La bandeja de pendientes se pide aparte con ?revision=Pendiente: si se
     * filtrara sobre la pagina visible, un pendiente en la pagina 3 no
     * aparecería y nadie lo revisaria nunca.
     */
    public function index(Request $request)
    {
        $query = Mantenimiento::with('vehiculo.socio');

        if ($request->filled('revision')) {
            $query->where('revision_estado', $request->revision);
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('search')) {
            $termino = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($termino) {
                $q->whereRaw('LOWER(tipo_mantenimiento) LIKE ?', [$termino])
                    ->orWhereHas('vehiculo', fn ($v) => $v
                        ->whereRaw('LOWER(placa) LIKE ?', [$termino])
                        ->orWhereRaw('LOWER(numero_vehiculo) LIKE ?', [$termino])
                        ->orWhereHas('socio', fn ($s) => $s->whereRaw('LOWER(nombre) LIKE ?', [$termino])));
            });
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'created_at');

        return response()->json($query->paginate($this->porPagina($request)), 200);
    }

    // Confirmar el registro que subio un socio: recien aqui la unidad
    // pasa a contar como atendida en el plan de mantenimiento.
    public function aprobar(Request $request, $id)
    {
        $mantenimiento = Mantenimiento::find($id);

        if (! $mantenimiento) {
            return response()->json(['message' => 'Registro no encontrado.'], 404);
        }

        if ($mantenimiento->revision_estado !== 'Pendiente') {
            return response()->json(['message' => 'Este registro ya fue revisado.'], 422);
        }

        $mantenimiento->update([
            'revision_estado' => 'Aprobado',
            'motivo_rechazo' => null,
            'revisado_por' => $request->user()->id,
            'revisado_en' => now(),
        ]);
        $mantenimiento->load('vehiculo.socio');

        return response()->json([
            'message' => 'Mantenimiento aprobado exitosamente.',
            'mantenimiento' => $mantenimiento,
        ], 200);
    }

    // Rechazar con motivo (respaldo ilegible, fecha equivocada, etc.): el
    // socio lo ve en su portal y puede volver a enviarlo.
    public function rechazar(Request $request, $id)
    {
        $mantenimiento = Mantenimiento::find($id);

        if (! $mantenimiento) {
            return response()->json(['message' => 'Registro no encontrado.'], 404);
        }

        if ($mantenimiento->revision_estado !== 'Pendiente') {
            return response()->json(['message' => 'Este registro ya fue revisado.'], 422);
        }

        $request->validate(['motivo_rechazo' => 'required|string|max:300']);

        $mantenimiento->update([
            'revision_estado' => 'Rechazado',
            'motivo_rechazo' => $request->motivo_rechazo,
            'revisado_por' => $request->user()->id,
            'revisado_en' => now(),
        ]);
        $mantenimiento->load('vehiculo.socio');

        return response()->json([
            'message' => 'Mantenimiento rechazado.',
            'mantenimiento' => $mantenimiento,
        ], 200);
    }

    public function store(Request $request)
    {
        $request->validate([
            'vehiculo_id'              => ['required', Rule::exists('vehiculos', 'id')->whereNull('deleted_at')],
            'fecha_mantenimiento'      => 'required|date',
            'tipo_mantenimiento'       => 'required|string|max:80',
            'mecanico'                 => 'nullable|string|max:80',
            'kilometraje_actual'       => 'nullable|integer|min:0|max:9999999',
            'proximo_mantenimiento_km' => 'nullable|integer|min:0|max:9999999',
            'estado'                   => 'required|in:Completado,En Proceso,Programado',
            // Preventivo: planificado por frecuencia. Correctivo: por una falla.
            // Distinguirlos es lo que permite ver el historial de fallas de una unidad.
            'naturaleza'               => 'required|in:Preventivo,Correctivo',
            'observaciones'            => 'nullable|string|max:800',
            'comprobante'              => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        if ($request->estado === 'Completado') {
            $request->validate([
                // Un trabajo ya terminado no puede tener fecha futura.
                'fecha_mantenimiento' => 'required|date|before_or_equal:' . Calendario::hoyString(),
                'kilometraje_actual' => 'required|integer|min:1|max:9999999',
                'observaciones' => 'required|string|max:800',
                'comprobante' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            ]);

            $this->validarKilometrajeNoRetrocede(
                (int) $request->vehiculo_id,
                (int) $request->kilometraje_actual,
                (string) $request->fecha_mantenimiento
            );

            if (in_array($request->tipo_mantenimiento, ['Cambio de Aceite', 'Frenos', 'Llantas'], true)) {
                $request->validate([
                    'proximo_mantenimiento_km' => 'required|integer|gt:kilometraje_actual|max:9999999',
                ]);
            }
        }

        // Solo campos validados del formulario: una ruta de R2 o los datos de
        // revision nunca deben llegar desde el cuerpo de la peticion.
        $datos = $request->only([
            'vehiculo_id', 'fecha_mantenimiento', 'tipo_mantenimiento',
            'mecanico', 'kilometraje_actual', 'proximo_mantenimiento_km',
            'estado', 'naturaleza', 'observaciones',
        ]);

        // Lo que registra el staff no pasa por revision, y nadie puede
        // mandar estos campos a mano en la peticion.
        $datos['origen'] = 'staff';
        $datos['revision_estado'] = 'Aprobado';
        $datos['motivo_rechazo'] = null;

        if ($request->estado !== 'Completado') {
            $datos['kilometraje_actual'] = 0;
            $datos['proximo_mantenimiento_km'] = null;
            $datos['observaciones'] = null;
        }

        if ($request->hasFile('comprobante')) {
            $datos['comprobante_ruta'] = $request->file('comprobante')
                ->store('comprobantes_mantenimiento', 's3');
        }

        $mantenimiento = Mantenimiento::create($datos);
        $mantenimiento->load('vehiculo.socio');

        return response()->json([
            'message' => 'Mantenimiento registrado con exito.',
            'mantenimiento' => $mantenimiento
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $mantenimiento = Mantenimiento::find($id);

        if (!$mantenimiento) {
            return response()->json(['message' => 'Registro no encontrado.'], 404);
        }

        if ($mantenimiento->estado === 'Completado') {
            return response()->json(['message' => 'No se puede modificar un mantenimiento completado.'], 422);
        }

        $request->validate([
            'estado'        => 'required|in:Completado,En Proceso,Programado',
            'kilometraje_actual' => 'nullable|integer|min:0|max:9999999',
            'proximo_mantenimiento_km' => 'nullable|integer|min:0|max:9999999',
            'observaciones' => 'nullable|string|max:800',
            'comprobante'   => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        if ($mantenimiento->estado === 'En Proceso' && $request->estado === 'Programado') {
            return response()->json(['message' => 'El estado solo puede avanzar; no se puede regresar a Programado.'], 422);
        }

        if ($request->estado === 'Completado') {
            $request->validate([
                'kilometraje_actual' => 'required|integer|min:1|max:9999999',
                'observaciones' => 'required|string|max:800',
                'comprobante' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            ]);

            // Si estaba programado para una fecha futura y se termino antes,
            // la fecha real del trabajo es hoy.
            if (Carbon::parse($mantenimiento->fecha_mantenimiento)->isFuture()) {
                $mantenimiento->fecha_mantenimiento = Calendario::hoyString();
            }

            $this->validarKilometrajeNoRetrocede(
                (int) $mantenimiento->vehiculo_id,
                (int) $request->kilometraje_actual,
                (string) $mantenimiento->fecha_mantenimiento,
                $mantenimiento->id
            );

            if (in_array($mantenimiento->tipo_mantenimiento, ['Cambio de Aceite', 'Frenos', 'Llantas'], true)) {
                $request->validate([
                    'proximo_mantenimiento_km' => 'required|integer|gt:kilometraje_actual|max:9999999',
                ]);
            }
        }

        $mantenimiento->estado = $request->estado;

        if ($request->estado === 'Completado') {
            $mantenimiento->kilometraje_actual = $request->kilometraje_actual;
            $mantenimiento->proximo_mantenimiento_km = $request->proximo_mantenimiento_km;
            $mantenimiento->observaciones = $request->observaciones;
        }

        if ($request->hasFile('comprobante')) {
            if ($mantenimiento->comprobante_ruta) {
                Storage::disk('s3')->delete($mantenimiento->comprobante_ruta);
            }

            $mantenimiento->comprobante_ruta = $request->file('comprobante')
                ->store('comprobantes_mantenimiento', 's3');
        }

        $mantenimiento->save();
        $mantenimiento->load('vehiculo.socio');

        return response()->json([
            'message' => 'Estado de mantenimiento actualizado con exito.',
            'mantenimiento' => $mantenimiento
        ], 200);
    }

    // El odometro de una unidad solo sube: un kilometraje menor al del
    // ultimo mantenimiento completado (a esa fecha o antes) es un error de
    // digitacion o un intento de esconder un dato.
    public function validarKilometrajeNoRetrocede(int $vehiculoId, int $km, string $fecha, ?int $ignorarId = null): void
    {
        $anterior = Mantenimiento::where('vehiculo_id', $vehiculoId)
            ->where('estado', 'Completado')
            ->whereDate('fecha_mantenimiento', '<=', $fecha)
            ->when($ignorarId, fn ($q) => $q->where('id', '!=', $ignorarId))
            ->orderByDesc('kilometraje_actual')
            ->first();

        if ($anterior && $km < $anterior->kilometraje_actual) {
            throw ValidationException::withMessages([
                'kilometraje_actual' => [
                    "El kilometraje ({$km} km) no puede ser menor al del último mantenimiento completado de esta unidad ({$anterior->kilometraje_actual} km).",
                ],
            ]);
        }
    }

    public function destroy($id)
    {
        $mantenimiento = Mantenimiento::find($id);

        if (!$mantenimiento) {
            return response()->json(['message' => 'Registro no encontrado.'], 404);
        }

        if ($mantenimiento->estado === 'Completado') {
            return response()->json(['message' => 'No se puede eliminar un mantenimiento completado.'], 422);
        }

        // Borrado suave: el registro (y su comprobante en R2) se conservan
        // para auditoria, solo se oculta del listado normal.
        $mantenimiento->delete();

        return response()->json(['message' => 'Mantenimiento eliminado.'], 200);
    }

    // Genera un enlace temporal (5 min) para ver/descargar el comprobante
    // directo desde R2. El archivo no pasa por este servidor.
    public function download($id)
    {
        $mantenimiento = Mantenimiento::find($id);

        if (!$mantenimiento || !$mantenimiento->comprobante_ruta) {
            return response()->json(['message' => 'Comprobante no encontrado.'], 404);
        }

        $nombreArchivo = ArchivoPrivado::nombreSeguro(
            'comprobante_' . $mantenimiento->id,
            pathinfo($mantenimiento->comprobante_ruta, PATHINFO_EXTENSION),
            'comprobante'
        );

        return response()->json([
            'url' => ArchivoPrivado::enlaceTemporal($mantenimiento->comprobante_ruta, $nombreArchivo),
        ], 200);
    }
}
