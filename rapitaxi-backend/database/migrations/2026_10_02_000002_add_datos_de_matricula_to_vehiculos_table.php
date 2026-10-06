<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los datos que la matricula y la resolucion de habilitacion traen en papel y
 * que el sistema no guardaba.
 *
 * Del analisis de los documentos de la cooperativa: chasis, motor, clase,
 * cilindraje y numero de pasajeros salen de la matricula, igual que su fecha de
 * caducidad. Sin esa fecha, el control de vencimientos no podia saber cuando
 * una unidad se queda sin matricula vigente, que es lo que la deja fuera de
 * circulacion.
 *
 * Todos son opcionales: las 66 carpetas no estan completas por igual y obligar
 * a llenarlos impediria registrar una unidad cuyo papel todavia no llego.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->string('numero_chasis', 30)->nullable()->after('color');
            $table->string('numero_motor', 30)->nullable()->after('numero_chasis');
            $table->string('clase', 40)->nullable()->after('numero_motor');
            $table->unsignedSmallInteger('cilindraje')->nullable()->after('clase');
            $table->unsignedTinyInteger('numero_pasajeros')->nullable()->after('cilindraje');

            $table->date('fecha_matricula')->nullable()->after('numero_pasajeros');
            $table->date('fecha_caducidad_matricula')->nullable()->after('fecha_matricula');
            // Puede no ser el socio: hay unidades matriculadas todavia a nombre
            // del dueño anterior o de un familiar.
            $table->string('propietario_matricula', 120)->nullable()->after('fecha_caducidad_matricula');

            $table->string('numero_resolucion_habilitacion', 60)->nullable()->after('propietario_matricula');
            $table->date('fecha_resolucion_habilitacion')->nullable()->after('numero_resolucion_habilitacion');

            // El aviso diario de vencimientos filtra por esta columna.
            $table->index('fecha_caducidad_matricula');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropIndex(['fecha_caducidad_matricula']);
            $table->dropColumn([
                'numero_chasis',
                'numero_motor',
                'clase',
                'cilindraje',
                'numero_pasajeros',
                'fecha_matricula',
                'fecha_caducidad_matricula',
                'propietario_matricula',
                'numero_resolucion_habilitacion',
                'fecha_resolucion_habilitacion',
            ]);
        });
    }
};
