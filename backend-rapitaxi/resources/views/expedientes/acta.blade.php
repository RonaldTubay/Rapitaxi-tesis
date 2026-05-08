<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acta - {{ $acta['expediente_codigo'] ?? 'Expediente' }}</title>
  <style>
    body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
    .header { text-align: center; margin-bottom: 12px; }
    .title { font-weight: bold; font-size: 18px; }
    .section { margin-top: 10px; }
    .label { font-weight: bold; color: #333; }
    .row { margin-bottom: 6px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .table th, .table td { border: 1px solid #ddd; padding: 6px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">{{ $acta['empresa'] ?? 'RAPITAXI' }}</div>
    <div>ACTA DE EXPEDIENTE - {{ $acta['expediente_codigo'] ?? '' }}</div>
    <div style="font-size:11px; margin-top:6px;">Fecha emisión: {{ $acta['fecha_emision'] ?? '' }}</div>
  </div>

  <div class="section">
    <div class="label">Datos del Socio</div>
    <div class="row">Nombre: {{ $acta['miembro']['nombre'] ?? 'N/A' }}</div>
    <div class="row">Cédula: {{ $acta['miembro']['cedula'] ?? 'N/A' }}</div>
    <div class="row">Teléfono: {{ $acta['miembro']['telefono'] ?? 'N/A' }}</div>
    <div class="row">Correo: {{ $acta['miembro']['correo'] ?? 'N/A' }}</div>
  </div>

  <div class="section">
    <div class="label">Datos del Vehículo</div>
    <div class="row">Número: {{ $acta['vehiculo']['numero_vehicular'] ?? 'N/A' }}</div>
    <div class="row">Placa: {{ $acta['vehiculo']['placa'] ?? 'N/A' }}</div>
    <div class="row">Marca: {{ $acta['vehiculo']['marca'] ?? 'N/A' }}</div>
    <div class="row">Año: {{ $acta['vehiculo']['anio_modelo'] ?? 'N/A' }}</div>
    <div class="row">Accionista: {{ $acta['vehiculo']['nombre_accionista'] ?? 'N/A' }}</div>
  </div>

  <div class="section">
    <div class="label">Observación General</div>
    <div class="row">{{ $acta['observacion_general'] ?? 'Sin observaciones.' }}</div>
  </div>

  <div class="section">
    <div class="label">Historial de Revisiones</div>
    @if(!empty($acta['historial_revisiones']) && count($acta['historial_revisiones']) > 0)
      <table class="table">
        <thead>
          <tr><th>#</th><th>Fecha</th><th>Resultado</th><th>Observación</th><th>Registrado por</th></tr>
        </thead>
        <tbody>
          @foreach($acta['historial_revisiones'] as $i => $rev)
            <tr>
              <td>{{ $i + 1 }}</td>
              <td>{{ $rev['fecha_revision'] ?? '' }}</td>
              <td>{{ $rev['resultado'] ?? '' }}</td>
              <td>{{ $rev['observacion'] ?? '' }}</td>
              <td>{{ $rev['registrado_por'] ?? '' }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    @else
      <div class="row">No hay revisiones registradas.</div>
    @endif
  </div>

  <div class="section">
    <div class="label">Historial de Mantenimientos</div>
    @if(!empty($acta['historial_mantenimientos']) && count($acta['historial_mantenimientos']) > 0)
      <table class="table">
        <thead>
          <tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Estado</th></tr>
        </thead>
        <tbody>
          @foreach($acta['historial_mantenimientos'] as $i => $m)
            <tr>
              <td>{{ $i + 1 }}</td>
              <td>{{ $m['fecha'] ?? '' }}</td>
              <td>{{ $m['tipo'] ?? '' }}</td>
              <td>{{ $m['descripcion'] ?? '' }}</td>
              <td>{{ $m['estado'] ?? '' }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    @else
      <div class="row">No hay mantenimientos registrados.</div>
    @endif
  </div>

  <div style="margin-top:20px;">
    <div style="font-size:11px; color:#666;">Elaborado por: {{ $acta['elaborado_por'] ?? 'N/A' }}</div>
  </div>
</body>
</html>
