<#
.SYNOPSIS
  Sobe todo o EcoRadar Urbano do zero: infraestrutura, microsserviços, gateway, dados de demonstração.
.PARAMETER SemWeb
  Não gera o build web do app (mobile/dist) servido pelo gateway em http://localhost:8080/.
.PARAMETER RecriarDados
  Recria os dados de demonstração (seed --forcar).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
#>
param([switch]$SemWeb, [switch]$RecriarDados)
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Passo([string]$texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

# ----- Docker disponível? ------------------------------------------------------
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerBin)) { $env:PATH = "$dockerBin;$env:PATH" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker não encontrado. Instale o Docker Desktop (veja COMO_TESTAR.md).' }

Passo 'Verificando se o Docker está em execução'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) {
        Write-Host 'Iniciando o Docker Desktop (pode levar até 2 minutos)...'
        Start-Process $desktop | Out-Null
        $limite = (Get-Date).AddMinutes(3)
        do { Start-Sleep -Seconds 5; docker info *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $limite)
    }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'O Docker não está respondendo. Abra o Docker Desktop e tente novamente.' }
}
Write-Host 'Docker ok.'

# ----- .env ----------------------------------------------------------------------
if (-not (Test-Path '.env')) {
    Passo 'Criando .env a partir de .env.example'
    Copy-Item '.env.example' '.env'
}

# ----- Build web do app (servido pelo gateway) -----------------------------------------
if (-not $SemWeb -and -not (Test-Path 'mobile/dist/index.html')) {
    if (Test-Path 'mobile/node_modules') {
        Passo 'Gerando o build web do app (npx expo export --platform web)'
        Push-Location mobile
        $env:EXPO_PUBLIC_API_URL = ''
        npx expo export --platform web --output-dir dist
        Pop-Location
    } else {
        Write-Host 'mobile/node_modules não encontrado: pulando o build web (rode "npm install" em mobile/ se quiser o app web no gateway).' -ForegroundColor Yellow
    }
}
if (-not (Test-Path 'mobile/dist')) { New-Item -ItemType Directory -Force 'mobile/dist' | Out-Null }

# ----- Containers ------------------------------------------------------------------------
Passo 'Construindo as imagens e subindo os containers (aguardando todos ficarem "healthy")'
docker compose up -d --build --wait --wait-timeout 420
if ($LASTEXITCODE -ne 0) {
    docker compose ps
    throw 'Algum serviço não ficou saudável. Veja os logs com: docker compose logs <servico>'
}

# ----- Dados de demonstração ----------------------------------------------------------------
Passo 'Carregando os dados de demonstração (seed)'
if ($RecriarDados) {
    docker compose --profile seed run --rm seed node --enable-source-maps dist/index.js --forcar
} else {
    docker compose --profile seed run --rm seed
}
if ($LASTEXITCODE -ne 0) { throw 'Falha ao executar o seed.' }

# ----- Resumo ----------------------------------------------------------------------------------
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
$porta = (Select-String -Path '.env' -Pattern '^GATEWAY_PORTA=(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }) ; if (-not $porta) { $porta = 8080 }
Write-Host ''
Write-Host 'EcoRadar Urbano no ar!' -ForegroundColor Green
Write-Host "  Gateway / API ........ http://localhost:$porta"
Write-Host "  App web .............. http://localhost:$porta/"
Write-Host "  Swagger (exemplos) ... http://localhost:$porta/api/ocorrencias/docs  |  /api/auth/docs  |  /api/ambiental/docs"
Write-Host '  RabbitMQ (painel) .... http://localhost:15672  (usuário/senha no .env)'
Write-Host '  Credenciais demo ..... backend/seed/usuarios-demo.json'
Write-Host '  Celular .............. rode scripts\configurar-ip.ps1 e siga o COMO_TESTAR.md'
