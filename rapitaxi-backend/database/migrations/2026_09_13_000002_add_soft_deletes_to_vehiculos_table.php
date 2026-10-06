<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mismo criterio que socios: la placa deja de estar "tomada" una vez el
     * vehiculo se da de baja (soft delete), pero el historial de
     * mantenimientos/revisiones que lo referencian se conserva intacto.
     */
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropUnique(['placa']);
        });

        DB::statement('CREATE UNIQUE INDEX vehiculos_placa_unique ON vehiculos (placa) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS vehiculos_placa_unique');

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->unique('placa');
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
