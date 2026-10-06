<?php

namespace App\Models;

use App\Support\Calendario;
use Illuminate\Database\Eloquent\Model;

/**
 * La compania a la que sirve esta instalacion. Es una sola fila.
 *
 * Antes la razon social estaba escrita a mano en dos pantallas, lo que obligaba
 * a editar el codigo para instalarlo en otra cooperativa.
 */
class Empresa extends Model
{
    protected $table = 'empresa';

    /**
     * Con cuanta antelacion avisar de la caducidad del permiso de operacion.
     *
     * Seis meses, no los treinta dias de los demas papeles: renovarlo es un
     * tramite con el GAD y la ANT, no una vuelta a la notaria. Avisar con un mes
     * seria avisar tarde.
     */
    public const DIAS_AVISO_PERMISO = 180;

    public const PERMISO_VIGENTE = 'Vigente';
    public const PERMISO_POR_VENCER = 'Por vencer';
    public const PERMISO_VENCIDO = 'Vencido';
    public const PERMISO_SIN_REGISTRAR = 'Sin registrar';

    protected $fillable = [
        'razon_social',
        'ruc',
        'permiso_operacion',
        'fecha_permiso_operacion',
        'fecha_caducidad_permiso',
        'direccion',
        'ciudad',
        'provincia',
        'parroquia',
        'clase_transporte',
        'ambito_servicio',
        'tipo_servicio',
        'telefono',
        'email',
        'gerente',
        'secretario',
    ];

    protected $appends = ['estado_permiso', 'dias_para_vencer_permiso'];

    protected function casts(): array
    {
        return [
            'fecha_permiso_operacion' => 'date:Y-m-d',
            'fecha_caducidad_permiso' => 'date:Y-m-d',
        ];
    }

    /**
     * Si el permiso de operacion caduca, no es que un socio no pueda circular:
     * es que la compania entera deja de operar.
     */
    public function getEstadoPermisoAttribute(): string
    {
        if (! $this->fecha_caducidad_permiso) {
            return self::PERMISO_SIN_REGISTRAR;
        }

        $dias = $this->dias_para_vencer_permiso;

        if ($dias < 0) {
            return self::PERMISO_VENCIDO;
        }

        return $dias <= self::DIAS_AVISO_PERMISO ? self::PERMISO_POR_VENCER : self::PERMISO_VIGENTE;
    }

    /** Negativo si ya caduco. Null si no hay fecha registrada. */
    public function getDiasParaVencerPermisoAttribute(): ?int
    {
        return Calendario::diasHasta($this->fecha_caducidad_permiso);
    }

    /**
     * Los datos vigentes. Si la fila no existe devuelve un registro sin guardar
     * con la razon social por defecto: un GET no deberia escribir en la base,
     * y una pantalla sin encabezado se ve como un error del sistema.
     */
    public static function actual(): self
    {
        return static::query()->orderBy('id')->first()
            ?? new self(['razon_social' => 'Compañía de taxis']);
    }
}
