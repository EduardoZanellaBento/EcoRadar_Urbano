#!/usr/bin/env bash
# Roda todos os testes e verificações (tsc, lint, unitários, integração, E2E, distribuído e carga).
# Pré-requisito: a stack no ar (./scripts/iniciar.sh). Uso: ./scripts/rodar-todos-testes.sh [--sem-carga]
set -uo pipefail
cd "$(dirname "$0")/../tests"
[ -d node_modules ] || npm install --no-audit --no-fund
[ -d .cache/ms-playwright ] || node scripts/instalar-navegadores.mjs
node scripts/rodar-todos.mjs "$@"
