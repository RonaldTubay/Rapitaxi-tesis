<?php

namespace App\Models;

use App\Traits\TapsActivityWithRequestMeta;
use App\Support\Calendario;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Expediente extends Model
{
    use HasFactory, LogsActivity, TapsActivityWithRequestMeta;

    /**
     * Catalogo de documentos del expediente, tomado del archivo fisico real de
     * la compania (337 documentos en 67 carpetas, una por unidad).
     *
     * - ambito:      de quien es el papel. 'socio' si es de la persona,
     *               'vehiculo' si es de la unidad.
     * - vence:       el documento tiene fecha de caducidad y se controla.
     * - obligatorio: cuenta para decir que el expediente esta completo, dentro
     *               de su ambito.
     *
     * El ambito sale de las carpetas reales: la cedula es de la persona, la
     * matricula y la habilitacion describen el auto. Archivadas bajo el socio,
     * al traspasar el cupo el entrante empezaba con el expediente vacio aunque
     * la unidad tuviera sus papeles al dia.
     *
     * Se marcan como obligatorios los tres que aparecen en casi todas las
     * carpetas: habilitacion (79 documentos), cedula (74) y matricula (47).
     * La cesion es frecuente (56) pero solo existe si hubo traspaso, asi que
     * no puede exigirse a todos.
     */
    public const AMBITO_SOCIO = 'socio';
    public const AMBITO_VEHICULO = 'vehiculo';

    public const TIPOS = [
        'cedula' => ['etiqueta' => 'Cédula de identidad', 'ambito' => self::AMBITO_SOCIO, 'vence' => true, 'obligatorio' => true],
        'habilitacion' => ['etiqueta' => 'Resolución de habilitación', 'ambito' => self::AMBITO_VEHICULO, 'vence' => true, 'obligatorio' => true],
        'matricula' => ['etiqueta' => 'Matrícula del vehículo', 'ambito' => self::AMBITO_VEHICULO, 'vence' => true, 'obligatorio' => true],
        'ruc' => ['etiqueta' => 'Certificado del SRI (RUC)', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
        'cesion' => ['etiqueta' => 'Carta de cesión de acciones', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
        'cambio_socio' => ['etiqueta' => 'Resolución de cambio de socio', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
        'acciones' => ['etiqueta' => 'Certificado de acciones', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
        'licencia' => ['etiqueta' => 'Licencia de conducir', 'ambito' => self::AMBITO_SOCIO, 'vence' => true, 'obligatorio' => false],
        'seguro' => ['etiqueta' => 'Póliza de seguro / SOAT', 'ambito' => self::AMBITO_VEHICULO, 'vence' => true, 'obligatorio' => false],
        'infraccion' => ['etiqueta' => 'Récord de infracciones', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
        'otro' => ['etiqueta' => 'Otro documento', 'ambito' => self::AMBITO_SOCIO, 'vence' => false, 'obligatorio' => false],
    ];

    /** Con cuantos dias de anticipacion un documento pasa a "Por vencer". */
    public const DIAS_AVISO_VENCIMIENTO = 30;

    public const VIGENTE = 'Vigente';
    public const POR_VENCER = 'Por vencer';
    public const VENCIDO = 'Vencido';
    public const SIN_VENCIMIENTO = 'Sin vencimiento';

    protected $fillable = [
        'socio_id',
        'vehiculo_id',
        'nombre_documento',
        'tipo_documento',
        'tipo_expediente',
        'numero_documento',
        'fecha_emision',
        'fecha_vencimiento',
        'ruta_archivo',
    ];

    protected $appends = ['tipo_etiqueta', 'estado_vigencia', 'dias_para_vencer'];

    protected function casts(): array
    {
        return [
            'fecha_emision' => 'date:Y-m-d',
            'fecha_vencimiento' => 'date:Y-m-d',
        ];
    }

    public function socio()
    {
        return $this->belongsTo(Socio::class);
    }

    /** La unidad a la que pertenece el papel, si es un documento del auto. */
    public function vehiculo()
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /** De quien es este tipo de papel: de la persona o de la unidad. */
    public static function ambitoDe(string $tipo): string
    {
        return self::TIPOS[$tipo]['ambito'] ?? self::AMBITO_SOCIO;
    }

    /** Solo los documentos de la persona; los del auto cuelgan de la unidad. */
    public function scopeDeSocios($query)
    {
        return $query->whereNotNull('socio_id');
    }

    public function scopeDeUnidades($query)
    {
        return $query->whereNotNull('vehiculo_id');
    }

    /** @return array<string, bool> Tipos que llevan control de vencimiento. */
    public static function tiposQueVencen(): array
    {
        return array_keys(array_filter(self::TIPOS, fn ($t) => $t['vence']));
    }

    /** @return array<string, bool> Tipos exigidos para considerar completo un expediente. */
    /**
     * Los tipos obligatorios de un ambito. Sin filtrar por ambito, a cada socio
     * se le exigia la matricula y la habilitacion de un auto que puede no ser
     * suyo, y cada traspaso dejaba al entrante "incompleto" hasta volver a
     * subir el mismo PDF.
     *
     * @return array<int, string>
     */
    public static function tiposObligatorios(?string $ambito = null): array
    {
        return array_keys(array_filter(
            self::TIPOS,
            fn ($t) => $t['obligatorio'] && ($ambito === null || $t['ambito'] === $ambito)
        ));
    }

    public function getTipoEtiquetaAttribute(): string
    {
        return self::TIPOS[$this->tipo_expediente]['etiqueta'] ?? 'Otro documento';
    }

    public function getEstadoVigenciaAttribute(): string
    {
        if (! $this->fecha_vencimiento) {
            return self::SIN_VENCIMIENTO;
        }

        $dias = $this->dias_para_vencer;

        if ($dias < 0) {
            return self::VENCIDO;
        }

        return $dias <= self::DIAS_AVISO_VENCIMIENTO ? self::POR_VENCER : self::VIGENTE;
    }

    /** Negativo si ya vencio. Null si el documento no caduca. */
    public function getDiasParaVencerAttribute(): ?int
    {
        if (! $this->fecha_vencimiento) {
            return null;
        }

        // El dia lo decide Calendario: antes esto usaba UTC y un documento y
        // una matricula que vencian la misma fecha daban cifras distintas.
        return Calendario::diasHasta($this->fecha_vencimiento);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('expedientes');
    }
}
