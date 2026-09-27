<#
.SYNOPSIS
  Para todos os containers do EcoRadar Urbano.
.PARAMETER Limpar
  Remove também os volumes (banco, filas e fotos) — na próxima subida tudo é recriado do zero.
#>
param([switch]$Limpar)
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerBin)) { $env:PATH = "$dockerBin;$env:PATH" }

if ($Limpar) {
    Write-Host 'Parando e removendo containers e VOLUMES (dados serão apagados)...' -ForegroundColor Yellow
    docker compose --profile seed down -v --remove-orphans
} else {
    Write-Host 'Parando os containers (os dados são mantidos)...'
    docker compose --profile seed down --remove-orphans
}
Write-Host 'Pronto.' -ForegroundColor Green
