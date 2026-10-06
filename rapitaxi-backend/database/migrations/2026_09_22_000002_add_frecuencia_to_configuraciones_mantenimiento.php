<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La tabla guardaba con cuanta anticipacion avisar, pero nunca cada
     * cuanto toca cada trabajo, que es el dato que hace falta para poder
     * calcular la proxima fecha. El aviso se calcula solo por tiempo:
     * el sistema no conoce el kilometraje actual de una unidad entre un
     * mantenimiento y otro, asi que km_anticipacion no servia para nada.
     */
    public function up(): void
    {
        Schema::table('configuraciones_mantenimiento', function (Blueprint $table) {
            $table->integer('meses_frecuencia')->default(6);
            $table->dropColumn('km_anticipacion');
        });
    }

    public function down(): void
    {
        Schema::table('configuraciones_mantenimiento', function (Blueprint $table) {
            $table->integer('km_anticipacion')->default(500);
            $table->dropColumn('meses_frecuencia');
        });
    }
};
