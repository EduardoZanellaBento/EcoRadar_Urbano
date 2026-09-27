# Registra informações do sistema e versões das ferramentas em registros/ambiente/
# Uso: powershell -ExecutionPolicy Bypass -File scripts/registrar-ambiente.ps1
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'registros/ambiente'
New-Item -ItemType Directory -Force $destino | Out-Null

function Versao([string]$cmd, [string[]]$argumentos) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $c) { return 'não instalado' }
    try {
        $saida = & $cmd @argumentos 2>&1 | Out-String
        $linhas = ($saida -replace "`0", '') -split "`r?`n" | Where-Object { $_.Trim() -ne '' }
        return ($linhas -join ' | ').Trim()
    } catch { return "erro ao consultar: $($_.Exception.Message)" }
}

# Garante que o Docker Desktop esteja no PATH desta sessão, se instalado
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if ((Test-Path $dockerBin) -and -not ($env:PATH -like "*$dockerBin*")) { $env:PATH = "$dockerBin;$env:PATH" }

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Loopback' } |
    ForEach-Object { "$($_.InterfaceAlias): $($_.IPAddress)" }
$perfis = Get-NetConnectionProfile | ForEach-Object { "$($_.InterfaceAlias): rede '$($_.Name)' categoria $($_.NetworkCategory)" }

$sistema = @"
# Informações do sistema — gerado em $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
Sistema operacional : $($os.Caption) $($os.Version) (build $($os.BuildNumber)) $($os.OSArchitecture)
Nome do computador  : $env:COMPUTERNAME
CPU                 : $($cpu.Name.Trim()) — $($cpu.NumberOfCores) núcleos / $($cpu.NumberOfLogicalProcessors) threads
Virtualização (BIOS): $($cpu.VirtualizationFirmwareEnabled)
RAM total           : $([math]::Round($cs.TotalPhysicalMemory / 1GB, 1)) GB
IP(s) da rede local : $($ips -join '; ')
Perfil de rede      : $($perfis -join '; ')

## Ferramentas
node            : $(Versao 'node' @('-v'))
npm             : $(Versao 'npm' @('-v'))
git             : $(Versao 'git' @('--version'))
docker          : $(Versao 'docker' @('--version'))
docker compose  : $(Versao 'docker' @('compose','version'))
python          : $(Versao 'python' @('--version'))
adb             : $(Versao 'adb' @('version'))
wsl             : $(Versao 'wsl' @('--version'))
"@
$sistema | Out-File -Encoding utf8 (Join-Path $destino 'sistema.txt')
Write-Host "Gerado: registros/ambiente/sistema.txt"
