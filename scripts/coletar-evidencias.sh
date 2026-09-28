#!/usr/bin/env bash
# Regenera toda a pasta registros/ a partir de execuções reais (ambiente, build, dados limpos, todos os
# testes, prints de infraestrutura, logs, métricas, versões, relatório e galeria index.html).
# Uso: ./scripts/coletar-evidencias.sh [--sem-carga] [--manter-dados]
set -uo pipefail
cd "$(dirname "$0")/.."
docker info >/dev/null 2>&1 || { echo "O Docker não está em execução."; exit 1; }
node tests/scripts/coletar-evidencias.mjs "$@"
