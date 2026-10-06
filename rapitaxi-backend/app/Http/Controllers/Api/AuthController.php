<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function user(Request $request)
    {
        return $request->user();
    }

    public function login(LoginRequest $request)
    {
        try {
            $credentials = $request->validated();

            $user = User::where('email', $credentials['email'])->first();

            if (! $user || ! Hash::check($credentials['password'], $user->password)) {
                throw ValidationException::withMessages([
                    'email' => ['Las credenciales ingresadas son incorrectas.'],
                ]);
            }

            if (! $user->is_active) {
                throw ValidationException::withMessages([
                    'email' => ['Esta cuenta ha sido desactivada. Contacta al administrador.'],
                ]);
            }

            $rol = $user->getRoleNames()->first();
            if (! $rol) {
                throw ValidationException::withMessages([
                    'email' => ['Tu cuenta no tiene un rol asignado. Contacta al administrador.'],
                ]);
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'message' => 'Ingreso exitoso',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $rol,
                ],
            ], 200);
        } catch (ValidationException $e) {
            throw $e;
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'No se pudo conectar con la base de datos. Intenta nuevamente en unos minutos o contacta al administrador.',
                'code' => 'database_connection_error',
            ], 503);
        }
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesion cerrada correctamente'], 200);
    }
}
