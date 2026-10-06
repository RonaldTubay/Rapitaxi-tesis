<?php

namespace App\Http\Controllers\Api;

use App\Support\Calendario;
use App\Http\Controllers\Controller;
use App\Models\Aportacion;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Services\ArchivoPrivado;
use App\Http\Concerns\ListadoDeTabla;

class AportacionController extends Controller
{
    use ListadoDeTabla;

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'id' => 'id',
        'monto' => 'monto',
        'fecha_pago' => 'fecha_pago',
        'anio_pagado' => 'anio_pagado',
        'mes_pagado' => 'mes_pagado',
        'estado' => 'estado',
    ];

    // 1. Obtener todos los Aportacions (incluyendo la información del socio)
    // Admite ?estado=Pendiente para la bandeja de comprobantes por revisar.
    // Paginado: esta tabla crece sin techo (cada socio suma 12 filas al año).
    // El filtro y la busqueda van en el servidor porque filtrar en el navegador
    // solo alcanzaria a la pagina que se esta viendo.
    public function index(Request $request)
    {
        $query = Aportacion::with('socio');

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('search')) {
            $termino = '%' . mb_strtolower($request->search) . '%';
            $query->whereHas('socio', fn ($q) => $q
                ->whereRaw('LOWER(nombre) LIKE ?', [$termino])
                ->orWhereRaw('LOWER(cedula) LIKE ?', [$termino]));
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'id');

        return response()->json($query->paginate($this->porPagina($request)), 200);
    }

    /** Entre 1 y 100 por pagina: un tope evita que alguien pida la tabla entera. */
    // 2. Registrar un nuevo Aportacion (uso interno: admin/operador, queda
    // Aprobado de inmediato porque lo capturo el staff directamente)
    public function store(Request $request)
    {
        $request->validate([
            'socio_id' => ['required', Rule::exists('socios', 'id')->whereNull('deleted_at')],
            'mes_pagado' => 'required|integer|min:1|max:12',
            'anio_pagado' => 'required|integer|min:2000|max:2100',
            'monto' => 'required|numeric|min:0.01|max:99999.99',
            'fecha_pago' => 'required|date|before_or_equal:' . Calendario::hoyString(),
            'metodo_pago' => 'nullable|string|max:30',
        ]);

        if ($this->tieneAportacionVigente($request->socio_id, $request->mes_pagado, $request->anio_pagado)) {
            return response()->json([
                'message' => 'Este socio ya tiene un Aportacion registrado para este mes y año.'
            ], 422); // 422 significa "Entidad no procesable" (Error de validación de negocio)
        }

        $aportacion = Aportacion::create([
            ...$request->only(['socio_id', 'mes_pagado', 'anio_pagado', 'monto', 'fecha_pago', 'metodo_pago']),
            'estado' => 'Aprobado',
        ]);

        // Cargamos los datos del socio recién asociado para devolverlos a React
        $aportacion->load('socio');

        return response()->json([
            'message' => 'Aportacion registrado exitosamente.',
            'aportacion' => $aportacion
        ], 201);
    }

    // 3. Eliminar un Aportacion (en caso de error del administrador)
    public function destroy($id)
    {
        $Aportacion = Aportacion::find($id);

        if (!$Aportacion) {
            return response()->json(['message' => 'Aportacion no encontrado.'], 404);
        }

        // El comprobante NO se borra de R2. Esta tabla usa borrado suave: el
        // registro sobrevive y se puede restaurar o auditar, asi que destruir el
        // archivo dejaba una aportacion apuntando a un comprobante inexistente.
        // En un sistema cuyo objeto es respaldar pagos, borrar la evidencia y
        // conservar el registro es exactamente al reves de lo que se necesita.
        $Aportacion->delete();

        return response()->json(['message' => 'Aportacion eliminado exitosamente.'], 200);
    }

    // 4. Aprobar un comprobante subido por el socio: pasa a contar como pago
    // valido para su estado_pago_actual.
    public function aprobar(Request $request, $id)
    {
        $aportacion = Aportacion::find($id);

        if (!$aportacion) {
            return response()->json(['message' => 'Aportacion no encontrado.'], 404);
        }

        if ($aportacion->estado !== 'Pendiente') {
            return response()->json(['message' => 'Esta aportacion ya fue revisada.'], 422);
        }

        $aportacion->update([
            'estado' => 'Aprobado',
            'motivo_rechazo' => null,
            'revisado_por' => $request->user()->id,
            'revisado_en' => now(),
        ]);
        $aportacion->load('socio');

        return response()->json([
            'message' => 'Comprobante aprobado exitosamente.',
            'aportacion' => $aportacion,
        ], 200);
    }

    // 5. Rechazar un comprobante subido por el socio (ej. monto no coincide,
    // comprobante ilegible, mes equivocado). El socio puede volver a subir
    // uno nuevo para el mismo periodo despues de esto.
    public function rechazar(Request $request, $id)
    {
        $aportacion = Aportacion::find($id);

        if (!$aportacion) {
            return response()->json(['message' => 'Aportacion no encontrado.'], 404);
        }

        if ($aportacion->estado !== 'Pendiente') {
            return response()->json(['message' => 'Esta aportacion ya fue revisada.'], 422);
        }

        $request->validate([
            'motivo_rechazo' => 'required|string|max:300',
        ]);

        $aportacion->update([
            'estado' => 'Rechazado',
            'motivo_rechazo' => $request->motivo_rechazo,
            'revisado_por' => $request->user()->id,
            'revisado_en' => now(),
        ]);
        $aportacion->load('socio');

        return response()->json([
            'message' => 'Comprobante rechazado.',
            'aportacion' => $aportacion,
        ], 200);
    }

    // 6. Ver el comprobante que subio el socio (URL temporal, 5 min, directo
    // desde R2; el archivo no pasa por este servidor).
    public function comprobante($id)
    {
        $aportacion = Aportacion::find($id);

        if (!$aportacion || !$aportacion->comprobante_ruta) {
            return response()->json(['message' => 'Comprobante no encontrado.'], 404);
        }

        $nombreArchivo = ArchivoPrivado::nombreSeguro(
            'comprobante_' . $aportacion->id,
            pathinfo($aportacion->comprobante_ruta, PATHINFO_EXTENSION),
            'comprobante'
        );

        return response()->json([
            'url' => ArchivoPrivado::enlaceTemporal($aportacion->comprobante_ruta, $nombreArchivo),
        ], 200);
    }

    // Bloquea duplicados para el mismo socio+mes+anio, salvo que el intento
    // anterior haya sido rechazado (ese si se puede volver a intentar).
    public function tieneAportacionVigente($socioId, $mes, $anio): bool
    {
        return Aportacion::where('socio_id', $socioId)
            ->where('mes_pagado', $mes)
            ->where('anio_pagado', $anio)
            ->where('estado', '!=', 'Rechazado')
            ->exists();
    }
}
