<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->date('fecha_caducidad_habilitacion')->nullable();
            $table->index('fecha_caducidad_habilitacion');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropIndex(['fecha_caducidad_habilitacion']);
            $table->dropColumn('fecha_caducidad_habilitacion');
        });
    }
};
