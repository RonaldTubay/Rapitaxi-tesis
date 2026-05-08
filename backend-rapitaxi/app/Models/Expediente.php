<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expediente extends Model
{
    use HasFactory;

    protected $fillable = [
        'codigo',
        'socio_id',
        'vehiculo_id',
        'elaborado_por',
        'fecha_emision',
        'observacion_general',
        'estado',
        'tipo_registro',
        'archivo_path',
        'archivo_nombre',
    ];

    protected function casts(): array
    {
        return [
            'fecha_emision' => 'date',
        ];
    }

    public function socio()
    {
        return $this->belongsTo(Socio::class);
    }

    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function elaboradoPor()
    {
        return $this->belongsTo(User::class, 'elaborado_por');
    }
}
