<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Un socio eliminado deja de aparecer en el sistema, pero su cedula no
     * queda disponible para pisar en consultas historicas (aportaciones,
     * vehiculos, etc. la siguen referenciando). El indice unico de cedula se
     * recrea como parcial (solo entre no eliminados) para poder reusar la
     * cedula si alguien se re-registra tras haber sido borrado antes.
     */
    public function up(): void
    {
        Schema::table('socios', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('socios', function (Blueprint $table) {
            $table->dropUnique(['cedula']);
        });

        DB::statement('CREATE UNIQUE INDEX socios_cedula_unique ON socios (cedula) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS socios_cedula_unique');

        Schema::table('socios', function (Blueprint $table) {
            $table->unique('cedula');
        });

        Schema::table('socios', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
