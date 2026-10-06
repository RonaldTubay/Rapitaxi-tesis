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
        Schema::create('mantenimientos', function (Blueprint $table) {
            $table->id();
            // Conexión con el vehículo
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->onDelete('cascade');
            
            // Datos Operativos
            $table->date('fecha_mantenimiento');
            $table->string('tipo_mantenimiento'); // Ej: Cambio de Aceite, Frenos...
            $table->integer('kilometraje_actual');
            $table->integer('proximo_mantenimiento_km')->nullable(); // Cálculo predictivo
            
            // Datos Financieros
            $table->decimal('costo', 8, 2)->default(0); 
            $table->string('comprobante_ruta')->nullable(); // Ruta de la foto de la factura
            
            // Control de Taller
            $table->string('mecanico')->nullable(); 
            $table->enum('estado', ['Completado', 'En Proceso', 'Programado'])->default('Programado'); 
            $table->text('observaciones')->nullable(); // <-- ¡Campo recuperado para los detalles!
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mantenimientos');
    }
};