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
        Schema::create('vehiculos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('socio_id')->constrained('socios')->onDelete('cascade');
            
            // Datos del Activo (Movidos desde Socios)
            $table->string('numero_vehiculo'); // Ej: 012-01
            $table->string('placa')->unique(); // Ej: MBC-4650
            
            // Especificaciones
            $table->string('marca');
            $table->string('modelo');
            $table->integer('anio_fabricacion');
            $table->string('color')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehiculos');
    }
};
