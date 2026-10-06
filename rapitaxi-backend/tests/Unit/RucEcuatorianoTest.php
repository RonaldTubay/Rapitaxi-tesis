<?php

namespace Tests\Unit;

use App\Rules\RucEcuatoriano;
use PHPUnit\Framework\TestCase;

/**
 * El verificador del RUC.
 *
 * De las personas juridicas se comprueba la estructura, no el digito
 * verificador: el RUC verdadero de la compañia no cumple el modulo 11 publicado
 * y exigirlo dejaba al administrador sin poder guardar sus propios datos. Lo que
 * se busca aqui es atrapar un numero mal copiado, no suplantar al SRI.
 */
class RucEcuatorianoTest extends TestCase
{
    // Tomado del acta de cambio de socio de la unidad 012-01. Si alguien vuelve
    // a endurecer la regla, esta prueba lo detiene.
    public function test_acepta_el_ruc_verdadero_de_la_compania(): void
    {
        $this->assertTrue(
            RucEcuatoriano::esValido('1391934177001'),
            'rechazar el RUC real de la compañía deja el formulario inservible'
        );
    }

    public function test_acepta_el_ruc_de_una_sociedad_privada(): void
    {
        $this->assertTrue(RucEcuatoriano::esValido('1790010937001'));
        $this->assertTrue(RucEcuatoriano::esValido('1790016919001'));
    }

    public function test_acepta_el_ruc_de_una_entidad_publica(): void
    {
        $this->assertTrue(RucEcuatoriano::esValido('1768152560001'));
    }

    public function test_acepta_el_ruc_de_una_persona_natural(): void
    {
        // Los diez primeros digitos son una cedula valida (provincia 13, Manabi).
        $this->assertTrue(RucEcuatoriano::esValido('1310060007001'));
    }

    public function test_acepta_otros_establecimientos_de_la_misma_empresa(): void
    {
        // El sufijo es el numero de establecimiento: 002 es la segunda sucursal.
        $this->assertTrue(RucEcuatoriano::esValido('1790010937002'));
    }

    // En las personas naturales el nucleo es una cedula, y ese algoritmo si es
    // fiable: ahi un digito mal copiado se sigue detectando.
    public function test_rechaza_una_persona_natural_con_la_cedula_mal_escrita(): void
    {
        $this->assertFalse(RucEcuatoriano::esValido('1310060001001'));
        $this->assertFalse(RucEcuatoriano::esValido('1312106005001'));
    }

    public function test_rechaza_el_establecimiento_000(): void
    {
        $this->assertFalse(RucEcuatoriano::esValido('1790010937000'));
        $this->assertFalse(RucEcuatoriano::esValido('1391934177000'));
    }

    // Una entidad publica solo tiene el establecimiento 0001.
    public function test_rechaza_una_entidad_publica_con_otro_establecimiento(): void
    {
        $this->assertFalse(RucEcuatoriano::esValido('1768152560002'));
    }

    public function test_rechaza_una_provincia_que_no_existe(): void
    {
        $this->assertFalse(RucEcuatoriano::esValido('9990010937001'));
        $this->assertFalse(RucEcuatoriano::esValido('0090010937001'));
    }

    public function test_rechaza_un_tercer_digito_que_no_corresponde_a_ningun_tipo(): void
    {
        $this->assertFalse(RucEcuatoriano::esValido('1370010937001'));
        $this->assertFalse(RucEcuatoriano::esValido('1380010937001'));
    }

    public function test_rechaza_lo_que_no_sean_trece_digitos(): void
    {
        foreach (['', '1391934177', '13919341770011', '139193417700a', 'abcdefghijklm'] as $invalido) {
            $this->assertFalse(RucEcuatoriano::esValido($invalido), "debio rechazar: {$invalido}");
        }
    }
}
