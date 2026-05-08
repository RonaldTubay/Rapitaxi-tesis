<?php

namespace Database\Factories;

use App\Models\Mantenimiento;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Mantenimiento>
 */
class MantenimientoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tipo' => $this->faker->randomElement(['Cambio de aceite', 'Revisión de frenos', 'Cambio de llantas', 'Alineación y balanceo', 'Revisión general']),
            'descripcion' => $this->faker->sentence(),
            'fecha' => $this->faker->dateTimeBetween('-1 year', '+1 month'),
            'mecanico' => $this->faker->name(),
            'kilometraje_actual' => $this->faker->numberBetween(10000, 200000),
            'costo' => $this->faker->randomFloat(2, 20, 500), // Precio entre $20.00 y $500.00
            'estado' => $this->faker->randomElement(['Completado', 'En Proceso', 'Pendiente']),
        ];
    }
}
