<?php

namespace App\Traits;

use Spatie\Activitylog\Models\Activity;

/**
 * Se agrega junto con LogsActivity en cada modelo auditado para que cada
 * entrada del log quede tambien con la IP y el navegador/SO de quien hizo
 * la accion, ademas del cambio en si. Spatie llama a tapActivity()
 * automaticamente antes de guardar si el metodo existe en el modelo.
 */
trait TapsActivityWithRequestMeta
{
    public function tapActivity(Activity $activity, string $eventName): void
    {
        $activity->properties = $activity->properties->merge([
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
