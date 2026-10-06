<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Modelo" (texto libre, ej. "Aveo Family") se reemplaza por "tipo de
     * vehiculo" (una lista cerrada como Sedan/SUV/Pickup, igual a como lo
     * clasifica la resolucion de habilitacion de la ANT/GAD). Se agrega
     * tambien el combustible, que la matricula ya registra por unidad.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE vehiculos RENAME COLUMN modelo TO tipo_vehiculo');

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->string('combustible')->default('Gasolina');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('combustible');
        });

        DB::statement('ALTER TABLE vehiculos RENAME COLUMN tipo_vehiculo TO modelo');
    }
};
