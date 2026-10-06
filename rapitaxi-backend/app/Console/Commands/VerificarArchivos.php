<?php

namespace App\Console\Commands;

use App\Models\Aportacion;
use App\Models\Expediente;
use App\Models\LibroContable;
use App\Models\Mantenimiento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Comprueba que cada archivo que la base dice tener exista de verdad en R2, y
 * al reves: que no queden archivos en R2 que ningun registro reclama.
 *
 * Hace falta porque los respaldos cubren la base pero NO el almacenamiento, y
 * los dos se pueden desincronizar sin que nadie lo note: un archivo que se
 * pierde en R2 no da error hasta que alguien pulsa "ver", y para entonces puede
 * haber pasado un año. En un sistema cuyo objeto es respaldar documentos, "creo
 * que estan todos" no es una respuesta.
 */
class VerificarArchivos extends Command
{
    protected $signature = 'archivos:verificar {--huerfanos : Buscar tambien archivos en R2 que ningun registro reclama}';

    protected $description = 'Verifica que los documentos registrados existan en el almacenamiento';

    /** Modelo => [columna con la ruta, etiqueta para el informe, carpeta en R2]. */
    private const FUENTES = [
        Expediente::class => ['ruta_archivo', 'Expedientes', 'expedientes'],
        Aportacion::class => ['comprobante_ruta', 'Comprobantes de aportación', 'comprobantes_aportaciones'],
        Mantenimiento::class => ['comprobante_ruta', 'Respaldos de mantenimiento', 'comprobantes_mantenimiento'],
        LibroContable::class => ['archivo_ruta', 'Libros contables', 'libros_contables'],
    ];

    public function handle(): int
    {
        $disco = Storage::disk('s3');
        $faltantes = [];
        $registradas = [];
        $revisados = 0;

        foreach (self::FUENTES as $modelo => [$columna, $etiqueta, $carpeta]) {
            $consulta = $modelo::query()->whereNotNull($columna);

            // Tambien los borrados suaves: su archivo deberia seguir ahi, que es
            // justamente lo que permite restaurarlos con su respaldo intacto.
            if (method_exists($modelo, 'bootSoftDeletes')) {
                $consulta->withTrashed();
            }

            $rutas = $consulta->pluck($columna, 'id');
            $revisados += $rutas->count();
            $perdidos = 0;

            foreach ($rutas as $id => $ruta) {
                $registradas[] = $ruta;

                if (! $disco->exists($ruta)) {
                    $perdidos++;
                    $faltantes[] = "{$etiqueta} #{$id}: {$ruta}";
                }
            }

            $this->line(sprintf(
                '  %-28s %4d registrados, %s',
                $etiqueta,
                $rutas->count(),
                $perdidos === 0 ? 'todos presentes' : "<fg=red>{$perdidos} SIN ARCHIVO</>"
            ));
        }

        $this->newLine();

        if ($faltantes) {
            $this->error('Archivos que la base reclama y no estan en el almacenamiento:');
            foreach ($faltantes as $linea) {
                $this->line('  - ' . $linea);
            }
            $this->newLine();
        }

        $huerfanos = [];

        if ($this->option('huerfanos')) {
            $enBase = array_flip($registradas);

            foreach (self::FUENTES as [$columna, $etiqueta, $carpeta]) {
                foreach ($disco->files($carpeta) as $archivo) {
                    if (! isset($enBase[$archivo])) {
                        $huerfanos[] = $archivo;
                    }
                }
            }

            if ($huerfanos) {
                $this->warn(count($huerfanos) . ' archivo(s) en el almacenamiento que ningun registro reclama:');
                foreach (array_slice($huerfanos, 0, 20) as $archivo) {
                    $this->line('  - ' . $archivo);
                }
                if (count($huerfanos) > 20) {
                    $this->line('  … y ' . (count($huerfanos) - 20) . ' mas.');
                }
                $this->newLine();
                $this->line('No se borran solos: puede que sean de un registro que se va a restaurar.');
            } else {
                $this->info('Sin archivos huérfanos.');
            }
        }

        if ($faltantes) {
            $this->error(sprintf('%d de %d documentos NO estan respaldados.', count($faltantes), $revisados));

            return self::FAILURE;
        }

        $this->info(sprintf('Los %d documentos registrados estan presentes en el almacenamiento.', $revisados));

        return self::SUCCESS;
    }
}
