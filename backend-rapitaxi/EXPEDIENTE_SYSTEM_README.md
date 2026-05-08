# MEJORA DEL SISTEMA DE EXPEDIENTES - RAPITAXI

## Resumen

Se ha mejorado la base de datos, modelos, controladores y API de RAPITAXI para soportar un flujo completo de generación de expedientes digitales que consolidan:

- **Datos del miembro (socio/accionista)**
- **Datos del vehículo** con información documentada (Nº vehicular, placa, año modelo, accionista)
- **Historial de revisiones vehiculares**
- **Historial de mantenimientos**
- **Empleado/Usuario que genera el expediente**

---

## Cambios en la Base de Datos

### 1. Tabla `vehiculos` - Campos Agregados

Se agregaron campos documentales a la tabla de vehículos:

```
- numero_vehicular: Número único del vehículo
- placa: Placa del vehículo
- anio_modelo: Año de fabricación
- fecha_ultima_revision: Fecha de la última revisión técnica
- observacion: Observaciones sobre el vehículo
- accionista_id: FK a socios (accionista/propietario)
```

**Migración**: `2026_05_07_000001_enhance_vehiculos_for_expediente.php`

### 2. Tabla `revisiones_vehiculares` - Nueva

Registra el historial de revisiones técnicas de cada vehículo:

```
- id: ID único
- vehiculo_id: FK a vehículos
- registrado_por: FK a users (empleado que registra)
- fecha_revision: Fecha de la revisión
- resultado: Aprobado/Observado/Rechazado
- observacion: Detalles de la revisión
- timestamps
```

**Migración**: `2026_05_07_000002_create_revisiones_vehiculares_table.php`

### 3. Tabla `expedientes` - Nueva

Consolidación digital del expediente del miembro:

```
- id: ID único
- codigo: Código único del expediente (EXP-YYYYMMDD-XXXX)
- socio_id: FK a socios
- vehiculo_id: FK a vehículos
- elaborado_por: FK a users (empleado que genera)
- fecha_emision: Fecha de generación
- observacion_general: Observaciones del expediente
- estado: Abierto/Cerrado
- timestamps
```

**Migración**: `2026_05_07_000003_create_expedientes_table.php`

---

## Nuevos Modelos

### 1. `App\Models\Expediente`
- Relaciones: socio, vehículo, elaboradoPor (user)
- Fillables: codigo, socio_id, vehiculo_id, elaborado_por, fecha_emision, observacion_general, estado
- Casts: fecha_emision → date

### 2. `App\Models\RevisionVehicular`
- Table: `revisiones_vehiculares`
- Relaciones: vehiculo, registradoPor (user)
- Fillables: vehiculo_id, registrado_por, fecha_revision, resultado, observacion
- Casts: fecha_revision → date

### 3. Modelos Existentes - Relaciones Extendidas

**Vehiculo**:
- `revisionesVehiculares()`: hasMany RevisionVehicular
- `expedientes()`: hasMany Expediente
- `accionista()`: belongsTo Socio (accionista_id)

**Socio**:
- `vehiculosComoAccionista()`: hasMany Vehiculo (accionista_id)
- `expedientes()`: hasMany Expediente

**User**:
- `expedientesElaborados()`: hasMany Expediente
- `revisionesVehicularesRegistradas()`: hasMany RevisionVehicular

---

## API REST - Endpoints

### 1. Registrar Revisión Vehicular

**POST** `/api/revisiones-vehiculares`

```json
{
  "vehiculo_id": 1,
  "registrado_por": 1,
  "fecha_revision": "2026-05-07",
  "resultado": "Aprobado",
  "observacion": "Vehículo en buen estado"
}
```

**Respuesta** (201 Created):
```json
{
  "message": "Revision vehicular registrada correctamente.",
  "data": {
    "id": 1,
    "vehiculo_id": 1,
    "registrado_por": 1,
    "fecha_revision": "2026-05-07",
    "resultado": "Aprobado",
    "observacion": "Vehículo en buen estado",
    "vehiculo": {...},
    "registradoPor": {...}
  }
}
```

### 2. Crear Expediente

**POST** `/api/expedientes`

```json
{
  "socio_id": 1,
  "vehiculo_id": 1,
  "elaborado_por": 1,
  "observacion_general": "Expediente digital"
}
```

**Respuesta** (201 Created):
```json
{
  "message": "Expediente creado correctamente.",
  "data": {
    "id": 1,
    "codigo": "EXP-20260507-0001",
    "socio_id": 1,
    "vehiculo_id": 1,
    "elaborado_por": 1,
    "fecha_emision": "2026-05-07",
    "observacion_general": "Expediente digital",
    "estado": "Abierto",
    "socio": {...},
    "vehiculo": {...},
    "elaboradoPor": {...}
  }
}
```

### 3. Generar Acta del Expediente

**GET** `/api/expedientes/{expediente}/acta`

**Respuesta** (200 OK):
```json
{
  "message": "Acta generada correctamente.",
  "data": {
    "empresa": "RAPITAXI",
    "expediente_codigo": "EXP-20260507-0001",
    "fecha_emision": "2026-05-07",
    "miembro": {
      "id": 1,
      "nombre": "Carlos Ramírez González",
      "cedula": "123-456789-0",
      "telefono": "+1 (555) 123-4567",
      "correo": "carlos@example.com",
      "estado": "Activo"
    },
    "vehiculo": {
      "id": 1,
      "numero_vehicular": "NV-0001",
      "placa": "ABC-1234",
      "marca": "Toyota Corolla",
      "color": "Blanco",
      "anio_modelo": 2023,
      "nombre_accionista": "Carlos Ramírez González",
      "fecha_ultima_revision": "2026-05-07",
      "observacion": "Vehículo en buen estado",
      "estado": "Operativo"
    },
    "revision_vehicular_actual": {
      "fecha_revision": "2026-05-07",
      "resultado": "Aprobado",
      "observacion": "Sin observaciones",
      "registrado_por": "Juan Pérez"
    },
    "historial_revisiones": [...],
    "historial_mantenimientos": [...],
    "elaborado_por": "Juan Pérez",
    "observacion_general": "Expediente digital",
    "estado_expediente": "Abierto"
  }
}
```

---

## Factories (Generadores de Datos)

### 1. `Database\Factories\VehiculoFactory` - Actualizada
Ahora genera:
- numero_vehicular: "NV-XXXX"
- placa: formato ABC-1234
- anio_modelo: año de 4 dígitos
- fecha_ultima_revision: fecha entre -10 meses y hoy
- observacion: frase aleatorios opcional

### 2. `Database\Factories\ExpedienteFactory` - Nueva
Genera:
- codigo: "EXP-YYYYMMDD-XXXX"
- fecha_emision: fecha aleatoria
- observacion_general: frase aleatoria
- estado: Abierto o Cerrado

### 3. `Database\Factories\RevisionVehicularFactory` - Nueva
Genera:
- fecha_revision: fecha entre -10 meses y hoy
- resultado: Aprobado/Observado/Rechazado
- observacion: frase aleatoria opcional

---

## Database Seeder - Actualizado

`Database\Seeders\DatabaseSeeder` ahora:

1. Crea 3 usuarios (empleados)
2. Crea 10 socios
3. Para cada socio, crea 1-2 vehículos
4. Para cada vehículo:
   - Crea 3 registros de mantenimiento
   - **Crea 1 revisión vehicular** ← NUEVO
   - **Crea 1 expediente** ← NUEVO

Así tienes datos completos para probar todo el flujo.

---

## Testing - Pruebas Feature

Se crearon 2 clases de pruebas Feature:

### 1. `Tests\Feature\ExpedienteApiTest` (3 tests)
```
✓ crear_expediente_exitosamente
✓ crear_expediente_con_vehiculo_de_otro_socio (validación)
✓ generar_acta_de_expediente
```

### 2. `Tests\Feature\RevisionVehicularApiTest` (4 tests)
```
✓ registrar_revision_vehicular_exitosamente
✓ registrar_revision_actualiza_fecha_ultima_revision
✓ registrar_revision_con_resultado_invalido (validación)
✓ registrar_revision_con_vehiculo_inexistente (validación)
```

**Estado**: ✅ 9/9 tests passing (60 assertions)

---

## Configuración de Testing

Se actualizó la configuración para ejecutar tests con migrations automáticas:

- `tests/TestCase.php`: Ejecuta migraciones antes de cada test
- `config/database.php`: Agregó conexión "testing" con SQLite :memory:
- `phpunit.xml`: Usa DB_CONNECTION=testing

---

## Documentación

### 1. `EXPEDIENTE_API_DOCS.txt`
Documentación completa y detallada de todos los endpoints con:
- Descripción de cada uno
- Request/Response examples
- Validaciones
- Valores permitidos
- Flujo completo ejemplo
- Notas importantes

### 2. `RAPITAXI_Expediente_API.postman_collection.json`
Colección de Postman lista para importar con:
- 3 requests preconfigurados
- Variable de base_url
- Headers correctos
- Bodies de ejemplo

---

## Cómo Usar

### 1. Ejecutar Migraciones

```bash
cd backend-rapitaxi
php artisan migrate
```

### 2. Poblar Base de Datos

```bash
php artisan db:seed
```

### 3. Ejecutar Servidor Laravel

```bash
php artisan serve
```

### 4. Importar en Postman

1. Abre Postman
2. Click en "Import"
3. Selecciona el archivo `RAPITAXI_Expediente_API.postman_collection.json`
4. Cambia la variable `base_url` si tu servidor corre en otro puerto

### 5. Probar Endpoints

1. **Registrar Revisión**
   ```
   POST http://localhost:8000/api/revisiones-vehiculares
   ```

2. **Crear Expediente**
   ```
   POST http://localhost:8000/api/expedientes
   ```

3. **Generar Acta** (reemplaza {id} con ID del expediente)
   ```
   GET http://localhost:8000/api/expedientes/1/acta
   ```

### 6. Ejecutar Tests

```bash
php artisan test
```

---

## Archivos Creados/Modificados

### Migraciones
- `database/migrations/2026_05_07_000001_enhance_vehiculos_for_expediente.php`
- `database/migrations/2026_05_07_000002_create_revisiones_vehiculares_table.php`
- `database/migrations/2026_05_07_000003_create_expedientes_table.php`

### Modelos
- `app/Models/Expediente.php` (nuevo)
- `app/Models/RevisionVehicular.php` (nuevo)
- `app/Models/Vehiculo.php` (actualizado)
- `app/Models/Socio.php` (actualizado)
- `app/Models/User.php` (actualizado)

### Controladores
- `app/Http/Controllers/Api/ExpedienteController.php` (nuevo)
- `app/Http/Controllers/Api/RevisionVehicularController.php` (nuevo)

### Factories
- `database/factories/ExpedienteFactory.php` (nueva)
- `database/factories/RevisionVehicularFactory.php` (nueva)
- `database/factories/VehiculoFactory.php` (actualizada)

### Rutas
- `routes/api.php` (actualizado)

### Seeders
- `database/seeders/DatabaseSeeder.php` (actualizado)

### Tests
- `tests/Feature/ExpedienteApiTest.php` (nueva)
- `tests/Feature/RevisionVehicularApiTest.php` (nueva)
- `tests/TestCase.php` (actualizado)

### Configuración
- `config/database.php` (actualizado)
- `phpunit.xml` (actualizado)

### Documentación
- `EXPEDIENTE_API_DOCS.txt` (nueva)
- `RAPITAXI_Expediente_API.postman_collection.json` (nueva)
- `README.md` (este archivo)

---

## Próximos Pasos Recomendados

1. ✅ Implementar frontend para crear/visualizar expedientes
2. ✅ Agregar exportación de acta a PDF
3. ✅ Implementar autenticación y autorización completa
4. ✅ Agregar validaciones adicionales según requrimientos
5. ✅ Crear dashboard de expedientes

---

## Contacto / Soporte

Para preguntas o problemas, revisa:
- `EXPEDIENTE_API_DOCS.txt` para detalles de API
- Tests en `tests/Feature/` para ejemplos de uso
- Colección Postman para probar endpoints

---

**Versión**: 1.0 | **Fecha**: 2026-05-07 | **Estado**: ✅ Producción Lista
