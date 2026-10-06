<#
    Restaura un respaldo de RapiTaxi en una base de datos.

    Uso:
        # Restaurar en una base nueva para verificar que el respaldo sirve
        .\scripts\restaurar-bd.ps1 -Archivo respaldos\rapitaxi_2026-09-25_1430.dump -BaseDestino rapitaxi_prueba

        # Restaurar sobre la base del .env (PIDE CONFIRMACION: borra lo que haya)
        .\scripts\restaurar-bd.ps1 -Archivo respaldos\rapitaxi_2026-09-25_1430.dump

    Conviene probar cada respaldo en una base aparte al menos una vez: un
    respaldo que nunca se restauro no es un respaldo, es un archivo.
#>

param(
    [Parameter(Mandatory = $true)][string]$Archivo,
    [string]$BaseDestino = "",
    [string]$Env = ".env",
    [switch]$SinConfirmar
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent

# --- Localizar las herramientas ---------------------------------------------
function Buscar-Herramienta([string]$nombre) {
    $ruta = (Get-Command $nombre -ErrorAction SilentlyContinue).Source
    if (-not $ruta) {
        $c = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$nombre.exe" -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1
        if ($c) { $ruta = $c.FullName }
    }
    if (-not $ruta) { throw "No se encontro $nombre. Instala PostgreSQL o agrega su bin al PATH." }
    return $ruta
}

$pgRestore = Buscar-Herramienta "pg_restore"
$psql = Buscar-Herramienta "psql"

# --- Credenciales ------------------------------------------------------------
$rutaEnv = Join-Path $raiz $Env
if (-not (Test-Path $rutaEnv)) { throw "No existe el archivo $rutaEnv" }

$config = @{}
Get-Content $rutaEnv | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $config[$matches[1]] = $matches[2].Trim().Trim('"')
    }
}

$rutaArchivo = if ([System.IO.Path]::IsPathRooted($Archivo)) { $Archivo } else { Join-Path $raiz $Archivo }
if (-not (Test-Path $rutaArchivo)) { throw "No existe el respaldo $rutaArchivo" }

$esBaseNueva = [bool]$BaseDestino
if (-not $BaseDestino) { $BaseDestino = $config['DB_DATABASE'] }

# --- Confirmacion: restaurar sobre una base con datos los reemplaza ----------
if (-not $esBaseNueva -and -not $SinConfirmar) {
    Write-Host "Vas a restaurar sobre '$BaseDestino', reemplazando su contenido actual." -ForegroundColor Yellow
    $respuesta = Read-Host "Escribe el nombre de la base para confirmar"
    if ($respuesta -ne $BaseDestino) { Write-Host "Cancelado." -ForegroundColor Red; exit 1 }
}

$env:PGPASSWORD = $config['DB_PASSWORD']
try {
    # psql y pg_restore escriben avisos normales (NOTICE) en stderr. Con
    # ErrorActionPreference en Stop, PowerShell 5.1 los toma como errores
    # fatales, asi que aqui se controla el exito por el codigo de salida.
    $ErrorActionPreference = "Continue"

    # Si es una base de verificacion, se crea vacia.
    if ($esBaseNueva) {
        Write-Host "Creando la base '$BaseDestino'..." -ForegroundColor Cyan
        & $psql --host=$($config['DB_HOST']) --port=$($config['DB_PORT']) --username=$($config['DB_USERNAME']) `
            --dbname=postgres --command="DROP DATABASE IF EXISTS `"$BaseDestino`";" | Out-Null
        & $psql --host=$($config['DB_HOST']) --port=$($config['DB_PORT']) --username=$($config['DB_USERNAME']) `
            --dbname=postgres --command="CREATE DATABASE `"$BaseDestino`";" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la base '$BaseDestino'." }
    }

    Write-Host "Restaurando $([System.IO.Path]::GetFileName($rutaArchivo)) en '$BaseDestino'..." -ForegroundColor Cyan

    # --clean elimina los objetos previos antes de recrearlos, para que
    # restaurar sobre una base con datos deje exactamente lo del respaldo.
    $limpiar = if ($esBaseNueva) { @() } else { @("--clean", "--if-exists") }

    & $pgRestore `
        --host=$($config['DB_HOST']) `
        --port=$($config['DB_PORT']) `
        --username=$($config['DB_USERNAME']) `
        --dbname=$BaseDestino `
        --no-owner `
        --no-privileges `
        @limpiar `
        $rutaArchivo

    # pg_restore devuelve 1 por avisos que no impiden la restauracion.
    if ($LASTEXITCODE -gt 1) { throw "pg_restore termino con codigo $LASTEXITCODE" }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Restauracion terminada en '$BaseDestino'." -ForegroundColor Green
