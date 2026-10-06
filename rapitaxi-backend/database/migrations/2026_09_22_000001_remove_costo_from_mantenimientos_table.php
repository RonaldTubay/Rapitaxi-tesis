<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cada socio paga de su bolsillo el mantenimiento de su unidad: la
     * compañia no lleva esa plata ni la audita. Lo unico que necesita
     * registrar es en que fecha se hizo cada trabajo, para controlar que
     * las unidades esten operativas.
     */
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropColumn('costo');
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->decimal('costo', 8, 2)->default(0);
        });
    }
};
