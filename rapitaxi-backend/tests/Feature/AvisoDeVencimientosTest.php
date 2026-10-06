<?php

namespace Tests\Feature;

use App\Models\Expediente;
use App\Models\Notificacion;
use App\Models\Revision;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * Los avisos de vencimiento.
 *
 * El sistema sabia desde hace tiempo cuando caduca cada papel, pero no se lo
 * decia a nadie: habia que entrar a Expedientes y revisar socio por socio. Un
 * control de vencimientos que exige acordarse de ir a mirar no es un control.
 */
class AvisoDeVencimientosTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    private function documento(int $socioId, string $tipo, ?string $vence): Expediente
    {
        return Expediente::create([
            'socio_id' => $socioId,
            'nombre_documento' => 'Documento ' . $tipo,
            'tipo_documento' => 'pdf',
            'tipo_expediente' => $tipo,
            'fecha_vencimiento' => $vence,
            'ruta_archivo' => 'expedientes/' . $tipo . '-' . $socioId . '.pdf',
        ]);
    }

    public function test_avisa_de_lo_vencido_y_de_lo_que_esta_por_vencer(): void
    {
        $socio = $this->crearSocio(['nombre' => 'Ana Bravo']);

        $this->documento($socio->id, 'matricula', $this->enDias(-4));
        $this->documento($socio->id, 'habilitacion', $this->enDias(10));
        // Fuera de la ventana de aviso: no debe generar nada.
        $this->documento($socio->id, 'cedula', $this->enAnios(2));

        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Documento vencido',
            'mensaje' => 'Matrícula del vehículo de Ana Bravo venció hace 4 días.',
        ]);
        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Documento por vencer',
            'mensaje' => 'Resolución de habilitación de Ana Bravo vence en 10 días.',
        ]);

        $this->assertSame(2, Notificacion::count(), 'la cédula no vence pronto, no debia avisar');
    }

    public function test_avisa_tambien_de_la_revision_tecnica(): void
    {
        $socio = $this->crearSocio();
        $vehiculo = $this->crearVehiculo($socio);

        Revision::create([
            'vehiculo_id' => $vehiculo->id,
            'fecha_revision' => $this->enMeses(-11),
            'fecha_vencimiento' => $this->enDias(7),
            'tipo' => 'RTV Manta',
            'estado' => 'Aprobada',
        ]);

        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Revisión técnica por vencer',
            'mensaje' => 'La RTV de la unidad 012-01 vence en 7 días.',
        ]);
    }

    // Esta pensado para correr cada dia: si repitiera los avisos, en una semana
    // el panel seria ilegible y nadie volveria a mirarlo.
    public function test_correrlo_dos_veces_el_mismo_dia_no_duplica_avisos(): void
    {
        $socio = $this->crearSocio();
        $this->documento($socio->id, 'matricula', $this->enDias(5));

        $this->artisan('vencimientos:avisar');
        $this->artisan('vencimientos:avisar');

        $this->assertSame(1, Notificacion::count());
    }

    public function test_la_ventana_de_aviso_se_puede_ajustar(): void
    {
        $socio = $this->crearSocio();
        // A 45 dias queda fuera del aviso por defecto (30).
        $this->documento($socio->id, 'habilitacion', $this->enDias(45));

        $this->artisan('vencimientos:avisar');
        $this->assertSame(0, Notificacion::count());

        $this->artisan('vencimientos:avisar', ['--dias' => 60]);
        $this->assertSame(1, Notificacion::count());
    }

    public function test_el_dashboard_muestra_los_documentos_que_vencen(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio(['nombre' => 'Luis Vera']);

        $this->documento($socio->id, 'matricula', $this->enDias(-2));
        $this->documento($socio->id, 'habilitacion', $this->enDias(15));
        $this->documento($socio->id, 'cedula', $this->enAnios(3));

        $respuesta = $this->api($token)->getJson('/api/dashboard/stats')->assertOk();

        $this->assertSame(1, $respuesta->json('kpis.documentos_vencidos'));
        $this->assertSame(1, $respuesta->json('kpis.documentos_por_vencer'));
        $this->assertSame('Luis Vera', $respuesta->json('documentos.vencidos.0.socio'));
        $this->assertSame('Matrícula del vehículo', $respuesta->json('documentos.vencidos.0.etiqueta'));
    }

    // La campana filtraba por una lista fija de titulos, asi que los avisos de
    // vencimiento se creaban en la base y nadie los veia nunca.
    public function test_la_campana_muestra_los_avisos_de_vencimiento(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio(['nombre' => 'Ana Bravo']);
        $this->documento($socio->id, 'matricula', $this->enDias(5));

        $this->artisan('vencimientos:avisar');

        $titulos = collect($this->api($token)->getJson('/api/notificaciones')->assertOk()->json())
            ->pluck('titulo')
            ->all();

        $this->assertContains('Documento por vencer', $titulos);
    }

    // El dashboard no debe soltar la ruta del archivo ni datos del socio que la
    // pantalla no muestra.
    public function test_el_dashboard_no_expone_rutas_de_archivo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio();
        $this->documento($socio->id, 'matricula', $this->enDias(-1));

        $cuerpo = $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->getContent();

        $this->assertStringNotContainsString('ruta_archivo', $cuerpo);
        $this->assertStringNotContainsString('expedientes/', $cuerpo);
    }
}
