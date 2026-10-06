<?php

namespace Tests\Unit;

use App\Rules\CedulaEcuatoriana;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CedulaEcuatorianaTest extends TestCase
{
    private function pasa(string $valor): bool
    {
        $fallo = false;
        (new CedulaEcuatoriana)->validate('cedula', $valor, function () use (&$fallo) {
            $fallo = true;
        });

        return ! $fallo;
    }

    public static function validas(): array
    {
        return [
            'Manabi'    => ['1312106006'],
            'Pichincha' => ['1713175071'],
            'Guayas'    => ['0912345675'],
        ];
    }

    public static function invalidas(): array
    {
        return [
            'digito verificador malo' => ['1312106007'],
            'provincia inexistente'   => ['9912345678'],
            'provincia cero'          => ['0012345678'],
            'tercer digito >= 6'      => ['1762345678'],
            'muy corta'               => ['131210600'],
            'muy larga'               => ['13121060066'],
            'con letras'              => ['13121060AB'],
            'con espacios'            => ['1312 06006'],
            'todo ceros'              => ['0000000000'],
        ];
    }

    #[DataProvider('validas')]
    public function test_acepta_cedulas_validas(string $cedula): void
    {
        $this->assertTrue($this->pasa($cedula));
    }

    #[DataProvider('invalidas')]
    public function test_rechaza_cedulas_invalidas(string $cedula): void
    {
        $this->assertFalse($this->pasa($cedula));
    }
}
