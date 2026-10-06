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
        Schema::create('expedientes', function (Blueprint $table) {
            $table->id();
            // Conexión con el socio (Si se borra el socio, se borran sus documentos)
            $table->foreignId('socio_id')->constrained('socios')->onDelete('cascade');
            
            $table->string('nombre_documento'); // Ej: "Matrícula 2026", "Cédula Escaneada"
            $table->string('tipo_documento');   // Ej: "pdf", "jpg"
            $table->string('ruta_archivo');     // Ruta interna donde Laravel guardará el archivo
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expedientes');
    }
};
