<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VehiculoController extends Controller
{
    private const IDENTIFICADOR_REGEX = '/^[A-Z]{3}-[0-9]{4}$/';

    public function index()
    {
        return response()->json(Vehiculo::orderBy('id', 'desc')->get());
    }

    public function show(Vehiculo $vehiculo)
    {
        return response()->json($vehiculo);
    }

    public function store(Request $request)
    {
        $identificadorInput = strtoupper((string) $request->input('placa', ''));
        if ($identificadorInput !== '') {
            $request->merge([
                'placa' => $identificadorInput,
                'numero_vehicular' => $identificadorInput,
            ]);
        }

        $data = $request->validate([
            'codigo_taxi' => ['nullable', 'string', 'max:191'],
            'numero_vehicular' => ['required', 'string', 'max:191', 'regex:' . self::IDENTIFICADOR_REGEX, 'unique:vehiculos,numero_vehicular'],
            'placa' => ['required', 'string', 'max:50', 'regex:' . self::IDENTIFICADOR_REGEX, 'unique:vehiculos,placa'],
            'marca' => ['required', 'string', 'max:191'],
            'color' => ['required', 'string', 'max:100'],
            'anio_modelo' => ['nullable', 'integer', 'between:1900,2100'],
            'socio_id' => ['nullable', 'integer', 'exists:socios,id'],
            'accionista_id' => ['nullable', 'integer', 'exists:socios,id'],
            'kilometraje' => ['required', 'integer', 'min:0'],
            'estado' => ['nullable', Rule::in(['Operativo', 'Mantenimiento'])],
            'observacion' => ['nullable', 'string'],
        ]);

        $identificador = strtoupper($data['placa']);
        $data['placa'] = $identificador;
        $data['numero_vehicular'] = $identificador;
        $data['codigo_taxi'] = $data['codigo_taxi'] ?? $identificador;

        $vehiculo = Vehiculo::create($data);

        return response()->json($vehiculo, 201);
    }

    public function update(Request $request, Vehiculo $vehiculo)
    {
        $identificadorInput = $request->input('placa') ?? $request->input('numero_vehicular');
        if ($identificadorInput !== null) {
            $identificador = strtoupper((string) $identificadorInput);
            $request->merge([
                'placa' => $identificador,
                'numero_vehicular' => $identificador,
            ]);
        }

        $data = $request->validate([
            'codigo_taxi' => ['nullable', 'string', 'max:191'],
            'numero_vehicular' => ['sometimes', 'required', 'string', 'max:191', 'regex:' . self::IDENTIFICADOR_REGEX, Rule::unique('vehiculos', 'numero_vehicular')->ignore($vehiculo->id)],
            'placa' => ['sometimes', 'required', 'string', 'max:50', 'regex:' . self::IDENTIFICADOR_REGEX, Rule::unique('vehiculos', 'placa')->ignore($vehiculo->id)],
            'marca' => ['sometimes', 'required', 'string', 'max:191'],
            'color' => ['sometimes', 'required', 'string', 'max:100'],
            'anio_modelo' => ['nullable', 'integer', 'between:1900,2100'],
            'socio_id' => ['nullable', 'integer', 'exists:socios,id'],
            'accionista_id' => ['nullable', 'integer', 'exists:socios,id'],
            'kilometraje' => ['sometimes', 'required', 'integer', 'min:0'],
            'estado' => ['nullable', Rule::in(['Operativo', 'Mantenimiento'])],
            'observacion' => ['nullable', 'string'],
        ]);

        $identificadorInput = $data['placa'] ?? $data['numero_vehicular'] ?? $vehiculo->placa;
        $identificador = strtoupper($identificadorInput);
        $data['placa'] = $identificador;
        $data['numero_vehicular'] = $identificador;
        $data['codigo_taxi'] = $data['codigo_taxi'] ?? $identificador;

        $vehiculo->update($data);

        return response()->json($vehiculo);
    }

    public function destroy(Vehiculo $vehiculo)
    {
        $vehiculo->delete();
        return response()->json(['deleted' => true]);
    }
}
