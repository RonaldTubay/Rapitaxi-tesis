<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehiculo extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_vehicular',
        'codigo_taxi',
        'placa',
        'marca',
        'color',
        'anio_modelo',
        'socio_id',
        'accionista_id',
        'kilometraje',
        'desgaste',
        'fecha_ultima_revision',
        'prox_mantenimiento',
        'observacion',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'anio_modelo' => 'integer',
            'fecha_ultima_revision' => 'date',
            'prox_mantenimiento' => 'date',
        ];
    }

    // Relación Inversa: Este vehículo pertenece a un socio (belongsTo)
    public function socio()
    {
        return $this->belongsTo(Socio::class);
    }

    // Relacion: El accionista del vehiculo.
    public function accionista()
    {
        return $this->belongsTo(Socio::class, 'accionista_id');
    }

    // Relación Directa: Este vehículo tiene muchos mantenimientos (hasMany)
    public function mantenimientos()
    {
        return $this->hasMany(Mantenimiento::class);
    }

    public function revisionesVehiculares()
    {
        return $this->hasMany(RevisionVehicular::class);
    }

    public function expedientes()
    {
        return $this->hasMany(Expediente::class);
    }
}