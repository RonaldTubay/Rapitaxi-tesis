<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->enum('tipo_registro', ['generado', 'cargado'])->default('generado')->after('estado');
            $table->string('archivo_path')->nullable()->after('tipo_registro');
            $table->string('archivo_nombre')->nullable()->after('archivo_path');
        });
    }

    public function down(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->dropColumn(['tipo_registro', 'archivo_path', 'archivo_nombre']);
        });
    }
};
