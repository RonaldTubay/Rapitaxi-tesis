<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notificacion;
use App\Models\Socio;
use App\Rules\CedulaEcuatoriana;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Http\Concerns\ListadoDeTabla;
use App\Rules\NombreDePersona;

class SocioController extends Controller
{
    use ListadoDeTabla;

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'id' => 'id',
        'nombre' => 'nombre',
        'cedula' => 'cedula',
        'estado' => 'estado',
        'created_at' => 'created_at',
    ];

    // Telefono ecuatoriano: 10 digitos, siempre empieza en 0.
    private const REGEX_TELEFONO = '/^0[0-9]{9}$/';

    // 1. Obtener todos los socios (Con soporte para el buscador de la interfaz)
    public function index(Request $request)
    {
        $query = Socio::query();

        // Si el usuario escribe algo en el buscador del frontend, filtramos la consulta.
        // LOWER() en ambos lados para que la busqueda no distinga mayusculas/minusculas
        // (en PostgreSQL, a diferencia de MySQL, LIKE por defecto SI distingue).
        if ($request->filled('search')) {
            $search = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(nombre) LIKE ?', [$search])
                  ->orWhereRaw('LOWER(cedula) LIKE ?', [$search])
                  ->orWhereHas('vehiculos', function ($vehiculosQuery) use ($search) {
                      $vehiculosQuery->whereRaw('LOWER(numero_vehiculo) LIKE ?', [$search])
                          ->orWhereRaw('LOWER(placa) LIKE ?', [$search]);
                  });
            });
        }

        // De las aportaciones solo se precarga la del mes en curso, que es la
        // unica que mira el accessor estado_pago_actual. Antes se traia el
        // historial completo de cada socio: con dos años de datos eran miles de
        // filas que nadie muestra, y la respuesta pasaba del megabyte.
        // Los desplegables de otras pantallas (aportaciones, expedientes,
        // vehiculos) necesitan TODOS los socios, no una pagina. Se les da una
        // lista minima: sin relaciones y sin atributos calculados, que es lo
        // que costaba consultas de mas para llenar un <select>.
        if ($request->boolean('select')) {
            $lista = $query->reorder('nombre')
                ->with(['user:id,is_active', 'vehiculos:id,socio_id,numero_vehiculo,placa'])
                ->get(['id', 'nombre', 'cedula', 'user_id']);

            // Solo cuenta_activa: los otros calculados (estado de pago, numero de
            // unidad) obligarian a traer aportaciones y no los usa ningun selector.
            $lista->each->append('cuenta_activa');
            $lista->each->makeHidden('user');

            return response()->json($lista, 200);
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'id');

        $socios = $query->with([
            'vehiculos',
            'user',
            'aportaciones' => fn ($q) => $q
                ->where('mes_pagado', now()->month)
                ->where('anio_pagado', now()->year),
        ])->paginate($this->porPagina($request));

        $socios->getCollection()->each->append(Socio::ATRIBUTOS_CALCULADOS);

        return response()->json($socios, 200);
    }

    // 2. Almacenar un nuevo socio: nombre, cedula, telefono y correo son
    // obligatorios (son los datos minimos para identificar y contactar a
    // un socio real de la cooperativa).
    public function store(Request $request)
    {
        $request->validate([
            'nombre'          => ['required', 'string', new NombreDePersona],
            'cedula'          => ['required', 'digits:10', new CedulaEcuatoriana, Rule::unique('socios', 'cedula')->whereNull('deleted_at')],
            'telefono'        => ['required', 'regex:' . self::REGEX_TELEFONO],
            'correo'          => 'required|email|max:100',
            'direccion'       => 'nullable|string|max:150',
            'estado'          => 'required|in:Activo,Inactivo',
            'observaciones'   => 'nullable|string|max:500',
        ]);

        $socio = Socio::create($request->only(['nombre', 'cedula', 'telefono', 'correo', 'direccion', 'estado', 'observaciones']));

        Notificacion::create([
            'tipo' => 'info',
            'titulo' => 'Socio registrado',
            'mensaje' => "Se registró el socio {$socio->nombre}.",
            'leida' => false
        ]);

        return response()->json([
            'message' => 'Socio registrado con éxito.',
            'socio' => $socio->append(Socio::ATRIBUTOS_CALCULADOS),
        ], 201);
    }

    // 3. Mostrar un socio específico por su ID
    public function show($id)
    {
        $socio = Socio::find($id);

        if (!$socio) {
            return response()->json(['message' => 'Socio no encontrado.'], 404);
        }

        return response()->json($socio->append(Socio::ATRIBUTOS_CALCULADOS), 200);
    }

    // 4. Actualizar los datos de un socio existente
    public function update(Request $request, $id)
    {
        $socio = Socio::find($id);

        if (!$socio) {
            return response()->json(['message' => 'Socio no encontrado.'], 404);
        }

        // Validamos la cédula asegurando que ignore el ID actual para permitir la actualización
        $request->validate([
            'nombre'          => ['required', 'string', new NombreDePersona],
            'cedula'          => ['required', 'digits:10', new CedulaEcuatoriana, Rule::unique('socios', 'cedula')->whereNull('deleted_at')->ignore($id)],
            'telefono'        => ['required', 'regex:' . self::REGEX_TELEFONO],
            'correo'          => 'required|email|max:100',
            'direccion'       => 'nullable|string|max:150',
            'estado'          => 'required|in:Activo,Inactivo',
            'observaciones'   => 'nullable|string|max:500',
        ]);

        $datos = $request->only(['nombre', 'cedula', 'telefono', 'correo', 'direccion', 'estado', 'observaciones']);

        // Pasar a Inactivo es una decision con peso (deja de aparecer como
        // socio operativo): exigimos que quede por que, junto con quien y
        // cuando lo hizo (eso ya lo cubre la auditoria).
        if ($socio->estado === 'Activo' && $datos['estado'] === 'Inactivo') {
            $request->validate(['motivo_baja' => 'required|string|max:300']);
            $datos['observaciones'] = $this->conMotivoBaja($request->motivo_baja, $datos['observaciones'] ?? null);
        }

        $seDaDeBaja = $socio->estado === 'Activo' && $datos['estado'] === 'Inactivo';

        $socio->update($datos);

        if ($seDaDeBaja) {
            $this->desactivarCuenta($socio);
        }

        return response()->json([
            'message' => 'Socio actualizado con éxito.',
            'socio' => $socio->append(Socio::ATRIBUTOS_CALCULADOS),
        ], 200);
    }

    // 5. Eliminar un socio del sistema (borrado suave: se puede reactivar despues)
    public function destroy(Request $request, $id)
    {
        $socio = Socio::find($id);

        if (!$socio) {
            return response()->json(['message' => 'Socio no encontrado.'], 404);
        }

        $request->validate(['motivo_baja' => 'required|string|max:300']);

        $socio->observaciones = $this->conMotivoBaja($request->motivo_baja, $socio->observaciones);
        $socio->save();

        $socio->delete();
        $this->desactivarCuenta($socio);

        return response()->json(['message' => 'Socio eliminado con éxito.'], 200);
    }

    // Un socio dado de baja no debe seguir entrando al portal ni con una
    // sesion que ya tenia abierta. Al reactivar al socio, el admin decide
    // por separado si vuelve a habilitar su cuenta.
    private function desactivarCuenta(Socio $socio): void
    {
        $cuenta = $socio->user;

        if ($cuenta) {
            $cuenta->update(['is_active' => false]);
            $cuenta->tokens()->delete();
        }
    }

    // Antepone el motivo (con fecha) a las observaciones existentes, sin
    // perder lo que ya hubiera escrito antes.
    private function conMotivoBaja(string $motivo, ?string $observacionesActuales): string
    {
        $nota = '[' . now()->format('d/m/Y H:i') . '] ' . $motivo;

        return $observacionesActuales ? "{$nota}\n\n{$observacionesActuales}" : $nota;
    }

    // 6. Listar socios dados de baja, para poder reactivarlos
    public function eliminados(Request $request)
    {
        $query = Socio::onlyTrashed()->orderBy('deleted_at', 'desc');

        if ($request->filled('search')) {
            $search = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(nombre) LIKE ?', [$search])
                  ->orWhereRaw('LOWER(cedula) LIKE ?', [$search]);
            });
        }

        // La pantalla muestra el estado de la cuenta de cada socio dado de baja,
        // asi que se precarga la relacion en vez de consultarla uno por uno.
        $eliminados = $query->with(['vehiculos', 'user'])->paginate($this->porPagina($request));
        $eliminados->getCollection()->each->append(Socio::ATRIBUTOS_CALCULADOS);

        return response()->json($eliminados, 200);
    }

    // 7. Reactivar un socio dado de baja, con todo su historial intacto
    public function restaurar($id)
    {
        $socio = Socio::onlyTrashed()->find($id);

        if (!$socio) {
            return response()->json(['message' => 'Socio eliminado no encontrado.'], 404);
        }

        // Si en el tiempo que estuvo dado de baja alguien mas tomo su cedula,
        // no lo dejamos reactivar hasta resolver ese choque.
        if ($socio->cedula && Socio::where('cedula', $socio->cedula)->whereNull('deleted_at')->exists()) {
            return response()->json([
                'message' => 'No se puede reactivar: ya existe otro socio activo con esta misma cedula.',
            ], 422);
        }

        $socio->restore();
        $socio->load([
            'vehiculos',
            'user',
            'aportaciones' => fn ($q) => $q
                ->where('mes_pagado', now()->month)
                ->where('anio_pagado', now()->year),
        ]);

        return response()->json([
            'message' => 'Socio reactivado con éxito.',
            'socio' => $socio->append(Socio::ATRIBUTOS_CALCULADOS),
        ], 200);
    }
}
