<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Support\Calendario;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\TapsActivityWithRequestMeta;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Vehiculo extends Model
{
    use HasFactory, SoftDeletes, LogsActivity, TapsActivityWithRequestMeta;

    /** Con cuanta antelacion avisar de la matricula, igual que los documentos. */
    public const DIAS_AVISO_MATRICULA = 30;
    public const DIAS_AVISO_HABILITACION = 30;

    public const MATRICULA_VIGENTE = 'Vigente';
    public const MATRICULA_POR_VENCER = 'Por vencer';
    public const MATRICULA_VENCIDA = 'Vencida';
    public const MATRICULA_SIN_REGISTRAR = 'Sin registrar';

    protected $fillable = [
        'socio_id',
        'numero_vehiculo',
        'placa',
        'marca',
        'tipo_vehiculo',
        'combustible',
        'anio_fabricacion',
        'color',
        'color_secundario',
        'disco',
        'capacidad_carga',
        // Lo que trae la matricula en papel.
        'numero_chasis',
        'numero_motor',
        'clase',
        'cilindraje',
        'numero_pasajeros',
        'fecha_matricula',
        'fecha_caducidad_matricula',
        'propietario_matricula',
        // Lo que trae la resolucion de habilitacion.
        'numero_resolucion_habilitacion',
        'fecha_resolucion_habilitacion',
        'fecha_caducidad_habilitacion',
    ];

    /**
     * El estado de la matricula se calcula, no se guarda: una columna con el
     * estado quedaria vieja al dia siguiente sin que nadie toque el registro.
     */
    protected $appends = [
        'estado_matricula', 'dias_para_vencer_matricula',
        'estado_habilitacion', 'dias_para_vencer_habilitacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha_matricula' => 'date:Y-m-d',
            'fecha_caducidad_matricula' => 'date:Y-m-d',
            'fecha_resolucion_habilitacion' => 'date:Y-m-d',
            'fecha_caducidad_habilitacion' => 'date:Y-m-d',
        ];
    }

    /**
     * Una unidad sin matricula vigente no puede circular, asi que esto no es un
     * dato administrativo: es lo que deja a un socio sin trabajar.
     */
    public function getEstadoMatriculaAttribute(): string
    {
        if (! $this->fecha_caducidad_matricula) {
            return self::MATRICULA_SIN_REGISTRAR;
        }

        $dias = $this->dias_para_vencer_matricula;

        if ($dias < 0) {
            return self::MATRICULA_VENCIDA;
        }

        return $dias <= self::DIAS_AVISO_MATRICULA ? self::MATRICULA_POR_VENCER : self::MATRICULA_VIGENTE;
    }

    /** Negativo si ya caduco. Null si no hay fecha registrada. */
    public function getDiasParaVencerMatriculaAttribute(): ?int
    {
        if (! $this->fecha_caducidad_matricula) {
            return null;
        }

        return Calendario::diasHasta($this->fecha_caducidad_matricula);
    }

    public function getEstadoHabilitacionAttribute(): string
    {
        if (! $this->fecha_caducidad_habilitacion) {
            return self::MATRICULA_SIN_REGISTRAR;
        }

        $dias = $this->dias_para_vencer_habilitacion;

        if ($dias < 0) {
            return self::MATRICULA_VENCIDA;
        }

        return $dias <= self::DIAS_AVISO_HABILITACION ? self::MATRICULA_POR_VENCER : self::MATRICULA_VIGENTE;
    }

    public function getDiasParaVencerHabilitacionAttribute(): ?int
    {
        if (! $this->fecha_caducidad_habilitacion) {
            return null;
        }

        return Calendario::diasHasta($this->fecha_caducidad_habilitacion);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('vehiculos');
    }

    // Relación inversa: Un vehículo pertenece a un socio
    public function socio()
    {
        return $this->belongsTo(Socio::class);
    }

    public function mantenimientos()
    {
        return $this->hasMany(Mantenimiento::class);
    }
}
