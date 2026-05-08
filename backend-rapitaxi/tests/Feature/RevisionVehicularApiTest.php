<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vehiculo;
use Tests\TestCase;

class RevisionVehicularApiTest extends TestCase
{
    private Vehiculo $vehiculo;
    private User $usuario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->vehiculo = Vehiculo::factory()->create();
        $this->usuario = User::factory()->create();
    }

    public function test_registrar_revision_vehicular_exitosamente(): void
    {
        $response = $this->postJson('/api/revisiones-vehiculares', [
            'vehiculo_id' => $this->vehiculo->id,
            'registrado_por' => $this->usuario->id,
            'fecha_revision' => now()->toDateString(),
            'resultado' => 'Aprobado',
            'observacion' => 'Vehículo en buen estado',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'data' => [
                    'id',
                    'vehiculo_id',
                    'registrado_por',
                    'fecha_revision',
                    'resultado',
                    'observacion',
                ],
            ]);

        $this->assertDatabaseHas('revisiones_vehiculares', [
            'vehiculo_id' => $this->vehiculo->id,
            'resultado' => 'Aprobado',
        ]);
    }

    public function test_registrar_revision_actualiza_fecha_ultima_revision(): void
    {
        $nueva_fecha = now()->addDays(5)->toDateString();

        $response = $this->postJson('/api/revisiones-vehiculares', [
            'vehiculo_id' => $this->vehiculo->id,
            'registrado_por' => $this->usuario->id,
            'fecha_revision' => $nueva_fecha,
            'resultado' => 'Observado',
        ]);

        $response->assertStatus(201);

        $this->vehiculo->refresh();
        $this->assertEquals($nueva_fecha, $this->vehiculo->fecha_ultima_revision->toDateString());
    }

    public function test_registrar_revision_con_resultado_invalido(): void
    {
        $response = $this->postJson('/api/revisiones-vehiculares', [
            'vehiculo_id' => $this->vehiculo->id,
            'registrado_por' => $this->usuario->id,
            'fecha_revision' => now()->toDateString(),
            'resultado' => 'Invalido',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['resultado']);
    }

    public function test_registrar_revision_con_vehiculo_inexistente(): void
    {
        $response = $this->postJson('/api/revisiones-vehiculares', [
            'vehiculo_id' => 99999,
            'registrado_por' => $this->usuario->id,
            'fecha_revision' => now()->toDateString(),
            'resultado' => 'Aprobado',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['vehiculo_id']);
    }
}
