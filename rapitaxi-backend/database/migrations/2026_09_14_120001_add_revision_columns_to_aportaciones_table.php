<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Habilita que el propio socio suba su comprobante de pago desde el
     * portal. Queda en 'Pendiente' hasta que un admin/operador lo revisa;
     * solo las 'Aprobado' cuentan para el estado_pago_actual del socio.
     * Las aportaciones que ya existen (todas registradas por el staff)
     * quedan 'Aprobado' por defecto, sin cambiar su comportamiento actual.
     */
    public function up(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            $table->enum('estado', ['Pendiente', 'Aprobado', 'Rechazado'])->default('Aprobado')->after('metodo_pago');
            $table->string('comprobante_ruta')->nullable()->after('estado');
            $table->string('motivo_rechazo', 300)->nullable()->after('comprobante_ruta');
            $table->foreignId('revisado_por')->nullable()->after('motivo_rechazo')->constrained('users')->nullOnDelete();
            $table->timestamp('revisado_en')->nullable()->after('revisado_por');
        });
    }

    public function down(): void
    {
        Schema::table('aportaciones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('revisado_por');
            $table->dropColumn(['estado', 'comprobante_ruta', 'motivo_rechazo', 'revisado_en']);
        });
    }
};
