<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\TapsActivityWithRequestMeta;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Mantenimiento extends Model
{
    use HasFactory, SoftDeletes, LogsActivity, TapsActivityWithRequestMeta;

    protected $fillable = [
        'vehiculo_id',
        'fecha_mantenimiento',
        'tipo_mantenimiento',
        'kilometraje_actual',
        'proximo_mantenimiento_km',
        'comprobante_ruta',
        'mecanico',       // <-- Nuevo campo añadido
        'estado',         // <-- Sus valores cambiaron
        'naturaleza',     // Preventivo (planificado) o Correctivo (por una falla)
        'observaciones',
        'revision_estado',
        'origen',
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

    public function revisadoPor()
    {
        return $this->belongsTo(User::class, 'revisado_por');
    }

    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('mantenimientos');
    }
}