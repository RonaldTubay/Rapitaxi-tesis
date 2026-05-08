<?php

namespace Database\Factories;

use App\Models\RevisionVehicular;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RevisionVehicular>
 */
class RevisionVehicularFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'fecha_revision' => $this->faker->dateTimeBetween('-10 months', 'now'),
            'resultado' => $this->faker->randomElement(['Aprobado', 'Observado', 'Rechazado']),
            'observacion' => $this->faker->optional()->sentence(),
        ];
    }
}
