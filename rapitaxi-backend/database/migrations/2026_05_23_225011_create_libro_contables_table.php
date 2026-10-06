<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('libro_contables', function (Blueprint $table) {
            $table->id();
            $table->string('titulo'); // Ej: Balance General
            $table->string('mes_anio')->nullable(); // Ej: Mayo 2026
            $table->string('archivo_ruta'); // Donde se guarda el PDF
            $table->text('descripcion')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('libro_contables');
    }
};
