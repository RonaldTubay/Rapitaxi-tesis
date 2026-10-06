<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notificacion;

class NotificacionController extends Controller
{
    // Obtener todas las notificaciones ordenadas por las más recientes
    public function index()
    {
        // Sin lista blanca de titulos. Antes filtraba por
        // whereIn('titulo', ['Socio registrado', 'Vehiculo registrado']), asi que
        // cualquier aviso nuevo era invisible para la campana: los de vencimiento
        // se creaban en la base y nadie los veia nunca.
        $notificaciones = Notificacion::orderBy('created_at', 'desc')
            ->take(20) // Solo las ultimas 20, para no saturar el desplegable
            ->get();
        return response()->json($notificaciones, 200);
    }

    // Marcar una sola notificación como leída
    public function marcarLeida($id)
    {
        $notificacion = Notificacion::find($id);
        if ($notificacion) {
            $notificacion->update(['leida' => true]);
            return response()->json(['message' => 'Marcada como leída']);
        }
        return response()->json(['message' => 'No encontrada'], 404);
    }

    // Marcar TODAS como leídas de un solo golpe
    public function marcarTodasLeidas()
    {
        Notificacion::where('leida', false)->update(['leida' => true]);
        return response()->json(['message' => 'Todas marcadas como leídas']);
    }
}
