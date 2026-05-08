<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Socio;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SocioController extends Controller
{
    public function index()
    {
        return response()->json(Socio::orderBy('id', 'desc')->get());
    }

    public function show(Socio $socio)
    {
        return response()->json($socio);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:191'],
            'cedula' => ['required', 'string', 'max:50', 'unique:socios,cedula'],
            'telefono' => ['required', 'string', 'max:50'],
            'correo' => ['required', 'email', 'max:191', 'unique:socios,correo'],
            'fecha_ingreso' => ['required', 'date'],
            'estado' => ['required', Rule::in(['Activo', 'Suspendido'])],
        ]);

        $socio = Socio::create($data);

        return response()->json($socio, 201);
    }

    public function update(Request $request, Socio $socio)
    {
        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:191'],
            'cedula' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('socios', 'cedula')->ignore($socio->id)],
            'telefono' => ['sometimes', 'required', 'string', 'max:50'],
            'correo' => ['sometimes', 'required', 'email', 'max:191', Rule::unique('socios', 'correo')->ignore($socio->id)],
            'fecha_ingreso' => ['sometimes', 'required', 'date'],
            'estado' => ['sometimes', 'required', Rule::in(['Activo', 'Suspendido'])],
        ]);

        $socio->update($data);

        return response()->json($socio);
    }

    public function destroy(Socio $socio)
    {
        $socio->delete();

        return response()->json(['deleted' => true]);
    }
}
