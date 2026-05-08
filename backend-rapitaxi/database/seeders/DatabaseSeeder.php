<?php

namespace Database\Seeders;

use App\Models\Expediente;
use App\Models\RevisionVehicular;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory(3)->create();

        // Creamos 10 socios, y para cada socio creamos 1 o 2 vehículos
        \App\Models\Socio::factory(10)->create()->each(function ($socio) {
            \App\Models\Vehiculo::factory(rand(1, 2))->create([
                'socio_id' => $socio->id,
                'accionista_id' => $socio->id,
            ])->each(function ($vehiculo) {
                // Para cada vehículo, creamos 3 registros de historial
                \App\Models\Mantenimiento::factory(3)->create([
                    'vehiculo_id' => $vehiculo->id
                ]);

                // Revision vehicular para alimentar el expediente.
                RevisionVehicular::create([
                    'vehiculo_id' => $vehiculo->id,
                    'registrado_por' => User::inRandomOrder()->value('id'),
                    'fecha_revision' => now()->subDays(rand(1, 120))->toDateString(),
                    'resultado' => collect(['Aprobado', 'Observado', 'Rechazado'])->random(),
                    'observacion' => fake()->sentence(),
                ]);

                Expediente::create([
                    'codigo' => 'EXP-' . str_pad((string) $vehiculo->id, 5, '0', STR_PAD_LEFT),
                    'socio_id' => $vehiculo->socio_id,
                    'vehiculo_id' => $vehiculo->id,
                    'elaborado_por' => User::inRandomOrder()->value('id'),
                    'fecha_emision' => now()->toDateString(),
                    'observacion_general' => 'Expediente generado automaticamente para pruebas.',
                    'estado' => 'Abierto',
                ]);
            });
        });
    }
}
