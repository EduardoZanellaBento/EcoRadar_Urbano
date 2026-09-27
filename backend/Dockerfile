# syntax=docker/dockerfile:1
# =============================================================================
# Imagem única e parametrizada para todos os microsserviços do backend.
#   docker build --build-arg PACOTE=services/auth-service -t ecoradar/auth-service .
# Estágios: deps (todas as dependências) -> build (esbuild) -> prod-deps -> final
# =============================================================================
FROM node:24-alpine AS base
WORKDIR /app

# ----- Dependências completas (para compilar) -----------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/auth-service/package.json services/auth-service/
COPY services/ocorrencias-service/package.json services/ocorrencias-service/
COPY services/ambiental-service/package.json services/ambiental-service/
COPY services/alertas-service/package.json services/alertas-service/
COPY services/relatorios-service/package.json services/relatorios-service/
COPY services/sensor-simulator/package.json services/sensor-simulator/
COPY seed/package.json seed/
RUN npm ci --no-audit --no-fund

# ----- Build do pacote escolhido -----------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY services ./services
COPY seed ./seed
ARG PACOTE
RUN test -n "$PACOTE" || (echo "Informe --build-arg PACOTE=services/<nome>" && exit 1)
RUN cd "/app/$PACOTE" && node /app/scripts/build.mjs

# ----- Somente dependências de produção ----------------------------------------
FROM deps AS prod-deps
RUN npm prune --omit=dev --no-audit --no-fund

# ----- Imagem final -------------------------------------------------------------
FROM base AS final
ENV NODE_ENV=production
ARG PACOTE
# Pasta de uploads (volume compartilhado entre as réplicas do ocorrencias-service).
# Código e dependências ficam com o root (somente leitura para o usuário "node");
# só a pasta de uploads precisa de escrita.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/${PACOTE}/dist ./dist
USER node
EXPOSE 3000
# SIGTERM chega direto ao Node (PID 1), que faz o encerramento gracioso
CMD ["node", "--enable-source-maps", "dist/index.js"]
