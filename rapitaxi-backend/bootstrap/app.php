<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php', // ¡Esta es la línea vital que faltaba!
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Activamos CORS globalmente
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);

        // Render pone su propio proxy/balanceador delante de la app: sin
        // confiar en el (todos, '*') $request->ip() devuelve la IP interna
        // de Render en vez de la IP real de quien hizo la peticion.
        $middleware->trustProxies(at: '*');

        // Global (no solo del grupo "api"): asi tambien cubre las respuestas de
        // error (401, 429), que Laravel genera antes de llegar a ese grupo.
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        $middleware->alias([
            'active' => \App\Http\Middleware\EnsureUserIsActive::class,
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
        ]);

        // Este backend no tiene ninguna pantalla de login por sesion (routes/web.php
        // solo tiene '/'), todo el login pasa por POST /api/login. Sin esto, un
        // invitado sin token en una ruta protegida hace que Laravel intente armar
        // una redireccion a la ruta con nombre 'login', que no existe, y eso
        // provoca un 500 (RouteNotFoundException) en vez de un 401 limpio.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Este backend es solo API: cualquier error en rutas api/* debe responder
        // en JSON siempre, sin importar el header Accept del cliente. Sin esto,
        // una peticion sin ese header a una ruta protegida sin sesion valida
        // hace que Laravel intente redirigir a una ruta 'login' que no existe
        // aqui, y eso termina en un 500 en vez de un 401 limpio.
        $exceptions->shouldRenderJsonWhen(function ($request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })->create();