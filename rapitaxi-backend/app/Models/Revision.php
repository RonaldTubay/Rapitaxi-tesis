<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Support\Calendario;
use Illuminate\Database\Eloquent\Model;
use App\Traits\TapsActivityWithRequestMeta;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Revision extends Model
{
    use HasFactory, LogsActivity, TapsActivityWithRequestMeta;

    protected $table = 'revisiones'; // Por si Laravel se confunde con el plural

    /** Con cuantos dias de anticipacion se avisa que la RTV esta por caducar. */
    public const DIAS_AVISO_VENCIMIENTO = 30;

    protected $fillable = [
        'vehiculo_id',
        'fecha_revision',
        'fecha_vencimiento',
        'tipo',
        'estado',
        'observaciones',
    ];

    protected $appends = ['estado_vigencia', 'dias_para_vencer'];

    protected function casts(): array
    {
        return [
            'fecha_revision' => 'date:Y-m-d',
            'fecha_vencimiento' => 'date:Y-m-d',
        ];
    }

    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /**
     * Vigencia de la revision tecnica. Solo tiene sentido en las aprobadas:
     * una rechazada o pendiente no habilita al vehiculo, caduque o no.
     */
    public function getEstadoVigenciaAttribute(): string
    {
        if ($this->estado !== 'Aprobada' || ! $this->fecha_vencimiento) {
            return 'Sin vigencia';
        }

        $dias = $this->dias_para_vencer;

        if ($dias < 0) {
            return 'Vencida';
        }

        return $dias <= self::DIAS_AVISO_VENCIMIENTO ? 'Por vencer' : 'Vigente';
    }

    /** Negativo si ya caduco. Null si no se registro la fecha. */
    public function getDiasParaVencerAttribute(): ?int
    {
        if (! $this->fecha_vencimiento) {
            return null;
        }

        return Calendario::diasHasta($this->fecha_vencimiento);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('revisiones');
    }
}