# Relatório de testes — EcoRadar Urbano

Gerado em 27/09/2026, 23:56:38 a partir das execuções reais registradas nesta pasta. Nenhum número foi digitado à mão:
todos vêm dos arquivos de resultado (JSON/saída) indicados em cada seção.

## Resumo

| Tipo de teste | Ferramenta | Resultado | Evidência |
|---|---|---|---|
| Unitários (regras de negócio) | Vitest + v8 | **105 testes passaram** em 10 arquivos · cobertura de linhas **97,47%** (branches 88,6%, funções 89,92%) | `testes/unitarios/` |
| Integração (stack real via gateway) | Vitest + fetch + Socket.IO | **20/20** passaram | `testes/integracao/` |
| E2E (app web em viewport de celular) | Playwright | **16/16** passaram (Pixel 7 e iPhone 14) · 70 prints · 18 vídeos | `testes/e2e/`, `screenshots/web-mobile/`, `videos/` |
| Sistema distribuído | script próprio + Docker | **5/5** cenários passaram | `testes/distribuido/` |
| Carga leve | autocannon | 1 réplica: **1474 req/s** (p95 41 ms) · 2 réplicas: **2498 req/s** (p95 35 ms) · variação +69.5% | `testes/carga/` |
| Qualidade de código | tsc + ESLint + expo lint | Backend: checagem de tipos (tsc --noEmit): sem erros · Backend: lint (ESLint): sem erros · App: checagem de tipos (tsc --noEmit): sem erros · App: lint (expo lint): sem erros · Testes: checagem de tipos: sem erros | `testes/qualidade/` |

## 1. Testes unitários (Vitest)

**Objetivo:** validar as regras de negócio isoladas: cálculo do IQAr (faixas da CETESB), inversão térmica, nível dos córregos, motor de regras de alertas (inclusive deduplicação, escalonamento e concentração em raio), validações Zod, idempotência, transições de status, publicador do outbox com broker simulado, backoff exponencial, cache com TTL, circuit breaker da Open-Meteo e geração de relatórios (estatísticas, CSV e PDF).

**Procedimento:** `npx vitest run --coverage` em `backend/` (script `tests/scripts/testes-unitarios.mjs`).

**Resultado esperado:** todos os testes passam e a cobertura das regras de negócio fica acima de 70%. **Obtido:** 105 testes passaram, 0 falharam; cobertura de linhas 97,47%.

```
Cobertura dos testes unitários (regras de negócio) — 27/09/2026, 23:49:41

Testes     : 105 passaram em 10 arquivos (código de saída 0)
Linhas     : 97.47% (501/514)
Instruções : 95.15% (589/619)
Funções    : 89.92% (116/129)
Branches   : 88.6% (451/509)

Meta da APS: >= 70% nas regras de negócio. Relatório HTML: cobertura/index.html

Por arquivo (linhas):
  packages/shared/src/backoff.ts                                   100%
  packages/shared/src/cache.ts                                     100%
  packages/shared/src/erros.ts                                     75%
  packages/shared/src/eventos.ts                                   100%
  packages/shared/src/geo.ts                                       100%
  services/alertas-service/src/dominio/motor-regras.ts             100%
  services/ambiental-service/src/dominio/avaliacao.ts              100%
  services/ambiental-service/src/dominio/indicadores.ts            97.67%
  services/ambiental-service/src/dominio/iqar.ts                   100%
  services/ambiental-service/src/dominio/leitura.ts                100%
  services/ambiental-service/src/integracoes/open-meteo.ts         98.43%
  services/auth-service/src/dominio/validacoes.ts                  95.45%
  services/ocorrencias-service/src/dominio/publicador-outbox.ts    93.75%
  services/ocorrencias-service/src/dominio/regras.ts               100%
  services/relatorios-service/src/dominio/relatorio.ts             100%
  services/sensor-simulator/src/dominio/modelo.ts                  100%
```

## 2. Testes de integração (stack real, via gateway http://localhost:8080)

**Objetivo:** percorrer o fluxo completo de ponta a ponta e validar as respostas de erro padronizadas.

**Procedimento:** `npm run integracao` (em `tests/`): cadastro → login → ocorrência com foto (multipart) → reenvio com a mesma chave → listagem por raio (PostGIS) → confirmação → mudança de status por agente → estatísticas (CQRS) → exportação PDF/CSV → dados ambientais → cenário do simulador gerando alerta recebido por um cliente Socket.IO; erros 401, 403, 404, 409, 413, 415, 422 e 429 (limite de tentativas de login por e-mail).

| Teste | Resultado | Duração |
|---|---|---|
| 1. cadastro de novo cidadão devolve token e perfil CIDADAO | ✅ | 67 ms |
| 2. login com as credenciais cadastradas | ✅ | 66 ms |
| 3. cria ocorrência com foto (multipart) e a foto fica disponível em /uploads | ✅ | 49 ms |
| 4. reenvio com a mesma idempotencyKey NÃO duplica (200 + mesmo id) | ✅ | 26 ms |
| 5. lista por raio (PostGIS ST_DWithin) com distância calculada | ✅ | 45 ms |
| 6. confirmação colaborativa: outro cidadão confirma uma única vez; o autor não pode confirmar | ✅ | 28 ms |
| 7. agente altera o status (com comentário) e o histórico é gravado | ✅ | 34 ms |
| 8. estatísticas (CQRS, alimentadas por eventos) refletem a nova ocorrência e o status | ✅ | 1056 ms |
| 9. exporta PDF e CSV (arquivos salvos como evidência) | ✅ | 560 ms |
| 10. dados ambientais: IQAr das estações e integração Open-Meteo | ✅ | 20 ms |
| 11. cenário do simulador gera alerta recebido por um cliente Socket.IO | ✅ | 534 ms |
| 401 sem token e com token inválido | ✅ | 8 ms |
| 401 para senha incorreta | ✅ | 64 ms |
| 403 quando um cidadão tenta alterar status ou trocar perfis | ✅ | 9 ms |
| 404 para ocorrência inexistente e rota inexistente | ✅ | 6 ms |
| 422 com detalhes por campo para dados inválidos | ✅ | 10 ms |
| 413 para foto acima de 5 MB e 415 para arquivo que não é imagem | ✅ | 129 ms |
| 409 para e-mail já cadastrado e chave de idempotência de outro usuário | ✅ | 68 ms |
| 429 após 10 logins errados por minuto para o MESMO e-mail, sem bloquear outros usuários do mesmo IP | ✅ | 693 ms |
| todas as respostas trazem X-Request-Id e o formato { erro: { codigo, mensagem, requestId } } | ✅ | 5 ms |

## 3. Testes E2E (Playwright)

**Objetivo:** demonstrar o app funcionando como o usuário vê, em viewport de celular, com prints de cada passo e vídeo.

**Procedimento:** build web exportado (`npx expo export --platform web`) servido pelo gateway; Playwright com emulação do **Pixel 7** (roteiro completo) e do **iPhone 14** (navegação pelas telas principais), geolocalização simulada em São Paulo, vídeo ligado. O modo offline usa `context.setOffline(true)`; o tempo real e o alerta usam dois contextos de navegador independentes.

| Etapa | Aparelho | Resultado | Duração |
|---|---|---|---|
| 01 · onboarding, cadastro e login (com erro de senha) | pixel-7 | ✅ | 9.1 s |
| 02 · mapa com ocorrências, mananciais e estações; filtro por categoria | pixel-7 | ✅ | 6.5 s |
| 03 · registro completo com foto e aviso de área de manancial | pixel-7 | ✅ | 4.6 s |
| 04 · detalhe da ocorrência e confirmação colaborativa | pixel-7 | ✅ | 1.8 s |
| 05 · qualidade ambiental: IQAr, Open-Meteo e gráfico de 24 h | pixel-7 | ✅ | 2.2 s |
| 06 · tempo real entre dois dispositivos (Socket.IO) | pixel-7 | ✅ | 5.7 s |
| 07 · alerta disparado pelo ADMIN chega ao cidadão (banner + badge) | pixel-7 | ✅ | 4.3 s |
| 08 · modo offline: fila pendente, sincronização e idempotência | pixel-7 | ✅ | 36.2 s |
| 09 · relatórios com gráficos e exportação PDF/CSV | pixel-7 | ✅ | 3.4 s |
| 10 · status do sistema: microsserviços online, balanceamento e integrações | pixel-7 | ✅ | 2.2 s |
| 11 · painel do agente alterando status | pixel-7 | ✅ | 2.3 s |
| 12 · tema escuro em várias telas | pixel-7 | ✅ | 7.4 s |
| N · navegação pelas telas principais | pixel-7 | ✅ | 11.1 s |
| N · painel do agente em outro aparelho | pixel-7 | ✅ | 1.0 s |
| N · navegação pelas telas principais | iphone-14 | ✅ | 10.9 s |
| N · painel do agente em outro aparelho | iphone-14 | ✅ | 1.0 s |

Observação: o iPhone 14 é emulado no Chromium (viewport, user agent e toque), pois o WebKit do Playwright não foi instalado; o comportamento de layout é o mesmo do app web.

## 4. Testes de sistema distribuído

**Procedimento:** `npm run distribuido` — o script manipula os containers com `docker compose stop/start` e verifica o comportamento pelo gateway, gravando log detalhado, imagem do log e prints do app.

| Teste | Objetivo | Resultado esperado | Resultado obtido | Evidência |
|---|---|---|---|---|
| Balanceamento de carga | Distribuir a carga entre as réplicas | X-Instance-Id alterna entre ocorrencias-1 e ocorrencias-2 | ✅ 20 requisições: ocorrencias-2=10, ocorrencias-1=10 | `testes/distribuido/1_balanceamento.*` |
| Tolerância a falha de réplica | Continuar atendendo com uma réplica parada | 100% de sucesso durante a falha; réplica volta ao rodízio | ✅ réplica 2 parada: 20/20 sucesso (todas em ocorrencias-1); religada: {"ocorrencias-1":10,"ocorrencias-2":10} | `testes/distribuido/2_falha_de_replica.*, 2a_app_status_uma_replica.png` |
| Queda do broker + outbox | Não perder eventos com o broker fora (~20 s) | eventos ficam no outbox e são publicados na volta; relatórios e alertas atualizados | ✅ 5 eventos pendentes com o broker fora ~20 s; outbox zerado e relatórios 65→70 após religar; alerta de manancial gerado | `testes/distribuido/3_queda_do_broker.*, 3a/3b_app_status_*.png` |
| Falha da Open-Meteo + circuit breaker | Degradação graciosa com a Open-Meteo fora | circuito ABERTO, app mostra dados em cache; recupera sozinho | ✅ circuito ABERTO e fonte "cache" durante a falha; FECHADO e "ao_vivo" após o resetTimeout | `testes/distribuido/4_falha_integracao_externa.*, 4a/4b_app_*.png` |
| Rastreamento por X-Request-Id | Rastrear uma requisição entre serviços | o mesmo X-Request-Id nos logs do gateway, serviço e consumidores | ✅ ID encontrado em: relatorios-service-1, ocorrencias-service-2-1, alertas-service-1, gateway-1 | `testes/distribuido/rastreamento_request_id.txt, 5_rastreamento_request_id.*` |

## 5. Teste de carga leve (autocannon)

Executado em 27/09/2026, 23:55:32 com autocannon: 50 conexões simultâneas, 30 s por cenário (após 5 s de aquecimento), via gateway Nginx (http://localhost:8080).
Latências calculadas a partir do tempo de cada resposta registrado durante o teste.

| Cenário | Requisições | Req/s (média) | p50 (ms) | p95 (ms) | p99 (ms) | Média (ms) | Máx. (ms) | Erros/timeouts | Respostas não-2xx | Amostra de X-Instance-Id |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 réplica | 44209 | 1474 | 33 | 41 | 46 | 34 | 226 | 0 | 0 | ocorrencias-1: 20 |
| 2 réplicas | 74916 | 2498 | 20 | 35 | 40 | 20 | 205 | 0 | 0 | ocorrencias-2: 10, ocorrencias-1: 10 |

**Variação da vazão com 2 réplicas: +69.5%** em relação a 1 réplica.

Observação: todos os containers (banco, broker, réplicas e gerador de carga) rodam no mesmo computador; o ganho
de escalar horizontalmente fica limitado pelos recursos compartilhados (CPU e PostgreSQL). Em produção, as réplicas
ficariam em máquinas distintas.

![Gráfico](testes/carga/grafico-carga.png)

## 6. Problemas encontrados e corrigidos durante os testes

| # | Problema (como foi detectado) | Causa | Correção |
|---|---|---|---|
| 1 | Cidadão recebia **422** em vez de **403** ao tentar alterar status (teste de fumaça) | No Fastify a validação do corpo roda antes do `preHandler` | Autorização movida para o hook `onRequest` em todos os serviços |
| 2 | Alerta de poluição "Péssima" era suprimido após um alerta "Ruim" (cenário do simulador) | A deduplicação de 30 min não considerava a piora | Escalonamento: severidade maior não é considerada repetição (teste unitário incluído) |
| 3 | Imagens Docker com 494 MB | `chown -R` duplicava a camada do `node_modules` | Código somente leitura para o usuário `node`; imagens com 368 MB |
| 4 | Migração com `geometry(point)` sem SRID e FKs `"public".tabela` | Limitações do drizzle-kit com PostGIS e schemas por serviço | Tipo customizado `geometry(Point, 4326)` e pós-processamento das migrações |
| 5 | App web abria em branco | Hidratação síncrona do Zustand (localStorage) referenciava o store antes de existir | `persist.hasHydrated()` + `onFinishHydration` com `useSyncExternalStore` |
| 6 | Duas telas de login na pilha após sair (E2E) | `router.replace` mantinha telas anteriores | Reinício da pilha ao entrar/sair (`reiniciarNavegacao`) |
| 7 | 6 erros de socket no teste de carga com 2 réplicas (todas as respostas eram 200) | Nginx fecha a conexão keep-alive após 1000 requisições (padrão) | `keepalive_requests 10000`; nova execução sem erros e com latências menores |
| 8 | Seletor de raio estourava a largura em 375 px e zoom inicial do mapa muito aberto (inspeção visual dos prints) | Layout | 4 opções de raio e zoom 11 na cidade |
| 9 | Logins de usuários diferentes recebiam **429** na execução completa dos testes | O rate limit rodava no hook `onRequest`, antes da leitura do corpo: a chave "IP + e-mail" ficava só com o IP e todos os usuários de uma mesma rede (NAT) dividiam 10 tentativas/min | Limite aplicado no `preHandler`; novo teste de integração prova 429 para o e-mail atacado sem bloquear outro usuário do mesmo IP |
| 10 | Teste distribuído 3 (queda do broker) falhou uma vez esperando o alerta de manancial | Defeito do **teste**, não do sistema: a invasão era sorteada a ~1 km de outra registrada minutos antes (seed/E2E) e o alerta foi corretamente suprimido pela deduplicação (regra 6), como mostrou o log do alertas-service | O teste escolhe um ponto dentro do manancial (confirmado via PostGIS) a mais de 1,5 km dos alertas recentes e passou a salvar o log mesmo quando falha |

## 7. Limitações e observações

- **Android nativo:** não há Android SDK/`adb` neste computador; os prints nativos (item 9.7, opcional) não foram gerados. O guia `COMO_TESTAR.md` descreve o teste no celular com o Expo Go (prints em `registros/manual/`).
- **Notificações:** o app usa notificações **locais** (funcionam no Expo Go); notificações push remotas exigiriam um development build.
- **IQAr:** a metodologia oficial usa médias de 24 h/8 h/1 h; para demonstração em tempo real, as faixas da CETESB são aplicadas à média móvel curta das leituras simuladas.
- **Carga:** todos os containers e o gerador de carga rodam no mesmo computador; os números servem para comparar 1 × 2 réplicas, não como capacidade absoluta.
- **Mananciais:** polígonos aproximados, desenhados para fins didáticos.
