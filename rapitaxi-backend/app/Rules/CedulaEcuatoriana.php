<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida una cedula ecuatoriana de 10 digitos: provincia (01-24 o 30),
 * tercer digito menor a 6 y digito verificador por modulo 10.
 */
class CedulaEcuatoriana implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::esValida((string) $value)) {
            $fail('La cédula no es válida: revisa que los 10 dígitos estén bien escritos.');
        }
    }

    public static function esValida(string $cedula): bool
    {
        if (! preg_match('/^\d{10}$/', $cedula)) {
            return false;
        }

        $provincia = (int) substr($cedula, 0, 2);
        if (($provincia < 1 || $provincia > 24) && $provincia !== 30) {
            return false;
        }

        if ((int) $cedula[2] >= 6) {
            return false;
        }

        $suma = 0;
        for ($i = 0; $i < 9; $i++) {
            $valor = (int) $cedula[$i] * ($i % 2 === 0 ? 2 : 1);
            $suma += $valor > 9 ? $valor - 9 : $valor;
        }

        return (10 - ($suma % 10)) % 10 === (int) $cedula[9];
    }
}
