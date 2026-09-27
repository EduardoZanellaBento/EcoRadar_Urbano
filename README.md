# EcoRadar Urbano

Aplicação de **sistema distribuído para dispositivo móvel** voltada ao gerenciamento de
informações ambientais urbanas (poluição do ar, trânsito e transporte público, alagamentos,
invasão de mananciais, desmatamento, inversão térmica, queimadas e descarte irregular de lixo).

APS — Ciência da Computação (UNIP), 7º/8º semestre, 2026.

> Este README é preliminar e será completado ao final do desenvolvimento (Fase 10), com
> diagrama de arquitetura, tabela de serviços e instruções completas.

## Visão geral

- **App móvel**: React Native + Expo (SDK 57), Expo Router, React Native Paper (Material 3).
- **Backend**: 6 microsserviços Node.js + TypeScript + Fastify, atrás de um **API Gateway Nginx** (porta 8080).
- **Mensageria**: RabbitMQ (AMQP entre serviços e MQTT para telemetria dos sensores).
- **Banco**: PostgreSQL + PostGIS, um schema (e um usuário) por serviço.
- **Orquestração**: Docker Compose.

## Estrutura

```
backend/     microsserviços (npm workspaces) e pacote compartilhado
mobile/      aplicativo Expo
gateway/     configuração do Nginx
infra/       inicialização do PostgreSQL e configuração do RabbitMQ
tests/       testes de integração, E2E, sistema distribuído e carga
scripts/     scripts de automação (PowerShell e Bash)
registros/   evidências de execução (prints, vídeos, logs e relatórios)
```

Acompanhe o andamento em [PROGRESSO.md](PROGRESSO.md).
