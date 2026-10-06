<?php

namespace Tests\Feature;

use App\Models\Expediente;
use Illuminate\Http\UploadedFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * De quien es cada papel.
 *
 * Reproduce una carpeta real de la cooperativa, la del cupo 012-01: cuatro PDF
 * que pertenecen a tres dueños distintos. La cedula es de la socia saliente, la
 * matricula y la habilitacion describen el auto, y el acta de cambio de socio no
 * es de nadie: es del hecho.
 *
 * Con un solo socio_id, los papeles del auto quedaban archivados bajo quien
 * fuera su dueño ese dia. Al traspasar el cupo, el entrante empezaba con el
 * expediente vacio aunque la unidad tuviera todo al dia.
 */
class ExpedienteDeLaUnidadTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        Storage::fake('s3');
    }

    private function pdf(string $nombre = 'doc.pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($nombre, 100, 'application/pdf');
    }

    public function test_la_matricula_se_adjunta_a_la_unidad_y_no_al_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio(['nombre' => 'Baque Piloco Isidro Fernando']);
        $unidad = $this->crearVehiculo($socio, ['placa' => 'MBC-4650']);

        $this->api($token)->post('/api/expedientes', [
            'vehiculo_id' => $unidad->id,
            'nombre_documento' => 'Matricula MBC-4650',
            'tipo_expediente' => 'matricula',
            'fecha_vencimiento' => $this->enAnios(4),
            'archivo' => $this->pdf('matricula.pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $documento = Expediente::where('tipo_expediente', 'matricula')->firstOrFail();

        $this->assertSame($unidad->id, $documento->vehiculo_id);
        $this->assertNull($documento->socio_id, 'la matricula describe el auto, no a la persona');
    }

    public function test_un_papel_de_la_unidad_exige_la_unidad_y_uno_de_la_persona_exige_la_persona(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();
        $unidad = $this->crearVehiculo($socio);

        // Matricula sin unidad: no se sabe de que auto es.
        $this->api($token)->post('/api/expedientes', [
            'socio_id' => $socio->id,
            'nombre_documento' => 'Matricula',
            'tipo_expediente' => 'matricula',
            'fecha_vencimiento' => $this->enAnios(2),
            'archivo' => $this->pdf(),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('vehiculo_id');

        // Cedula sin socio: no se sabe de quien es.
        $this->api($token)->post('/api/expedientes', [
            'vehiculo_id' => $unidad->id,
            'nombre_documento' => 'Cedula',
            'tipo_expediente' => 'cedula',
            'fecha_vencimiento' => $this->enAnios(2),
            'archivo' => $this->pdf(),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('socio_id');
    }

    /**
     * El caso de la carpeta 012-01: Alava Velez entrega el cupo a Baque Piloco.
     * Los papeles del auto se quedan con el auto.
     */
    public function test_al_cambiar_de_dueno_los_papeles_del_auto_se_quedan_con_el_auto(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $saliente = $this->crearSocio(['nombre' => 'Álava Vélez Rosa Elena', 'cedula' => '1312106006']);
        $entrante = $this->crearSocio(['nombre' => 'Baque Piloco Isidro Fernando', 'cedula' => '1311322539']);
        $unidad = $this->crearVehiculo($saliente, ['placa' => 'MBC-4650']);

        // La carpeta: la cedula es de ella, los dos papeles son del auto.
        $cedula = Expediente::create([
            'socio_id' => $saliente->id,
            'nombre_documento' => 'Cedula-Alava Velez Rosa Elena',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'cedula',
            'fecha_vencimiento' => $this->enAnios(3),
            'ruta_archivo' => 'expedientes/cedula.pdf',
        ]);

        foreach (['matricula' => $this->enAnios(4), 'habilitacion' => $this->enAnios(8)] as $tipo => $vence) {
            Expediente::create([
                'vehiculo_id' => $unidad->id,
                'nombre_documento' => strtoupper($tipo) . '-ISIDRO FERNANDO BAQUE PILOCO',
                'tipo_documento' => 'pdf',
                'tipo_expediente' => $tipo,
                'fecha_vencimiento' => $vence,
                'ruta_archivo' => 'expedientes/' . $tipo . '.pdf',
            ]);
        }

        $acta = Expediente::create([
            'socio_id' => $entrante->id,
            'nombre_documento' => 'CAMBIO DE SOCIO -ISIDRO FERNANDO BAQUE PILOCO',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'cambio_socio',
            'ruta_archivo' => 'expedientes/cambio.pdf',
        ]);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $entrante->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'numero_resolucion' => '011-HV-013-DTTTSV-2025',
            'expediente_id' => $acta->id,
        ])->assertCreated();

        // El cupo cambio de manos.
        $this->assertSame($entrante->id, $unidad->fresh()->socio_id);

        // Los papeles del auto siguen siendo del auto: nadie tuvo que volver a
        // subir el mismo PDF a nombre del entrante.
        $resumen = $this->api($token)->getJson('/api/expedientes/resumen')->assertOk();

        $deLaUnidad = collect($resumen->json('unidades'))->firstWhere('vehiculo_id', $unidad->id);
        $this->assertTrue($deLaUnidad['completo'], 'la unidad conserva matricula y habilitacion tras el traspaso');

        $delEntrante = collect($resumen->json('socios'))->firstWhere('socio_id', $entrante->id);
        $faltantes = collect($delEntrante['faltantes'])->pluck('tipo')->all();
        $this->assertNotContains('matricula', $faltantes, 'al entrante no se le exigen los papeles del auto');
        $this->assertNotContains('habilitacion', $faltantes);
        // Su cedula si se la debe: esa si es suya.
        $this->assertContains('cedula', $faltantes);

        // Y la cedula de la saliente sigue siendo de ella.
        $this->assertSame($saliente->id, $cedula->fresh()->socio_id);
        $this->assertSame(
            $saliente->id,
            collect($resumen->json('socios'))->firstWhere('socio_id', $saliente->id)['socio_id']
        );
    }

    public function test_los_documentos_se_pueden_pedir_por_unidad(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();
        $unidad = $this->crearVehiculo($socio);

        Expediente::create([
            'vehiculo_id' => $unidad->id,
            'nombre_documento' => 'Matricula',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'matricula',
            'fecha_vencimiento' => $this->enAnios(2),
            'ruta_archivo' => 'expedientes/m.pdf',
        ]);

        Expediente::create([
            'socio_id' => $socio->id,
            'nombre_documento' => 'Cedula',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'cedula',
            'fecha_vencimiento' => $this->enAnios(2),
            'ruta_archivo' => 'expedientes/c.pdf',
        ]);

        $this->api($token)->getJson("/api/expedientes?vehiculo_id={$unidad->id}")
            ->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.tipo_expediente', 'matricula');

        $this->api($token)->getJson("/api/expedientes?socio_id={$socio->id}")
            ->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.tipo_expediente', 'cedula');
    }

    // La carpeta del socio, como la fisica: sus papeles y los de sus unidades.
    public function test_la_carpeta_del_socio_puede_incluir_los_papeles_de_sus_unidades(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();
        $unidad = $this->crearVehiculo($socio);

        Expediente::create([
            'vehiculo_id' => $unidad->id, 'nombre_documento' => 'Matricula', 'tipo_documento' => 'pdf',
            'tipo_expediente' => 'matricula', 'fecha_vencimiento' => $this->enAnios(2),
            'ruta_archivo' => 'expedientes/m.pdf',
        ]);
        Expediente::create([
            'socio_id' => $socio->id, 'nombre_documento' => 'Cedula', 'tipo_documento' => 'pdf',
            'tipo_expediente' => 'cedula', 'fecha_vencimiento' => $this->enAnios(2),
            'ruta_archivo' => 'expedientes/c.pdf',
        ]);

        $this->api($token)->getJson("/api/expedientes?socio_id={$socio->id}&incluir_unidades=1")
            ->assertOk()->assertJsonCount(2);

        $this->api($token)->getJson("/api/expedientes?socio_id={$socio->id}")
            ->assertOk()->assertJsonCount(1);
    }

    public function test_el_catalogo_dice_de_quien_es_cada_tipo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));

        $tipos = collect($this->api($token)->getJson('/api/expedientes/catalogo')->assertOk()->json('tipos'))
            ->pluck('ambito', 'valor');

        $this->assertSame('vehiculo', $tipos['matricula']);
        $this->assertSame('vehiculo', $tipos['habilitacion']);
        $this->assertSame('socio', $tipos['cedula']);
        $this->assertSame('socio', $tipos['cambio_socio']);
    }

    // ------------------------------------------------- el acta del traspaso

    public function test_un_traspaso_sin_acta_no_se_registra(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $saliente = $this->crearSocio();
        $entrante = $this->crearSocio(['nombre' => 'Quien Recibe', 'cedula' => $this->cedulaValida(7)]);
        $unidad = $this->crearVehiculo($saliente);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $entrante->id,
            'fecha_traspaso' => $this->enMeses(-1),
        ])->assertStatus(422)->assertJsonValidationErrors('expediente_id');

        $this->assertSame($saliente->id, $unidad->fresh()->socio_id, 'el cupo no debio cambiar de manos');
    }

    // De las 66 carpetas no todas tienen el acta digitalizada. Exigirla a secas
    // obligaria a inventar datos para poder avanzar con la carga.
    public function test_se_puede_declarar_que_no_hay_acta_diciendo_por_que(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $saliente = $this->crearSocio();
        $entrante = $this->crearSocio(['nombre' => 'Quien Recibe', 'cedula' => $this->cedulaValida(7)]);
        $unidad = $this->crearVehiculo($saliente);

        // Declararlo sin decir por que no vale: quedaria un hueco sin explicacion.
        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $entrante->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'sin_acta' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('observaciones');

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $entrante->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'sin_acta' => true,
            'observaciones' => 'Carga histórica: el acta no está en la carpeta física.',
        ])->assertCreated();

        $this->assertSame($entrante->id, $unidad->fresh()->socio_id);
    }

    public function test_el_dashboard_cuenta_los_traspasos_que_quedaron_sin_respaldo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $saliente = $this->crearSocio();
        $entrante = $this->crearSocio(['nombre' => 'Quien Recibe', 'cedula' => $this->cedulaValida(7)]);
        $unidad = $this->crearVehiculo($saliente);

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()
            ->assertJsonPath('kpis.traspasos_sin_respaldo', 0);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $entrante->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'sin_acta' => true,
            'observaciones' => 'Carga histórica.',
        ])->assertCreated();

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()
            ->assertJsonPath('kpis.traspasos_sin_respaldo', 1);
    }
}
