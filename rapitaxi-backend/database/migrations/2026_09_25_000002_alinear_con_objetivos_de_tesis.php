<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cierra dos brechas entre el planteamiento del proyecto y el sistema:
     *
     * 1. El objetivo especifico habla de "mantenimientos preventivos,
     *    correctivos y alerta tecnica", pero el sistema no distinguia unos de
     *    otros. Sin esa distincion no se puede responder cuantas fallas
     *    imprevistas tuvo una unidad, que es el "historial cronologico de
     *    fallas" que plantea el proyecto.
     *
     * 2. El resumen ejecutivo promete "alerta preventiva antes de que expire
     *    una revision tecnica", pero las revisiones solo guardaban la fecha en
     *    que se hicieron, no hasta cuando valen. La vigencia se asumia en 12
     *    meses fijos; la RTV real trae su fecha de caducidad impresa.
     */
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            // Los registros existentes son trabajos planificados por frecuencia.
            $table->string('naturaleza')->default('Preventivo');
        });

        Schema::table('revisiones', function (Blueprint $table) {
            $table->date('fecha_vencimiento')->nullable();
            $table->index('fecha_vencimiento', 'revisiones_vencimiento_index');
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropColumn('naturaleza');
        });

        Schema::table('revisiones', function (Blueprint $table) {
            $table->dropIndex('revisiones_vencimiento_index');
            $table->dropColumn('fecha_vencimiento');
        });
    }
};
