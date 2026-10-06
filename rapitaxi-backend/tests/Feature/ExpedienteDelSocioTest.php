<?php

namespace Tests\Feature;

use App\Models\Aportacion;
use App\Models\Expediente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * El socio viendo su propio expediente.
 *
 * El proyecto se llama "gestion digital de expedientes de socios". Durante
 * mucho tiempo solo el staff veia que documentos tenia cada quien: el socio,
 * dueño de esos papeles, tenia que ir a la oficina a preguntar si le faltaba
 * renovar la habilitacion.
 */
class ExpedienteDelSocioTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        Storage::fake('s3');
    }

    /** @var array<int, \App\Models\Vehiculo> */
    private array $unidades = [];

    /** La unidad del socio, una sola por prueba: la placa es unica. */
    private function unidadDe(int $socioId): \App\Models\Vehiculo
    {
        return $this->unidades[$socioId] ??= $this->crearVehiculo(\App\Models\Socio::find($socioId));
    }

    /**
     * La matricula y la habilitacion son de la unidad, no de la persona: el
     * socio las ve en su portal porque tiene ese cupo hoy, no porque sean suyas.
     */
    private function documento(int $socioId, string $tipo, array $extra = []): Expediente
    {
        $deUnidad = Expediente::ambitoDe($tipo) === Expediente::AMBITO_VEHICULO;

        return Expediente::create($extra + [
            'socio_id' => $deUnidad ? null : $socioId,
            'vehiculo_id' => $deUnidad ? $this->unidadDe($socioId)->id : null,
            'nombre_documento' => 'Documento ' . $tipo,
            'tipo_documento' => 'pdf',
            'tipo_expediente' => $tipo,
            'ruta_archivo' => 'expedientes/' . $tipo . '-' . $socioId . '.pdf',
        ]);
    }

    public function test_el_socio_ve_sus_documentos_con_su_estado_de_vigencia(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        $this->documento($socio->id, 'cedula', ['fecha_vencimiento' => $this->enAnios(1)]);
        $this->documento($socio->id, 'habilitacion', ['fecha_vencimiento' => $this->enDias(10)]);
        $this->documento($socio->id, 'matricula', ['fecha_vencimiento' => $this->enDias(-3)]);

        $respuesta = $this->api($token)->getJson('/api/mis-documentos')->assertOk();

        $this->assertSame(3, $respuesta->json('resumen.total'));
        $this->assertSame(1, $respuesta->json('resumen.vencidos'));
        $this->assertSame(1, $respuesta->json('resumen.por_vencer'));
        $this->assertFalse($respuesta->json('resumen.completo'), 'con un obligatorio vencido no esta completo');

        $estados = collect($respuesta->json('documentos'))->pluck('estado', 'tipo');
        $this->assertSame('Vencido', $estados['matricula']);
        $this->assertSame('Por vencer', $estados['habilitacion']);
        $this->assertSame('Vigente', $estados['cedula']);
    }

    public function test_el_socio_ve_que_documentos_obligatorios_le_faltan(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        $this->documento($socio->id, 'cedula', ['fecha_vencimiento' => $this->enAnios(1)]);
        // Tiene un cupo, asi que se le exigen tambien los papeles de esa unidad.
        $unidad = $this->unidadDe($socio->id);

        $respuesta = $this->api($token)->getJson('/api/mis-documentos')->assertOk();

        $faltantes = collect($respuesta->json('faltantes'))->pluck('tipo')->all();

        $this->assertContains('habilitacion', $faltantes);
        $this->assertContains('matricula', $faltantes);
        $this->assertNotContains('cedula', $faltantes, 'la cedula si la tiene');

        // Y le dice de que unidad falta, no solo que falta.
        $deLaUnidad = collect($respuesta->json('faltantes'))->firstWhere('tipo', 'matricula');
        $this->assertSame($unidad->numero_vehiculo, $deLaUnidad['unidad']);
    }

    // El portal nunca debe soltar la ruta del archivo: se descarga por el
    // endpoint firmado, que caduca a los 5 minutos.
    public function test_el_portal_no_expone_la_ruta_del_archivo(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);
        $this->documento($socio->id, 'cedula');

        $cuerpo = $this->api($token)->getJson('/api/mis-documentos')->assertOk()->getContent();

        $this->assertStringNotContainsString('ruta_archivo', $cuerpo);
        $this->assertStringNotContainsString('expedientes/', $cuerpo);
    }

    public function test_un_socio_no_puede_descargar_el_documento_de_otro(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        $ajeno = $this->crearSocio(['nombre' => 'Otro Socio']);
        $documentoAjeno = $this->documento($ajeno->id, 'cedula');
        $propio = $this->documento($socio->id, 'habilitacion');

        $this->api($token)->getJson("/api/mis-documentos/{$documentoAjeno->id}/descargar")->assertNotFound();
        $this->api($token)->getJson("/api/mis-documentos/{$propio->id}/descargar")->assertOk()
            ->assertJsonStructure(['url']);
    }

    public function test_el_staff_no_entra_por_la_puerta_del_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->getJson('/api/mis-documentos')->assertForbidden();
    }

    // ------------------------------------------- respaldo de los archivos

    public function test_el_verificador_avisa_cuando_falta_un_archivo(): void
    {
        [$socio] = $this->crearSocioConCuenta();

        $presente = $this->documento($socio->id, 'cedula');
        Storage::disk('s3')->put($presente->ruta_archivo, 'contenido');

        // Este queda registrado pero su archivo nunca llega al almacenamiento,
        // que es exactamente lo que el comando tiene que cazar.
        $this->documento($socio->id, 'habilitacion');

        $this->artisan('archivos:verificar')
            ->expectsOutputToContain('1 SIN ARCHIVO')
            ->assertExitCode(1);
    }

    public function test_el_verificador_pasa_cuando_estan_todos(): void
    {
        [$socio] = $this->crearSocioConCuenta();

        $documento = $this->documento($socio->id, 'cedula');
        Storage::disk('s3')->put($documento->ruta_archivo, 'contenido');

        $aportacion = Aportacion::create([
            'socio_id' => $socio->id, 'monto' => 20, 'mes_pagado' => 1, 'anio_pagado' => 2026,
            'fecha_pago' => $this->enDias(0), 'metodo_pago' => 'Efectivo', 'estado' => 'Aprobado',
            'comprobante_ruta' => 'comprobantes_aportaciones/uno.pdf',
        ]);
        Storage::disk('s3')->put($aportacion->comprobante_ruta, 'contenido');

        $this->artisan('archivos:verificar')->assertExitCode(0);
    }

    // Una aportacion borrada conserva su comprobante: el registro se puede
    // restaurar y auditar, y sin el archivo la evidencia del pago se perdia.
    public function test_borrar_una_aportacion_no_destruye_su_comprobante(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();

        $aportacion = Aportacion::create([
            'socio_id' => $socio->id, 'monto' => 20, 'mes_pagado' => 2, 'anio_pagado' => 2026,
            'fecha_pago' => $this->enDias(0), 'metodo_pago' => 'Efectivo', 'estado' => 'Aprobado',
            'comprobante_ruta' => 'comprobantes_aportaciones/pago.pdf',
        ]);
        Storage::disk('s3')->put($aportacion->comprobante_ruta, 'contenido');

        $this->api($token)->deleteJson("/api/aportaciones/{$aportacion->id}")->assertOk();

        $this->assertSoftDeleted('aportaciones', ['id' => $aportacion->id]);
        Storage::disk('s3')->assertExists('comprobantes_aportaciones/pago.pdf');
    }
}
