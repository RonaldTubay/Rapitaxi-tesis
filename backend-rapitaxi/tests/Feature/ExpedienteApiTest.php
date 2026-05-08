<?php

namespace Tests\Feature;

use App\Models\Expediente;
use App\Models\RevisionVehicular;
use App\Models\Socio;
use App\Models\User;
use App\Models\Vehiculo;
use Tests\TestCase;

class ExpedienteApiTest extends TestCase
{
    private Socio $socio;
    private Vehiculo $vehiculo;
    private User $usuario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->socio = Socio::factory()->create();
        $this->vehiculo = Vehiculo::factory()->create([
            'socio_id' => $this->socio->id,
            'accionista_id' => $this->socio->id,
        ]);
        $this->usuario = User::factory()->create();
    }

    public function test_crear_expediente_exitosamente(): void
    {
        $response = $this->postJson('/api/expedientes', [
            'socio_id' => $this->socio->id,
            'vehiculo_id' => $this->vehiculo->id,
            'elaborado_por' => $this->usuario->id,
            'observacion_general' => 'Expediente de prueba',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'data' => [
                    'id',
                    'codigo',
                    'socio_id',
                    'vehiculo_id',
                    'elaborado_por',
                    'fecha_emision',
                    'observacion_general',
                    'estado',
                ],
            ]);

        $this->assertDatabaseHas('expedientes', [
            'socio_id' => $this->socio->id,
            'vehiculo_id' => $this->vehiculo->id,
        ]);
    }

    public function test_crear_expediente_con_vehiculo_de_otro_socio(): void
    {
        $otro_socio = Socio::factory()->create();
        $otro_vehiculo = Vehiculo::factory()->create(['socio_id' => $otro_socio->id]);

        $response = $this->postJson('/api/expedientes', [
            'socio_id' => $this->socio->id,
            'vehiculo_id' => $otro_vehiculo->id,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'El vehiculo no pertenece al socio indicado.']);
    }

    public function test_generar_acta_de_expediente(): void
    {
        $expediente = Expediente::factory()->create([
            'socio_id' => $this->socio->id,
            'vehiculo_id' => $this->vehiculo->id,
            'elaborado_por' => $this->usuario->id,
        ]);

        RevisionVehicular::factory()->create([
            'vehiculo_id' => $this->vehiculo->id,
            'registrado_por' => $this->usuario->id,
        ]);

        $response = $this->getJson("/api/expedientes/{$expediente->id}/acta");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'data' => [
                    'empresa',
                    'expediente_codigo',
                    'fecha_emision',
                    'miembro' => [
                        'id',
                        'nombre',
                        'cedula',
                        'telefono',
                        'correo',
                        'estado',
                    ],
                    'vehiculo' => [
                        'id',
                        'numero_vehicular',
                        'placa',
                        'marca',
                        'anio_modelo',
                        'fecha_ultima_revision',
                    ],
                    'revision_vehicular_actual' => [
                        'fecha_revision',
                        'resultado',
                    ],
                    'historial_revisiones',
                    'historial_mantenimientos',
                    'estado_expediente',
                ],
            ]);
    }
}
