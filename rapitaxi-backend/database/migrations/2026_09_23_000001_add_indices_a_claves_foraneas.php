<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * En PostgreSQL una FOREIGN KEY no crea indice automaticamente, a
     * diferencia de MySQL. Sin indice, cada JOIN con la tabla padre y cada
     * borrado en cascada recorre la tabla entera.
     *
     * Con los ~66 socios actuales no se nota, pero cada año de historial
     * multiplica las filas de aportaciones y mantenimientos.
     *
     * Los indices compuestos cubren ademas las consultas mas repetidas del
     * sistema, que filtran por la clave foranea Y por periodo o estado.
     */
    public function up(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            // El accessor estado_pago_actual del socio consulta exactamente asi.
            $table->index(['socio_id', 'anio_pagado', 'mes_pagado'], 'aportaciones_socio_periodo_index');
            $table->index('revisado_por', 'aportaciones_revisado_por_index');
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->index('socio_id', 'vehiculos_socio_id_index');
        });

        Schema::table('mantenimientos', function (Blueprint $table) {
            // PlanMantenimiento busca el ultimo trabajo aprobado por unidad y tipo.
            $table->index(['vehiculo_id', 'estado', 'fecha_mantenimiento'], 'mantenimientos_vehiculo_estado_fecha_index');
            $table->index('revisado_por', 'mantenimientos_revisado_por_index');
        });

        Schema::table('revisiones', function (Blueprint $table) {
            // El dashboard cuenta revisiones aprobadas recientes por vehiculo.
            $table->index(['vehiculo_id', 'estado', 'fecha_revision'], 'revisiones_vehiculo_estado_fecha_index');
        });

        Schema::table('expedientes', function (Blueprint $table) {
            $table->index('socio_id', 'expedientes_socio_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            $table->dropIndex('aportaciones_socio_periodo_index');
            $table->dropIndex('aportaciones_revisado_por_index');
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropIndex('vehiculos_socio_id_index');
        });

        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropIndex('mantenimientos_vehiculo_estado_fecha_index');
            $table->dropIndex('mantenimientos_revisado_por_index');
        });

        Schema::table('revisiones', function (Blueprint $table) {
            $table->dropIndex('revisiones_vehiculo_estado_fecha_index');
        });

        Schema::table('expedientes', function (Blueprint $table) {
            $table->dropIndex('expedientes_socio_id_index');
        });
    }
};
