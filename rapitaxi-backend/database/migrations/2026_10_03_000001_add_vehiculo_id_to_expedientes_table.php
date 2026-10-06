<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un expediente cuelga de un socio o de una unidad, no siempre de un socio.
 *
 * En las carpetas de la cooperativa, una misma carpeta mezcla papeles de tres
 * dueños distintos: la cedula es de la persona, la matricula y la habilitacion
 * son del auto, y el acta de cambio de socio no es de nadie, es del hecho.
 *
 * Con un solo socio_id, los papeles del auto quedaban archivados bajo quien
 * fuera su dueño ese dia. Al traspasar el cupo, el socio entrante empezaba con
 * el expediente vacio aunque la unidad tuviera sus papeles al dia, y habia que
 * volver a subir el mismo PDF con otro nombre: el documento duplicado una vez
 * por cada dueño.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->foreignId('vehiculo_id')->nullable()->after('socio_id')
                ->constrained('vehiculos')->nullOnDelete();
        });

        // Un documento de la unidad no tiene socio: es del cupo.
        Schema::table('expedientes', function (Blueprint $table) {
            $table->unsignedBigInteger('socio_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehiculo_id');
        });
    }
};
