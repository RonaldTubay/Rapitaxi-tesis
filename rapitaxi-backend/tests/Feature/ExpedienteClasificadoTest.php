<?php

namespace Tests\Feature;

use App\Models\Expediente;
use App\Models\Socio;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

class ExpedienteClasificadoTest extends TestCase
{
    use CreaEscenarioApi, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        Storage::fake('s3');
    }

    private function documento(array $cambios = []): array
    {
        return $cambios + [
            'nombre_documento' => 'Habilitacion 2026',
            'tipo_expediente' => 'habilitacion',
            'fecha_vencimiento' => $this->enAnios(1),
            'archivo' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
        ];
    }

    /** @var array<int, \App\Models\Vehiculo> */
    private array $unidades = [];

    /** La unidad del socio, una sola por prueba: la placa es unica. */
    private function unidadDe(Socio $socio): \App\Models\Vehiculo
    {
        return $this->unidades[$socio->id] ??= $this->crearVehiculo($socio);
    }

    /**
     * Crea un documento directo en la base, saltando la validacion del alta.
     *
     * La matricula y la habilitacion describen el auto, asi que cuelgan de la
     * unidad; la cedula y la cesion, de la persona.
     */
    private function guardar(Socio $socio, string $tipo, ?string $vencimiento = null): Expediente
    {
        $deUnidad = Expediente::ambitoDe($tipo) === Expediente::AMBITO_VEHICULO;

        return Expediente::create([
            'socio_id' => $deUnidad ? null : $socio->id,
            'vehiculo_id' => $deUnidad ? $this->unidadDe($socio)->id : null,
            'nombre_documento' => 'Documento de prueba',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => $tipo,
            'fecha_vencimiento' => $vencimiento,
            'ruta_archivo' => 'expedientes/prueba.pdf',
        ]);
    }

    // ------------------------------------------------- catalogo

    public function test_el_catalogo_dice_que_tipos_existen_y_cuales_vencen(): void
    {
        $respuesta = $this->api($this->tokenDe($this->crearUsuario('operador')))
            ->getJson('/api/expedientes/catalogo')->assertOk();

        $tipos = collect($respuesta->json('tipos'));

        $this->assertTrue($tipos->contains('valor', 'habilitacion'));
        $this->assertTrue($tipos->contains('valor', 'cesion'));
        $this->assertTrue($tipos->firstWhere('valor', 'matricula')['vence']);
        $this->assertFalse($tipos->firstWhere('valor', 'cesion')['vence']);
        $this->assertTrue($tipos->firstWhere('valor', 'cedula')['obligatorio']);
        $respuesta->assertJsonPath('dias_aviso_vencimiento', 30);
    }

    // ------------------------------------------------- clasificacion al subir

    public function test_al_subir_un_documento_se_exige_clasificarlo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        $this->api($token)->post('/api/expedientes', $this->documento([
            'socio_id' => $socio->id, 'tipo_expediente' => null,
        ]), ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('tipo_expediente');

        $this->api($token)->post('/api/expedientes', $this->documento([
            'socio_id' => $socio->id, 'tipo_expediente' => 'pasaporte_galactico',
        ]), ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('tipo_expediente');
    }

    public function test_los_documentos_que_caducan_exigen_fecha_de_vencimiento(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        // La matricula caduca: sin fecha no entra al control de vencimientos.
        $this->api($token)->post('/api/expedientes', [
            'vehiculo_id' => $this->unidadDe($socio)->id, 'nombre_documento' => 'Matricula', 'tipo_expediente' => 'matricula',
            'archivo' => UploadedFile::fake()->create('m.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('fecha_vencimiento');

        // La carta de cesion no caduca: se acepta sin fecha.
        $this->api($token)->post('/api/expedientes', [
            'socio_id' => $socio->id, 'nombre_documento' => 'Cesion de acciones', 'tipo_expediente' => 'cesion',
            'archivo' => UploadedFile::fake()->create('c.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
    }

    public function test_un_documento_no_puede_vencer_antes_de_emitirse(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        $this->api($token)->post('/api/expedientes', $this->documento([
            'vehiculo_id' => $this->unidadDe($socio)->id,
            'fecha_emision' => $this->enDias(0),
            'fecha_vencimiento' => $this->enDias(-1),
        ]), ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('fecha_vencimiento');
    }

    public function test_el_documento_guardado_conserva_su_clasificacion(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        $this->api($token)->post('/api/expedientes', $this->documento([
            'vehiculo_id' => $this->unidadDe($socio)->id,
            'numero_documento' => '011-HV-013-DTTTSV-2025',
            'fecha_emision' => $this->enMeses(-1),
        ]), ['Accept' => 'application/json'])->assertStatus(201)
            ->assertJsonPath('expediente.tipo_expediente', 'habilitacion')
            ->assertJsonPath('expediente.tipo_etiqueta', 'Resolución de habilitación')
            ->assertJsonPath('expediente.numero_documento', '011-HV-013-DTTTSV-2025')
            ->assertJsonPath('expediente.estado_vigencia', 'Vigente');
    }

    // ------------------------------------------------- vigencia

    public function test_el_estado_de_vigencia_se_calcula_segun_la_fecha(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        $vigente = $this->guardar($socio, 'matricula', $this->enMeses(6));
        $porVencer = $this->guardar($socio, 'licencia', $this->enDias(10));
        $vencido = $this->guardar($socio, 'seguro', $this->enDias(-5));
        $sinFecha = $this->guardar($socio, 'cesion');

        // Sin filtrar por socio: la matricula y el seguro son de la unidad, no
        // de la persona, y aqui lo que se mira es el estado de vigencia.
        $porId = collect($this->api($token)->getJson('/api/expedientes')->assertOk()->json())
            ->keyBy('id');

        $this->assertSame('Vigente', $porId[$vigente->id]['estado_vigencia']);
        $this->assertSame('Por vencer', $porId[$porVencer->id]['estado_vigencia']);
        $this->assertSame('Vencido', $porId[$vencido->id]['estado_vigencia']);
        $this->assertSame('Sin vencimiento', $porId[$sinFecha->id]['estado_vigencia']);

        $this->assertSame(-5, $porId[$vencido->id]['dias_para_vencer']);
        $this->assertNull($porId[$sinFecha->id]['dias_para_vencer']);
    }

    // ------------------------------------------------- completitud

    public function test_el_resumen_dice_que_documentos_obligatorios_faltan(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        // La persona solo debe su cedula. La matricula y la habilitacion se le
        // piden a la unidad: exigirselas al socio dejaba a cada nuevo dueño
        // "incompleto" hasta volver a subir el mismo PDF con otro nombre.
        $this->guardar($socio, 'cedula', $this->enAnios(5));
        $unidad = $this->unidadDe($socio);

        $respuesta = $this->api($token)->getJson('/api/expedientes/resumen')->assertOk();

        $delSocio = collect($respuesta->json('socios'))->firstWhere('socio_id', $socio->id);
        $this->assertSame(1, $delSocio['obligatorios_presentes']);
        $this->assertSame(1, $delSocio['obligatorios_totales']);
        $this->assertTrue($delSocio['completo']);
        $this->assertEmpty($delSocio['faltantes']);

        $deLaUnidad = collect($respuesta->json('unidades'))->firstWhere('vehiculo_id', $unidad->id);
        $this->assertSame(2, $deLaUnidad['obligatorios_totales']);
        $this->assertFalse($deLaUnidad['completo']);

        $faltantes = collect($deLaUnidad['faltantes'])->pluck('tipo')->all();
        $this->assertContains('habilitacion', $faltantes);
        $this->assertContains('matricula', $faltantes);
    }

    public function test_un_expediente_con_todo_al_dia_figura_completo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        foreach (['cedula', 'habilitacion', 'matricula'] as $tipo) {
            $this->guardar($socio, $tipo, $this->enAnios(2));
        }

        $respuesta = $this->api($token)->getJson('/api/expedientes/resumen')->assertOk();

        $resumen = collect($respuesta->json('socios'))->firstWhere('socio_id', $socio->id);
        $this->assertTrue($resumen['completo']);
        $this->assertEmpty($resumen['faltantes']);
        $this->assertEmpty($resumen['vencidos']);

        $unidad = collect($respuesta->json('unidades'))->firstWhere('vehiculo_id', $this->unidadDe($socio)->id);
        $this->assertTrue($unidad['completo'], 'la unidad tiene matricula y habilitacion vigentes');
    }

    public function test_un_documento_obligatorio_vencido_deja_el_expediente_incompleto(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();

        $this->guardar($socio, 'cedula', $this->enAnios(2));
        $this->guardar($socio, 'habilitacion', $this->enAnios(2));
        // Presente pero caducada: el documento existe, pero ya no sirve.
        $this->guardar($socio, 'matricula', $this->enMeses(-1));

        $unidad = collect($this->api($token)->getJson('/api/expedientes/resumen')->assertOk()->json('unidades'))
            ->firstWhere('vehiculo_id', $this->unidadDe($socio)->id);

        $this->assertEmpty($unidad['faltantes']);
        $this->assertCount(1, $unidad['vencidos']);
        $this->assertSame('matricula', $unidad['vencidos'][0]['tipo']);
        $this->assertFalse($unidad['completo']);
    }

    public function test_el_resumen_avisa_de_los_documentos_por_vencer(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();
        $this->guardar($socio, 'matricula', $this->enDias(12));

        $resumen = collect($this->api($token)->getJson('/api/expedientes/resumen')->assertOk()->json('unidades'))
            ->firstWhere('vehiculo_id', $this->unidadDe($socio)->id);

        $this->assertCount(1, $resumen['por_vencer']);
        $this->assertSame(12, $resumen['por_vencer'][0]['dias_para_vencer']);
    }

    public function test_el_resumen_se_puede_pedir_de_un_solo_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socioA] = $this->crearSocioConCuenta();
        Socio::create(['nombre' => 'Otro Socio', 'cedula' => $this->cedulaValida(44), 'estado' => 'Activo']);

        $this->api($token)->getJson("/api/expedientes/resumen?socio_id={$socioA->id}")->assertOk()
            ->assertJsonCount(1, 'socios')
            ->assertJsonPath('socios.0.socio_id', $socioA->id);
    }

    public function test_los_documentos_se_pueden_filtrar_por_tipo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();
        $this->guardar($socio, 'cedula', $this->enAnios(3));
        $this->guardar($socio, 'cesion');

        $this->api($token)->getJson('/api/expedientes?tipo=cesion')->assertOk()->assertJsonCount(1);
        $this->api($token)->getJson('/api/expedientes?tipo=cedula')->assertOk()->assertJsonCount(1);
        $this->api($token)->getJson('/api/expedientes')->assertOk()->assertJsonCount(2);
    }

    // ------------------------------------------------- permisos

    public function test_un_socio_no_puede_ver_ni_el_catalogo_ni_el_resumen(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        $this->api($token)->getJson('/api/expedientes/catalogo')->assertStatus(403);
        $this->api($token)->getJson('/api/expedientes/resumen')->assertStatus(403);
    }
}
