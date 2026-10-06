<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('pagos') && ! Schema::hasTable('aportaciones')) {
            Schema::rename('pagos', 'aportaciones');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('aportaciones') && ! Schema::hasTable('pagos')) {
            Schema::rename('aportaciones', 'pagos');
        }
    }
};