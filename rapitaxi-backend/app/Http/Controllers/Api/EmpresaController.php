<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Support\Calendario;
use App\Rules\NombreDePersona;
use App\Rules\RucEcuatoriano;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Los datos de la compania: razon social, RUC, permiso de operacion y quienes
 * firman los documentos impresos.
 *
 * Estaban escritos a mano en el dashboard y en el cuadro maestro, asi que
 * instalarlo en otra cooperativa obligaba a editar el codigo fuente.
 *
 * Los lee cualquier usuario autenticado, porque el encabezado y el cuadro
 * maestro los necesitan; solo el admin los modifica.
 */
class EmpresaController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Empresa::actual(), 200);
    }

    public function update(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'razon_social' => ['required', 'string', 'min:3', 'max:150'],
            'ruc' => ['nullable', 'string', new RucEcuatoriano],
            'permiso_operacion' => ['nullable', 'string', 'max:60'],
            'fecha_permiso_operacion' => ['nullable', 'date', 'before_or_equal:' . Calendario::hoyString()],
            // Puede estar caducado: por eso no se exige que sea futura.
            'fecha_caducidad_permiso' => ['nullable', 'date', 'after:fecha_permiso_operacion'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'ciudad' => ['nullable', 'string', 'max:80'],
            'provincia' => ['nullable', 'string', 'max:60'],
            'parroquia' => ['nullable', 'string', 'max:80'],
            // Las tres casillas del bloque "SERVICIO" del acta.
            'clase_transporte' => ['nullable', 'string', 'max:40'],
            'ambito_servicio' => ['nullable', 'string', 'max:60'],
            'tipo_servicio' => ['nullable', 'string', 'max:60'],
            // Formato local: 7 a 10 digitos, con o sin separadores.
            'telefono' => ['nullable', 'string', 'regex:/^[\d\s+()-]{7,20}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'gerente' => ['nullable', 'string', new NombreDePersona],
            'secretario' => ['nullable', 'string', new NombreDePersona],
        ], [
            'razon_social.required' => 'La razón social es obligatoria: encabeza todos los documentos impresos.',
            'telefono.regex' => 'El teléfono solo admite dígitos, espacios y los signos + ( ) -.',
        ]);

        $empresa = Empresa::query()->orderBy('id')->first();

        if ($empresa) {
            $empresa->update($datos);
        } else {
            // Una instalacion migrada desde una version anterior puede no tener
            // la fila: la creamos en vez de fallar con un 500.
            $empresa = Empresa::create($datos);
        }

        return response()->json([
            'message' => 'Datos de la compañía actualizados con éxito.',
            'empresa' => $empresa->fresh(),
        ], 200);
    }
}
