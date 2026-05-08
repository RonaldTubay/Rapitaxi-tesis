<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->string('comprobante_path')->nullable()->after('estado');
            $table->string('comprobante_nombre')->nullable()->after('comprobante_path');
            $table->date('fecha_completado')->nullable()->after('comprobante_nombre');
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropColumn(['comprobante_path', 'comprobante_nombre', 'fecha_completado']);
        });
    }
};
