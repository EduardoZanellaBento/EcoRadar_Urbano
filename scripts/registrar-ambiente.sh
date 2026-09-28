#!/usr/bin/env bash
# Registra informações do sistema e versões das ferramentas em registros/ambiente/sistema.txt (Linux/macOS)
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p registros/ambiente
versao() { command -v "$1" >/dev/null 2>&1 && "$@" 2>&1 | head -1 || echo "não instalado"; }
if [ "$(uname)" = "Darwin" ]; then
  CPU=$(sysctl -n machdep.cpu.brand_string); RAM=$(( $(sysctl -n hw.memsize) / 1073741824 ))
  IP=$(ipconfig getifaddr en0 2>/dev/null || echo "?")
else
  CPU=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs); RAM=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1048576 ))
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
cat > registros/ambiente/sistema.txt <<EOF
# Informações do sistema — gerado em $(date '+%Y-%m-%d %H:%M:%S %z')
Sistema operacional : $(uname -srm)
Nome do computador  : $(hostname)
CPU                 : ${CPU} — $(getconf _NPROCESSORS_ONLN) threads
RAM total           : ${RAM} GB
IP da rede local    : ${IP}

## Ferramentas
node            : $(versao node -v)
npm             : $(versao npm -v)
git             : $(versao git --version)
docker          : $(versao docker --version)
docker compose  : $(versao docker compose version)
python          : $(versao python3 --version)
adb             : $(versao adb version)
EOF
echo "Gerado: registros/ambiente/sistema.txt"
