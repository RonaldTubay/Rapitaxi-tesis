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
        Schema::create('pagos', function (Blueprint $table) {
            $table->id();
            // Llave foránea: Conecta el pago con un socio específico. Si se borra el socio, se borran sus pagos.
            $table->foreignId('socio_id')->constrained('socios')->onDelete('cascade');
            
            $table->integer('mes_pagado'); // Ej: 5 (Mayo)
            $table->integer('anio_pagado'); // Ej: 2026
            $table->decimal('monto', 8, 2); // Ej: 20.00
            $table->date('fecha_pago');
            $table->string('metodo_pago')->default('Efectivo');
            
            $table->timestamps();
        });
}
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pagos');
    }
};
