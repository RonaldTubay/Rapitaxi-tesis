<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que el acta de cambio de socio trae y el sistema todavia no guardaba.
 *
 * Del bloque del vehiculo: el segundo color, el numero de disco y la capacidad
 * de carga. Del bloque de la operadora: la parroquia y la provincia, y las tres
 * casillas del servicio (clase de transporte, ambito y tipo), que encabezan los
 * documentos oficiales.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            // La matricula trae COLOR 1 y COLOR 2; el sistema solo guardaba uno,
            // y encima fijo en "Amarillo" desde el controlador.
            $table->string('color_secundario', 30)->nullable()->after('color');
            $table->string('disco', 10)->nullable()->after('color_secundario');
            $table->decimal('capacidad_carga', 5, 2)->nullable()->after('disco');
        });

        Schema::table('empresa', function (Blueprint $table) {
            $table->string('provincia', 60)->nullable()->after('ciudad');
            $table->string('parroquia', 80)->nullable()->after('provincia');
            $table->string('clase_transporte', 40)->nullable()->after('parroquia');
            $table->string('ambito_servicio', 60)->nullable()->after('clase_transporte');
            $table->string('tipo_servicio', 60)->nullable()->after('ambito_servicio');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn(['color_secundario', 'disco', 'capacidad_carga']);
        });

        Schema::table('empresa', function (Blueprint $table) {
            $table->dropColumn(['provincia', 'parroquia', 'clase_transporte', 'ambito_servicio', 'tipo_servicio']);
        });
    }
};
