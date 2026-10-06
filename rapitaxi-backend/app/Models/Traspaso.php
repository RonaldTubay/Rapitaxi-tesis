<?php

namespace App\Models;

use App\Traits\TapsActivityWithRequestMeta;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Un cambio de dueño de un cupo.
 *
 * No se borra nunca: el historial de un cupo es justamente lo que la compañia
 * necesita poder demostrar, y un traspaso mal digitado se corrige registrando
 * el siguiente, no borrando el anterior.
 */
class Traspaso extends Model
{
    use LogsActivity;
    use TapsActivityWithRequestMeta;

    protected $fillable = [
        'vehiculo_id',
        'socio_anterior_id',
        'socio_nuevo_id',
        'fecha_traspaso',
        'numero_resolucion',
        'observaciones',
        'expediente_id',
        'registrado_por',
    ];

    protected $casts = [
        'fecha_traspaso' => 'date:Y-m-d',
    ];

    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function socioAnterior()
    {
        return $this->belongsTo(Socio::class, 'socio_anterior_id');
    }

    public function socioNuevo()
    {
        return $this->belongsTo(Socio::class, 'socio_nuevo_id');
    }

    public function expediente()
    {
        return $this->belongsTo(Expediente::class);
    }

    public function registradoPor()
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('traspasos');
    }
}
