<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConfiguracionMantenimiento;
use Illuminate\Http\Request;

/**
 * Cada cuanto le toca a una unidad cada tipo de trabajo, y con cuanta
 * anticipacion avisarle al socio. De aqui sale el aviso que el socio ve
 * en su portal (ver App\Services\PlanMantenimiento).
 */
class ConfiguracionMantenimientoController extends Controller
{
    public function index()
    {
        // Los tipos por defecto los siembra ConfiguracionMantenimientoSeeder
        // en cada arranque: un GET no deberia escribir en la base.
        return response()->json(
            ConfiguracionMantenimiento::orderBy('tipo_mantenimiento')->get(),
            200
        );
    }

    public function update(Request $request)
    {
        $request->validate([
            'configuraciones' => 'required|array|min:1',
            'configuraciones.*.id' => 'required|exists:configuraciones_mantenimiento,id',
            // Entre 1 y 60 meses: fuera de ese rango el aviso deja de tener sentido.
            'configuraciones.*.meses_frecuencia' => 'required|integer|min:1|max:60',
            'configuraciones.*.dias_anticipacion' => 'required|integer|min:0|max:180',
        ]);

        foreach ($request->configuraciones as $config) {
            ConfiguracionMantenimiento::where('id', $config['id'])->update([
                'meses_frecuencia' => $config['meses_frecuencia'],
                'dias_anticipacion' => $config['dias_anticipacion'],
            ]);
        }

        return response()->json([
            'message' => 'Frecuencias de mantenimiento actualizadas con éxito.',
            'configuraciones' => ConfiguracionMantenimiento::orderBy('tipo_mantenimiento')->get(),
        ], 200);
    }
}
