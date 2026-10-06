<?php

namespace App\Console\Commands;

use App\Support\Calendario;
use App\Models\Empresa;
use App\Models\Expediente;
use App\Models\Notificacion;
use App\Models\Revision;
use App\Models\Vehiculo;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Deja un aviso en el panel por cada documento o revision que esta por vencer
 * o que ya vencio.
 *
 * El sistema sabia desde hace tiempo cuando caduca cada papel, pero no se lo
 * decia a nadie: habia que entrar a Expedientes y revisar socio por socio. Un
 * control de vencimientos que exige acordarse de ir a mirar no es un control.
 *
 * Esta pensado para correr una vez al dia. Es idempotente: si el aviso de hoy
 * ya existe no lo repite, asi que ejecutarlo dos veces no llena el panel.
 */
class AvisarVencimientos extends Command
{
    protected $signature = 'vencimientos:avisar {--dias= : Avisar con esta antelacion en vez de la configurada}';

    protected $description = 'Crea avisos de documentos, RTV, matriculas y habilitaciones proximos a vencer';

    public function handle(): int
    {
        $dias = (int) ($this->option('dias') ?: Expediente::DIAS_AVISO_VENCIMIENTO);
        $creados = 0;

        $creados += $this->avisarDocumentos($dias);
        $creados += $this->avisarRevisiones($dias);
        $creados += $this->avisarMatriculas($dias);
        $creados += $this->avisarPermisoDeOperacion();
        $creados += $this->avisarHabilitaciones($dias);

        if ($creados === 0) {
            $this->info('Nada por avisar: nada entra en la ventana de aviso.');
        } else {
            $this->info("{$creados} aviso(s) nuevo(s) en el panel.");
        }

        return self::SUCCESS;
    }

    private function avisarDocumentos(int $dias): int
    {
        $documentos = Expediente::whereNotNull('fecha_vencimiento')
            ->whereDate('fecha_vencimiento', '<=', Calendario::hoy()->addDays($dias)->toDateString())
            ->with('socio:id,nombre')
            ->whereHas('socio')
            ->orderBy('fecha_vencimiento')
            ->get();

        $creados = 0;

        foreach ($documentos as $documento) {
            $vencido = $documento->estado_vigencia === Expediente::VENCIDO;
            $cuantos = abs((int) $documento->dias_para_vencer);
            $plural = $cuantos === 1 ? 'día' : 'días';

            $titulo = $vencido ? 'Documento vencido' : 'Documento por vencer';
            $mensaje = sprintf(
                '%s de %s %s.',
                $documento->tipo_etiqueta,
                $documento->socio->nombre,
                $vencido ? "venció hace {$cuantos} {$plural}" : "vence en {$cuantos} {$plural}"
            );

            $creados += $this->avisar($vencido ? 'error' : 'advertencia', $titulo, $mensaje);
        }

        $this->line("  Documentos revisados: {$documentos->count()}");

        return $creados;
    }

    private function avisarRevisiones(int $dias): int
    {
        $revisiones = Revision::where('estado', 'Aprobada')
            ->whereNotNull('fecha_vencimiento')
            ->whereDate('fecha_vencimiento', '<=', Calendario::hoy()->addDays($dias)->toDateString())
            ->with('vehiculo:id,numero_vehiculo,placa')
            ->whereHas('vehiculo')
            ->orderBy('fecha_vencimiento')
            ->get();

        $creados = 0;

        foreach ($revisiones as $revision) {
            $vencida = $revision->estado_vigencia === 'Vencida';
            $cuantos = abs((int) $revision->dias_para_vencer);
            $plural = $cuantos === 1 ? 'día' : 'días';

            $mensaje = sprintf(
                'La RTV de la unidad %s %s.',
                $revision->vehiculo->numero_vehiculo,
                $vencida ? "venció hace {$cuantos} {$plural}" : "vence en {$cuantos} {$plural}"
            );

            $creados += $this->avisar(
                $vencida ? 'error' : 'advertencia',
                $vencida ? 'Revisión técnica vencida' : 'Revisión técnica por vencer',
                $mensaje
            );
        }

        $this->line("  Revisiones revisadas: {$revisiones->count()}");

        return $creados;
    }

    /**
     * La matricula es lo que permite circular: una unidad sin matricula vigente
     * deja al socio sin trabajar, no es un trámite administrativo más.
     */
    private function avisarMatriculas(int $dias): int
    {
        $vehiculos = Vehiculo::whereNotNull('fecha_caducidad_matricula')
            ->where('fecha_caducidad_matricula', '<=', Calendario::hoy()->addDays($dias)->toDateString())
            ->orderBy('fecha_caducidad_matricula')
            ->get();

        $creados = 0;

        foreach ($vehiculos as $vehiculo) {
            $vencida = $vehiculo->estado_matricula === Vehiculo::MATRICULA_VENCIDA;
            $cuantos = abs((int) $vehiculo->dias_para_vencer_matricula);
            $plural = $cuantos === 1 ? 'día' : 'días';

            $mensaje = sprintf(
                'La matrícula de la unidad %s %s.',
                $vehiculo->numero_vehiculo,
                $vencida ? "venció hace {$cuantos} {$plural}" : "vence en {$cuantos} {$plural}"
            );

            $creados += $this->avisar(
                $vencida ? 'error' : 'advertencia',
                $vencida ? 'Matrícula vencida' : 'Matrícula por vencer',
                $mensaje
            );
        }

        $this->line("  Matrículas revisadas: {$vehiculos->count()}");

        return $creados;
    }

    private function avisarHabilitaciones(int $dias): int
    {
        $vehiculos = Vehiculo::whereNotNull('fecha_caducidad_habilitacion')
            ->where('fecha_caducidad_habilitacion', '<=', Calendario::hoy()->addDays($dias)->toDateString())
            ->orderBy('fecha_caducidad_habilitacion')
            ->get();

        $creados = 0;

        foreach ($vehiculos as $vehiculo) {
            $vencida = $vehiculo->estado_habilitacion === Vehiculo::MATRICULA_VENCIDA;
            $cuantos = abs((int) $vehiculo->dias_para_vencer_habilitacion);
            $plural = $cuantos === 1 ? 'día' : 'días';

            $mensaje = sprintf(
                'La habilitación de la unidad %s %s.',
                $vehiculo->numero_vehiculo,
                $vencida ? "venció hace {$cuantos} {$plural}" : "vence en {$cuantos} {$plural}"
            );

            $creados += $this->avisar(
                $vencida ? 'error' : 'advertencia',
                $vencida ? 'Habilitación vencida' : 'Habilitación por vencer',
                $mensaje
            );
        }

        $this->line("  Habilitaciones revisadas: {$vehiculos->count()}");

        return $creados;
    }

    /**
     * El permiso de operacion de la compania.
     *
     * Si caduca, no es que un socio no pueda circular: deja de operar la
     * compania entera. Usa su propia ventana de seis meses y no la del resto,
     * porque renovarlo es un tramite con el GAD y la ANT: avisar con un mes
     * seria avisar tarde.
     */
    private function avisarPermisoDeOperacion(): int
    {
        $empresa = Empresa::actual();

        if (! $empresa->fecha_caducidad_permiso) {
            $this->line('  Permiso de operación: sin fecha de caducidad registrada.');

            return 0;
        }

        $estado = $empresa->estado_permiso;
        $this->line("  Permiso de operación: {$estado}.");

        if ($estado === Empresa::PERMISO_VIGENTE) {
            return 0;
        }

        $vencido = $estado === Empresa::PERMISO_VENCIDO;
        $cuantos = abs((int) $empresa->dias_para_vencer_permiso);
        $plural = $cuantos === 1 ? 'día' : 'días';

        return $this->avisar(
            $vencido ? 'error' : 'advertencia',
            $vencido ? 'Permiso de operación vencido' : 'Permiso de operación por vencer',
            sprintf(
                'El permiso de operación de %s %s.',
                $empresa->razon_social,
                $vencido ? "venció hace {$cuantos} {$plural}" : "vence en {$cuantos} {$plural}"
            )
        );
    }

    /**
     * Crea el aviso solo si hoy no se creo uno igual. Sin esto, correr el
     * comando dos veces en un dia dejaba el panel con todo duplicado.
     */
    private function avisar(string $tipo, string $titulo, string $mensaje): int
    {
        $existe = Notificacion::where('titulo', $titulo)
            ->where('mensaje', $mensaje)
            // created_at se guarda en UTC: un aviso creado a las 23:30 en Ecuador
            // quedo con la fecha UTC del dia siguiente y un whereDate sobre el dia
            // local no lo encontraria, asi que el comando repetiria el aviso.
            ->where('created_at', '>=', Calendario::inicioDeHoyEnUtc())
            ->exists();

        if ($existe) {
            return 0;
        }

        Notificacion::create([
            'tipo' => $tipo,
            'titulo' => $titulo,
            'mensaje' => $mensaje,
            'leida' => false,
        ]);

        return 1;
    }
}
