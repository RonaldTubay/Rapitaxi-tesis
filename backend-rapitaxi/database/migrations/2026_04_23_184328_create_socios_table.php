<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('socios', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('cedula')->unique();
            $table->string('telefono');
            $table->string('correo')->unique();
            $table->date('fecha_ingreso');
            $table->enum('estado', ['Activo', 'Suspendido'])->default('Activo');
            $table->timestamps(); // Crea automatically created_at y updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('socios');
    }
};