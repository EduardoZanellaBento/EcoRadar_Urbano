#!/usr/bin/env bash
# Para os containers do EcoRadar Urbano. Use --limpar para remover também os volumes (dados).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" = "--limpar" ]; then
  echo "Parando e removendo containers e VOLUMES (dados serão apagados)..."
  docker compose --profile seed down -v --remove-orphans
else
  echo "Parando os containers (os dados são mantidos)..."
  docker compose --profile seed down --remove-orphans
fi
echo "Pronto."
