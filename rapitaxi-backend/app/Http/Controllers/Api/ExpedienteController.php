<?php

namespace App\Http\Controllers\Api;

use App\Support\Calendario;
use App\Http\Controllers\Controller;
use App\Models\Expediente;
use App\Models\Socio;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Services\ArchivoPrivado;

class ExpedienteController extends Controller
{
    // 1. Documentos de un socio o de una unidad (o todos).
    // Acepta ?socio_id=, ?vehiculo_id= y ?tipo=
    public function index(Request $request)
    {
        $query = Expediente::query();

        if ($request->filled('socio_id')) {
            // La carpeta de un socio, como la fisica, puede incluir los papeles de
            // las unidades que tiene hoy: la matricula esta ahi aunque sea del auto.
            if ($request->boolean('incluir_unidades')) {
                $unidades = Vehiculo::where('socio_id', $request->socio_id)->pluck('id');
                $query->where(fn ($q) => $q->where('socio_id', $request->socio_id)
                    ->orWhereIn('vehiculo_id', $unidades));
            } else {
                $query->where('socio_id', $request->socio_id);
            }
        }

        if ($request->filled('vehiculo_id')) {
            $query->where('vehiculo_id', $request->vehiculo_id);
        }

        if ($request->filled('tipo')) {
            $query->where('tipo_expediente', $request->tipo);
        }

        return response()->json($query->orderBy('id', 'desc')->get(), 200);
    }

    // 2. Catalogo de tipos, para que el formulario sepa cuales ofrecer y
    // cuales piden fecha de vencimiento.
    public function catalogo()
    {
        $tipos = collect(Expediente::TIPOS)->map(fn ($datos, $clave) => [
            'valor' => $clave,
            'etiqueta' => $datos['etiqueta'],
            // De quien es el papel: el formulario pide socio o unidad segun esto.
            'ambito' => $datos['ambito'],
            'vence' => $datos['vence'],
            'obligatorio' => $datos['obligatorio'],
        ])->values();

        return response()->json([
            'tipos' => $tipos,
            'dias_aviso_vencimiento' => Expediente::DIAS_AVISO_VENCIMIENTO,
        ], 200);
    }

    /**
     * 3. Estado del expediente de cada socio: que documentos obligatorios
     * tiene, cuales le faltan y cuales estan vencidos o por vencer.
     *
     * Es la consulta que antes no se podia responder: con el expediente como
     * "archivos con nombre libre" no habia forma de saber a quien le falta la
     * habilitacion ni que matriculas caducan este mes.
     */
    public function resumen(Request $request)
    {
        $socios = Socio::query()
            ->when($request->filled('socio_id'), fn ($q) => $q->where('id', $request->socio_id))
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'cedula']);

        $obligatoriosSocio = Expediente::tiposObligatorios(Expediente::AMBITO_SOCIO);
        $obligatoriosUnidad = Expediente::tiposObligatorios(Expediente::AMBITO_VEHICULO);

        $expedientes = $socios->isEmpty()
            ? collect()
            : Expediente::whereIn('socio_id', $socios->pluck('id'))->get();

        $resumen = $socios->map(fn (Socio $socio) => $this->estado(
            $expedientes->where('socio_id', $socio->id),
            $obligatoriosSocio,
            [
                'socio_id' => $socio->id,
                'nombre' => $socio->nombre,
                'cedula' => $socio->cedula,
            ]
        ));

        // Las unidades tienen su propio expediente: la matricula y la
        // habilitacion son del auto y se quedan con el cuando cambia de dueño.
        $unidades = Vehiculo::query()
            ->when($request->filled('vehiculo_id'), fn ($q) => $q->where('id', $request->vehiculo_id))
            ->when($request->filled('socio_id'), fn ($q) => $q->where('socio_id', $request->socio_id))
            ->orderBy('numero_vehiculo')
            ->get(['id', 'numero_vehiculo', 'placa', 'socio_id']);

        $deUnidades = $unidades->isEmpty()
            ? collect()
            : Expediente::whereIn('vehiculo_id', $unidades->pluck('id'))->get();

        $resumenUnidades = $unidades->map(fn (Vehiculo $unidad) => $this->estado(
            $deUnidades->where('vehiculo_id', $unidad->id),
            $obligatoriosUnidad,
            [
                'vehiculo_id' => $unidad->id,
                'numero_vehiculo' => $unidad->numero_vehiculo,
                'placa' => $unidad->placa,
                'socio_id' => $unidad->socio_id,
            ]
        ));

        return response()->json([
            'socios' => $resumen->values(),
            'unidades' => $resumenUnidades->values(),
            'obligatorios' => $obligatoriosSocio,
            'obligatorios_unidad' => $obligatoriosUnidad,
        ], 200);
    }

    /**
     * El estado de un expediente: que falta, que vencio y que esta por vencer.
     * Es el mismo calculo para una persona y para una unidad.
     *
     * @param  \Illuminate\Support\Collection<int, Expediente>  $documentos
     * @param  array<int, string>  $obligatorios
     * @param  array<string, mixed>  $cabecera
     * @return array<string, mixed>
     */
    private function estado($documentos, array $obligatorios, array $cabecera): array
    {
        $presentes = $documentos->pluck('tipo_expediente')->unique();

        $faltantes = collect($obligatorios)
            ->reject(fn ($tipo) => $presentes->contains($tipo))
            ->map(fn ($tipo) => ['tipo' => $tipo, 'etiqueta' => Expediente::TIPOS[$tipo]['etiqueta']])
            ->values();

        $porEstado = fn (string $estado) => $documentos
            ->filter(fn (Expediente $e) => $e->estado_vigencia === $estado)
            ->map(fn (Expediente $e) => [
                'id' => $e->id,
                'tipo' => $e->tipo_expediente,
                'etiqueta' => $e->tipo_etiqueta,
                'fecha_vencimiento' => $e->fecha_vencimiento?->toDateString(),
                'dias_para_vencer' => $e->dias_para_vencer,
            ])->values();

        $vencidos = $porEstado(Expediente::VENCIDO);
        $porVencer = $porEstado(Expediente::POR_VENCER);

        return $cabecera + [
            'total_documentos' => $documentos->count(),
            'obligatorios_presentes' => count($obligatorios) - $faltantes->count(),
            'obligatorios_totales' => count($obligatorios),
            'faltantes' => $faltantes,
            'vencidos' => $vencidos,
            'por_vencer' => $porVencer,
            'completo' => $faltantes->isEmpty() && $vencidos->isEmpty(),
        ];
    }
    // 4. Subir un documento al expediente de un socio
    public function store(Request $request)
    {
        $tiposValidos = array_keys(Expediente::TIPOS);

        $ambito = Expediente::ambitoDe((string) $request->tipo_expediente);
        $esDeUnidad = $ambito === Expediente::AMBITO_VEHICULO;

        // La matricula y la habilitacion describen el auto, no a la persona: se
        // adjuntan a la unidad para que viajen con ella cuando cambie de dueño.
        $request->validate([
            'socio_id'          => [Rule::requiredIf(! $esDeUnidad), 'nullable', Rule::exists('socios', 'id')->whereNull('deleted_at')],
            'vehiculo_id'       => [Rule::requiredIf($esDeUnidad), 'nullable', Rule::exists('vehiculos', 'id')->whereNull('deleted_at')],
            'nombre_documento'  => 'required|string|max:80',
            'tipo_expediente'   => ['required', Rule::in($tiposValidos)],
            'numero_documento'  => 'nullable|string|max:60',
            'fecha_emision'     => 'nullable|date|before_or_equal:' . Calendario::hoyString(),
            // Un documento caduca despues de emitirse, nunca antes.
            'fecha_vencimiento' => 'nullable|date|after:fecha_emision',
            'archivo'           => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        // Si el tipo lleva control de caducidad, la fecha es obligatoria: sin
        // ella el documento no puede entrar en el control de vencimientos.
        if (Expediente::TIPOS[$request->tipo_expediente]['vence']) {
            $request->validate([
                'fecha_vencimiento' => 'required|date|after:' . Calendario::hoyString(),
            ], [], ['fecha_vencimiento' => 'fecha de vencimiento']);
        }

        $file = $request->file('archivo');
        $ruta = $file->store('expedientes', 's3');

        $expediente = Expediente::create([
            // Solo uno de los dos: un papel es de la persona o de la unidad.
            'socio_id'          => $esDeUnidad ? null : $request->socio_id,
            'vehiculo_id'       => $esDeUnidad ? $request->vehiculo_id : null,
            'nombre_documento'  => $request->nombre_documento,
            'tipo_documento'    => strtolower($file->extension()),
            'tipo_expediente'   => $request->tipo_expediente,
            'numero_documento'  => $request->numero_documento,
            'fecha_emision'     => $request->fecha_emision,
            'fecha_vencimiento' => $request->fecha_vencimiento,
            'ruta_archivo'      => $ruta,
        ]);

        return response()->json([
            'message' => 'Documento subido correctamente.',
            'expediente' => $expediente,
        ], 201);
    }

    public function destroy($id)
    {
        $expediente = Expediente::find($id);

        if (!$expediente) {
            return response()->json(['message' => 'Documento no encontrado.'], 404);
        }

        Storage::disk('s3')->delete($expediente->ruta_archivo);
        $expediente->delete();

        return response()->json(['message' => 'Documento eliminado correctamente.'], 200);
    }

    // Enlace temporal (5 min) servido por R2, sin pasar por este servidor.
    public function download($id)
    {
        $expediente = Expediente::find($id);

        if (!$expediente) {
            return response()->json(['message' => 'Documento no encontrado.'], 404);
        }

        $nombreArchivo = ArchivoPrivado::nombreSeguro(
            $expediente->nombre_documento,
            $expediente->tipo_documento,
            'documento'
        );

        return response()->json([
            'url' => ArchivoPrivado::enlaceTemporal($expediente->ruta_archivo, $nombreArchivo),
        ], 200);
    }
}
