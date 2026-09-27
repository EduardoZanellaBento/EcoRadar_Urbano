<#
.SYNOPSIS
  Descobre o IP deste computador na rede local e grava mobile/.env com
  EXPO_PUBLIC_API_URL=http://<IP>:8080 (usado pelo app no celular via Expo Go).
.PARAMETER Ip
  Força um IP específico (ex.: quando há mais de uma rede ativa).
#>
param([string]$Ip)
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot

if (-not $Ip) {
    # Interface usada pela rota padrão (a que leva à internet), ignorando adaptadores virtuais
    $rotas = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric
    foreach ($r in $rotas) {
        $cand = Get-NetIPAddress -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254*' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|VirtualBox|VMware|Loopback' } |
            Select-Object -First 1
        if ($cand) { $Ip = $cand.IPAddress; $interface = $cand.InterfaceAlias; break }
    }
}
if (-not $Ip) { throw 'Não foi possível detectar o IP da rede local. Informe manualmente: scripts\configurar-ip.ps1 -Ip 192.168.0.10' }

$porta = 8080
$envRaiz = Join-Path $raiz '.env'
if (Test-Path $envRaiz) {
    $p = Select-String -Path $envRaiz -Pattern '^GATEWAY_PORTA=(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }
    if ($p) { $porta = $p }
}
$url = "http://${Ip}:$porta"
$conteudo = @"
# Gerado por scripts/configurar-ip em $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Endereço do gateway (Nginx) acessível pelo celular na mesma rede Wi-Fi
EXPO_PUBLIC_API_URL=$url
"@
[IO.File]::WriteAllText((Join-Path $raiz 'mobile/.env'), $conteudo + "`n", (New-Object Text.UTF8Encoding $false))

Write-Host "IP detectado: $Ip $(if ($interface) { "($interface)" })" -ForegroundColor Green
Write-Host "Gravado em mobile/.env -> EXPO_PUBLIC_API_URL=$url"
Write-Host "Teste no navegador do celular: $url/api/ambiental/health"
$perfil = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -eq $interface } | Select-Object -First 1
if ($perfil -and $perfil.NetworkCategory -eq 'Public') {
    Write-Host "Atenção: a rede '$($perfil.Name)' está como PÚBLICA no Windows. Veja no COMO_TESTAR.md como liberar o firewall." -ForegroundColor Yellow
}
