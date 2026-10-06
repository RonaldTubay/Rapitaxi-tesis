<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Nombre de una persona: letras (con tildes y Ñ), espacios, apostrofes, guiones
 * y puntos. Nadie tiene numeros ni etiquetas HTML como parte de su nombre, y un
 * nombre completo no pasa de 80 caracteres.
 *
 * El punto entra porque aparece en nombres reales ("Dr. Ana Perez", "St. John"):
 * dejarlo fuera rechazaba gente de verdad sin ganar nada, ya que lo que hay que
 * frenar son los digitos y los simbolos de marcado.
 *
 * Vive aqui y no como constante de un controlador porque la misma regla aplica
 * a los socios y al personal interno. Estaba solo en SocioController, asi que
 * un usuario del staff podia llamarse "123456" o traer etiquetas HTML.
 */
class NombreDePersona implements ValidationRule
{
    public const PATRON = "/^[\pL\s'.-]{3,80}$/u";

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! preg_match(self::PATRON, (string) $value)) {
            $fail('El nombre solo puede tener letras, espacios, apóstrofes, guiones y puntos (entre 3 y 80 caracteres).');
        }
    }
}
