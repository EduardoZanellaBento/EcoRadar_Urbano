<#
.SYNOPSIS
  Roda todos os testes e verificações (tsc, lint, unitários, integração, E2E, distribuído e carga).
  Pré-requisito: a stack no ar (scripts\iniciar.ps1). Resumo em registros\testes\resumo-execucao.md
.PARAMETER SemCarga
  Pula o teste de carga (economiza ~1,5 min).
#>
param([switch]$SemCarga)
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerBin)) { $env:PATH = "$dockerBin;$env:PATH" }
Push-Location (Join-Path $raiz 'tests')
if (-not (Test-Path 'node_modules')) { npm install --no-audit --no-fund }
if (-not (Test-Path '.cache/ms-playwright')) { node scripts/instalar-navegadores.mjs }
$argumentos = @('scripts/rodar-todos.mjs')
if ($SemCarga) { $argumentos += '--sem-carga' }
node @argumentos
$codigo = $LASTEXITCODE
Pop-Location
exit $codigo
