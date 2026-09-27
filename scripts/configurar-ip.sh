#!/usr/bin/env bash
# Descobre o IP da rede local e grava mobile/.env com EXPO_PUBLIC_API_URL=http://<IP>:8080
# Uso: ./scripts/configurar-ip.sh [IP]
set -euo pipefail
cd "$(dirname "$0")/.."

IP="${1:-}"
if [ -z "$IP" ]; then
  if command -v ip >/dev/null 2>&1; then
    IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
  fi
  if [ -z "$IP" ] && command -v ipconfig >/dev/null 2>&1; then # macOS
    IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
    IP=$(ipconfig getifaddr "${IFACE:-en0}" 2>/dev/null || true)
  fi
  if [ -z "$IP" ]; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
fi
[ -n "$IP" ] || { echo "Não foi possível detectar o IP. Informe manualmente: ./scripts/configurar-ip.sh 192.168.0.10"; exit 1; }

PORTA=8080
if [ -f .env ]; then P=$(grep -E '^GATEWAY_PORTA=' .env | cut -d= -f2 || true); PORTA=${P:-8080}; fi
URL="http://${IP}:${PORTA}"
cat > mobile/.env <<EOF
# Gerado por scripts/configurar-ip em $(date '+%Y-%m-%d %H:%M')
# Endereço do gateway (Nginx) acessível pelo celular na mesma rede Wi-Fi
EXPO_PUBLIC_API_URL=${URL}
EOF
echo "IP detectado: ${IP}"
echo "Gravado em mobile/.env -> EXPO_PUBLIC_API_URL=${URL}"
echo "Teste no navegador do celular: ${URL}/api/ambiental/health"
