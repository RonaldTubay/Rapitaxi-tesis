<?php

namespace Tests\Feature;

use App\Models\Empresa;
use App\Models\Notificacion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * El permiso de operacion de la compania.
 *
 * El acta de cambio de socio lo trae bajo "DOCUMENTOS HABILITANTES":
 * N°001-CPO-DTTTSV-GADCM-2024, del 02-08-2024, caduca el 02-08-2034. El sistema
 * guardaba solo el numero, como texto suelto.
 *
 * Es el vencimiento mas grave de todos: si caduca, no es que un socio no pueda
 * circular, es que la compania entera deja de operar.
 */
class PermisoDeOperacionTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    private function conCaducidad(?string $fecha): Empresa
    {
        $empresa = Empresa::query()->orderBy('id')->firstOrFail();
        $empresa->update([
            'permiso_operacion' => 'N°001-CPO-DTTTSV-GADCM-2024',
            'fecha_permiso_operacion' => $this->enAnios(-2),
            'fecha_caducidad_permiso' => $fecha,
        ]);

        return $empresa->fresh();
    }

    public function test_el_admin_guarda_la_vigencia_del_permiso(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxi Convencionales RapitaxisMontecristi S.A.',
            'ruc' => '1391934177001',
            'permiso_operacion' => 'N°001-CPO-DTTTSV-GADCM-2024',
            'fecha_permiso_operacion' => '2024-08-02',
            'fecha_caducidad_permiso' => '2034-08-02',
        ])->assertOk();

        $this->assertDatabaseHas('empresa', [
            'permiso_operacion' => 'N°001-CPO-DTTTSV-GADCM-2024',
            'fecha_caducidad_permiso' => '2034-08-02',
        ]);
    }

    public function test_la_caducidad_no_puede_ser_anterior_a_la_resolucion(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxis',
            'fecha_permiso_operacion' => '2024-08-02',
            'fecha_caducidad_permiso' => '2024-08-01',
        ])->assertStatus(422)->assertJsonValidationErrors('fecha_caducidad_permiso');
    }

    // Seis meses, no treinta dias: renovarlo es un tramite con el GAD y la ANT.
    public function test_avisa_con_seis_meses_de_antelacion_y_no_con_uno(): void
    {
        $this->conCaducidad($this->enDias(120));

        $this->assertSame(Empresa::PERMISO_POR_VENCER, Empresa::actual()->estado_permiso);

        // Aunque el comando corra con la ventana corta de los demas papeles.
        $this->artisan('vencimientos:avisar', ['--dias' => 30])->assertExitCode(0);

        $this->assertDatabaseHas('notificaciones', ['titulo' => 'Permiso de operación por vencer']);
    }

    public function test_un_permiso_lejano_no_genera_ruido(): void
    {
        $this->conCaducidad('2034-08-02');

        $this->assertSame(Empresa::PERMISO_VIGENTE, Empresa::actual()->estado_permiso);

        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertSame(0, Notificacion::count());
    }

    public function test_un_permiso_caducado_avisa_como_error(): void
    {
        $this->conCaducidad($this->enDias(-3));

        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertDatabaseHas('notificaciones', [
            'titulo' => 'Permiso de operación vencido',
            'tipo' => 'error',
        ]);
    }

    public function test_el_aviso_del_permiso_no_se_duplica_en_el_dia(): void
    {
        $this->conCaducidad($this->enDias(30));

        $this->artisan('vencimientos:avisar');
        $this->artisan('vencimientos:avisar');

        $this->assertSame(1, Notificacion::where('titulo', 'Permiso de operación por vencer')->count());
    }

    public function test_sin_fecha_registrada_no_rompe_el_comando(): void
    {
        $this->conCaducidad(null);

        $this->artisan('vencimientos:avisar')->assertExitCode(0);

        $this->assertSame(Empresa::PERMISO_SIN_REGISTRAR, Empresa::actual()->estado_permiso);
        $this->assertSame(0, Notificacion::count());
    }

    public function test_el_dashboard_muestra_el_estado_del_permiso(): void
    {
        $this->conCaducidad($this->enDias(45));
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()
            ->assertJsonPath('permiso_operacion.estado', Empresa::PERMISO_POR_VENCER)
            ->assertJsonPath('permiso_operacion.dias_para_vencer', 45)
            ->assertJsonPath('permiso_operacion.numero', 'N°001-CPO-DTTTSV-GADCM-2024');
    }
}
