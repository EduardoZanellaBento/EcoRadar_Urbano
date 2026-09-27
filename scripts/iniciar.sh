#!/usr/bin/env bash
# Sobe todo o EcoRadar Urbano do zero (infra, microsserviços, gateway e dados de demonstração).
# Uso: ./scripts/iniciar.sh [--sem-web] [--recriar-dados]
set -euo pipefail
cd "$(dirname "$0")/.."

SEM_WEB=0
RECRIAR=0
for arg in "$@"; do
  case "$arg" in
    --sem-web) SEM_WEB=1 ;;
    --recriar-dados) RECRIAR=1 ;;
  esac
done

passo() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }

command -v docker >/dev/null || { echo "Docker não encontrado. Instale o Docker (veja COMO_TESTAR.md)."; exit 1; }
passo "Verificando se o Docker está em execução"
docker info >/dev/null 2>&1 || { echo "O Docker não está respondendo. Inicie o Docker e tente novamente."; exit 1; }

[ -f .env ] || { passo "Criando .env a partir de .env.example"; cp .env.example .env; }

if [ "$SEM_WEB" -eq 0 ] && [ ! -f mobile/dist/index.html ]; then
  if [ -d mobile/node_modules ]; then
    passo "Gerando o build web do app (npx expo export --platform web)"
    (cd mobile && EXPO_PUBLIC_API_URL= npx expo export --platform web --output-dir dist)
  else
    echo "mobile/node_modules não encontrado: pulando o build web."
  fi
fi
mkdir -p mobile/dist

passo "Construindo as imagens e subindo os containers (aguardando todos ficarem healthy)"
if ! docker compose up -d --build --wait --wait-timeout 420; then
  docker compose ps
  echo "Algum serviço não ficou saudável. Veja: docker compose logs <servico>"
  exit 1
fi

passo "Carregando os dados de demonstração (seed)"
if [ "$RECRIAR" -eq 1 ]; then
  docker compose --profile seed run --rm seed node --enable-source-maps dist/index.js --forcar
else
  docker compose --profile seed run --rm seed
fi

docker compose ps --format 'table {{.Name}}\t{{.Status}}'
PORTA=$(grep -E '^GATEWAY_PORTA=' .env | cut -d= -f2 || true); PORTA=${PORTA:-8080}
cat <<EOF

EcoRadar Urbano no ar!
  Gateway / API ........ http://localhost:${PORTA}
  App web .............. http://localhost:${PORTA}/
  Swagger (exemplos) ... http://localhost:${PORTA}/api/ocorrencias/docs | /api/auth/docs | /api/ambiental/docs
  RabbitMQ (painel) .... http://localhost:15672 (usuário/senha no .env)
  Credenciais demo ..... backend/seed/usuarios-demo.json
  Celular .............. rode ./scripts/configurar-ip.sh e siga o COMO_TESTAR.md
EOF
