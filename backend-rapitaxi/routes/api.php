<?php

use App\Http\Controllers\Api\ExpedienteController;
use App\Http\Controllers\Api\MantenimientoController;
use App\Http\Controllers\Api\RevisionVehicularController;
use App\Http\Controllers\Api\SocioController;
use App\Http\Controllers\Api\VehiculoController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
// Ruta pública para login
Route::post('/login', [AuthController::class, 'login']);
// Rutas protegidas (aquí meterás las de socios, vehículos, etc.)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    // Generación y guardado de acta (solo usuarios autenticados)
    Route::post('/expedientes/{expediente}/acta/generate', [ExpedienteController::class, 'generateAndStore']);
    Route::get('/expedientes/{expediente}/documentos', [ExpedienteController::class, 'documentos']);
    Route::get('/expedientes/{expediente}/documentos/{documento}/download', [ExpedienteController::class, 'documentoDownload']);
    // Ejemplo: Route::apiResource('socios', SocioController::class);
});


Route::post('/revisiones-vehiculares', [RevisionVehicularController::class, 'store']);
Route::get('/revisiones-vehiculares', [RevisionVehicularController::class, 'index']);
Route::get('/expedientes', [ExpedienteController::class, 'index']);
Route::post('/expedientes', [ExpedienteController::class, 'store']);
Route::get('/expedientes/{expediente}/acta', [ExpedienteController::class, 'acta']);
Route::get('/expedientes/{expediente}/archivo', [ExpedienteController::class, 'archivo']);

Route::get('/mantenimientos', [MantenimientoController::class, 'index']);
Route::post('/mantenimientos', [MantenimientoController::class, 'store']);
Route::patch('/mantenimientos/{mantenimiento}/estado', [MantenimientoController::class, 'updateEstado']);
Route::post('/mantenimientos/{mantenimiento}/comprobante', [MantenimientoController::class, 'uploadComprobante']);

Route::get('/vehiculos', [VehiculoController::class, 'index']);
Route::post('/vehiculos', [VehiculoController::class, 'store']);
Route::get('/vehiculos/{vehiculo}', [VehiculoController::class, 'show']);
Route::put('/vehiculos/{vehiculo}', [VehiculoController::class, 'update']);
Route::delete('/vehiculos/{vehiculo}', [VehiculoController::class, 'destroy']);

Route::get('/socios', [SocioController::class, 'index']);
Route::post('/socios', [SocioController::class, 'store']);
Route::get('/socios/{socio}', [SocioController::class, 'show']);
Route::put('/socios/{socio}', [SocioController::class, 'update']);
Route::delete('/socios/{socio}', [SocioController::class, 'destroy']);
