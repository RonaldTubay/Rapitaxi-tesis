<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida un RUC ecuatoriano de 13 digitos.
 *
 * El tercer digito dice de quien es:
 *   0-5  persona natural   -> los 10 primeros digitos son una cedula (modulo 10)
 *   6    entidad publica   -> el establecimiento es 0001
 *   9    sociedad privada  -> establecimiento distinto de 000
 *
 * De las personas juridicas se comprueba la estructura, no el digito
 * verificador. El RUC verdadero de la compañia, 1391934177001, tomado del acta
 * de cambio de socio, tiene la estructura correcta (provincia 13 = Manabi,
 * tercer digito 9 = sociedad) y NO cumple el modulo 11 publicado. Hay RUC de
 * sociedades reales, sobre todo antiguos, que tampoco lo cumplen.
 *
 * Exigirlo dejaba al administrador sin poder guardar el RUC de su propia
 * compañia, y una validacion que rechaza el dato verdadero es peor que no
 * validar: lo que se busca aqui es atrapar un numero mal copiado, no suplantar
 * al SRI.
 */
class RucEcuatoriano implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::esValido((string) $value)) {
            $fail('El RUC no es válido: revisa que los 13 dígitos estén bien escritos.');
        }
    }

    public static function esValido(string $ruc): bool
    {
        if (! preg_match('/^\d{13}$/', $ruc)) {
            return false;
        }

        $provincia = (int) substr($ruc, 0, 2);
        if (($provincia < 1 || $provincia > 24) && $provincia !== 30) {
            return false;
        }

        $tercero = (int) $ruc[2];

        if ($tercero < 6) {
            // Persona natural con RUC: el nucleo es su cedula.
            return substr($ruc, 10, 3) !== '000'
                && CedulaEcuatoriana::esValida(substr($ruc, 0, 10));
        }

        if ($tercero === 6) {
            // Entidad publica: el establecimiento es siempre 0001.
            return substr($ruc, 9, 4) === '0001';
        }

        if ($tercero === 9) {
            return substr($ruc, 10, 3) !== '000';
        }

        // Un 7 u 8 en el tercer digito no corresponde a ningun tipo de RUC.
        return false;
    }
}
