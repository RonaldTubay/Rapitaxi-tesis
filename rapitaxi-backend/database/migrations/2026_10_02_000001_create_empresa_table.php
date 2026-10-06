<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los datos de la compania que usa el sistema.
 *
 * Estaban escritos a mano en el dashboard y en el cuadro maestro, asi que
 * instalarlo en otra cooperativa obligaba a editar el codigo fuente. Es una
 * sola fila: el sistema sirve a una compania por instalacion.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empresa', function (Blueprint $table) {
            $table->id();
            $table->string('razon_social');
            $table->string('ruc', 13)->nullable();
            $table->string('permiso_operacion')->nullable();
            $table->string('direccion')->nullable();
            $table->string('ciudad')->nullable();
            $table->string('telefono', 20)->nullable();
            $table->string('email')->nullable();
            // Nombres que firman los documentos impresos. Hasta ahora el cuadro
            // maestro salia con la linea de firma pero sin decir quien firma.
            $table->string('gerente')->nullable();
            $table->string('secretario')->nullable();
            $table->timestamps();
        });

        // La fila inicial lleva los datos que estaban en el codigo, para que al
        // migrar una instalacion existente no cambie nada de lo que ya se veia.
        DB::table('empresa')->insert([
            'razon_social' => 'RapitaxisMontecristi S.A.',
            'ciudad' => 'Montecristi',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('empresa');
    }
};
