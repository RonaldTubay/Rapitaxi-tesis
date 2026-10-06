<?php

use App\Http\Controllers\Api\AportacionController;
use App\Http\Controllers\Api\AuditoriaController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConfiguracionMantenimientoController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmpresaController;
use App\Http\Controllers\Api\ExpedienteController;
use App\Http\Controllers\Api\LibroContableController;
use App\Http\Controllers\Api\MantenimientoController;
use App\Http\Controllers\Api\NotificacionController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\RevisionController;
use App\Http\Controllers\Api\SocioController;
use App\Http\Controllers\Api\SocioCuentaController;
use App\Http\Controllers\Api\SocioPortalController;
use App\Http\Controllers\Api\UsuarioController;
use App\Http\Controllers\Api\TraspasoController;
use App\Http\Controllers\Api\VehiculoController;
use Illuminate\Support\Facades\Route;

// Limite propio de intentos (ver RateLimiter "login" en AppServiceProvider)
// para dificultar la fuerza bruta sobre credenciales.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
    // Estas dos son validas para cualquier usuario autenticado (admin, operador o socio).
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Los datos de la compania encabezan el panel y el cuadro maestro, asi que
    // los lee cualquier rol. Modificarlos es cosa del admin (mas abajo).
    Route::get('empresa', [EmpresaController::class, 'show']);

    // Todo lo demas es el panel administrativo: nadie con rol "socio" puede
    // entrar aqui, ni desde la UI ni llamando a la API directamente.
    Route::middleware('role:admin|operador')->group(function () {
        // Deben ir antes del apiResource: si no, "eliminados" se interpreta
        // como {socio} y termina en el metodo show().
        Route::get('socios/eliminados', [SocioController::class, 'eliminados']);
        Route::put('socios/{id}/restaurar', [SocioController::class, 'restaurar']);
        Route::apiResource('socios', SocioController::class);
        Route::apiResource('aportaciones', AportacionController::class)->only(['index', 'store', 'destroy']);
        Route::put('aportaciones/{id}/aprobar', [AportacionController::class, 'aprobar']);
        Route::put('aportaciones/{id}/rechazar', [AportacionController::class, 'rechazar']);
        Route::get('aportaciones/{id}/comprobante', [AportacionController::class, 'comprobante']);
        // Antes del apiResource: si no, "catalogo" y "resumen" se toman como
        // un {expediente} y terminan en el metodo equivocado.
        Route::get('expedientes/catalogo', [ExpedienteController::class, 'catalogo']);
        Route::get('expedientes/resumen', [ExpedienteController::class, 'resumen']);
        Route::apiResource('expedientes', ExpedienteController::class)->only(['index', 'store', 'destroy']);
        Route::get('expedientes/{id}/download', [ExpedienteController::class, 'download']);
        Route::apiResource('vehiculos', VehiculoController::class);

        // Historial de a quien pertenecio cada cupo. Registrar un traspaso es lo
        // unico que cambia el dueño de una unidad.
        Route::get('vehiculos/{vehiculo}/traspasos', [TraspasoController::class, 'index']);
        Route::post('vehiculos/{vehiculo}/traspasos', [TraspasoController::class, 'store']);
        Route::get('socios/{socio}/traspasos', [TraspasoController::class, 'porSocio']);
        Route::apiResource('revisiones', RevisionController::class);
        Route::apiResource('mantenimientos', MantenimientoController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::get('mantenimientos/{id}/comprobante', [MantenimientoController::class, 'download']);
        Route::put('mantenimientos/{id}/aprobar', [MantenimientoController::class, 'aprobar']);
        Route::put('mantenimientos/{id}/rechazar', [MantenimientoController::class, 'rechazar']);
        Route::apiResource('libros-contables', LibroContableController::class)->only(['index', 'store', 'destroy']);
        Route::get('libros-contables/{id}/download', [LibroContableController::class, 'download']);

        Route::get('/reportes/cuadro-maestro', [ReporteController::class, 'cuadroMaestro']);
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

        Route::get('notificaciones', [NotificacionController::class, 'index']);
        Route::put('notificaciones/{id}/leer', [NotificacionController::class, 'marcarLeida']);
        Route::put('notificaciones/leer-todas', [NotificacionController::class, 'marcarTodasLeidas']);
    });

    // Solo el admin: gestion de personal interno, cuentas de socios y configuracion critica.
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('usuarios', UsuarioController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('socios/{socio}/cuenta', [SocioCuentaController::class, 'store']);
        Route::put('socios/{socio}/cuenta/estado', [SocioCuentaController::class, 'actualizarEstado']);

        Route::put('empresa', [EmpresaController::class, 'update']);

        Route::get('configuraciones-mantenimiento', [ConfiguracionMantenimientoController::class, 'index']);
        Route::put('configuraciones-mantenimiento', [ConfiguracionMantenimientoController::class, 'update']);

        Route::get('auditoria', [AuditoriaController::class, 'index']);
    });

    // Portal del socio: solo puede ver/editar su propia ficha y su propio
    // historial de aportaciones, nada del resto del sistema.
    Route::middleware('role:socio')->group(function () {
        Route::get('mi-perfil', [SocioPortalController::class, 'perfil']);
        Route::put('mi-perfil', [SocioPortalController::class, 'actualizarPerfil']);
        Route::get('mis-aportaciones', [SocioPortalController::class, 'misAportaciones']);
        Route::post('mis-aportaciones', [SocioPortalController::class, 'subirComprobante']);
        Route::get('mis-unidades', [SocioPortalController::class, 'misUnidades']);

        // El socio ve SU expediente: que documentos tiene, cuales le faltan y
        // cuales estan por vencer. Hasta ahora eso solo lo veia el staff.
        Route::get('mis-documentos', [SocioPortalController::class, 'misDocumentos']);
        Route::get('mis-documentos/{expediente}/descargar', [SocioPortalController::class, 'descargarMiDocumento']);
        Route::post('mis-unidades/{vehiculo}/mantenimientos', [SocioPortalController::class, 'registrarMantenimiento']);
    });
});
