<#
.SYNOPSIS
  Regenera toda a pasta registros\ a partir de execuções reais: ambiente, build, dados limpos,
  todos os testes, prints de infraestrutura, logs, métricas, versões, relatório e galeria (index.html).
.PARAMETER SemCarga
  Pula o teste de carga.
.PARAMETER ManterDados
  Não recria os dados de demonstração antes dos testes.
#>
param([switch]$SemCarga, [switch]$ManterDados)
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerBin)) { $env:PATH = "$dockerBin;$env:PATH" }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'O Docker não está em execução. Abra o Docker Desktop e tente novamente.' -ForegroundColor Red; exit 1 }
$argumentos = @((Join-Path $raiz 'tests/scripts/coletar-evidencias.mjs'))
if ($SemCarga) { $argumentos += '--sem-carga' }
if ($ManterDados) { $argumentos += '--manter-dados' }
node @argumentos
exit $LASTEXITCODE
