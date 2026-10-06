<?php

namespace Database\Seeders;

use App\Models\ConfiguracionMantenimiento;
use Illuminate\Database\Seeder;

/**
 * Frecuencias de arranque, pensadas para un taxi (uso intensivo diario).
 * El admin las ajusta despues desde Ajustes del Sistema.
 *
 * Es idempotente: solo crea los tipos que falten, nunca pisa lo que la
 * cooperativa ya haya configurado. Corre en cada arranque del contenedor
 * (ver DatabaseSeeder) para que el aviso del portal funcione desde el
 * primer dia, sin depender de que alguien entre a una pantalla.
 */
class ConfiguracionMantenimientoSeeder extends Seeder
{
    public const TIPOS_DEFECTO = [
        'Cambio de Aceite'   => ['meses_frecuencia' => 3,  'dias_anticipacion' => 15],
        'Frenos'             => ['meses_frecuencia' => 6,  'dias_anticipacion' => 15],
        'Suspensión'         => ['meses_frecuencia' => 12, 'dias_anticipacion' => 30],
        'Llantas'            => ['meses_frecuencia' => 12, 'dias_anticipacion' => 30],
        'Sistema Eléctrico'  => ['meses_frecuencia' => 12, 'dias_anticipacion' => 30],
    ];

    public function run(): void
    {
        foreach (self::TIPOS_DEFECTO as $tipo => $valores) {
            ConfiguracionMantenimiento::firstOrCreate(['tipo_mantenimiento' => $tipo], $valores);
        }
    }
}
