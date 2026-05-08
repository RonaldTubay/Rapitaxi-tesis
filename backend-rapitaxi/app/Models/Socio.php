<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Socio extends Model
{
    use HasFactory;

    // 1. Permitimos guardar datos en estos campos
    protected $fillable = [
        'nombre', 'cedula', 'telefono', 'correo', 'fecha_ingreso', 'estado'
    ];

    // 2. Relación: Un socio tiene muchos vehículos (hasMany)
    public function vehiculos()
    {
        return $this->hasMany(Vehiculo::class);
    }

    // Relacion: Un socio puede ser accionista de muchos vehiculos.
    public function vehiculosComoAccionista()
    {
        return $this->hasMany(Vehiculo::class, 'accionista_id');
    }

    public function expedientes()
    {
        return $this->hasMany(Expediente::class);
    }
}