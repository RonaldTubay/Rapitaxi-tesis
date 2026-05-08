<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Mantenimiento extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehiculo_id',
        'tipo',
        'descripcion',
        'fecha',
        'mecanico',
        'kilometraje_actual',
        'costo',
        'estado',
        'comprobante_path',
        'comprobante_nombre',
        'fecha_completado',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'fecha_completado' => 'date',
            'costo' => 'decimal:2',
        ];
    }

    // Relación Inversa: Este mantenimiento pertenece a un vehículo (belongsTo)
    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }
}