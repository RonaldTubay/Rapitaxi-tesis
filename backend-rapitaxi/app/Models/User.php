<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; // <--- 1. IMPORTA ESTO

class User extends Authenticatable
{
    // 2. AÑADE HasApiTokens AQUÍ
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // Tus relaciones existentes se mantienen igual...
    public function expedientesElaborados()
    {
        return $this->hasMany(Expediente::class, 'elaborado_por');
    }

    public function revisionesVehicularesRegistradas()
    {
        return $this->hasMany(RevisionVehicular::class, 'registrado_por');
    }
}