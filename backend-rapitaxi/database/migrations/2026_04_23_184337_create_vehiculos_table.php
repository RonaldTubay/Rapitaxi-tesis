<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehiculos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_taxi')->unique(); // Ej: TAX-001
            $table->string('marca');
            $table->string('color');
            
            // Relación con el socio (Conductor)
            $table->foreignId('socio_id')->nullable()->constrained('socios')->nullOnDelete();
            
            $table->integer('kilometraje');
            $table->integer('desgaste')->default(0); // Porcentaje 0-100
            $table->date('prox_mantenimiento')->nullable();
            $table->enum('estado', ['Operativo', 'Mantenimiento'])->default('Operativo');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculos');
    }
};