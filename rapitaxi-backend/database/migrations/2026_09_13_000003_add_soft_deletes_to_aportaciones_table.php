<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Un pago borrado por error de captura ya no debe desaparecer del todo:
    // queda oculto del sistema pero conservado para auditoria contable.
    public function up(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
