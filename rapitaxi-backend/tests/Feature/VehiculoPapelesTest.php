<?php

namespace Tests\Feature;

use App\Models\Notificacion;
use App\Models\Vehiculo;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

class VehiculoPapelesTest extends TestCase
{
    use CreaEscenarioApi, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    private function datosVehiculo(int $socioId): array
    {
        return [
            'socio_id' => $socioId,
            'numero_vehiculo' => '012-01',
            'placa' => 'MBC-4650',
            'marca' => 'KIA',
            'tipo_vehiculo' => 'Sedán',
            'combustible' => 'Gasolina',
            'anio_fabricacion' => 2015,
        ];
    }

    public function test_guarda_los_dos_vencimientos_y_calcula_sus_estados_por_separado(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $respuesta = $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'numero_chasis' => 'CHASIS123',
            'numero_motor' => 'MOTOR123',
            'fecha_matricula' => $this->enAnios(-1),
            'fecha_caducidad_matricula' => $this->enDias(8),
            'numero_resolucion_habilitacion' => 'RES-2025-01',
            'fecha_resolucion_habilitacion' => $this->enAnios(-1),
            'fecha_caducidad_habilitacion' => $this->enMeses(6),
        ])->assertCreated();

        $id = $respuesta->json('vehiculo.id');
        $respuesta->assertJsonPath('vehiculo.estado_matricula', 'Por vencer')
            ->assertJsonPath('vehiculo.dias_para_vencer_matricula', 8)
            ->assertJsonPath('vehiculo.estado_habilitacion', 'Vigente');

        $this->api($token)->putJson("/api/vehiculos/{$id}", array_diff_key(
            $this->datosVehiculo($socio->id), ['socio_id' => true]
        ) + [
            'fecha_caducidad_matricula' => $this->enDias(8),
            'fecha_caducidad_habilitacion' => $this->enDias(-2),
        ])->assertOk()
            ->assertJsonPath('vehiculo.estado_habilitacion', 'Vencida')
            ->assertJsonPath('vehiculo.dias_para_vencer_habilitacion', -2);
    }

    public function test_rechaza_vencimientos_anteriores_a_la_fecha_del_documento(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'fecha_matricula' => $this->enDias(-2),
            'fecha_caducidad_matricula' => $this->enDias(-3),
            'fecha_resolucion_habilitacion' => $this->enDias(-2),
            'fecha_caducidad_habilitacion' => $this->enDias(-3),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['fecha_caducidad_matricula', 'fecha_caducidad_habilitacion']);

        $this->assertSame(0, Vehiculo::count());
    }

    public function test_acepta_caducidades_antiguas_sin_fecha_de_emision_y_no_infla_el_selector(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'fecha_caducidad_matricula' => $this->enDias(-4),
            'fecha_caducidad_habilitacion' => $this->enDias(-7),
        ])->assertCreated()
            ->assertJsonPath('vehiculo.estado_matricula', 'Vencida')
            ->assertJsonPath('vehiculo.estado_habilitacion', 'Vencida');

        $selector = $this->api($token)->getJson('/api/vehiculos?select=1')->assertOk();
        $selector->assertJsonMissingPath('0.estado_matricula')
            ->assertJsonMissingPath('0.estado_habilitacion')
            ->assertJsonMissingPath('0.fecha_caducidad_matricula')
            ->assertJsonMissingPath('0.fecha_caducidad_habilitacion');
    }

    public function test_el_socio_ve_la_vigencia_de_sus_dos_documentos_sin_ver_notas_internas(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio, [
            'fecha_caducidad_matricula' => $this->enDias(5),
            'fecha_caducidad_habilitacion' => $this->enDias(-1),
        ]);

        $respuesta = $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk();
        $respuesta->assertJsonPath('unidades.0.matricula.estado', 'Por vencer')
            ->assertJsonPath('unidades.0.habilitacion.estado', 'Vencida')
            ->assertJsonPath('unidades.0.habilitacion.dias_para_vencer', -1);
        $this->assertStringNotContainsString('NOTA INTERNA', $respuesta->getContent());
    }

    public function test_el_comando_avisa_los_dos_papeles_sin_duplicar_avisos(): void
    {
        $socio = $this->crearSocio();
        $this->crearVehiculo($socio, [
            'fecha_caducidad_matricula' => $this->enDias(5),
            'fecha_caducidad_habilitacion' => $this->enDias(-2),
        ]);

        $this->artisan('vencimientos:avisar')->assertExitCode(0);
        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Matrícula por vencer',
            'mensaje' => 'La matrícula de la unidad 012-01 vence en 5 días.',
        ]);
        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Habilitación vencida',
            'mensaje' => 'La habilitación de la unidad 012-01 venció hace 2 días.',
        ]);
        $this->assertSame(2, Notificacion::count());
    }

    public function test_el_vencimiento_usa_el_dia_de_ecuador_y_no_el_de_utc(): void
    {
        Carbon::setTestNow('2026-10-03 00:30:00 UTC');
        try {
            $vehiculo = new Vehiculo([
                'fecha_caducidad_matricula' => '2026-10-02',
                'fecha_caducidad_habilitacion' => '2026-10-03',
            ]);

            $this->assertSame(0, $vehiculo->dias_para_vencer_matricula);
            $this->assertSame(1, $vehiculo->dias_para_vencer_habilitacion);
        } finally {
            Carbon::setTestNow();
        }
    }
    // La matricula trae COLOR 1 y COLOR 2, el numero de disco y la capacidad de
    // carga. El color estaba fijo en "Amarillo" dentro del codigo.
    public function test_guarda_los_colores_el_disco_y_la_capacidad_de_carga(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'color' => 'AMARILLO',
            'color_secundario' => 'NEGRO',
            'disco' => '01',
            'capacidad_carga' => 0.55,
        ])->assertCreated();

        $this->assertDatabaseHas('vehiculos', [
            'numero_vehiculo' => '012-01',
            'color' => 'AMARILLO',
            'color_secundario' => 'NEGRO',
            'disco' => '01',
            'capacidad_carga' => 0.55,
        ]);
    }

    // Un taxi es amarillo, asi que sigue siendo el valor por defecto; lo que ya
    // no es, es un dato inventado que ignora lo que dice la matricula.
    public function test_sin_color_sigue_poniendo_amarillo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id))->assertCreated();

        $this->assertDatabaseHas('vehiculos', ['numero_vehiculo' => '012-01', 'color' => 'Amarillo']);
    }

    public function test_rechaza_una_capacidad_de_carga_imposible(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'capacidad_carga' => 500,
        ])->assertStatus(422)->assertJsonValidationErrors('capacidad_carga');
    }

    public function test_editar_sin_enviar_color_conserva_el_de_la_matricula(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();

        $vehiculo = $this->api($token)->postJson('/api/vehiculos', $this->datosVehiculo($socio->id) + [
            'color' => 'AMARILLO',
        ])->assertCreated()->json('vehiculo');

        $this->api($token)->putJson('/api/vehiculos/'.$vehiculo['id'], array_diff_key(
            $this->datosVehiculo($socio->id), ['socio_id' => true]
        ))->assertOk();

        $this->assertDatabaseHas('vehiculos', ['id' => $vehiculo['id'], 'color' => 'AMARILLO']);
    }
}
