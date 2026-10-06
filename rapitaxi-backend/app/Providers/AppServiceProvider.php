<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)->letters()->numbers());

        // Por correo (frena el ataque a una cuenta desde muchas IP) y por IP
        // (frena probar muchos correos desde un solo lugar).
        RateLimiter::for('login', function (Request $request) {
            $correo = strtolower((string) $request->input('email'));
            $respuesta = fn (Request $req, array $headers) => response()->json([
                'message' => 'Demasiados intentos de inicio de sesión. Espera un minuto e inténtalo de nuevo.',
            ], 429, $headers);

            return [
                Limit::perMinute(20)->by('login-ip:' . $request->ip())->response($respuesta),
                Limit::perMinute(5)->by('login-correo:' . $correo)->response($respuesta),
            ];
        });

        // Toda la API autenticada; las peticiones con archivos (comprobantes,
        // expedientes, libros) ademas tienen un tope propio mas bajo porque
        // cada una escribe en el almacenamiento y consume ancho de banda.
        RateLimiter::for('api', function (Request $request) {
            $clave = $request->user()?->id ?: $request->ip();
            $respuesta = fn (Request $req, array $headers) => response()->json([
                'message' => 'Estás haciendo demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.',
            ], 429, $headers);

            $limites = [Limit::perMinute(120)->by("api:{$clave}")->response($respuesta)];
            if ($request->allFiles()) {
                $limites[] = Limit::perMinute(20)->by("archivos:{$clave}")->response($respuesta);
            }

            return $limites;
        });
    }
}
