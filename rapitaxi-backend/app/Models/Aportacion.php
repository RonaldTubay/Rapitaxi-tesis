<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\TapsActivityWithRequestMeta;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Aportacion extends Model
{
    use HasFactory, SoftDeletes, LogsActivity, TapsActivityWithRequestMeta;

    // La tabla se llamo "pagos" hasta la migracion que la renombro. Antes esto
    // se resolvia con Schema::hasTable() dentro del constructor, que disparaba
    // una consulta al esquema POR CADA modelo hidratado: listar 500 aportaciones
    // costaba 500 consultas extra. El nombre es fijo desde esa migracion.
    protected $table = 'aportaciones';

    protected $fillable = [
        'socio_id',
        'mes_pagado',
        'anio_pagado',
        'monto',
        'fecha_pago',
        'metodo_pago',
        'estado',
        'comprobante_ruta',
        'motivo_rechazo',
        'revisado_por',
        'revisado_en',
    ];

    protected function casts(): array
    {
        return [
            'revisado_en' => 'datetime',
        ];
    }

    // Relación inversa: Un pago pertenece a un socio
    public function socio()
    {
        return $this->belongsTo(Socio::class);
    }

    // Quien (admin/operador) aprobo o rechazo el comprobante subido por el socio
    public function revisadoPor()
    {
        return $this->belongsTo(User::class, 'revisado_por');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('aportaciones');
    }
}