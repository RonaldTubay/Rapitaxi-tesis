<?php

namespace Tests\Feature;

use App\Models\Empresa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * Los datos de la compania.
 *
 * Estaban escritos a mano en el dashboard y en el cuadro maestro, asi que
 * instalarlo en otra cooperativa obligaba a editar el codigo fuente. Ahora
 * salen de la base: cualquier rol los lee, solo el admin los cambia.
 */
class DatosDeLaCompaniaTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    public function test_la_migracion_deja_los_datos_que_estaban_en_el_codigo(): void
    {
        // Al migrar una instalacion existente no debe cambiar lo que ya se veia.
        $this->assertSame('RapitaxisMontecristi S.A.', Empresa::actual()->razon_social);
    }

    // El encabezado del panel y del cuadro maestro los necesita, y el portal del
    // socio tambien: si solo el staff pudiera leerlos, el socio veria un hueco.
    public function test_cualquier_usuario_autenticado_puede_leer_los_datos(): void
    {
        foreach (['admin', 'operador'] as $rol) {
            $this->api($this->tokenDe($this->crearUsuario($rol)))
                ->getJson('/api/empresa')
                ->assertOk()
                ->assertJsonPath('razon_social', 'RapitaxisMontecristi S.A.');
        }

        [, $usuarioSocio] = $this->crearSocioConCuenta();

        $this->api($this->tokenDe($usuarioSocio))->getJson('/api/empresa')
            ->assertOk()
            ->assertJsonPath('razon_social', 'RapitaxisMontecristi S.A.');
    }

    public function test_sin_token_no_se_leen_los_datos(): void
    {
        $this->getJson('/api/empresa')->assertUnauthorized();
    }

    public function test_el_admin_actualiza_los_datos(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Cooperativa de Taxis Jaramijó',
            'ruc' => '1790010937001',
            'permiso_operacion' => 'ANT-2026-0042',
            'ciudad' => 'Jaramijó',
            'telefono' => '052-301-445',
            'email' => 'gerencia@taxisjaramijo.ec',
            'gerente' => 'Ana Bravo',
            'secretario' => 'Luis Vera',
        ])->assertOk()->assertJsonPath('empresa.razon_social', 'Cooperativa de Taxis Jaramijó');

        $this->assertDatabaseHas('empresa', [
            'razon_social' => 'Cooperativa de Taxis Jaramijó',
            'ruc' => '1790010937001',
            'gerente' => 'Ana Bravo',
        ]);

        // Sigue siendo una sola fila: el sistema sirve a una compania por instalacion.
        $this->assertSame(1, Empresa::count());
    }

    public function test_el_operador_no_puede_cambiar_los_datos_de_la_compania(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));

        $this->api($token)
            ->putJson('/api/empresa', ['razon_social' => 'Otra Compañía S.A.'])
            ->assertForbidden();

        $this->assertDatabaseMissing('empresa', ['razon_social' => 'Otra Compañía S.A.']);
    }

    public function test_un_socio_no_puede_cambiar_los_datos_de_la_compania(): void
    {
        [, $usuarioSocio] = $this->crearSocioConCuenta();

        $this->api($this->tokenDe($usuarioSocio))
            ->putJson('/api/empresa', ['razon_social' => 'Compañía del Socio S.A.'])
            ->assertForbidden();
    }

    public function test_la_razon_social_es_obligatoria(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', ['razon_social' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('razon_social');
    }

    public function test_rechaza_un_ruc_mal_escrito_y_acepta_uno_valido(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxis',
            // Provincia inexistente: lo que sigue siendo invalido es la estructura,
            // no el digito verificador de una sociedad (ver App\Rules\RucEcuatoriano).
            'ruc' => '9990010937001',
        ])->assertStatus(422)->assertJsonValidationErrors('ruc');

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxis',
            'ruc' => '1391934177001',
        ])->assertOk();
    }

    public function test_el_telefono_y_el_correo_se_validan(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxis',
            'telefono' => 'llamar a la oficina',
            'email' => 'no-es-un-correo',
        ])->assertStatus(422)->assertJsonValidationErrors(['telefono', 'email']);
    }

    // Un GET no deberia escribir en la base, y una pantalla sin encabezado se ve
    // como un error del sistema: sin fila hay que devolver algo razonable.
    public function test_sin_fila_devuelve_un_valor_por_defecto_sin_escribir_en_la_base(): void
    {
        Empresa::query()->delete();
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->getJson('/api/empresa')
            ->assertOk()
            ->assertJsonPath('razon_social', 'Compañía de taxis');

        $this->assertSame(0, Empresa::count());
    }

    public function test_si_la_fila_no_existe_el_admin_la_crea_al_guardar(): void
    {
        Empresa::query()->delete();
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', ['razon_social' => 'Compañía Nueva S.A.'])
            ->assertOk();

        $this->assertDatabaseHas('empresa', ['razon_social' => 'Compañía Nueva S.A.']);
    }
    // El acta encabeza con la parroquia y las tres casillas del servicio. Sin
    // ellas, un documento impreso desde el sistema no se parece al oficial.
    public function test_guarda_la_ubicacion_y_el_servicio_que_encabezan_el_acta(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->putJson('/api/empresa', [
            'razon_social' => 'Compañía de Taxi Convencionales RapitaxisMontecristi S.A.',
            'ciudad' => 'Montecristi',
            'provincia' => 'Manabí',
            'parroquia' => 'Leonidas Proaño',
            'clase_transporte' => 'Comercial',
            'ambito_servicio' => 'Intracantonal combinado',
            'tipo_servicio' => 'Taxi convencional',
        ])->assertOk();

        $this->assertDatabaseHas('empresa', [
            'provincia' => 'Manabí',
            'parroquia' => 'Leonidas Proaño',
            'clase_transporte' => 'Comercial',
            'ambito_servicio' => 'Intracantonal combinado',
            'tipo_servicio' => 'Taxi convencional',
        ]);
    }
}
