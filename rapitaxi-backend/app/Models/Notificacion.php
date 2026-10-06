<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notificacion extends Model
{
    use HasFactory;
    
    protected $table = 'notificaciones'; // Le decimos explícitamente el nombre en español

    protected $fillable = [
        'tipo',
        'titulo',
        'mensaje',
        'leida'
    ];
}