<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->string('numero_vehicular')->nullable()->unique()->after('id');
            $table->string('placa')->nullable()->unique()->after('numero_vehicular');
            $table->unsignedSmallInteger('anio_modelo')->nullable()->after('placa');
            $table->date('fecha_ultima_revision')->nullable()->after('anio_modelo');
            $table->text('observacion')->nullable()->after('fecha_ultima_revision');

            // Accionista asociado al vehiculo.
            $table->foreignId('accionista_id')
                ->nullable()
                ->after('socio_id')
                ->constrained('socios')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('accionista_id');
            $table->dropUnique(['placa']);
            $table->dropUnique(['numero_vehicular']);
            $table->dropColumn([
                'numero_vehicular',
                'placa',
                'anio_modelo',
                'fecha_ultima_revision',
                'observacion',
            ]);
        });
    }
};
