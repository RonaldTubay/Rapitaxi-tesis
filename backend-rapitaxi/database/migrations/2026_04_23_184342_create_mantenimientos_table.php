<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mantenimientos', function (Blueprint $table) {
            $table->id();
            
            // Relación con el vehículo
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            
            $table->string('tipo'); // Ej: Cambio de aceite
            $table->text('descripcion')->nullable();
            $table->date('fecha');
            $table->string('mecanico');
            $table->integer('kilometraje_actual');
            $table->decimal('costo', 8, 2); // Hasta 999,999.99
            $table->enum('estado', ['Completado', 'En Proceso', 'Pendiente'])->default('Pendiente');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mantenimientos');
    }
};