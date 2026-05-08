<?php

namespace Database\Factories;

use App\Models\Vehiculo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehiculo>
 */
class VehiculoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'numero_vehicular' => 'NV-' . $this->faker->unique()->numberBetween(1000, 9999),
            'codigo_taxi' => 'TAX-' . $this->faker->unique()->numberBetween(100, 999),
            'placa' => strtoupper($this->faker->bothify('???-####')),
            'marca' => $this->faker->randomElement(['Toyota Corolla', 'Nissan Sentra', 'Hyundai Accent', 'Kia Rio']) . ' ' . $this->faker->year(),
            'color' => $this->faker->safeColorName(),
            'anio_modelo' => (int) $this->faker->year(),
            'kilometraje' => $this->faker->numberBetween(10000, 200000),
            'desgaste' => $this->faker->numberBetween(0, 100),
            'fecha_ultima_revision' => $this->faker->dateTimeBetween('-10 months', 'now'),
            'prox_mantenimiento' => $this->faker->dateTimeBetween('now', '+6 months'),
            'observacion' => $this->faker->optional()->sentence(),
            'estado' => $this->faker->randomElement(['Operativo', 'Mantenimiento']),
        ];
    }
}
