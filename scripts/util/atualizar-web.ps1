# Regera o build web do app (mobile/dist) e reinicia o gateway, que serve esse build em http://localhost:8080/
# (o export recria a pasta; o bind mount do Docker precisa ser remontado).
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerBin)) { $env:PATH = "$dockerBin;$env:PATH" }
Push-Location (Join-Path $raiz 'mobile')
$env:EXPO_PUBLIC_API_URL = ''
npx expo export --platform web --output-dir dist 2>&1 | Out-File -Encoding utf8 (Join-Path $raiz 'registros/build/04_expo-export-web.log')
$codigo = $LASTEXITCODE
Pop-Location
if ($codigo -ne 0) { Write-Host 'Falha no expo export (veja registros/build/04_expo-export-web.log)' -ForegroundColor Red; exit 1 }
Push-Location $raiz
docker compose restart gateway | Out-Null
Pop-Location
Write-Host 'Build web atualizado e gateway reiniciado: http://localhost:8080/' -ForegroundColor Green
