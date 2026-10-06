<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Socio;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class SocioCuentaController extends Controller
{
    /**
     * Crea la cuenta de acceso de un socio (login para el futuro portal).
     * Solo el admin puede crearla; el socio no se autoregistra.
     */
    public function store(Request $request, Socio $socio)
    {
        if ($socio->user_id) {
            return response()->json([
                'message' => 'Este socio ya tiene una cuenta de acceso.',
            ], 422);
        }

        $validated = $request->validate([
            'email' => 'required|email|max:100|unique:users,email',
            'password' => ['required', 'string', 'max:100', Password::defaults()],
        ]);

        $user = User::create([
            'name' => $socio->nombre,
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);
        $user->assignRole('socio');

        // user_id no esta en $fillable a proposito (evita que SocioController::store/update,
        // que usan $request->all(), permitan enlazar cuentas de forma arbitraria). Se asigna
        // aqui de forma explicita porque este es el unico flujo autorizado para vincularlo.
        $socio->user_id = $user->id;
        $socio->save();

        return response()->json([
            'message' => 'Cuenta de acceso creada exitosamente.',
            'socio' => $socio->fresh()->append(Socio::ATRIBUTOS_CALCULADOS),
        ], 201);
    }

    /**
     * Activa o desactiva la cuenta de acceso (dar de baja sin borrar el historial).
     */
    public function actualizarEstado(Request $request, Socio $socio)
    {
        if (! $socio->user_id) {
            return response()->json([
                'message' => 'Este socio no tiene una cuenta de acceso todavia.',
            ], 422);
        }

        $validated = $request->validate([
            'activa' => 'required|boolean',
        ]);

        $socio->user()->update(['is_active' => $validated['activa']]);

        return response()->json([
            'message' => $validated['activa'] ? 'Cuenta activada exitosamente.' : 'Cuenta desactivada exitosamente.',
            'socio' => $socio->fresh()->append(Socio::ATRIBUTOS_CALCULADOS),
        ], 200);
    }
}
