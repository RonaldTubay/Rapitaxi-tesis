<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('configuraciones_mantenimiento', function (Blueprint $table) {
            $table->id();
            $table->string('tipo_mantenimiento'); // Ej: 'Cambio de Aceite'
            $table->integer('km_anticipacion')->default(500); // Kilómetros de margen
            $table->integer('dias_anticipacion')->default(7); // Días de margen
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('configuraciones_mantenimiento');
    }
};
