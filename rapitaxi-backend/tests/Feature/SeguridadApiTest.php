<?php

namespace Tests\Feature;

use App\Models\Aportacion;
use App\Models\Mantenimiento;
use App\Models\Socio;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

class SeguridadApiTest extends TestCase
{
    use CreaEscenarioApi, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
        Storage::fake('s3');
    }

    public function test_el_staff_no_puede_fijar_rutas_privadas_ni_metadatos_de_revision_al_registrar_mantenimiento(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        $vehiculo = $this->crearVehiculo($this->crearSocio());

        $this->api($token)->postJson('/api/mantenimientos', [
            'vehiculo_id' => $vehiculo->id,
            'fecha_mantenimiento' => $this->enDias(1),
            'tipo_mantenimiento' => 'Cambio de Aceite',
            'estado' => 'Programado',
            'naturaleza' => 'Preventivo',
            'comprobante_ruta' => 'expedientes/cedula-ajena.pdf',
            'revisado_por' => 999,
            'revisado_en' => now()->toDateTimeString(),
        ])->assertCreated();

        $mantenimiento = Mantenimiento::firstOrFail();
        $this->assertNull($mantenimiento->comprobante_ruta);
        $this->assertNull($mantenimiento->revisado_por);
        $this->assertNull($mantenimiento->revisado_en);
    }

    public function test_el_cuadro_maestro_no_cuenta_aportaciones_eliminadas(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio();
        $this->crearVehiculo($socio);
        $aportacion = Aportacion::create([
            'socio_id' => $socio->id,
            'mes_pagado' => $this->mesActual(),
            'anio_pagado' => $this->anioActual(),
            'monto' => 20,
            'fecha_pago' => now(),
            'estado' => 'Aprobado',
        ]);
        $aportacion->delete();

        $this->api($token)->getJson('/api/reportes/cuadro-maestro')->assertOk()
            ->assertJsonPath('0.estado_aportacion', 'En mora');
    }

    public function test_un_error_del_cuadro_maestro_no_expone_sql_al_cliente(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        Schema::drop('aportaciones');

        $this->api($token)->getJson('/api/reportes/cuadro-maestro')->assertStatus(500)
            ->assertJsonMissingPath('error_real_de_sql');
    }

    public function test_el_seeder_inicial_no_restituye_el_rol_admin_a_una_cuenta_existente(): void
    {
        $usuario = $this->crearUsuario('operador', ['email' => 'inicial@rapitaxi.test']);
        $anteriorEmail = $_ENV['ADMIN_EMAIL'] ?? null;
        $anteriorPassword = $_ENV['ADMIN_PASSWORD'] ?? null;

        try {
            $_ENV['ADMIN_EMAIL'] = 'inicial@rapitaxi.test';
            $_ENV['ADMIN_PASSWORD'] = 'ClaveInicial123';
            $this->seed(AdminUserSeeder::class);

            $this->assertTrue($usuario->fresh()->hasRole('operador'));
            $this->assertFalse($usuario->fresh()->hasRole('admin'));
        } finally {
            if ($anteriorEmail === null) {
                unset($_ENV['ADMIN_EMAIL']);
            } else {
                $_ENV['ADMIN_EMAIL'] = $anteriorEmail;
            }
            if ($anteriorPassword === null) {
                unset($_ENV['ADMIN_PASSWORD']);
            } else {
                $_ENV['ADMIN_PASSWORD'] = $anteriorPassword;
            }
        }
    }

    // ---------------------------------------------------------------- acceso

    public function test_las_rutas_protegidas_exigen_autenticacion(): void
    {
        foreach (['socios', 'vehiculos', 'aportaciones', 'mantenimientos', 'usuarios', 'auditoria',
                  'dashboard/stats', 'mi-perfil', 'mis-aportaciones', 'libros-contables', 'notificaciones'] as $ruta) {
            $this->api()->getJson("/api/{$ruta}")->assertStatus(401);
        }
    }

    public function test_un_socio_no_puede_entrar_a_ninguna_ruta_del_panel(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        foreach (['socios', 'vehiculos', 'aportaciones', 'mantenimientos', 'usuarios', 'auditoria',
                  'dashboard/stats', 'libros-contables', 'reportes/cuadro-maestro', 'expedientes'] as $ruta) {
            $this->api($token)->getJson("/api/{$ruta}")->assertStatus(403);
        }
    }

    public function test_un_operador_no_puede_gestionar_usuarios_ni_ver_auditoria_ni_configuracion(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));

        foreach (['usuarios', 'auditoria', 'configuraciones-mantenimiento'] as $ruta) {
            $this->api($token)->getJson("/api/{$ruta}")->assertStatus(403);
        }
        $this->api($token)->postJson('/api/usuarios', [
            'name' => 'X', 'email' => 'x@x.com', 'password' => 'Clave1234', 'role' => 'admin',
        ])->assertStatus(403);
    }

    public function test_el_staff_no_puede_usar_el_portal_del_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->getJson('/api/mi-perfil')->assertStatus(403);
        $this->api($token)->getJson('/api/mis-aportaciones')->assertStatus(403);
    }

    // ----------------------------------------------------------------- login

    public function test_el_login_no_revela_si_el_correo_existe(): void
    {
        $this->crearUsuario('admin', ['email' => 'real@rapitaxi.test']);

        $existente = $this->api()->postJson('/api/login', ['email' => 'real@rapitaxi.test', 'password' => 'mala']);
        $inexistente = $this->api()->postJson('/api/login', ['email' => 'nadie@rapitaxi.test', 'password' => 'mala']);

        $this->assertSame($existente->json('errors.email'), $inexistente->json('errors.email'));
    }

    public function test_el_login_se_bloquea_tras_5_intentos_fallidos_del_mismo_correo(): void
    {
        $this->crearUsuario('admin', ['email' => 'real@rapitaxi.test']);

        for ($i = 0; $i < 5; $i++) {
            $this->api()->postJson('/api/login', ['email' => 'real@rapitaxi.test', 'password' => 'mala'])->assertStatus(422);
        }
        $this->api()->postJson('/api/login', ['email' => 'real@rapitaxi.test', 'password' => 'mala'])->assertStatus(429);
    }

    public function test_una_cuenta_desactivada_no_puede_iniciar_sesion_ni_usar_su_token(): void
    {
        $usuario = $this->crearUsuario('admin', ['email' => 'baja@rapitaxi.test', 'password' => 'Clave1234']);
        $token = $this->tokenDe($usuario);
        $usuario->update(['is_active' => false]);

        $this->api()->postJson('/api/login', ['email' => 'baja@rapitaxi.test', 'password' => 'Clave1234'])->assertStatus(422);
        $this->api($token)->getJson('/api/socios')->assertStatus(403);
    }

    public function test_los_tokens_tienen_vencimiento_configurado(): void
    {
        $minutos = config('sanctum.expiration');

        $this->assertNotNull($minutos, 'Los tokens de Sanctum nunca vencen.');
        $this->assertLessThanOrEqual(24 * 60, $minutos);
    }

    public function test_un_usuario_sin_rol_no_se_presenta_como_admin(): void
    {
        User::factory()->create(['email' => 'sinrol@rapitaxi.test', 'password' => 'Clave1234', 'is_active' => true]);

        $respuesta = $this->api()->postJson('/api/login', ['email' => 'sinrol@rapitaxi.test', 'password' => 'Clave1234']);

        $this->assertNotSame('admin', $respuesta->json('user.role'));
    }

    public function test_el_seeder_no_convierte_en_admin_a_usuarios_sin_rol(): void
    {
        $sinRol = User::factory()->create();

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->assertFalse($sinRol->fresh()->hasRole('admin'));
    }

    // ------------------------------------------------- claves y sesiones

    public function test_las_claves_debiles_son_rechazadas(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        foreach (['12345678', 'abcdefgh', 'corta1'] as $clave) {
            $this->api($token)->postJson('/api/usuarios', [
                'name' => 'Nuevo', 'email' => "n{$clave}@rapitaxi.test", 'password' => $clave, 'role' => 'operador',
            ])->assertStatus(422)->assertJsonValidationErrors('password');
        }
    }

    public function test_cambiar_la_clave_de_un_usuario_cierra_sus_sesiones_abiertas(): void
    {
        $admin = $this->crearUsuario('admin');
        $operador = $this->crearUsuario('operador');
        $tokenOperador = $this->tokenDe($operador);

        $this->api($tokenOperador)->getJson('/api/socios')->assertOk();

        $this->api($this->tokenDe($admin))->putJson("/api/usuarios/{$operador->id}", [
            'name' => $operador->name, 'email' => $operador->email, 'role' => 'operador', 'password' => 'NuevaClave123',
        ])->assertOk();

        $this->api($tokenOperador)->getJson('/api/socios')->assertStatus(401);
    }

    public function test_dar_de_baja_a_un_socio_desactiva_su_cuenta_y_cierra_su_sesion(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $tokenSocio = $this->tokenDe($usuario);
        $this->api($tokenSocio)->getJson('/api/mi-perfil')->assertOk();

        $this->api($this->tokenDe($this->crearUsuario('admin')))
            ->deleteJson("/api/socios/{$socio->id}", ['motivo_baja' => 'Retiro voluntario'])
            ->assertOk();

        $this->assertFalse($usuario->fresh()->is_active);
        $this->api($tokenSocio)->getJson('/api/mi-perfil')->assertStatus(401);
    }

    public function test_pasar_un_socio_a_inactivo_desactiva_su_cuenta(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();

        $this->api($this->tokenDe($this->crearUsuario('admin')))->putJson("/api/socios/{$socio->id}", [
            'nombre' => $socio->nombre, 'cedula' => $socio->cedula, 'telefono' => $socio->telefono,
            'correo' => $socio->correo, 'estado' => 'Inactivo', 'motivo_baja' => 'Falta grave',
        ])->assertOk();

        $this->assertFalse($usuario->fresh()->is_active);
    }

    // ------------------------------------------- datos sensibles expuestos

    public function test_ninguna_respuesta_filtra_claves_ni_tokens(): void
    {
        $admin = $this->crearUsuario('admin');
        $token = $this->tokenDe($admin);
        $this->crearSocioConCuenta();

        foreach (['user', 'usuarios', 'socios'] as $ruta) {
            $cuerpo = $this->api($token)->getJson("/api/{$ruta}")->assertOk()->getContent();
            $this->assertStringNotContainsString('"password"', $cuerpo, "/{$ruta} expone el hash de la clave");
            $this->assertStringNotContainsString('remember_token', $cuerpo, "/{$ruta} expone remember_token");
        }
    }

    public function test_el_portal_no_muestra_notas_internas_de_la_administracion_al_socio(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();

        $respuesta = $this->api($this->tokenDe($usuario))->getJson('/api/mi-perfil')->assertOk();

        $this->assertStringNotContainsString('NOTA INTERNA', $respuesta->getContent());
        $respuesta->assertJsonMissingPath('observaciones');
        $respuesta->assertJsonMissingPath('user_id');
    }

    public function test_el_portal_no_muestra_rutas_internas_ni_revisores_de_las_aportaciones(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        Aportacion::create([
            'socio_id' => $socio->id, 'mes_pagado' => 1, 'anio_pagado' => 2026, 'monto' => 20,
            'fecha_pago' => now(), 'estado' => 'Aprobado', 'comprobante_ruta' => 'comprobantes_aportaciones/secreto.jpg',
        ]);

        $respuesta = $this->api($this->tokenDe($usuario))->getJson('/api/mis-aportaciones')->assertOk();

        $this->assertStringNotContainsString('secreto.jpg', $respuesta->getContent());
        $respuesta->assertJsonMissingPath('0.comprobante_ruta');
        $respuesta->assertJsonMissingPath('0.revisado_por');
    }

    public function test_un_socio_solo_ve_sus_propias_aportaciones(): void
    {
        [$socioA, $usuarioA] = $this->crearSocioConCuenta();
        $socioB = Socio::create(['nombre' => 'Otro Socio', 'cedula' => $this->cedulaValida(2), 'estado' => 'Activo']);
        foreach ([$socioA, $socioB] as $i => $socio) {
            Aportacion::create([
                'socio_id' => $socio->id, 'mes_pagado' => $i + 1, 'anio_pagado' => 2026, 'monto' => 20 + $i,
                'fecha_pago' => now(), 'estado' => 'Aprobado',
            ]);
        }

        $lista = $this->api($this->tokenDe($usuarioA))->getJson('/api/mis-aportaciones')->assertOk()->json();

        $this->assertCount(1, $lista);
        $this->assertSame($socioA->id, Aportacion::find($lista[0]['id'])->socio_id);
    }

    public function test_el_socio_no_puede_cambiar_su_nombre_cedula_estado_ni_observaciones(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();

        $this->api($this->tokenDe($usuario))->putJson('/api/mi-perfil', [
            'telefono' => '0991234567', 'correo' => 'sigo.siendo@rapitaxi.test', 'nombre' => 'HACKEADO', 'cedula' => '0000000000',
            'estado' => 'Inactivo', 'observaciones' => 'borrado', 'user_id' => 999,
        ])->assertOk();

        $socio->refresh();
        $this->assertSame('0991234567', $socio->telefono);
        $this->assertSame('Socio de Prueba', $socio->nombre);
        $this->assertSame('Activo', $socio->estado);
        $this->assertStringContainsString('NOTA INTERNA', $socio->observaciones);
    }

    public function test_un_socio_inactivo_no_puede_subir_comprobantes(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta(['estado' => 'Inactivo']);

        $this->api($this->tokenDe($usuario))->post('/api/mis-aportaciones', [
            'mes_pagado' => 1, 'anio_pagado' => $this->anioActual(), 'monto' => 20,
            'comprobante' => UploadedFile::fake()->create('c.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(403);
    }

    // -------------------------------------------------------- validaciones

    public function test_el_comprobante_rechaza_archivos_pesados_o_de_tipo_peligroso(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);
        $base = ['mes_pagado' => 1, 'anio_pagado' => $this->anioActual(), 'monto' => 20];
        $json = ['Accept' => 'application/json'];

        $this->api($token)->post('/api/mis-aportaciones', $base + [
            'comprobante' => UploadedFile::fake()->create('grande.pdf', 6000, 'application/pdf'),
        ], $json)->assertStatus(422)->assertJsonValidationErrors('comprobante');

        $this->api($token)->post('/api/mis-aportaciones', $base + [
            'comprobante' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload'),
        ], $json)->assertStatus(422)->assertJsonValidationErrors('comprobante');

        $this->api($token)->post('/api/mis-aportaciones', $base + [
            'comprobante' => UploadedFile::fake()->create('script.php', 10, 'application/x-php'),
        ], $json)->assertStatus(422)->assertJsonValidationErrors('comprobante');
    }

    public function test_un_monto_en_cero_o_negativo_es_rechazado(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        foreach (['0', '0.00', '-5'] as $monto) {
            $this->api($token)->post('/api/mis-aportaciones', [
                'mes_pagado' => 1, 'anio_pagado' => $this->anioActual(), 'monto' => $monto,
                'comprobante' => UploadedFile::fake()->create('c.pdf', 100, 'application/pdf'),
            ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('monto');
        }
    }

    public function test_no_se_puede_duplicar_el_comprobante_del_mismo_mes(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);
        $datos = fn () => [
            'mes_pagado' => 1, 'anio_pagado' => $this->anioActual(), 'monto' => 20,
            'comprobante' => UploadedFile::fake()->create('c.pdf', 100, 'application/pdf'),
        ];

        $this->api($token)->post('/api/mis-aportaciones', $datos(), ['Accept' => 'application/json'])->assertStatus(201);
        $this->api($token)->post('/api/mis-aportaciones', $datos(), ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_la_cedula_debe_tener_digito_verificador_valido(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = fn (string $cedula) => [
            'nombre' => 'Nuevo Socio', 'cedula' => $cedula, 'telefono' => '0991234567',
            'correo' => 'nuevo.socio@rapitaxi.test', 'estado' => 'Activo',
        ];

        $this->api($token)->postJson('/api/socios', $socio('1234567890'))->assertStatus(422)->assertJsonValidationErrors('cedula');
        $this->api($token)->postJson('/api/socios', $socio('9912345678'))->assertStatus(422)->assertJsonValidationErrors('cedula');
        $this->api($token)->postJson('/api/socios', $socio($this->cedulaValida(10)))->assertStatus(201);
    }

    public function test_telefono_y_correo_son_obligatorios_y_deben_tener_formato_valido_al_registrar_un_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $base = ['nombre' => 'Nuevo Socio', 'cedula' => $this->cedulaValida(20), 'estado' => 'Activo'];

        $this->api($token)->postJson('/api/socios', $base)
            ->assertStatus(422)->assertJsonValidationErrors(['telefono', 'correo']);

        $this->api($token)->postJson('/api/socios', $base + ['telefono' => '12345', 'correo' => 'no-es-un-correo'])
            ->assertStatus(422)->assertJsonValidationErrors(['telefono', 'correo']);

        $this->api($token)->postJson('/api/socios', $base + ['telefono' => '0991234567', 'correo' => 'nuevo@rapitaxi.test'])
            ->assertStatus(201);
    }

    public function test_el_tipo_de_vehiculo_y_el_combustible_deben_estar_en_la_lista_permitida(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $datos = fn (array $cambios) => $cambios + [
            'socio_id' => $socio->id, 'numero_vehiculo' => '012-02', 'placa' => 'ABC-1234',
            'marca' => 'KIA', 'tipo_vehiculo' => 'Sedán', 'combustible' => 'Gasolina', 'anio_fabricacion' => 2020,
        ];

        $this->api($token)->postJson('/api/vehiculos', $datos(['tipo_vehiculo' => 'Camión de carga']))
            ->assertStatus(422)->assertJsonValidationErrors('tipo_vehiculo');
        $this->api($token)->postJson('/api/vehiculos', $datos(['combustible' => 'Leña']))
            ->assertStatus(422)->assertJsonValidationErrors('combustible');
        $this->api($token)->postJson('/api/vehiculos', $datos([]))->assertStatus(201);
    }

    public function test_no_se_repite_el_numero_de_unidad_entre_vehiculos_activos(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);

        $this->api($token)->postJson('/api/vehiculos', [
            'socio_id' => $socio->id, 'numero_vehiculo' => '012-01', 'placa' => 'PBA-1234',
            'marca' => 'Chevrolet', 'tipo_vehiculo' => 'Hatchback', 'combustible' => 'Gasolina', 'anio_fabricacion' => 2020,
        ])->assertStatus(422)->assertJsonValidationErrors('numero_vehiculo');
    }

    public function test_un_nombre_con_html_o_numeros_es_rechazado_y_las_respuestas_siempre_son_json(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        // El nombre solo admite letras/espacios: un intento de XSS ni siquiera
        // llega a guardarse (defensa mas fuerte que solo escapar al mostrarlo).
        $this->api($token)->postJson('/api/socios', [
            'nombre' => '<script>alert(1)</script>', 'estado' => 'Activo',
        ])->assertStatus(422)->assertJsonValidationErrors('nombre');

        $this->api($token)->postJson('/api/socios', [
            'nombre' => 'Juan123', 'estado' => 'Activo',
        ])->assertStatus(422)->assertJsonValidationErrors('nombre');

        $respuesta = $this->api($token)->postJson('/api/socios', [
            'nombre' => 'Juan Pérez', 'cedula' => $this->cedulaValida(30), 'telefono' => '0991234567',
            'correo' => 'juan.perez@rapitaxi.test', 'estado' => 'Activo',
        ])->assertStatus(201);

        $this->assertStringContainsString('application/json', $respuesta->headers->get('Content-Type'));
    }

    public function test_una_consulta_con_inyeccion_sql_no_rompe_ni_devuelve_de_mas(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $this->crearSocioConCuenta();

        $respuesta = $this->api($token)->getJson('/api/socios?search=' . urlencode("' OR '1'='1"))->assertOk();

        $this->assertCount(0, $respuesta->json('data'));
        $this->assertSame(0, $respuesta->json('total'));
    }

    // --------------------------------------- atributos calculados del socio

    public function test_la_pantalla_de_socios_recibe_los_atributos_calculados(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);

        // Ya no van en $appends (calcularlos siempre costaba miles de consultas
        // al anidar socios); cada endpoint de esta pantalla debe agregarlos.
        $this->api($token)->getJson('/api/socios')->assertOk()
            ->assertJsonStructure(['data' => ['*' => ['estado_pago_actual', 'numero_vehiculo', 'placa', 'cuenta_activa']]]);

        $this->api($token)->getJson('/api/socios')->assertOk()
            ->assertJsonPath('data.0.estado_pago_actual', 'En mora')
            ->assertJsonPath('data.0.placa', 'MBC-4650')
            ->assertJsonPath('data.0.numero_vehiculo', '012-01')
            ->assertJsonPath('data.0.cuenta_activa', true);

        $this->api($token)->getJson("/api/socios/{$socio->id}")->assertOk()
            ->assertJsonPath('estado_pago_actual', 'En mora');
    }

    public function test_un_socio_anidado_en_otra_respuesta_no_arrastra_los_calculados(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);
        Aportacion::create([
            'socio_id' => $socio->id, 'mes_pagado' => 1, 'anio_pagado' => 2026,
            'monto' => 20, 'fecha_pago' => now(), 'estado' => 'Aprobado',
        ]);

        // Cada atributo calculado dispara consultas propias: no deben viajar
        // donde la pantalla solo necesita el nombre del socio.
        // (/aportaciones viene paginado, por eso el prefijo "data".)
        $this->api($token)->getJson('/api/aportaciones')->assertOk()
            ->assertJsonPath('data.0.socio.nombre', 'Socio de Prueba')
            ->assertJsonMissingPath('data.0.socio.estado_pago_actual')
            ->assertJsonMissingPath('data.0.socio.cuenta_activa');

        $this->api($token)->getJson('/api/vehiculos')->assertOk()
            ->assertJsonMissingPath('0.socio.estado_pago_actual');
    }

    // --------------------------------------------------- paginacion

    public function test_los_listados_que_crecen_sin_techo_vienen_paginados(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        foreach (range(1, 30) as $i) {
            Aportacion::create([
                'socio_id' => $socio->id, 'mes_pagado' => ($i % 12) + 1, 'anio_pagado' => 2020 + $i,
                'monto' => 20, 'fecha_pago' => now(), 'estado' => 'Aprobado',
            ]);
            \App\Models\Revision::create([
                'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enDias(-$i),
                'tipo' => 'RTV', 'estado' => 'Aprobada',
            ]);
        }

        foreach (['aportaciones', 'revisiones'] as $recurso) {
            $this->api($token)->getJson("/api/{$recurso}")->assertOk()
                ->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total'])
                ->assertJsonPath('total', 30)
                ->assertJsonPath('per_page', 25)
                ->assertJsonCount(25, 'data');

            $this->api($token)->getJson("/api/{$recurso}?page=2")->assertOk()
                ->assertJsonCount(5, 'data');
        }
    }

    public function test_el_tamano_de_pagina_es_configurable_pero_tiene_tope(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        foreach (range(1, 12) as $i) {
            Aportacion::create([
                'socio_id' => $socio->id, 'mes_pagado' => $i, 'anio_pagado' => 2026,
                'monto' => 20, 'fecha_pago' => now(), 'estado' => 'Aprobado',
            ]);
        }

        $this->api($token)->getJson('/api/aportaciones?per_page=5')->assertOk()->assertJsonCount(5, 'data');

        // Pedir la tabla entera no debe ser posible.
        $this->api($token)->getJson('/api/aportaciones?per_page=99999')->assertOk()->assertJsonPath('per_page', 100);
        $this->api($token)->getJson('/api/aportaciones?per_page=0')->assertOk()->assertJsonPath('per_page', 1);
    }

    public function test_la_busqueda_de_los_listados_paginados_se_resuelve_en_el_servidor(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socioA] = $this->crearSocioConCuenta();
        $socioB = Socio::create(['nombre' => 'Mariana Velez', 'cedula' => $this->cedulaValida(77), 'estado' => 'Activo']);
        $base = ['mes_pagado' => 1, 'anio_pagado' => 2026, 'monto' => 20, 'fecha_pago' => now(), 'estado' => 'Aprobado'];

        Aportacion::create($base + ['socio_id' => $socioA->id]);
        Aportacion::create($base + ['socio_id' => $socioB->id]);

        // Busca por el socio, aunque el registro este en otra pagina.
        $this->api($token)->getJson('/api/aportaciones?search=mariana')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.socio.nombre', 'Mariana Velez');

        $this->api($token)->getJson('/api/aportaciones?search=nadie')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_la_bandeja_de_pendientes_se_pide_aparte_y_no_depende_de_la_pagina(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $base = ['vehiculo_id' => $vehiculo->id, 'tipo_mantenimiento' => 'Frenos', 'kilometraje_actual' => 1000, 'estado' => 'Completado'];

        // 30 aprobados (llenan mas de una pagina) y 1 pendiente al final.
        foreach (range(1, 30) as $i) {
            Mantenimiento::create($base + ['fecha_mantenimiento' => $this->enDias(-$i)]);
        }
        Mantenimiento::create($base + [
            'fecha_mantenimiento' => $this->enDias(-60),
            'revision_estado' => 'Pendiente', 'origen' => 'socio',
        ]);

        $this->api($token)->getJson('/api/mantenimientos?revision=Pendiente')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.revision_estado', 'Pendiente');
    }

    // ------------------------------------------------ mantenimiento

    private function datosMantenimientoCompletado(int $vehiculoId, array $cambios = []): array
    {
        return $cambios + [
            'vehiculo_id' => $vehiculoId, 'fecha_mantenimiento' => $this->enDias(0),
            'tipo_mantenimiento' => 'Suspensión', 'estado' => 'Completado', 'naturaleza' => 'Preventivo', 'kilometraje_actual' => 50000,
            'observaciones' => 'Cambio de amortiguadores',
            'comprobante' => UploadedFile::fake()->create('factura.pdf', 100, 'application/pdf'),
        ];
    }

    public function test_un_mantenimiento_completado_no_puede_tener_fecha_futura(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        $this->api($token)->post('/api/mantenimientos', $this->datosMantenimientoCompletado($vehiculo->id, [
            'fecha_mantenimiento' => $this->enDias(10),
        ]), ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('fecha_mantenimiento');
    }

    public function test_el_kilometraje_no_puede_retroceder_respecto_al_ultimo_mantenimiento(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $json = ['Accept' => 'application/json'];

        $this->api($token)->post('/api/mantenimientos', $this->datosMantenimientoCompletado($vehiculo->id), $json)->assertStatus(201);

        $this->api($token)->post('/api/mantenimientos', $this->datosMantenimientoCompletado($vehiculo->id, [
            'kilometraje_actual' => 40000,
        ]), $json)->assertStatus(422)->assertJsonValidationErrors('kilometraje_actual');
    }

    // ------------------------------------------------------ dashboard

    public function test_el_dashboard_cuenta_solo_socios_activos(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        Socio::create(['nombre' => 'A', 'estado' => 'Activo']);
        Socio::create(['nombre' => 'B', 'estado' => 'Activo']);
        Socio::create(['nombre' => 'C', 'estado' => 'Inactivo']);

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->assertJsonPath('kpis.socios_activos', 2);
    }

    public function test_el_mantenimiento_no_guarda_ningun_costo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        // Aunque alguien mande "costo" a mano, no debe quedar rastro de dinero:
        // esos gastos los maneja cada socio por su cuenta.
        $respuesta = $this->api($token)->post('/api/mantenimientos', $this->datosMantenimientoCompletado($vehiculo->id, [
            'costo' => 500,
        ]), ['Accept' => 'application/json'])->assertStatus(201);

        $respuesta->assertJsonMissingPath('mantenimiento.costo');
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('mantenimientos', 'costo'));
        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->assertJsonMissingPath('kpis.gastos_mes');
    }

    public function test_el_dashboard_cuenta_las_unidades_sin_mantenimiento_reciente(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $alDia = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-01', 'placa' => 'AAA-1111']);
        $atrasado = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-02', 'placa' => 'BBB-2222']);
        $this->crearVehiculo($socio, ['numero_vehiculo' => '012-03', 'placa' => 'CCC-3333']); // nunca tuvo ninguno
        $base = ['tipo_mantenimiento' => 'Frenos', 'estado' => 'Completado', 'kilometraje_actual' => 1000];

        \App\Models\Mantenimiento::create($base + ['vehiculo_id' => $alDia->id, 'fecha_mantenimiento' => $this->enMeses(-1)]);
        \App\Models\Mantenimiento::create($base + ['vehiculo_id' => $atrasado->id, 'fecha_mantenimiento' => $this->enMeses(-8)]);

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()
            ->assertJsonPath('kpis.unidades_sin_mantenimiento', 2)
            ->assertJsonPath('kpis.meses_sin_mantenimiento', 6);
    }

    public function test_un_mantenimiento_programado_no_cuenta_como_unidad_atendida(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        \App\Models\Mantenimiento::create([
            'vehiculo_id' => $vehiculo->id, 'tipo_mantenimiento' => 'Frenos', 'estado' => 'Programado',
            'fecha_mantenimiento' => $this->enDias(0), 'kilometraje_actual' => 0,
        ]);

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()
            ->assertJsonPath('kpis.unidades_sin_mantenimiento', 1);
    }

    public function test_la_flota_al_dia_exige_una_revision_aprobada_reciente_de_un_vehiculo_vigente(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vigente = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-01', 'placa' => 'AAA-1111']);
        $vencido = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-02', 'placa' => 'BBB-2222']);
        $eliminado = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-03', 'placa' => 'CCC-3333']);

        $revision = fn ($vehiculo, $fecha) => \App\Models\Revision::create([
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $fecha, 'tipo' => 'RTV', 'estado' => 'Aprobada',
        ]);
        $revision($vigente, $this->enMeses(-2));
        $revision($vencido, $this->enMeses(-30));
        $revision($eliminado, $this->enMeses(-1));
        $eliminado->delete();

        $kpis = $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->json('kpis');

        $this->assertSame(2, $kpis['flota_total']);
        $this->assertSame(1, $kpis['vehiculos_al_dia']);
    }

    // La RTV vale hasta la fecha que dice el certificado, no doce meses contados
    // desde la revision. El portal del socio ya avisaba con la fecha real; el
    // dashboard seguia con la ventana fija y podia contar como al dia una unidad
    // con la revision vencida.
    public function test_una_unidad_con_la_rtv_vencida_no_cuenta_como_al_dia(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        \App\Models\Revision::create([
            'vehiculo_id' => $vehiculo->id,
            'fecha_revision' => $this->enMeses(-2),
            'fecha_vencimiento' => $this->enDias(-1),
            'tipo' => 'RTV', 'estado' => 'Aprobada',
        ]);

        $kpis = $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->json('kpis');

        $this->assertSame(0, $kpis['vehiculos_al_dia'], 'una RTV vencida no deberia contar como al dia');
    }

    public function test_una_unidad_con_la_rtv_vigente_cuenta_al_dia_aunque_la_revision_sea_vieja(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);

        \App\Models\Revision::create([
            'vehiculo_id' => $vehiculo->id,
            'fecha_revision' => $this->enMeses(-14),
            'fecha_vencimiento' => $this->enDias(30),
            'tipo' => 'RTV', 'estado' => 'Aprobada',
        ]);

        $kpis = $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->json('kpis');

        $this->assertSame(1, $kpis['vehiculos_al_dia'], 'si el certificado sigue vigente, la unidad esta al dia');
    }

    // Las revisiones cargadas antes de que existiera la columna no tienen fecha
    // de vencimiento. Para esas se mantiene la ventana de doce meses, que es lo
    // unico que se puede deducir.
    public function test_una_revision_sin_fecha_de_vencimiento_usa_la_ventana_de_doce_meses(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $reciente = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-01', 'placa' => 'AAA-1111']);
        $antigua = $this->crearVehiculo($socio, ['numero_vehiculo' => '012-02', 'placa' => 'BBB-2222']);

        \App\Models\Revision::create([
            'vehiculo_id' => $reciente->id,
            'fecha_revision' => $this->enMeses(-2),
            'tipo' => 'RTV', 'estado' => 'Aprobada',
        ]);
        \App\Models\Revision::create([
            'vehiculo_id' => $antigua->id,
            'fecha_revision' => $this->enMeses(-14),
            'tipo' => 'RTV', 'estado' => 'Aprobada',
        ]);

        $kpis = $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->json('kpis');

        $this->assertSame(1, $kpis['vehiculos_al_dia']);
    }
    public function test_los_pendientes_de_taller_ignoran_vehiculos_eliminados(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        \App\Models\Mantenimiento::create([
            'vehiculo_id' => $vehiculo->id, 'tipo_mantenimiento' => 'Frenos', 'estado' => 'En Proceso',
            'fecha_mantenimiento' => $this->enDias(0), 'kilometraje_actual' => 0,
        ]);
        $vehiculo->delete();

        $this->api($token)->getJson('/api/dashboard/stats')->assertOk()->assertJsonPath('kpis.taller_pendientes', 0);
    }

    // ------------------------------------------ ordenamiento de las tablas

    public function test_las_tablas_ordenan_por_la_columna_que_se_pide(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $this->crearSocio(['nombre' => 'Zulema Vera', 'cedula' => $this->cedulaValida(31)]);
        $this->crearSocio(['nombre' => 'Ana Bravo', 'cedula' => $this->cedulaValida(32)]);

        $ascendente = $this->api($token)->getJson('/api/socios?sort=nombre&dir=asc')->assertOk();
        $this->assertSame('Ana Bravo', $ascendente->json('data.0.nombre'));

        $descendente = $this->api($token)->getJson('/api/socios?sort=nombre&dir=desc')->assertOk();
        $this->assertSame('Zulema Vera', $descendente->json('data.0.nombre'));
    }

    // Sin lista blanca, ?sort= llegaria crudo a la consulta: se podria ordenar
    // por una columna que la respuesta no muestra y deducir su contenido viendo
    // como se reordenan las filas.
    public function test_ordenar_por_una_columna_no_permitida_se_ignora(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $this->crearSocio(['nombre' => 'Ana Bravo', 'cedula' => $this->cedulaValida(33)]);

        foreach (['password', 'observaciones', 'id); DROP TABLE socios; --'] as $columna) {
            $this->api($token)->getJson('/api/socios?sort=' . urlencode($columna))->assertOk();
        }

        $this->assertDatabaseCount('socios', 1);
    }

    public function test_el_tamano_de_pagina_de_las_tablas_tiene_tope(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $this->crearSocioConCuenta();

        foreach (['socios', 'vehiculos', 'usuarios', 'aportaciones', 'mantenimientos', 'revisiones', 'auditoria'] as $ruta) {
            $this->assertSame(100, $this->api($token)->getJson("/api/{$ruta}?per_page=99999")->assertOk()->json('per_page'), "/{$ruta} no acota por arriba");
            $this->assertSame(1, $this->api($token)->getJson("/api/{$ruta}?per_page=0")->assertOk()->json('per_page'), "/{$ruta} no acota por abajo");
        }
    }

    // Los desplegables de otras pantallas necesitan la lista entera: si les
    // llegara una pagina, faltarian socios en el selector sin aviso ninguno.
    public function test_los_desplegables_reciben_la_lista_completa_y_sin_datos_de_mas(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        for ($i = 0; $i < 30; $i++) {
            $this->crearSocio(['nombre' => 'Socio Numero ' . $i, 'cedula' => $this->cedulaValida(100 + $i)]);
        }

        $socios = $this->api($token)->getJson('/api/socios?select=1')->assertOk()->json();
        $claves = array_keys($socios[0]);

        $this->assertCount(30, $socios, 'el selector no recibio todos los socios');

        // Lo justo para pintar un <select> o la lista del buscador. Nada de
        // aportaciones, observaciones internas ni el resto del modelo.
        sort($claves);
        $this->assertSame(
            ['cedula', 'cuenta_activa', 'id', 'nombre', 'user_id', 'vehiculos'],
            $claves,
            'el selector recibe campos de mas o le faltan'
        );
        $this->assertStringNotContainsString('observaciones', json_encode($socios));
    }
    // La papelera comparte formato con el listado principal: si una devolviera
    // un array y la otra un objeto paginado, la misma pantalla se romperia al
    // marcar "ver eliminados".
    public function test_la_lista_de_socios_eliminados_tambien_viene_paginada(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio(['nombre' => 'Baja de Prueba']);
        $socio->delete();

        $this->api($token)->getJson('/api/socios/eliminados')->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total'])
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.nombre', 'Baja de Prueba');
    }

    public function test_las_tablas_de_aportaciones_y_mantenimientos_tambien_ordenan(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();

        foreach ([15, 90, 40] as $i => $monto) {
            \App\Models\Aportacion::create([
                'socio_id' => $socio->id, 'monto' => $monto,
                'mes_pagado' => $i + 1, 'anio_pagado' => 2026,
                'fecha_pago' => $this->enDias(0), 'metodo_pago' => 'Efectivo',
                'estado' => 'Aprobado',
            ]);
        }

        $mayor = $this->api($token)->getJson('/api/aportaciones?sort=monto&dir=desc')->assertOk();
        $this->assertSame(90.0, (float) $mayor->json('data.0.monto'));

        $menor = $this->api($token)->getJson('/api/aportaciones?sort=monto&dir=asc')->assertOk();
        $this->assertSame(15.0, (float) $menor->json('data.0.monto'));

        // Una columna fuera de la lista blanca no rompe ni cambia el orden.
        $this->api($token)->getJson('/api/aportaciones?sort=comprobante_ruta')->assertOk();
    }

    // El nombre del personal interno se validaba solo por longitud, mientras que
    // el del socio exigia un patron: un usuario podia llamarse 123456.
    public function test_el_nombre_del_personal_sigue_la_misma_regla_que_el_del_socio(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        foreach (['123456', '<script>x</script>', 'Ab'] as $malo) {
            $this->api($token)->postJson('/api/usuarios', [
                'name' => $malo,
                'email' => 'p' . md5($malo) . '@rapitaxi.test',
                'password' => 'ClaveSegura123',
                'role' => 'operador',
            ])->assertStatus(422)->assertJsonValidationErrors('name');
        }

        $this->api($token)->postJson('/api/usuarios', [
            'name' => 'Maria Jose Pazmino',
            'email' => 'maria.jose@rapitaxi.test',
            'password' => 'ClaveSegura123',
            'role' => 'operador',
        ])->assertCreated();
    }

    // ------------------------------------------------ limites y cabeceras

    public function test_las_rutas_autenticadas_tienen_limite_de_peticiones(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $respuesta = $this->api($token)->getJson('/api/socios')->assertOk();

        $this->assertNotNull($respuesta->headers->get('X-RateLimit-Limit'), 'La API autenticada no tiene rate limiting.');
    }

    public function test_las_subidas_de_archivos_tienen_un_limite_mas_estricto(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();

        $respuesta = $this->api($this->tokenDe($usuario))->post('/api/mis-aportaciones', [
            'mes_pagado' => 1, 'anio_pagado' => $this->anioActual(), 'monto' => 20,
            'comprobante' => UploadedFile::fake()->create('c.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json']);

        $this->assertLessThanOrEqual(30, (int) $respuesta->headers->get('X-RateLimit-Limit'));
        $this->assertGreaterThan(0, (int) $respuesta->headers->get('X-RateLimit-Limit'));
    }

    // ------------------------------------------- uso normal no se rompe

    public function test_el_login_correcto_devuelve_token_y_rol(): void
    {
        $this->crearUsuario('operador', ['email' => 'op@rapitaxi.test', 'password' => 'Clave1234']);

        $this->api()->postJson('/api/login', ['email' => 'op@rapitaxi.test', 'password' => 'Clave1234'])
            ->assertOk()
            ->assertJsonPath('user.role', 'operador')
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);
    }

    public function test_un_socio_puede_subir_su_comprobante_y_solo_ve_los_campos_publicos(): void
    {
        [, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($usuario);

        $respuesta = $this->api($token)->post('/api/mis-aportaciones', [
            'mes_pagado' => 3, 'anio_pagado' => $this->anioActual(), 'monto' => '20.00',
            'comprobante' => UploadedFile::fake()->create('c.jpg', 200, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertStatus(201);

        $respuesta->assertJsonPath('aportacion.estado', 'Pendiente');
        $respuesta->assertJsonMissingPath('aportacion.comprobante_ruta');
        $this->assertCount(1, Storage::disk('s3')->allFiles('comprobantes_aportaciones'));
    }

    public function test_el_perfil_del_socio_incluye_sus_vehiculos_tras_editar_sus_datos(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $this->crearVehiculo($socio);
        $token = $this->tokenDe($usuario);

        $this->api($token)->getJson('/api/mi-perfil')->assertOk()->assertJsonPath('vehiculos.0.placa', 'MBC-4650');
        $this->api($token)->putJson('/api/mi-perfil', ['telefono' => '0991234567', 'correo' => 'sigo.siendo@rapitaxi.test'])
            ->assertOk()->assertJsonPath('socio.vehiculos.0.placa', 'MBC-4650');
    }

    public function test_el_admin_conserva_su_propia_sesion_al_cambiar_su_clave(): void
    {
        $admin = $this->crearUsuario('admin');
        $token = $this->tokenDe($admin);

        $this->api($token)->putJson("/api/usuarios/{$admin->id}", [
            'name' => $admin->name, 'email' => $admin->email, 'role' => 'admin', 'password' => 'OtraClave123',
        ])->assertOk();

        $this->api($token)->getJson('/api/socios')->assertOk();
    }

    public function test_una_revision_aprobada_no_puede_tener_fecha_futura_pero_una_pendiente_si(): void
    {
        $token = $this->tokenDe($this->crearUsuario('operador'));
        [$socio] = $this->crearSocioConCuenta();
        $vehiculo = $this->crearVehiculo($socio);
        $revision = fn (string $estado) => [
            'vehiculo_id' => $vehiculo->id, 'fecha_revision' => $this->enDias(15),
            'tipo' => 'RTV', 'estado' => $estado,
        ];

        $this->api($token)->postJson('/api/revisiones', $revision('Aprobada'))
            ->assertStatus(422)->assertJsonValidationErrors('fecha_revision');
        $this->api($token)->postJson('/api/revisiones', $revision('Pendiente'))->assertStatus(201);
    }

    public function test_un_pago_manual_no_puede_ser_de_cero_ni_de_fecha_futura(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        [$socio] = $this->crearSocioConCuenta();
        $pago = fn (array $cambios) => $cambios + [
            'socio_id' => $socio->id, 'mes_pagado' => 2, 'anio_pagado' => $this->anioActual(),
            'monto' => 20, 'fecha_pago' => $this->enDias(0),
        ];

        $this->api($token)->postJson('/api/aportaciones', $pago(['monto' => 0]))->assertStatus(422);
        $this->api($token)->postJson('/api/aportaciones', $pago(['fecha_pago' => $this->enDias(3)]))->assertStatus(422);
        $this->api($token)->postJson('/api/aportaciones', $pago([]))->assertStatus(201);
    }

    public function test_el_socio_restaurado_no_recupera_la_cuenta_hasta_que_el_admin_la_reactive(): void
    {
        [$socio, $usuario] = $this->crearSocioConCuenta();
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $this->api($token)->deleteJson("/api/socios/{$socio->id}", ['motivo_baja' => 'Prueba'])->assertOk();
        $this->api($token)->putJson("/api/socios/{$socio->id}/restaurar")->assertOk();
        $this->assertFalse($usuario->fresh()->is_active);

        $this->api($token)->putJson("/api/socios/{$socio->id}/cuenta/estado", ['activa' => true])->assertOk();
        $this->assertTrue($usuario->fresh()->is_active);
    }

    public function test_la_api_no_permite_que_los_datos_personales_queden_en_cache(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));

        $respuesta = $this->api($token)->getJson('/api/socios')->assertOk();

        $this->assertStringContainsString('no-store', (string) $respuesta->headers->get('Cache-Control'));
        $this->assertSame('nosniff', $respuesta->headers->get('X-Content-Type-Options'));
    }

    public function test_las_respuestas_de_error_tambien_llevan_las_cabeceras_de_seguridad(): void
    {
        $sinSesion = $this->api()->getJson('/api/socios')->assertStatus(401);
        $this->assertStringContainsString('no-store', (string) $sinSesion->headers->get('Cache-Control'));
        $this->assertSame('nosniff', $sinSesion->headers->get('X-Content-Type-Options'));

        $prohibido = $this->api($this->tokenDe($this->crearUsuario('socio')))->getJson('/api/socios')->assertStatus(403);
        $this->assertSame('nosniff', $prohibido->headers->get('X-Content-Type-Options'));
    }
}
