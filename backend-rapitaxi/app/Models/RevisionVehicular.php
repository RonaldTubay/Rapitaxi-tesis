<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RevisionVehicular extends Model
{
    use HasFactory;

    protected $table = 'revisiones_vehiculares';

    protected $fillable = [
        'vehiculo_id',
        'registrado_por',
        'fecha_revision',
        'resultado',
        'observacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha_revision' => 'date',
        ];
    }

    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function registradoPor()
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
