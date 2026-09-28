# PROGRESSO — EcoRadar Urbano

> Arquivo de acompanhamento. Se a sessão for interrompida, basta dizer **"continue"**:
> o trabalho é retomado a partir da seção "Próximo passo".

## Situação atual

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Ambiente, estrutura, Git, README inicial | ✅ concluída |
| 2 | Infra (compose, PostGIS, RabbitMQ+MQTT, Nginx) | ✅ 10 containers *healthy*; só 8080 e 15672 expostas |
| 3 | `packages/shared` + auth-service | ✅ testes unitários + login via gateway |
| 4 | ocorrencias-service (2 réplicas, outbox, PostGIS, idempotência) | ✅ `X-Instance-Id` alterna; duplicata não é criada |
| 5 | sensor-simulator + ambiental-service | ✅ leituras MQTT, IQAr (CETESB), Open-Meteo com circuit breaker |
| 6 | alertas-service + relatorios-service | ✅ cenário gera alerta recebido via Socket.IO; PDF/CSV |
| 7 | App móvel (12 telas) | ✅ `tsc`, `expo lint` e `expo-doctor` (21/21) sem problemas; `expo export --platform web` ok |
| 8 | Seed + scripts + Swagger | ✅ `iniciar`, `parar`, `configurar-ip`, `rodar-todos-testes`, `coletar-evidencias` (.ps1 e .sh); Swagger em todos os serviços |
| 9 | Testes e evidências | ✅ ver `registros/` (galeria `registros/index.html`, `RELATORIO_DE_TESTES.md`) |
| 10 | `COMO_TESTAR.md` + README final | ✅ |

## Decisões e observações

- **Caminho do projeto**: `C:\dev\APS` (o prompt trazia um placeholder; confirmado com o aluno).
- **Docker/WSL**: instalados com autorização do aluno (`wsl --install --no-distribution`, `winget install Docker.DockerDesktop` 4.91.0); exigiu reiniciar o PC.
- **TypeScript 6.0.3** (e não 7.x): o `typescript-eslint` exige TS < 6.1; o template do Expo SDK 57 também usa 6.0.3.
- **Expo SDK 57** (React Native 0.86.3, React 19.2.3): SDK `latest`, suportado pelo Expo Go das lojas.
- **npm 12** bloqueia scripts de instalação: `esbuild` e `unrs-resolver` aprovados explicitamente (`allowScripts`).
- **Build**: cada serviço vira um único `dist/index.js` (esbuild); Dockerfile único parametrizado por `PACOTE`; código somente leitura na imagem.
- **Database per service**: cada usuário `svc_*` enxerga só o próprio schema; migrações Drizzle com advisory lock e pós-processamento.
- **IQAr**: faixas da página oficial da CETESB (consultada em 27/09/2026); aplicadas à média móvel curta das leituras simuladas.
- **Gráficos**: paleta validada para daltonismo com o script da skill de visualização; barras em cor única para as 10 categorias.
- **Playwright**: Chromium instalado em `tests/.cache` (nada instalado globalmente); iPhone 14 emulado no Chromium.
- **Rede do PC**: Ethernet, IP 192.168.68.104, perfil **Público** — `COMO_TESTAR.md` explica como marcar como Privada e liberar 8080/8081.

## Defeitos encontrados pelos testes e corrigidos

1. 422 em vez de 403 (autorização movida para `onRequest`).
2. Escalonamento de alertas suprimido pela deduplicação (severidade maior agora é emitida).
3. Imagens Docker grandes (`chown -R`) — de 494 MB para 368 MB.
4. SRID perdido e FKs com `"public".` nas migrações do drizzle-kit.
5. Tela branca na web (hidratação síncrona do Zustand).
6. Tela de login duplicada na pilha de navegação.
7. `keepalive_requests` do Nginx gerando erros de socket sob carga.
8. Layout: seletor de raio e zoom inicial do mapa.
9. Rate limit do login contava só por IP (corpo ainda não lido no `onRequest`) — todos os usuários de uma mesma rede dividiam o limite.
10. (defeito do teste) Teste distribuído 3 sorteava a invasão perto de outra recente e o alerta era deduplicado — ponto agora escolhido longe dos alertas recentes.

## Limitações

- Sem Android SDK/`adb` neste PC: os prints nativos (item 9.7, opcional) não foram gerados; o teste no celular real está no `COMO_TESTAR.md` (prints em `registros/manual/`).
- Notificações são locais (Expo Go); push remoto exigiria development build.
- Teste de carga com todos os containers no mesmo computador (serve para comparar 1 × 2 réplicas).

## Próximo passo

Nenhuma pendência obrigatória. Opcional: o aluno executa o checklist manual do `COMO_TESTAR.md` no próprio celular
e salva os prints em `registros/manual/` (depois `node tests/scripts/gerar-relatorios.mjs` para atualizar a galeria).

## Como retomar

1. Ler este arquivo e `git log --oneline`.
2. `scripts\iniciar.ps1` para subir tudo; `scripts\coletar-evidencias.ps1` para regenerar as evidências.
