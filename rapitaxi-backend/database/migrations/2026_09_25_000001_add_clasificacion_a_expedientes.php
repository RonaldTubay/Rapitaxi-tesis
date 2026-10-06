<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hasta ahora un expediente era solo "un archivo con un nombre libre": el
     * sistema guardaba el documento pero no sabia QUE era. Con eso no se podia
     * responder lo que justifica digitalizar un expediente: a que socio le
     * falta la habilitacion, que matriculas vencen este trimestre, si el
     * expediente de una unidad esta completo.
     *
     * Los tipos salen de los documentos reales de la compania: habilitacion,
     * cedula, carta de cesion, matricula y certificado del SRI concentran la
     * gran mayoria del archivo fisico.
     */
    public function up(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            // Los registros que ya existan quedan como "otro" hasta que
            // alguien los reclasifique desde la pantalla.
            $table->string('tipo_expediente')->default('otro');
            $table->string('numero_documento')->nullable();
            $table->date('fecha_emision')->nullable();
            $table->date('fecha_vencimiento')->nullable();

            // Para responder "que vence pronto" sin recorrer toda la tabla.
            $table->index(['socio_id', 'tipo_expediente'], 'expedientes_socio_tipo_index');
            $table->index('fecha_vencimiento', 'expedientes_vencimiento_index');
        });
    }

    public function down(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->dropIndex('expedientes_socio_tipo_index');
            $table->dropIndex('expedientes_vencimiento_index');
            $table->dropColumn(['tipo_expediente', 'numero_documento', 'fecha_emision', 'fecha_vencimiento']);
        });
    }
};
