<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La vigencia del permiso de operacion de la compania.
 *
 * El acta de cambio de socio lo trae bajo "DOCUMENTOS HABILITANTES": numero de
 * resolucion, fecha y fecha de caducidad. El sistema guardaba solo el numero,
 * como texto suelto.
 *
 * Es el vencimiento mas grave de todos: si caduca, no es que un socio no pueda
 * circular, es que la compania entera deja de operar. Y era el unico que el
 * control de vencimientos no podia ver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->date('fecha_permiso_operacion')->nullable()->after('permiso_operacion');
            $table->date('fecha_caducidad_permiso')->nullable()->after('fecha_permiso_operacion');
        });
    }

    public function down(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->dropColumn(['fecha_permiso_operacion', 'fecha_caducidad_permiso']);
        });
    }
};
