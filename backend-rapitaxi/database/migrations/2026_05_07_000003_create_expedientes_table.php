<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expedientes', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique();
            $table->foreignId('socio_id')->nullable()->constrained('socios')->nullOnDelete();
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->foreignId('elaborado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->date('fecha_emision');
            $table->text('observacion_general')->nullable();
            $table->enum('estado', ['Abierto', 'Cerrado'])->default('Abierto');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expedientes');
    }
};
