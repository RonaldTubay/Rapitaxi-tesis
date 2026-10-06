<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si a un usuario le desactivan la cuenta mientras tiene un token valido,
 * pierde el acceso de inmediato en la siguiente peticion (no solo en el
 * proximo intento de login).
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $user->currentAccessToken()?->delete();

            return response()->json([
                'message' => 'Esta cuenta ha sido desactivada. Contacta al administrador.',
            ], 403);
        }

        return $next($request);
    }
}
