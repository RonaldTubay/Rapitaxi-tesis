<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notificacion;
use App\Models\Traspaso;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Http\Concerns\ListadoDeTabla;
use App\Support\Calendario;

class VehiculoController extends Controller
{
    use ListadoDeTabla;

    // Igual a como la ANT/GAD clasifica "TIPO" en la resolucion de habilitacion.
    private const TIPOS_VEHICULO = ['Sedán', 'Hatchback', 'SUV', 'Station Wagon', 'Furgoneta', 'Pickup', 'Van'];

    private const COMBUSTIBLES = ['Gasolina', 'Diesel', 'GLP', 'Eléctrico', 'Híbrido'];

    /**
     * Lo que trae la matricula y la resolucion de habilitacion en papel.
     *
     * Todos opcionales: las carpetas de la cooperativa no estan completas por
     * igual y exigirlos impediria registrar una unidad cuyo papel no llego.
     */
    private const CAMPOS_DE_PAPELES = [
        'color', 'color_secundario', 'disco', 'capacidad_carga',
        'numero_chasis', 'numero_motor', 'clase', 'cilindraje', 'numero_pasajeros',
        'fecha_matricula', 'fecha_caducidad_matricula', 'propietario_matricula',
        'numero_resolucion_habilitacion', 'fecha_resolucion_habilitacion',
        'fecha_caducidad_habilitacion',
    ];

    /** @return array<string, mixed> */
    private function reglasDeLosPapeles(Request $request): array
    {
        return [
            // La matricula trae COLOR 1 y COLOR 2. El color estaba fijo en
            // "Amarillo" dentro del codigo, asi que el acta decia dos y el
            // sistema uno inventado.
            'color' => ['nullable', 'string', 'max:30'],
            'color_secundario' => ['nullable', 'string', 'max:30'],
            'disco' => ['nullable', 'string', 'max:10'],
            'capacidad_carga' => ['nullable', 'numeric', 'min:0', 'max:99.99'],
            'numero_chasis' => ['nullable', 'string', 'max:30'],
            'numero_motor' => ['nullable', 'string', 'max:30'],
            'clase' => ['nullable', 'string', 'max:40'],
            'cilindraje' => ['nullable', 'integer', 'min:600', 'max:9999'],
            'numero_pasajeros' => ['nullable', 'integer', 'min:1', 'max:20'],
            'fecha_matricula' => ['nullable', 'date', 'before_or_equal:' . Calendario::hoyString()],
            // Una matricula puede estar caducada: por eso no se exige futura.
            'fecha_caducidad_matricula' => ['nullable', 'date', Rule::when($request->filled('fecha_matricula'), ['after:fecha_matricula'])],
            'propietario_matricula' => ['nullable', 'string', 'max:120'],
            'numero_resolucion_habilitacion' => ['nullable', 'string', 'max:60'],
            'fecha_resolucion_habilitacion' => ['nullable', 'date', 'before_or_equal:' . Calendario::hoyString()],
            'fecha_caducidad_habilitacion' => ['nullable', 'date', Rule::when($request->filled('fecha_resolucion_habilitacion'), ['after:fecha_resolucion_habilitacion'])],
        ];
    }

    // 1. Listar todos los vehículos con los datos de su dueño
    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'id' => 'id',
        'numero_vehiculo' => 'numero_vehiculo',
        'placa' => 'placa',
        'marca' => 'marca',
        'tipo_vehiculo' => 'tipo_vehiculo',
        'anio_fabricacion' => 'anio_fabricacion',
        'fecha_caducidad_matricula' => 'fecha_caducidad_matricula',
        'fecha_caducidad_habilitacion' => 'fecha_caducidad_habilitacion',
    ];

    public function index(Request $request)
    {
        $query = Vehiculo::query();

        if ($request->filled('search')) {
            $busqueda = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($busqueda) {
                $q->whereRaw('LOWER(numero_vehiculo) LIKE ?', [$busqueda])
                    ->orWhereRaw('LOWER(placa) LIKE ?', [$busqueda])
                    ->orWhereRaw('LOWER(marca) LIKE ?', [$busqueda]);
            });
        }

        // Los selectores de mantenimiento y revisiones piden la lista completa.
        if ($request->boolean('select')) {
            $lista = $query->with('socio:id,nombre')
                ->orderBy('numero_vehiculo')
                ->get(['id', 'numero_vehiculo', 'placa', 'socio_id']);

            // Sin la columna de caducidad seleccionada, el accesor diria
            // "Sin registrar" aunque la unidad si tenga fecha.
            $lista->each->makeHidden([
                'estado_matricula', 'dias_para_vencer_matricula',
                'estado_habilitacion', 'dias_para_vencer_habilitacion',
            ]);

            return response()->json($lista, 200);
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'id');

        return response()->json(
            $query->with('socio')->paginate($this->porPagina($request)),
            200
        );
    }

    // 2. Registrar las especificaciones de un vehículo
    public function store(Request $request)
    {
        $request->merge([
            'placa' => strtoupper($request->placa ?? ''),
        ]);
        // Dentro de tus métodos store y update:
        $request->validate([
            'socio_id'         => ['required', Rule::exists('socios', 'id')->whereNull('deleted_at')],
            'numero_vehiculo'  => ['required', 'regex:/^[0-9]{3}-[0-9]{2}$/', Rule::unique('vehiculos', 'numero_vehiculo')->whereNull('deleted_at')],
            'placa'            => ['required', 'regex:/^[A-Z]{3}-[0-9]{4}$/', Rule::unique('vehiculos', 'placa')->whereNull('deleted_at')],
            'marca'            => 'required|string|max:50',
            'tipo_vehiculo'    => ['required', Rule::in(self::TIPOS_VEHICULO)],
            'combustible'      => ['required', Rule::in(self::COMBUSTIBLES)],
            'anio_fabricacion' => 'required|integer|min:1980|max:' . (date('Y') + 1),
        ] + $this->reglasDeLosPapeles($request));

        // Lista explicita en vez de $request->all(): asi nada que venga en el
        // cuerpo de la peticion llega al modelo sin estar previsto aqui.
        $datos = $request->only([
            'socio_id', 'numero_vehiculo', 'placa', 'marca', 'tipo_vehiculo',
            'combustible', 'anio_fabricacion',
            ...self::CAMPOS_DE_PAPELES,
        ]);
        $datos['placa'] = strtoupper($datos['placa']);
        // Amarillo por defecto, que es el color de un taxi, pero ya no fijo:
        // el que manda es el de la matricula.
        $datos['color'] = ($datos['color'] ?? null) ?: 'Amarillo';

        $vehiculo = Vehiculo::create($datos);

        // Primer eslabon del historial: sin esto, la cadena de una unidad
        // empezaria en su primer traspaso y no se sabria quien la tuvo al
        // principio.
        Traspaso::create([
            'vehiculo_id' => $vehiculo->id,
            'socio_anterior_id' => null,
            'socio_nuevo_id' => $vehiculo->socio_id,
            'fecha_traspaso' => Calendario::hoyString(),
            'observaciones' => 'Asignación inicial al registrar la unidad.',
            'registrado_por' => $request->user()?->id,
        ]);

        $vehiculo->load('socio');

        Notificacion::create([
            'tipo' => 'info',
            'titulo' => 'Vehiculo registrado',
            'mensaje' => "Se registró el vehículo unidad {$vehiculo->numero_vehiculo} con placa {$vehiculo->placa}.",
            'leida' => false
        ]);

        return response()->json([
            'message' => 'Vehículo registrado con éxito.',
            'vehiculo' => $vehiculo
        ], 201);
    }

    // 3. Mostrar un vehículo específico
    public function show($id)
    {
        $vehiculo = Vehiculo::with('socio')->find($id);

        if (!$vehiculo) {
            return response()->json(['message' => 'Vehículo no encontrado.'], 404);
        }

        return response()->json($vehiculo, 200);
    }

    // 4. Actualizar datos técnicos del auto
    public function update(Request $request, $id)
    {
        $request->merge([
            'placa' => strtoupper($request->placa ?? ''),
        ]);
        $vehiculo = Vehiculo::find($id);

        if (!$vehiculo) {
            return response()->json(['message' => 'Vehículo no encontrado.'], 404);
        }

        // socio_id NO esta aqui a proposito: el dueño de un cupo solo cambia
        // registrando un traspaso, que deja constancia de la fecha del acta, el
        // numero de resolucion y la carta de cesion. Si este formulario lo
        // aceptara, se podria cambiar el dueño sin dejar rastro y el historial
        // de la unidad diria una cosa mientras la unidad dice otra.
        $request->validate([
            'numero_vehiculo'  => ['required', 'regex:/^[0-9]{3}-[0-9]{2}$/', Rule::unique('vehiculos', 'numero_vehiculo')->whereNull('deleted_at')->ignore($id)],
            'placa'            => ['required', 'regex:/^[A-Z]{3}-[0-9]{4}$/', Rule::unique('vehiculos', 'placa')->whereNull('deleted_at')->ignore($id)],
            'marca'            => 'required|string|max:50',
            'tipo_vehiculo'    => ['required', Rule::in(self::TIPOS_VEHICULO)],
            'combustible'      => ['required', Rule::in(self::COMBUSTIBLES)],
            'anio_fabricacion' => 'required|integer|min:1980|max:' . (date('Y') + 1),
        ] + $this->reglasDeLosPapeles($request));

        // Lista explicita en vez de $request->all(): asi un socio_id que venga
        // en el cuerpo de la peticion no llega al modelo ni por descuido.
        $datos = $request->only([
            'numero_vehiculo', 'placa', 'marca', 'tipo_vehiculo',
            'combustible', 'anio_fabricacion',
            ...self::CAMPOS_DE_PAPELES,
        ]);
        $datos['placa'] = strtoupper($datos['placa']);
        // Si un cliente antiguo no envia color al editar, conservar el que ya
        // figura en la matricula en vez de reemplazarlo silenciosamente.
        if (array_key_exists('color', $datos)) {
            $datos['color'] = $datos['color'] ?: 'Amarillo';
        }

        $vehiculo->update($datos);
        $vehiculo->load('socio');

        return response()->json([
            'message' => 'Vehículo actualizado con éxito.',
            'vehiculo' => $vehiculo
        ], 200);
    }

    // 5. Eliminar un vehículo de la flota
    public function destroy($id)
    {
        $vehiculo = Vehiculo::find($id);

        if (!$vehiculo) {
            return response()->json(['message' => 'Vehículo no encontrado.'], 404);
        }

        $vehiculo->delete();
        return response()->json(['message' => 'Vehículo eliminado con éxito.'], 200);
    }
}
