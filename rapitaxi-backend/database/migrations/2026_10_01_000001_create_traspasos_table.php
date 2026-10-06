<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de a quien pertenecio cada cupo.
 *
 * En el archivo fisico de la compañia, 56 de 66 carpetas tienen una carta de
 * cesion de acciones: traspasar un cupo es lo normal, no la excepcion. Hasta
 * ahora el sistema solo guardaba el dueño ACTUAL, asi que no podia responder a
 * quien le pertenecio antes la unidad 012-01 ni con que resolucion cambio de
 * manos. El dato existia en el registro de auditoria, pero ahi es una linea
 * suelta ("socio_id: 3 -> 7") sin numero de resolucion, sin la fecha real del
 * traspaso y sin enlace a la carta escaneada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('traspasos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();

            // Nulo en la primera asignacion: un cupo nuevo no viene de nadie.
            $table->foreignId('socio_anterior_id')->nullable()->constrained('socios')->nullOnDelete();
            $table->foreignId('socio_nuevo_id')->constrained('socios')->cascadeOnDelete();

            // La del acta, no la del dia que se digito: pueden ser muy distintas
            // cuando se cargan traspasos viejos que estaban solo en papel.
            $table->date('fecha_traspaso');

            $table->string('numero_resolucion')->nullable();
            $table->text('observaciones')->nullable();

            // La carta de cesion escaneada, si esta cargada en el expediente.
            $table->foreignId('expediente_id')->nullable()->constrained('expedientes')->nullOnDelete();

            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // La consulta de siempre es "el historial de esta unidad, del mas
            // reciente al mas viejo".
            $table->index(['vehiculo_id', 'fecha_traspaso']);
            $table->index('socio_nuevo_id');
            $table->index('socio_anterior_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('traspasos');
    }
};
