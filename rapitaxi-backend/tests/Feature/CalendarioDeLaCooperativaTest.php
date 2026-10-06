<?php

namespace Tests\Feature;

use App\Models\Aportacion;
use App\Models\Expediente;
use App\Models\Notificacion;
use App\Models\Revision;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * Que dia es hoy para la cooperativa.
 *
 * Las marcas de tiempo se guardan en UTC, pero los vencimientos son del
 * calendario local. El sistema lo calculaba de dos maneras: matricula y
 * habilitacion con el dia de Ecuador, y expedientes, RTV, mantenimiento y
 * aportaciones con el de UTC.
 *
 * Entre las 19:00 y la medianoche en Ecuador, UTC ya es el dia siguiente. En
 * esa franja de cinco horas dos papeles que vencian la misma fecha reportaban
 * cifras distintas, la validacion aceptaba fechas de mañana y el aviso diario
 * se creia de otro dia y repetia los avisos.
 *
 * Todas estas pruebas viajan a esa franja a proposito: son los casos que de dia
 * pasan solos y de noche se rompen.
 */
class CalendarioDeLaCooperativaTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    /** 00:30 UTC del 3 de octubre son las 19:30 del 2 en Montecristi. */
    private const NOCHE_EN_ECUADOR = '2026-10-03 00:30:00 UTC';

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_un_documento_que_vence_hoy_no_aparece_vencido_de_noche(): void
    {
        Carbon::setTestNow(self::NOCHE_EN_ECUADOR);

        $documento = new Expediente(['fecha_vencimiento' => '2026-10-02']);

        $this->assertSame(0, $documento->dias_para_vencer);
        $this->assertSame(Expediente::POR_VENCER, $documento->estado_vigencia);
    }

    public function test_una_rtv_que_vence_hoy_tampoco(): void
    {
        Carbon::setTestNow(self::NOCHE_EN_ECUADOR);

        $revision = new Revision(['fecha_vencimiento' => '2026-10-02']);

        $this->assertSame(0, $revision->dias_para_vencer);
    }

    // Con el "today" de UTC, de noche se podia registrar un acta fechada el dia
    // siguiente: la validacion decia una cosa y la pantalla otra.
    public function test_no_se_puede_registrar_un_traspaso_fechado_manana(): void
    {
        Carbon::setTestNow(self::NOCHE_EN_ECUADOR);

        $token = $this->tokenDe($this->crearUsuario('operador'));
        $socio = $this->crearSocio();
        $otro = $this->crearSocio(['nombre' => 'Otro Socio', 'cedula' => $this->cedulaValida(2)]);
        $unidad = $this->crearVehiculo($socio);

        // El 3 de octubre todavia es mañana en Montecristi, aunque en UTC ya sea hoy.
        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $otro->id,
            'fecha_traspaso' => '2026-10-03',
        ])->assertStatus(422)->assertJsonValidationErrors('fecha_traspaso');

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $otro->id,
            'fecha_traspaso' => '2026-10-02',
            'sin_acta' => true,
            'observaciones' => 'Aqui se mira la fecha, no el respaldo documental.',
        ])->assertCreated();
    }

    // El comando esta pensado para correr una vez al dia. Si lo corre un cron a
    // las 23:00, la comprobacion de "ya avise hoy" tiene que seguir hablando del
    // mismo dia que a las 18:00.
    public function test_el_aviso_diario_no_se_duplica_al_cruzar_la_medianoche_de_utc(): void
    {
        $socio = $this->crearSocio(['nombre' => 'Ana Bravo']);

        Expediente::create([
            'socio_id' => $socio->id,
            'nombre_documento' => 'Matricula',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'matricula',
            'fecha_vencimiento' => '2026-10-10',
            'ruta_archivo' => 'expedientes/matricula.pdf',
        ]);

        // 18:00 en Montecristi: UTC y Ecuador coinciden en el dia.
        Carbon::setTestNow('2026-10-02 23:00:00 UTC');
        $this->artisan('vencimientos:avisar')->assertExitCode(0);
        $this->assertSame(1, Notificacion::count());

        // 23:30 del mismo dia en Montecristi: en UTC ya es el 3.
        Carbon::setTestNow('2026-10-03 04:30:00 UTC');
        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertSame(1, Notificacion::count(), 'es el mismo dia en Montecristi: no debia repetir el aviso');
    }

    // El ultimo dia del mes a las 19:00, con UTC ya era el mes siguiente y un
    // socio al dia aparecia en mora.
    public function test_el_mes_de_las_aportaciones_es_el_de_la_cooperativa(): void
    {
        // 02:00 UTC del 1 de noviembre son las 21:00 del 31 de octubre en Montecristi.
        Carbon::setTestNow('2026-11-01 02:00:00 UTC');

        $socio = $this->crearSocio();

        Aportacion::create([
            'socio_id' => $socio->id,
            'mes_pagado' => 10,
            'anio_pagado' => 2026,
            'monto' => 20,
            'fecha_pago' => '2026-10-15',
            'estado' => 'Aprobado',
        ]);

        $this->assertSame('Al día', $socio->fresh()->estado_pago_actual);
    }
}
