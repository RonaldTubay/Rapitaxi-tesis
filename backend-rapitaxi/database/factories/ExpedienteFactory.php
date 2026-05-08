<?php

namespace Database\Factories;

use App\Models\Expediente;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Expediente>
 */
class ExpedienteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'codigo' => 'EXP-' . now()->format('Ymd') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT),
            'fecha_emision' => $this->faker->date(),
            'observacion_general' => $this->faker->sentence(),
            'estado' => $this->faker->randomElement(['Abierto', 'Cerrado']),
        ];
    }
}
