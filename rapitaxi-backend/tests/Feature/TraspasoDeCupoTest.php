<?php

namespace Tests\Feature;

use App\Models\Expediente;
use App\Models\Socio;
use App\Models\Traspaso;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaEscenarioApi;
use Tests\TestCase;

/**
 * El historial de a quien pertenecio cada cupo.
 *
 * En el archivo fisico de la compañia, 56 de 66 carpetas tienen carta de cesion:
 * traspasar un cupo es lo normal. Hasta ahora el sistema solo guardaba el dueño
 * actual, asi que no podia responder a quien le pertenecio antes una unidad.
 */
class TraspasoDeCupoTest extends TestCase
{
    use CreaEscenarioApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararRoles();
    }

    private function unidadDe(Socio $socio): Vehiculo
    {
        return $this->crearVehiculo($socio);
    }

    public function test_registrar_una_unidad_deja_su_asignacion_inicial_en_el_historial(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio();

        $this->api($token)->postJson('/api/vehiculos', [
            'socio_id' => $socio->id,
            'numero_vehiculo' => '045-01',
            'placa' => 'XYZ-9876',
            'marca' => 'KIA',
            'tipo_vehiculo' => 'Sedán',
            'combustible' => 'Gasolina',
            'anio_fabricacion' => 2019,
        ])->assertCreated();

        $traspaso = Traspaso::firstOrFail();

        $this->assertNull($traspaso->socio_anterior_id, 'la primera asignación no viene de nadie');
        $this->assertSame($socio->id, $traspaso->socio_nuevo_id);
    }

    public function test_un_traspaso_cambia_el_dueno_y_queda_en_el_historial(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $entrega = $this->crearSocio(['nombre' => 'Quien Entrega']);
        $recibe = $this->crearSocio(['nombre' => 'Quien Recibe']);
        $unidad = $this->unidadDe($entrega);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $recibe->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'numero_resolucion' => 'RES-2026-014',
            'sin_acta' => true,
            'observaciones' => 'Carga historica: el acta no esta digitalizada.',
        ])->assertCreated();

        $this->assertSame($recibe->id, $unidad->fresh()->socio_id, 'la unidad no quedó a nombre del nuevo socio');

        $historial = $this->api($token)->getJson("/api/vehiculos/{$unidad->id}/traspasos")->assertOk();

        $this->assertSame('Quien Recibe', $historial->json('unidad.socio_actual.nombre'));
        $this->assertSame('Quien Entrega', $historial->json('traspasos.0.socio_anterior.nombre'));
        $this->assertSame('RES-2026-014', $historial->json('traspasos.0.numero_resolucion'));
    }

    // Esta es la que sostiene todo lo demas: si el formulario de vehiculos
    // pudiera cambiar el socio, el historial diria una cosa y la unidad otra.
    public function test_el_formulario_de_vehiculos_no_puede_cambiar_el_dueno(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $dueno = $this->crearSocio(['nombre' => 'Dueño Real']);
        $intruso = $this->crearSocio(['nombre' => 'Otro Socio']);
        $unidad = $this->unidadDe($dueno);

        $this->api($token)->putJson("/api/vehiculos/{$unidad->id}", [
            'socio_id' => $intruso->id,
            'numero_vehiculo' => $unidad->numero_vehiculo,
            'placa' => $unidad->placa,
            'marca' => 'Chevrolet',
            'tipo_vehiculo' => 'Sedán',
            'combustible' => 'Gasolina',
            'anio_fabricacion' => 2016,
        ])->assertOk();

        $this->assertSame($dueno->id, $unidad->fresh()->socio_id, 'el socio_id del cuerpo cambió el dueño sin dejar traspaso');
        $this->assertSame('Chevrolet', $unidad->fresh()->marca, 'el resto de la edición sí debe aplicarse');
        $this->assertSame(0, Traspaso::count());
    }

    public function test_no_se_puede_traspasar_una_unidad_al_socio_que_ya_la_tiene(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio();
        $unidad = $this->unidadDe($socio);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $socio->id,
            'fecha_traspaso' => $this->enDias(0),
        ])->assertStatus(422)->assertJsonValidationErrors('socio_nuevo_id');
    }

    public function test_la_fecha_de_un_traspaso_no_puede_ser_futura_ni_anterior_al_previo(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $uno = $this->crearSocio();
        $dos = $this->crearSocio();
        $tres = $this->crearSocio();
        $unidad = $this->unidadDe($uno);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $dos->id,
            'fecha_traspaso' => $this->enDias(1),
        ])->assertStatus(422)->assertJsonValidationErrors('fecha_traspaso');

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $dos->id,
            'fecha_traspaso' => $this->enMeses(-6),
            'sin_acta' => true,
            'observaciones' => 'Carga historica: el acta no esta digitalizada.',
        ])->assertCreated();

        // Un traspaso anterior al ultimo dejaria la linea de tiempo cruzada.
        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $tres->id,
            'fecha_traspaso' => $this->enAnios(-1),
        ])->assertStatus(422)->assertJsonValidationErrors('fecha_traspaso');
    }

    public function test_la_carta_de_cesion_debe_ser_de_alguno_de_los_dos_socios(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $entrega = $this->crearSocio();
        $recibe = $this->crearSocio();
        $ajeno = $this->crearSocio();
        $unidad = $this->unidadDe($entrega);

        $documentoAjeno = Expediente::create([
            'socio_id' => $ajeno->id,
            'nombre_documento' => 'Cesión de otra persona',
            'tipo_documento' => 'pdf',
            'tipo_expediente' => 'cesion',
            'ruta_archivo' => 'expedientes/ajeno.pdf',
        ]);

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $recibe->id,
            'fecha_traspaso' => $this->enDias(0),
            'expediente_id' => $documentoAjeno->id,
        ])->assertStatus(422);

        $this->assertSame($entrega->id, $unidad->fresh()->socio_id, 'la unidad cambió de dueño pese al rechazo');
    }

    public function test_el_expediente_del_socio_muestra_los_cupos_que_recibio_y_entrego(): void
    {
        $token = $this->tokenDe($this->crearUsuario('admin'));
        $socio = $this->crearSocio(['nombre' => 'Socio Con Historial']);
        $otro = $this->crearSocio(['nombre' => 'La Contraparte']);
        $unidad = $this->unidadDe($otro);

        // Lo recibe y despues lo entrega.
        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $socio->id,
            'fecha_traspaso' => $this->enAnios(-1),
            'sin_acta' => true,
            'observaciones' => 'Carga historica: el acta no esta digitalizada.',
        ])->assertCreated();

        $this->api($token)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $otro->id,
            'fecha_traspaso' => $this->enMeses(-1),
            'sin_acta' => true,
            'observaciones' => 'Carga historica: el acta no esta digitalizada.',
        ])->assertCreated();

        $movimientos = $this->api($token)->getJson("/api/socios/{$socio->id}/traspasos")->assertOk()->json();

        $this->assertCount(2, $movimientos);
        $this->assertSame('Entregó', $movimientos[0]['direccion']);
        $this->assertSame('Recibió', $movimientos[1]['direccion']);
        $this->assertSame('La Contraparte', $movimientos[0]['contraparte']);
    }

    public function test_un_socio_no_puede_ver_ni_registrar_traspasos(): void
    {
        $socioToken = $this->tokenDe($this->crearUsuario('socio'));
        [$socio] = $this->crearSocioConCuenta();
        $unidad = $this->unidadDe($socio);

        $this->api($socioToken)->getJson("/api/vehiculos/{$unidad->id}/traspasos")->assertForbidden();
        $this->api($socioToken)->postJson("/api/vehiculos/{$unidad->id}/traspasos", [
            'socio_nuevo_id' => $socio->id,
            'fecha_traspaso' => $this->enDias(0),
        ])->assertForbidden();
    }
}
