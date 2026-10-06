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
        Schema::create('socios', function (Blueprint $table) {
            $table->id();         
            $table->string('nombre');          
            $table->string('cedula')->nullable()->unique();
            $table->string('telefono')->nullable();
            $table->string('correo')->nullable();    
            $table->string('direccion')->nullable(); 
            $table->enum('estado', ['Activo', 'Inactivo'])->default('Activo');
            
            // --- NUEVOS CAMPOS ---
            $table->enum('estado_pago', ['Al día', 'En mora'])->default('Al día');
            $table->text('observaciones')->nullable(); // Texto largo opcional
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('socios');
    }
};
