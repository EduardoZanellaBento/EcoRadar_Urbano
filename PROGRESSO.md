# PROGRESSO — EcoRadar Urbano

> Arquivo de acompanhamento. Se a sessão for interrompida, basta dizer **"continue"**:
> o trabalho é retomado a partir da seção "Próximo passo".

## Situação atual

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Ambiente, estrutura, Git, README inicial | ✅ concluída |
| 2 | Infra (compose, PostGIS, RabbitMQ+MQTT, Nginx) | 🟡 arquivos prontos — **validação com Docker pendente (reinício do PC)** |
| 3 | `packages/shared` + auth-service | 🟡 código + testes unitários ok — login via gateway pendente |
| 4 | ocorrencias-service (2 réplicas, outbox, PostGIS, idempotência) | 🟡 código + testes unitários ok — validação em execução pendente |
| 5 | sensor-simulator + ambiental-service | 🟡 código + testes unitários ok (Open-Meteo testada com chamada real) |
| 6 | alertas-service + relatorios-service | 🟡 código + testes unitários ok (PDF de amostra gerado e conferido) |
| 7 | App móvel | ⏳ projeto Expo SDK 57 criado e dependências instaladas |
| 8 | Seed + scripts + Swagger | 🟡 seed, fotos, iniciar/parar/configurar-ip prontos; faltam rodar-todos-testes e coletar-evidencias |
| 9 | Testes e evidências | ⏳ |
| 10 | COMO_TESTAR.md + README final | ⏳ |

Números atuais (execução real em 27/09/2026): **104 testes unitários passando** (10 arquivos),
`tsc --noEmit` e `eslint` sem erros no backend, bundles esbuild dos 6 serviços + seed gerados.

## Decisões e observações

- **Caminho do projeto**: `C:\dev\APS` (o prompt trazia um placeholder; confirmado com o aluno).
- **Docker**: não estava instalado. Com autorização do aluno, foram instalados
  `wsl --install --no-distribution` (WSL 2.7.14) e `winget install Docker.DockerDesktop` (4.91.0).
  **É necessário reiniciar o PC** para ativar a Plataforma de Máquina Virtual e abrir o Docker Desktop uma vez.
- **TypeScript 6.0.3** (e não 7.x): o `typescript-eslint` atual exige TS < 6.1, e o template do Expo SDK 57 também usa 6.0.3.
- **Expo SDK 57** (React Native 0.86.3, React 19.2.3): SDK `latest` no npm, suportado pelo Expo Go das lojas.
- **npm 12** bloqueia scripts de instalação por padrão: o do `esbuild` foi aprovado explicitamente (`allowScripts`).
- **Build**: cada serviço vira um único `dist/index.js` (esbuild, com `@ecoradar/shared` embutido); Dockerfile único parametrizado por `PACOTE`.
- **Database per service**: tabelas sem schema explícito no Drizzle; cada usuário `svc_*` tem `search_path` no próprio schema.
  O drizzle-kit gera FKs com `"public".` — o script `backend/scripts/ajustar-migracoes.mjs` remove o qualificador.
  O tipo `geometry` do Drizzle perdia o SRID → uso de tipo customizado `geometry(Point, 4326)`.
- **IQAr**: faixas conferidas na página oficial da CETESB em 27/09/2026 (tabela atualizada: MP2,5 "Boa" até 15 µg/m³ etc.).
  URL: https://www.cetesb.sp.gov.br/cetesb/qualidade_ambiental/ar/informacoes_basicas/padroes_de_qualidade_do_ar
- **Gráficos**: barras por categoria em cor única (10 categorias excedem uma paleta categórica segura); rosca só para status (4 fatias);
  cores oficiais da CETESB para o IQAr sempre acompanhadas de rótulo; paleta de referência validada para daltonismo.
- Rede do PC: Ethernet, IP 192.168.68.104, perfil de rede **Público** (relevante para a regra de firewall).

## Próximo passo

1. (Aluno) Reiniciar o PC, abrir o **Docker Desktop** uma vez e aceitar os termos; depois dizer **"continue"**.
2. Rodar `scripts/iniciar.ps1` e validar as Fases 2–6 com a stack real (healthchecks, login via gateway,
   alternância de `X-Instance-Id`, idempotência, leituras MQTT, `/resumo`, alerta via Socket.IO, PDF).
3. Desenvolver o app móvel (Fase 7) contra a API real.
4. Fases 9 e 10 (testes automatizados, evidências, guias).

## Como retomar

1. Ler este arquivo.
2. `git log --oneline` para ver o que já foi entregue.
3. Continuar pela seção "Próximo passo".
