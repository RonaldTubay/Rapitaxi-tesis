<?php

namespace Tests\Feature;

use App\Models\ConfiguracionMantenimiento;
use App\Models\Mantenimiento;
use App\Models\Socio;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

class PlanMantenimientoTest extends TestCase
{
    use CreaEscenarioApi, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        Storage::fake('s3');
    }

    /** Un solo tipo configurado deja las aserciones legibles. */
    private function configurarTipoUnico(string $tipo = 'Cambio de Aceite', int $meses = 3, int $diasAviso = 15): void
    {
        ConfiguracionMantenimiento::query()->delete();
        ConfiguracionMantenimiento::create([
            'tipo_mantenimiento' => $tipo,
            'meses_frecuencia' => $meses,
            'dias_anticipacion' => $diasAviso,
        ]);
    }

    private function registrarTrabajo(Vehiculo $vehiculo, string $fecha, array $cambios = []): Mantenimiento
    {
        return Mantenimiento::create($cambios + [
            'vehiculo_id' => $vehiculo->id,
            'tipo_mantenimiento' => 'Cambio de Aceite',
            'fecha_mantenimiento' => $fecha,
            'kilometraje_actual' => 1000,
            'estado' => 'Completado',
            'revision_estado' => 'Aprobado',
        ]);
    }

    // ------------------------------------------------ calculo del estado

    public function test_una_unidad_sin_ningun_mantenimiento_aparece_como_sin_registro(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);

        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.resumen', 'Sin registro')
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Sin registro')
            ->assertJsonPath('unidades.0.mantenimientos.0.ultima_fecha', null);
    }

    public function test_el_estado_cambia_segun_la_frecuencia_configurada(): void
    {
        $this->configurarTipoUnico('Cambio de Aceite', 3, 15);
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);

        // Hace 1 mes: faltan 2 meses, todavia no toca avisar.
        $trabajo = $this->registrarTrabajo($vehiculo, $this->enMeses(-1));
        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Al día');

        // Hace 2 meses y 20 dias: entra en la ventana de aviso de 15 dias.
        $trabajo->update(['fecha_mantenimiento' => $this->hoyLocal()->subMonths(2)->subDays(20)->toDateString()]);
        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Por vencer');

        // Hace 4 meses: ya se paso.
        $trabajo->update(['fecha_mantenimiento' => $this->enMeses(-4)]);
        $this->api($token)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Vencido');
    }

    public function test_cambiar_la_frecuencia_desde_administracion_cambia_el_aviso_del_socio(): void
    {
        $this->configurarTipoUnico('Cambio de Aceite', 12, 15);
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $this->registrarTrabajo($vehiculo, $this->enMeses(-5));

        // Con frecuencia de 12 meses, 5 meses atras esta al dia.
        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Al día');

        $config = ConfiguracionMantenimiento::first();
        $this->api($this->tokenDe($this->crearUsuario('admin')))->putJson('/api/configuraciones-mantenimiento', [
            'configuraciones' => [['id' => $config->id, 'meses_frecuencia' => 3, 'dias_anticipacion' => 15]],
        ])->assertOk();

        // Con 3 meses, el mismo trabajo pasa a estar vencido.
        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.mantenimientos.0.estado', 'Vencido');
    }

    public function test_un_registro_pendiente_de_revision_no_pone_la_unidad_al_dia(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $this->registrarTrabajo($vehiculo, $this->enDias(0), ['revision_estado' => 'Pendiente', 'origen' => 'socio']);

        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.resumen', 'Sin registro')
            ->assertJsonCount(1, 'unidades.0.pendientes_revision');
    }

    public function test_el_socio_ve_cada_unidad_por_separado_con_su_propio_estado(): void
    {
        $this->configurarTipoUnico('Cambio de Aceite', 3, 15);
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $alDia = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-01', 'placa' => 'AAA-1111']);
        $this->crearVehiculo($socio, ['numero_vehiculo' => '012-02', 'placa' => 'BBB-2222']);
        $this->registrarTrabajo($alDia, $this->enDias(0));

        $respuesta = $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk();

        $respuesta->assertJsonCount(2, 'unidades');
        $respuesta->assertJsonPath('unidades.0.placa', 'AAA-1111')->assertJsonPath('unidades.0.resumen', 'Al día');
        $respuesta->assertJsonPath('unidades.1.placa', 'BBB-2222')->assertJsonPath('unidades.1.resumen', 'Sin registro');
    }

    public function test_un_socio_no_ve_las_unidades_de_otro(): void
    {
        $this->configurarTipoUnico();
        [, $usuarioA] = $this->crearSocioConCuenta();
        $socioB = Socio::create(['nombre' => 'Otro Socio', 'cedula' => $this->cedulaValida(2), 'estado' => 'Activo']);
        $this->crearVehiculo($socioB, ['numero_vehiculo' => '012-09', 'placa' => 'ZZZ-9999']);

        $this->api($this->tokenDe($usuarioA))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonCount(0, 'unidades');
    }

    public function test_el_socio_sigue_viendo_sus_unidades_aunque_no_haya_frecuencias_configuradas(): void
    {
        ConfiguracionMantenimiento::query()->delete();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);

        $this->api($this->tokenDe($usuario))->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonCount(1, 'unidades')
            ->assertJsonPath('unidades.0.placa', 'MBC-4650')
            ->assertJsonCount(0, 'unidades.0.mantenimientos');
    }

    public function test_el_seeder_deja_las_frecuencias_listas_sin_pisar_lo_que_el_admin_cambio(): void
    {
        ConfiguracionMantenimiento::query()->delete();

        $this->seed(\Database\Seeders\ConfiguracionMantenimientoSeeder::class);
        $this->assertSame(5, ConfiguracionMantenimiento::count());
        $this->assertSame(3, ConfiguracionMantenimiento::where('tipo_mantenimiento', 'Cambio de Aceite')->value('meses_frecuencia'));

        ConfiguracionMantenimiento::where('tipo_mantenimiento', 'Cambio de Aceite')->update(['meses_frecuencia' => 4]);
        $this->seed(\Database\Seeders\ConfiguracionMantenimientoSeeder::class);

        $this->assertSame(5, ConfiguracionMantenimiento::count());
        $this->assertSame(4, ConfiguracionMantenimiento::where('tipo_mantenimiento', 'Cambio de Aceite')->value('meses_frecuencia'));
    }

    // ------------------------------------- registro que sube el socio

    private function datosRegistro(array $cambios = []): array
    {
        return $cambios + [
            'tipo_mantenimiento' => 'Cambio de Aceite',
            'fecha_mantenimiento' => $this->enDias(0),
            'kilometraje_actual' => 60000,
            'naturaleza' => 'Preventivo',
            'observaciones' => 'Cambio de aceite y filtros en taller del barrio',
            'comprobante' => UploadedFile::fake()->create('factura.pdf', 100, 'application/pdf'),
        ];
    }

    public function test_el_socio_registra_su_mantenimiento_y_queda_pendiente_hasta_que_el_staff_lo_aprueba(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $tokenSocio = $this->tokenDe($usuario);

        $this->api($tokenSocio)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])
            ->assertStatus(201);

        $registro = Mantenimiento::first();
        $this->assertSame('Pendiente', $registro->revision_estado);
        $this->assertSame('socio', $registro->origen);
        $this->assertCount(1, Storage::disk('s3')->allFiles('comprobantes_mantenimiento'));

        // Mientras siga pendiente, la unidad no esta al dia.
        $this->api($tokenSocio)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.resumen', 'Sin registro');

        $this->api($this->tokenDe($this->crearUsuario('operador')))
            ->putJson("/api/mantenimientos/{$registro->id}/aprobar")->assertOk();

        $this->api($tokenSocio)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.resumen', 'Al día');
    }

    public function test_el_staff_rechaza_con_motivo_y_el_socio_lo_ve_y_puede_reenviar(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $tokenSocio = $this->tokenDe($usuario);
        $tokenStaff = $this->tokenDe($this->crearUsuario('operador'));

        $this->api($tokenSocio)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])->assertStatus(201);
        $registro = Mantenimiento::first();

        $this->api($tokenStaff)->putJson("/api/mantenimientos/{$registro->id}/rechazar", [])
            ->assertStatus(422)->assertJsonValidationErrors('motivo_rechazo');

        $this->api($tokenStaff)->putJson("/api/mantenimientos/{$registro->id}/rechazar", [
            'motivo_rechazo' => 'La factura no se lee, vuelve a subirla.',
        ])->assertOk();

        $this->api($tokenSocio)->getJson('/api/mis-unidades')->assertOk()
            ->assertJsonPath('unidades.0.rechazados.0.motivo_rechazo', 'La factura no se lee, vuelve a subirla.');

        // Rechazado deja de bloquear: puede volver a enviarlo.
        $this->api($tokenSocio)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])
            ->assertStatus(201);
    }

    public function test_no_se_puede_enviar_dos_veces_el_mismo_tipo_mientras_este_pendiente(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);

        $this->api($token)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])->assertStatus(201);
        $this->api($token)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_un_socio_no_puede_registrar_mantenimiento_en_una_unidad_ajena(): void
    {
        $this->configurarTipoUnico();
        [, $usuarioA] = $this->crearSocioConCuenta();
        $socioB = Socio::create(['nombre' => 'Otro Socio', 'cedula' => $this->cedulaValida(2), 'estado' => 'Activo']);
        $ajeno = $this->crearVehiculo($socioB, ['numero_vehiculo' => '012-09', 'placa' => 'ZZZ-9999']);

        $this->api($this->tokenDe($usuarioA))
            ->post("/api/mis-unidades/{$ajeno->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])
            ->assertStatus(404);
    }

    public function test_el_registro_del_socio_valida_fecha_tipo_y_respaldo(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);
        $url = "/api/mis-unidades/{$vehiculo->id}/mantenimientos";
        $json = ['Accept' => 'application/json'];

        $this->api($token)->post($url, $this->datosRegistro(['fecha_mantenimiento' => $this->enDias(5)]), $json)
            ->assertStatus(422)->assertJsonValidationErrors('fecha_mantenimiento');

        $this->api($token)->post($url, $this->datosRegistro(['tipo_mantenimiento' => 'Lavada de auto']), $json)
            ->assertStatus(422)->assertJsonValidationErrors('tipo_mantenimiento');

        $this->api($token)->post($url, $this->datosRegistro(['comprobante' => UploadedFile::fake()->create('virus.exe', 10)]), $json)
            ->assertStatus(422)->assertJsonValidationErrors('comprobante');
    }

    public function test_el_kilometraje_del_socio_no_puede_retroceder(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $this->registrarTrabajo($vehiculo, $this->enMeses(-4), ['kilometraje_actual' => 80000]);

        $this->api($this->tokenDe($usuario))
            ->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(['kilometraje_actual' => 50000]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('kilometraje_actual');
    }

    // ------------------------------------------------------- permisos

    public function test_solo_el_admin_configura_las_frecuencias(): void
    {
        $this->configurarTipoUnico();
        $config = ConfiguracionMantenimiento::first();
        $cuerpo = ['configuraciones' => [['id' => $config->id, 'meses_frecuencia' => 4, 'dias_anticipacion' => 10]]];

        $this->api($this->tokenDe($this->crearUsuario('operador')))
            ->putJson('/api/configuraciones-mantenimiento', $cuerpo)->assertStatus(403);

        [, $socio] = $this->crearSocioConCuenta();
        $this->api($this->tokenDe($socio))
            ->putJson('/api/configuraciones-mantenimiento', $cuerpo)->assertStatus(403);

        $this->api($this->tokenDe($this->crearUsuario('admin')))
            ->putJson('/api/configuraciones-mantenimiento', $cuerpo)->assertOk();
    }

    public function test_la_frecuencia_solo_acepta_valores_razonables(): void
    {
        $this->configurarTipoUnico();
        $config = ConfiguracionMantenimiento::first();
        $token = $this->tokenDe($this->crearUsuario('admin'));

        foreach ([0, -3, 120] as $meses) {
            $this->api($token)->putJson('/api/configuraciones-mantenimiento', [
                'configuraciones' => [['id' => $config->id, 'meses_frecuencia' => $meses, 'dias_anticipacion' => 15]],
            ])->assertStatus(422)->assertJsonValidationErrors('configuraciones.0.meses_frecuencia');
        }
    }

    public function test_un_socio_no_puede_aprobar_su_propio_mantenimiento(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);

        $this->api($token)->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])->assertStatus(201);
        $registro = Mantenimiento::first();

        $this->api($token)->putJson("/api/mantenimientos/{$registro->id}/aprobar")->assertStatus(403);
        $this->assertSame('Pendiente', $registro->fresh()->revision_estado);
    }

    public function test_un_mantenimiento_ya_revisado_no_se_revisa_de_nuevo(): void
    {
        $this->configurarTipoUnico();
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $this->api($this->tokenDe($usuario))->post("/api/mis-unidades/{$vehiculo->id}/mantenimientos", $this->datosRegistro(), ['Accept' => 'application/json'])->assertStatus(201);
        $registro = Mantenimiento::first();
        $tokenStaff = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($tokenStaff)->putJson("/api/mantenimientos/{$registro->id}/aprobar")->assertOk();
        $this->api($tokenStaff)->putJson("/api/mantenimientos/{$registro->id}/aprobar")->assertStatus(422);
        $this->api($tokenStaff)->putJson("/api/mantenimientos/{$registro->id}/rechazar", ['motivo_rechazo' => 'Tarde'])->assertStatus(422);
    }

    public function test_lo_que_registra_el_staff_no_pasa_por_revision(): void
    {
        $this->configurarTipoUnico();
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        // Aunque intente mandar los campos de revision a mano, se ignoran.
        $this->api($this->tokenDe($this->crearUsuario('admin')))->post('/api/mantenimientos', [
            'vehiculo_id' => $vehiculo->id, 'fecha_mantenimiento' => $this->enDias(0),
            'tipo_mantenimiento' => 'Cambio de Aceite', 'estado' => 'Completado',
            'naturaleza' => 'Preventivo',
            'kilometraje_actual' => 50000, 'observaciones' => 'Cambio de aceite',
            'proximo_mantenimiento_km' => 55000,
            'comprobante' => UploadedFile::fake()->create('factura.pdf', 100, 'application/pdf'),
            'revision_estado' => 'Pendiente', 'origen' => 'socio',
        ], ['Accept' => 'application/json'])->assertStatus(201);

        $registro = Mantenimiento::first();
        $this->assertSame('Aprobado', $registro->revision_estado);
        $this->assertSame('staff', $registro->origen);
    }
}
