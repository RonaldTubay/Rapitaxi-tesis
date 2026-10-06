<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El socio ahora puede registrar el mantenimiento que le hizo a su
     * unidad, igual que sube el comprobante de su aportacion: queda
     * "Pendiente" hasta que el staff lo confirme. Solo los aprobados
     * cuentan para decir que una unidad esta al dia.
     *
     * Los registros que ya existian nacieron del staff, asi que el valor
     * por defecto los deja aprobados sin tener que tocarlos.
     */
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->string('revision_estado')->default('Aprobado');
            $table->string('origen')->default('staff');
            $table->text('motivo_rechazo')->nullable();
            $table->foreignId('revisado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revisado_en')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('revisado_por');
            $table->dropColumn(['revision_estado', 'origen', 'motivo_rechazo', 'revisado_en']);
        });
    }
};
