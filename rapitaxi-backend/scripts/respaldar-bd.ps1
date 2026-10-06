<#
    Respalda la base de datos de RapiTaxi en un archivo local.

    Uso:
        .\scripts\respaldar-bd.ps1                 # usa el .env del proyecto (base local)
        .\scripts\respaldar-bd.ps1 -Env .env.render  # respalda produccion

    El archivo queda en rapitaxi-backend\respaldos\ con la fecha en el nombre.
    Esa carpeta esta en .gitignore a proposito: un respaldo contiene cedulas,
    telefonos y correos de los socios, y no puede terminar en GitHub.

    Para restaurar, ver restaurar-bd.ps1
#>

param(
    [string]$Env = ".env",
    [string]$Destino = ""
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent

# --- Localizar pg_dump -------------------------------------------------------
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
    $candidato = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidato) { $pgDump = $candidato.FullName }
}
if (-not $pgDump) {
    throw "No se encontro pg_dump. Instala PostgreSQL o agrega su carpeta bin al PATH."
}

# --- Leer credenciales del .env ---------------------------------------------
$rutaEnv = Join-Path $raiz $Env
if (-not (Test-Path $rutaEnv)) { throw "No existe el archivo $rutaEnv" }

$config = @{}
Get-Content $rutaEnv | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $config[$matches[1]] = $matches[2].Trim().Trim('"')
    }
}

foreach ($clave in @("DB_HOST", "DB_PORT", "DB_DATABASE", "DB_USERNAME")) {
    if (-not $config[$clave]) { throw "Falta $clave en $Env" }
}

# --- Armar la ruta de salida -------------------------------------------------
if (-not $Destino) {
    $carpeta = Join-Path $raiz "respaldos"
    New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
    $marca = Get-Date -Format "yyyy-MM-dd_HHmm"
    $Destino = Join-Path $carpeta "$($config['DB_DATABASE'])_$marca.dump"
}

Write-Host "Respaldando $($config['DB_DATABASE']) desde $($config['DB_HOST'])..." -ForegroundColor Cyan

# -Fc: formato comprimido de PostgreSQL. Pesa menos que SQL plano y permite
# restaurar tablas sueltas con pg_restore.
$env:PGPASSWORD = $config['DB_PASSWORD']
try {
    & $pgDump `
        --host=$($config['DB_HOST']) `
        --port=$($config['DB_PORT']) `
        --username=$($config['DB_USERNAME']) `
        --dbname=$($config['DB_DATABASE']) `
        --format=custom `
        --no-owner `
        --no-privileges `
        --file=$Destino

    if ($LASTEXITCODE -ne 0) { throw "pg_dump termino con codigo $LASTEXITCODE" }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$tam = [math]::Round((Get-Item $Destino).Length / 1KB, 1)
Write-Host "Listo: $Destino ($tam KB)" -ForegroundColor Green

# Aviso si el respaldo salio sospechosamente pequeno: suele significar que la
# base estaba vacia o que la conexion apunto al lugar equivocado.
if ($tam -lt 10) {
    Write-Host "Cuidado: el archivo es muy pequeno. Verifica que la base tenga datos." -ForegroundColor Yellow
}
