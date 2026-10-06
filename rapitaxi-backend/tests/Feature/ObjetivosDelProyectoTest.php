<?php

namespace Tests\Feature;

use App\Models\Expediente;
use App\Models\Mantenimiento;
use App\Models\Revision;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * Verifica lo que el planteamiento del proyecto promete de forma explicita:
 *
 * - "mantenimientos preventivos, correctivos y alerta tecnica"
 * - "alerta preventiva antes de que expire una revision tecnica o una poliza"
 * - el expediente incluye "polizas de seguro, record de infracciones,
 *   licencias profesionales y certificaciones societarias"
 */
class ObjetivosDelProyectoTest extends TestCase
{
    use CreaEscenarioApi, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        // El portal valida el tipo de trabajo contra las frecuencias configuradas.
        $this->seed(\Database\Seeders\ConfiguracionMantenimientoSeeder::class);
        Storage::fake('s3');
    }

    // --------------------------- preventivo vs correctivo

    public function test_un_mantenimiento_se_registra_como_preventivo_o_correctivo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $base = [
            'vehiculo_id' => $vehiculo->id, 'fecha_mantenimiento' => $this->enDias(0),
            'tipo_mantenimiento' => 'Frenos', 'estado' => 'Programado',
        ];

        $this->api($token)->post('/api/mantenimientos', $base, ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('naturaleza');

        $this->api($token)->post('/api/mantenimientos', $base + ['naturaleza' => 'Cuando se dane'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('naturaleza');

        $this->api($token)->post('/api/mantenimientos', $base + ['naturaleza' => 'Correctivo'], ['Accept' => 'application/json'])
            ->assertStatus(201)->assertJsonPath('mantenimiento.naturaleza', 'Correctivo');
    }

    public function test_el_socio_indica_si_su_trabajo_fue_por_una_falla(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $datos = [
            'tipo_mantenimiento' => 'Frenos', 'fecha_mantenimiento' => $this->enDias(0),
            'kilometraje_actual' => 70000, 'observaciones' => 'Se daño el cilindro de frenos',
            'comprobante' => UploadedFile::fake()->create('f.pdf', 100, 'application/pdf'),
        ];

        $this->api($this->tokenDe($usuario))
            ->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $datos, ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('naturaleza');

        $this->api($this->tokenDe($usuario))
            ->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $datos + ['naturaleza' => 'Correctivo'], ['Accept' => 'application/json'])
            ->assertStatus(201);

        $this->assertSame('Correctivo', Mantenimiento::first()->naturaleza);

        // El historial de fallas de la unidad se puede consultar.
        $this->assertSame(1, Mantenimiento::where('vehiculo_id', $vehiculo->id)
            ->where('naturaleza', 'Correctivo')->count());
    }

    // --------------------------- alerta antes de que expire la RTV

    public function test_una_revision_aprobada_exige_hasta_cuando_vale(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $base = [
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enDias(-1),
            'tipo' => 'RTV Manta', 'estado' => 'Aprobada',
        ];

        // Sin fecha de caducidad no se puede avisar antes de que expire.
        $this->api($token)->postJson('/api/revisiones', $base)
            ->assertStatus(422)->assertJsonValidationErrors('fecha_vencimiento');

        // No puede caducar antes de haberse hecho.
        $this->api($token)->postJson('/api/revisiones', $base + ['fecha_vencimiento' => $this->enMeses(-1)])
            ->assertStatus(422)->assertJsonValidationErrors('fecha_vencimiento');

        $this->api($token)->postJson('/api/revisiones', $base + ['fecha_vencimiento' => $this->enAnios(1)])
            ->assertStatus(201);

        // Una pendiente todavia no vence nada.
        $this->api($token)->postJson('/api/revisiones', [
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enDias(10),
            'tipo' => 'RTV Manta', 'estado' => 'Pendiente',
        ])->assertStatus(201);
    }

    public function test_el_socio_ve_en_su_portal_cuando_vence_la_revision_tecnica(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);

        $revision = Revision::create([
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enMeses(-11),
            'fecha_vencimiento' => $this->enDias(20),
            'tipo' => 'RTV Manta', 'estado' => 'Aprobada',
        ]);

        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.revision_tecnica.estado', 'Por vencer')
            ->assertJsonPath('unidades.0.revision_tecnica.dias_para_vencer', 20);

        // Ya caducada
        $revision->update(['fecha_vencimiento' => $this->enDias(-3)]);
        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.revision_tecnica.estado', 'Vencida')
            ->assertJsonPath('unidades.0.revision_tecnica.dias_para_vencer', -3);

        // Con holgura
        $revision->update(['fecha_vencimiento' => $this->enMeses(8)]);
        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.revision_tecnica.estado', 'Vigente');
    }

    public function test_una_unidad_sin_revision_aprobada_no_reporta_vigencia(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        Revision::create([
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enMeses(-1),
            'tipo' => 'RTV Manta', 'estado' => 'Rechazada',
        ]);

        // Una rechazada no habilita al vehiculo, asi que no cuenta como vigencia.
        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.revision_tecnica', null);
    }

    // --------------------------- documentos que nombra el proyecto

    public function test_el_expediente_admite_los_documentos_que_plantea_el_proyecto(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));

        $tipos = collect($this->api($token)->getJson('/api/expedientes/catalogo')->assertOk()->json('tipos'))
            ->pluck('valor');

        // El planteamiento nombra: licencias profesionales, certificaciones
        // societarias, polizas de seguro, record de infracciones y aportaciones.
        foreach (['licencia', 'acciones', 'seguro', 'infraccion'] as $tipo) {
            $this->assertTrue($tipos->contains($tipo), "Falta el tipo de documento '{$tipo}'");
        }
    }

    public function test_una_poliza_de_seguro_avisa_antes_de_expirar(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        Expediente::create([
            'socio_id' => $socio->id, 'nombre_documento' => 'Poliza 2026',
            'tipo_documento' => 'pdf', 'tipo_expediente' => 'seguro',
            'fecha_vencimiento' => $this->enDias(15),
            'ruta_archivo' => 'expedientes/poliza.pdf',
        ]);

        $resumen = collect($this->api($token)->getJson('/api/expedientes/resumen')->assertOk()->json('socios'))
            ->firstWhere('socio_id', $socio->id);

        $this->assertCount(1, $resumen['por_vencer']);
        $this->assertSame('seguro', $resumen['por_vencer'][0]['tipo']);
        $this->assertSame(15, $resumen['por_vencer'][0]['dias_para_vencer']);
    }
}
