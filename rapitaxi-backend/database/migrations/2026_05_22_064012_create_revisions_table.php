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
        Schema::create('revisiones', function (Blueprint $table) {
            $table->id();
            // Conexión: La revisión se le hace a un vehículo específico
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->onDelete('cascade');
            
            $table->date('fecha_revision');
            $table->string('tipo')->default('RTV Manta'); // RTV, Cambio de Aceite, Frenos, etc.
            $table->enum('estado', ['Aprobada', 'Rechazada', 'Pendiente'])->default('Aprobada');
            $table->text('observaciones')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('revisions');
    }
};
