"""Seções 5 a 10 do trabalho escrito (projeto, código, apresentação, considerações, bibliografia e ficha)."""
from pathlib import Path


# =====================================================================================
# 5 PROJETO
# =====================================================================================
def secao_projeto(c, fig: Path, reg: Path):
    c.h1("Projeto (estrutura e módulos) do programa", "projeto")
    c.h2("Arquitetura geral", "arquitetura")
    c.p(
        "A {F:arquitetura} mostra a arquitetura em camadas. O aplicativo fala apenas com o gateway Nginx, única porta "
        "pública (8080), que encaminha cada prefixo de URL ao serviço responsável, distribui as chamadas de "
        "`/api/ocorrencias` entre as duas réplicas e mantém aberta a conexão WebSocket de `/socket.io`. Os seis "
        "microsserviços rodam numa rede interna do Docker e compartilham apenas a infraestrutura: o RabbitMQ, para "
        "eventos e leituras de sensores, e o PostgreSQL, em que cada serviço acessa somente o próprio schema. O código "
        "comum — cliente AMQP resiliente, envelopes de eventos, erros padronizados, autenticação, __backoff__, cache e "
        "o servidor Fastify base com `/health`, `/ready`, `X-Request-Id` e Swagger — fica no pacote `packages/shared`."
    )
    c.figura("arquitetura", "Arquitetura do EcoRadar Urbano", fig / "arquitetura.png", 10.0)
    c.h2("Microsserviços")
    c.p(
        "Os serviços somam 28 __endpoints__ de negócio, todos documentados em OpenAPI (Swagger UI em "
        "`/api/<serviço>/docs`) a partir dos mesmos esquemas Zod que validam as requisições:"
    )
    c.lista([
        "**auth-service** — cadastro, login e perfis (`POST /api/auth/registrar`, `POST /api/auth/login`, "
        "`GET/PATCH /api/auth/me` e, para o administrador, `GET /api/auth/usuarios` e `PATCH "
        "/api/auth/usuarios/{id}/perfil`). Senhas com bcrypt (custo 10) e um __hash__ “fantasma” para que o tempo de "
        "resposta não revele quais e-mails existem; JWT válido por 12 h. Não publica eventos. Schema `auth`;",
        "**ocorrencias-service** (2 réplicas) — registro, listagem, detalhe, confirmação e mudança de status "
        "(`/api/ocorrencias`, `/{id}`, `/{id}/confirmar`, `/{id}/status`), mananciais em GeoJSON, verificação de "
        "ponto e estado do outbox; serve as fotos em `/uploads`. Publica `ocorrencia.criada`, "
        "`ocorrencia.confirmada` e `ocorrencia.status_alterado` pelo outbox. Schema `ocorrencias`;",
        "**ambiental-service** — assina as leituras MQTT, calcula IQAr, inversão térmica e situação dos córregos, "
        "consulta a Open-Meteo e expõe estações, séries de leituras, resumo e estado das integrações. Publica "
        "`ambiental.limite_excedido` e `ambiental.inversao_termica`. Schema `ambiental`;",
        "**alertas-service** — consome `ocorrencia.*` e `ambiental.*`, aplica o motor de regras, grava os alertas, "
        "transmite-os por Socket.IO e publica `alerta.criado` e `alerta.encerrado`; lista, detalha e encerra alertas e "
        "expira os ativos há mais de 12 h. Schema `alertas`;",
        "**relatorios-service** — consome `ocorrencia.*` e `alerta.*` para manter a visão de leitura (CQRS) e "
        "oferece estatísticas e exportação em CSV e PDF. Schema `relatorios`;",
        "**sensor-simulator** — seis estações virtuais em bairros de São Paulo (Sé, Pinheiros, Ipiranga, Itaquera, "
        "Santana e Santo Amaro) que publicam por MQTT a cada 5 s; o administrador pode forçar cenários de "
        "alagamento, poluição crítica e inversão térmica. Não usa banco.",
    ], marcador="ponto")
    c.h2("Comunicação por eventos")
    c.p(
        "A {F:eventos} detalha quem publica e quem consome cada evento. Todos os eventos usam o mesmo envelope — "
        "identificador, tipo, versão, data, serviço e instância de origem, `correlationId` e dados — validado com "
        "Zod na chegada. As filas são duráveis e cada uma tem uma fila de mensagens mortas (`<fila>.dlq`) ligada à "
        "__exchange__ `ecoradar.dlx`. O serviço de alertas processa uma mensagem por vez (__prefetch__ 1), preservando a "
        "ordem das regras de deduplicação; o de relatórios recebe até 20 mensagens por vez (__prefetch__ 20)."
    )
    c.figura("eventos", "Eventos publicados e consumidos", fig / "eventos.png", 8.0)
    c.h2("Fluxos principais")
    c.p(
        "A {F:seq_ocorrencia} mostra o registro de uma ocorrência. A requisição passa pelo gateway, que escolhe uma "
        "réplica e acrescenta o `X-Request-Id`. A réplica verifica a chave de idempotência e o manancial, grava "
        "ocorrência, histórico e evento numa única transação e responde 201 (ou 200 com o registro original, se for "
        "um reenvio). O publicador do outbox envia o evento ao broker a cada segundo; alertas e relatórios o consomem "
        "de forma independente, e o serviço de alertas avisa todos os aparelhos conectados."
    )
    c.figura("seq_ocorrencia", "Sequência do registro de uma ocorrência", fig / "sequencia_ocorrencia.png", 14.6)
    c.p(
        "A {F:seq_sensor} mostra o caminho de uma leitura de sensor. O simulador publica por MQTT; o serviço ambiental "
        "valida a mensagem, atualiza a média móvel, calcula o IQAr, avalia inversão e córrego e grava a leitura. Se "
        "algum limite foi ultrapassado, publica um evento — no máximo um por estação e indicador por minuto, até a "
        "condição normalizar — e o serviço de alertas decide, pelas regras e pela deduplicação, se um novo alerta deve "
        "ser emitido."
    )
    c.figura("seq_sensor", "Sequência de uma leitura de sensor até o alerta", fig / "sequencia_sensor.png", 11.6)
    c.h2("Modelo de dados")
    c.p(
        "O banco tem um schema e um usuário por serviço ({F:modelo_dados}). Não há chaves estrangeiras entre schemas: "
        "a única ligação entre eles são os eventos. As chaves são UUID (exceto leituras, com identidade sequencial), "
        "as tabelas de __inbox__ (`eventos_processados`) garantem o consumo idempotente e o campo `versao` impede que "
        "eventos atrasados sobrescrevam dados mais novos nas visões dos serviços de alertas e de relatórios."
    )
    c.figura("modelo_dados", "Modelo de dados simplificado por schema", fig / "modelo_dados.png", 12.0)
    c.h2("Estrutura do aplicativo e navegação")
    c.p(
        "O código do aplicativo fica em `mobile/src`: `app` contém as 14 telas do Expo Router; `componentes`, os "
        "componentes reutilizáveis, inclusive o mapa por plataforma; `api`, o cliente Axios e as consultas do "
        "TanStack Query; `estado`, os __stores__ do "
        "Zustand (sessão, preferências, conexão e fila offline); `servicos`, tempo real, sincronização, localização, "
        "mídia, notificações e exportação, com variantes `.web.ts` quando necessário; além de `tema` e `utils`. A "
        "{F:navegacao} mostra a navegação: a rota inicial decide entre onboarding, login e abas; a partir das abas "
        "abrem-se o registro, o detalhe da ocorrência e, pelo perfil, relatórios, status do sistema, envios pendentes e "
        "o painel do agente."
    )
    c.figura("navegacao", "Navegação entre as telas do aplicativo", fig / "navegacao.png", 8.2)
    c.h2("Tratamento de erros e resiliência", "erros")
    c.lista([
        "**respostas padronizadas**: todo erro segue o formato `{ erro: { codigo, mensagem, detalhes, requestId } }`, "
        "com mensagens em português e detalhes por campo nas validações (422); o gateway também devolve JSON em 413 e 503;",
        "**validação e autorização**: esquemas Zod em todas as rotas; a verificação de perfil roda no __hook__ "
        "`onRequest`, antes da validação do corpo; fotos são aceitas só até 5 MB e com tipo confirmado pelos bytes "
        "iniciais do arquivo;",
        "**mensageria**: reconexão AMQP e MQTT com __backoff__ exponencial e __jitter__ (1 s a 30 s), reassinatura "
        "automática das filas, __publisher confirms__, fila de mensagens mortas e consumidores idempotentes;",
        "**integração externa**: __timeout__ de 5 s, __circuit breaker__ e último valor válido persistido no banco;",
        "**aplicativo**: três tentativas com espera crescente em falhas transitórias, fila offline, cache persistido, "
        "__error boundary__ para falhas de renderização e mensagens amigáveis por código HTTP;",
        "**operação**: __health checks__ no Compose, encerramento gracioso ao receber SIGTERM e limpeza periódica do "
        "outbox e das tabelas de __inbox__.",
    ], marcador="ponto")


# =====================================================================================
# 6 RELATÓRIO COM AS LINHAS DE CÓDIGO
# =====================================================================================
def secao_codigo(c, fig: Path, reg: Path):
    c.h1("Relatório com as linhas de código do programa", "codigo")
    c.h2("Métricas do código")
    c.p(
        "O projeto tem **16.920 linhas em 177 arquivos** de código-fonte e testes (15.504 não vazias), sem contar "
        "dependências, __builds__ e arquivos gerados ({T:metricas}). O aplicativo é o maior módulo (5.497 linhas); "
        "no backend, os serviços de ocorrências e ambiental concentram a lógica mais extensa."
    )
    c.tabela(
        "metricas",
        "Linhas de código por módulo",
        ["Módulo", "Arquivos", "Linhas", "Não vazias"],
        [
            ["Pacote compartilhado", "18", "1.496", "1.354"],
            ["auth-service", "6", "486", "444"],
            ["ocorrencias-service", "10", "1.464", "1.337"],
            ["ambiental-service", "15", "1.603", "1.453"],
            ["alertas-service", "6", "859", "782"],
            ["relatorios-service", "7", "937", "861"],
            ["sensor-simulator", "4", "417", "378"],
            ["Seed (dados de demonstração)", "5", "647", "598"],
            ["Aplicativo móvel (mobile/src)", "61", "5.497", "5.089"],
            ["Testes (integração, E2E, distribuído, carga)", "26", "2.703", "2.493"],
            ["Scripts de automação", "15", "489", "437"],
            ["Gateway (Nginx) e infraestrutura", "4", "322", "278"],
            ["**Total**", "**177**", "**16.920**", "**15.504**"],
        ],
        [8.2, 2.4, 2.6, 2.8],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/metricas_codigo.txt.",
        alinhar=["esq", "dir", "dir", "dir"],
    )
    c.p(
        "Por linguagem, predominam TypeScript (11.050 linhas) e TSX (3.868). Os trechos a seguir concentram as "
        "decisões de sistemas distribuídos; linhas omitidas aparecem como “(…)”."
    )
    c.h2("Trechos selecionados")
    c.h3("Motor de regras de alertas")
    c.p(
        "O motor recebe um evento e devolve os alertas candidatos segundo cinco regras: IQAr ruim ou pior, córrego "
        "acima da cota, inversão térmica, três ou mais ocorrências da mesma categoria em 1 km e 60 min e invasão ou "
        "desmatamento em manancial, com os limites centralizados no objeto `PARAMETROS` do mesmo arquivo. A {L:motor} "
        "mostra a sexta regra, a deduplicação: um alerta do mesmo tipo, na mesma área e há menos de 30 min é "
        "suprimido — exceto quando a severidade aumentou, o que caracteriza escalonamento."
    )
    c.codigo("motor", "Deduplicação e escalonamento de alertas",
             "backend/services/alertas-service/src/dominio/motor-regras.ts", [(212, 227)])
    c.h3("Publicador do outbox")
    c.p(
        "A {L:outbox} mostra o ciclo do publicador. A fonte trava as linhas pendentes com `FOR UPDATE SKIP LOCKED`, "
        "de modo que as duas réplicas nunca publicam o mesmo evento; o lote é interrompido no primeiro erro para "
        "preservar a ordem, e as falhas reagendam o ciclo com __backoff__ de 1 a 15 s."
    )
    c.codigo("outbox", "Ciclo do publicador do outbox",
             "backend/services/ocorrencias-service/src/dominio/publicador-outbox.ts", [(54, 69)])
    c.h3("Idempotência na criação de ocorrências")
    c.p(
        "Na {L:idempotencia}, a chave enviada pelo aplicativo decide entre criar (201), devolver o original (200, com "
        "`X-Idempotent-Replay: true`) ou recusar uma chave de outro usuário (409). O segundo bloco trata a corrida entre "
        "réplicas: se as duas tentarem gravar a mesma chave, a restrição única do banco rejeita a segunda, que devolve o "
        "registro vencedor."
    )
    c.codigo("idempotencia", "Decisão de idempotência e corrida entre réplicas",
             "backend/services/ocorrencias-service/src/rotas.ts", [(87, 96), (158, 166)])
    c.h3("Consultas PostGIS por manancial e por raio")
    c.p(
        "A {L:postgis} traz as duas consultas espaciais. `ST_Contains` verifica se o ponto está em algum polígono de "
        "manancial; na listagem, `ST_DWithin` sobre `geography` filtra pelo raio em metros usando o índice GiST, e "
        "`ST_Distance` calcula a distância em quilômetros exibida no aplicativo."
    )
    c.codigo("postgis", "Ponto-em-polígono e busca por raio",
             "backend/services/ocorrencias-service/src/repositorio.ts", [(62, 69), (124, 133)])
    c.h3("Cálculo do IQAr")
    c.p(
        "A {L:iqar} implementa a interpolação linear da {T:iqar} para um poluente (o trecho omitido extrapola acima "
        "da última faixa, com teto de 500); a função `calcularIqar` aplica o cálculo a cada poluente e adota o maior."
    )
    c.codigo("iqar", "Índice de um poluente por interpolação na faixa",
             "backend/services/ambiental-service/src/dominio/iqar.ts", [(80, 84), (92, 99)])
    c.h3("Circuit breaker da Open-Meteo")
    c.p(
        "Na {L:breaker}, o opossum abre o circuito com 50% de falhas (mínimo de três chamadas em 60 s) e testa a API "
        "de novo após 30 s; em falha, `obter` devolve o último valor com a fonte “cache” em vez de um erro."
    )
    c.codigo("breaker", "Configuração do breaker e degradação graciosa",
             "backend/services/ambiental-service/src/integracoes/open-meteo.ts", [(99, 106), (221, 224), (230, 230), (237, 238)])
    c.h3("Gateway Nginx: balanceamento e WebSocket")
    c.p(
        "A {L:nginx} mostra o grupo de réplicas com __round-robin__ (uma falha tira a réplica do rodízio por 5 s), a "
        "repetição da requisição na próxima réplica em erro de conexão ou 502/503 e o repasse dos cabeçalhos "
        "`Upgrade` e `Connection` que transformam a conexão HTTP em WebSocket."
    )
    c.codigo("nginx", "Upstream com duas réplicas, repetição e proxy WebSocket", "gateway/nginx.conf",
             [(66, 71), (117, 119), (167, 172)], comentario="#")
    c.h3("Fila offline do aplicativo")
    c.p(
        "Na {L:fila}, cada registro recebe uma chave UUID antes de sair do aparelho. Sem conexão, ou em falha de rede "
        "ou erro 502 ou superior, o item vai para a fila persistente e é reenviado depois com a mesma chave."
    )
    c.codigo("fila", "Registro com fila offline", "mobile/src/servicos/sincronizacao.ts", [(42, 57)])
    c.h3("Componente de mapa por plataforma")
    c.p(
        "A {L:mapa} é o contrato comum às duas implementações do mapa: as telas importam `componentes/mapa/Mapa` e o "
        "Metro resolve `Mapa.native.tsx` (react-native-maps) no celular e `Mapa.web.tsx` (Leaflet) no navegador."
    )
    c.codigo("mapa", "Contrato único do mapa para as duas plataformas", "mobile/src/componentes/mapa/Mapa.d.ts", [(1, 8)])


# =====================================================================================
# 7 APRESENTAÇÃO DO PROGRAMA EM FUNCIONAMENTO
# =====================================================================================
def secao_apresentacao(c, fig: Path, reg: Path):
    px = reg / "screenshots" / "web-mobile" / "pixel-7"
    ip = reg / "screenshots" / "web-mobile" / "iphone-14"
    dist = reg / "testes" / "distribuido"
    c.h1("Apresentação do programa em funcionamento", "apresentacao")
    c.h2("Como as evidências foram produzidas")
    c.p(
        "Todas as imagens desta seção foram geradas por execuções reais registradas em `registros/`. O aplicativo foi "
        "exportado para a web (`expo export`), servido pelo gateway e operado pelo Playwright com emulação do Pixel 7 "
        "(roteiro completo) e do iPhone 14 (telas principais), com geolocalização simulada em São Paulo. Os prints "
        "de infraestrutura, os logs dos testes de falha e os relatórios exportados vieram dos scripts de teste. "
        "Os **18 vídeos** das execuções, o relatório HTML do Playwright (`registros/testes/e2e/relatorio-html/`), o "
        "relatório de cobertura e a galeria completa com 70 prints (`registros/index.html`) acompanham o trabalho."
    )
    c.p(
        "O computador de desenvolvimento não tinha Android SDK nem emulador; por isso os prints são do aplicativo web "
        "em __viewport__ de celular. O código nativo foi verificado com a compilação dos pacotes Android e iOS "
        "(`registros/build/08_expo-export-nativo.log`), e o roteiro de teste no celular com o Expo Go está no "
        "`COMO_TESTAR.md`. [REVISAR: se o grupo registrar os prints no celular real em registros/manual/, "
        "incluí-los nesta seção.]"
    )
    c.p(
        "Além das funções básicas de registro e consulta, o grupo destaca como **funções extras**: tempo real entre "
        "aparelhos, alertas automáticos com deduplicação e escalonamento, registro offline sem duplicidade, aviso de "
        "área de manancial, confirmação colaborativa, painel do agente, integração com dados reais da Open-Meteo, "
        "relatórios em PDF e CSV, tela de status da arquitetura, simulador de cenários, tema escuro e documentação "
        "OpenAPI de todos os serviços."
    )
    c.h2("Acesso, cadastro e tratamento de erros")
    c.p(
        "Na {F:acesso}, o onboarding apresenta o aplicativo no primeiro acesso; o cadastro valida cada campo antes do "
        "envio (nome, e-mail e senha com no mínimo oito caracteres, letras e números); e o login com senha errada "
        "mostra a mensagem do servidor sem revelar se o e-mail existe."
    )
    c.figuras_lado_a_lado("acesso", "Onboarding, validação do cadastro e erro de login", [
        (px / "01_onboarding_1.png", "Onboarding"),
        (px / "05_cadastro_validacao.png", "Validação"),
        (px / "08_login_senha_invalida.png", "Senha inválida"),
    ])
    c.h2("Mapa ambiental")
    c.p(
        "O mapa ({F:mapa}) mostra as ocorrências com cor pela severidade e ícone pela categoria, as estações com o valor "
        "do IQAr na cor da faixa CETESB e os polígonos dos mananciais Guarapiranga e Billings. A legenda explica a "
        "codificação e os filtros por categoria atualizam o mapa na hora; o selo “AO VIVO” indica a conexão em tempo "
        "real."
    )
    c.figuras_lado_a_lado("mapa", "Mapa com ocorrências, estações e mananciais; legenda; filtro por alagamento", [
        (px / "10_mapa_ocorrencias_mananciais_estacoes.png", "Visão geral"),
        (px / "11_mapa_legenda.png", "Legenda"),
        (px / "12_mapa_filtro_alagamento.png", "Filtro"),
    ])
    c.h2("Registro de ocorrência com foto, GPS e manancial")
    c.p(
        "A {F:registro} mostra o registro de uma invasão de manancial: categoria, severidade, descrição e foto; a "
        "localização obtida pelo GPS e ajustável no mapa, com o aviso de que o ponto está na área de proteção da "
        "Guarapiranga; e o detalhe logo após o envio, já com o banner do alerta prioritário gerado pela regra de "
        "manancial."
    )
    c.figuras_lado_a_lado("registro", "Formulário, aviso de manancial e alerta prioritário após o registro", [
        (px / "14_registro_formulario_foto.png", "Formulário"),
        (px / "15_registro_localizacao_aviso_manancial.png", "Local e aviso"),
        (px / "16_registro_concluido_detalhe.png", "Registrada"),
    ])
    c.h2("Detalhe, confirmação colaborativa e busca por proximidade")
    c.p(
        "No detalhe ({F:detalhe}) aparecem a foto, o autor, as coordenadas, o mapa e o histórico de status. Outro "
        "cidadão pode confirmar a ocorrência uma única vez, o que aumenta o contador usado para priorizar o "
        "atendimento. A lista “perto de mim”, capturada no iPhone 14, usa a consulta por raio do PostGIS e mostra a "
        "distância de cada ocorrência."
    )
    c.figuras_lado_a_lado("detalhe", "Detalhe, confirmação colaborativa e lista por raio (iPhone 14)", [
        (px / "17_detalhe_ocorrencia.png", "Detalhe"),
        (px / "18_detalhe_confirmacao_colaborativa.png", "Confirmação"),
        (ip / "N04_lista_perto_de_mim.png", "Perto de mim"),
    ])
    c.h2("Qualidade ambiental")
    c.p(
        "A aba Ambiente ({F:ambiental}) reúne o IQAr médio das estações, os dados da Open-Meteo (identificados como "
        "“ao vivo” ou “cache”, com o estado do circuito) com o IQAr recalculado pelas faixas da CETESB, o gráfico das "
        "últimas 24 horas por estação e indicador e os cartões de cada estação, com poluentes, temperatura e nível do "
        "córrego."
    )
    c.figuras_lado_a_lado("ambiental", "IQAr e Open-Meteo, gráfico de 24 h e estações", [
        (px / "19_ambiental_iqar_open_meteo.png", "IQAr e Open-Meteo"),
        (px / "20_ambiental_grafico_24h.png", "Últimas 24 h"),
        (px / "21_ambiental_estacoes.png", "Estações"),
    ])
    c.h2("Tempo real entre dois dispositivos")
    c.p(
        "Na {F:tempo_real}, dois contextos de navegador independentes representam dois aparelhos. O dispositivo B "
        "mostra 41 ocorrências em aberto; o dispositivo A registra uma queimada; sem recarregar a tela, o dispositivo B "
        "passa a mostrar 42 ocorrências e o novo marcador, recebido pelo evento `ocorrencia:nova` do Socket.IO."
    )
    c.figuras_lado_a_lado("tempo_real", "Ocorrência registrada no dispositivo A aparece no dispositivo B", [
        (px / "22a_dispositivo_B_antes.png", "B antes"),
        (px / "22b_dispositivo_A_registrou.png", "A registrou"),
        (px / "22c_dispositivo_B_recebeu.png", "B recebeu"),
    ])
    c.h2("Alerta disparado")
    c.p(
        "Na {F:alerta}, o administrador dispara pelo painel o cenário de alagamento na estação Ipiranga por 120 s. O "
        "simulador eleva o nível do córrego acima da cota de 180 cm, o serviço ambiental publica o evento, o motor de "
        "regras cria o alerta “Risco de alagamento — Ipiranga” e o cidadão, em outro aparelho, recebe o banner e o "
        "__badge__ na aba Alertas, onde o alerta aparece entre os ativos com severidade e distância."
    )
    c.figuras_lado_a_lado("alerta", "Cenário disparado pelo administrador e alerta recebido pelo cidadão", [
        (px / "23a_admin_dispara_cenario.png", "Admin dispara"),
        (px / "23b_cidadao_recebe_alerta.png", "Cidadão recebe"),
        (px / "24_alertas_ativos.png", "Alertas ativos"),
    ])
    c.h2("Modo offline e sincronização")
    c.p(
        "Na {F:offline}, a conexão do navegador é desligada: a faixa “Você está offline” aparece, a ocorrência é salva "
        "no aparelho e fica pendente na tela de envios, com sua chave de idempotência. Ao religar a conexão, o envio é "
        "sincronizado automaticamente; o teste reenviou em seguida a mesma chave e confirmou que o servidor devolveu o "
        "registro original, sem duplicar."
    )
    c.figuras_lado_a_lado("offline", "Registro sem conexão, envio pendente e sincronização automática", [
        (px / "25_offline_registro.png", "Sem conexão"),
        (px / "26_offline_fila_pendente.png", "Pendente"),
        (px / "27_offline_sincronizado.png", "Sincronizado"),
    ])
    c.h2("Relatórios exportados")
    c.p(
        "A tela de relatórios ({F:relatorios}) mostra indicadores (ocorrências, em aberto, resolvidas, tempo médio de "
        "resolução, taxa de validação colaborativa e alertas), gráficos por status e categoria e as áreas mais "
        "críticas, com exportação em PDF e CSV. O PDF é gerado no servidor com os mesmos dados; a primeira página do "
        "arquivo exportado no teste de integração aparece ao lado."
    )
    c.figuras_lado_a_lado("relatorios", "Indicadores, exportação e primeira página do PDF gerado", [
        (px / "28_relatorios_indicadores.png", "Indicadores"),
        (px / "31_relatorios_exportacao.png", "Exportação"),
        (reg / "screenshots" / "relatorios" / "relatorio-pdf-pagina1.png", "PDF exportado"),
    ], largura_cm=[4.5, 4.5, 5.4])
    c.h2("Status do sistema e painel do agente")
    c.p(
        "A tela de status ({F:status}) torna a arquitetura visível: saúde e latência de cada serviço e a instância "
        "que respondeu, dependências (banco, broker, MQTT), teste de balanceamento com dez requisições (cinco em cada "
        "réplica), estado do __circuit breaker__, conexões WebSocket e MQTT e o estado do outbox. O painel do agente "
        "ordena a fila de atendimento por severidade e permite analisar, resolver ou descartar, sempre com comentário."
    )
    c.figuras_lado_a_lado("status", "Status dos microsserviços, balanceamento e painel do agente", [
        (px / "32_status_microsservicos.png", "Microsserviços"),
        (px / "33_status_balanceamento.png", "Balanceamento"),
        (px / "36_painel_dialogo_status.png", "Painel do agente"),
    ])
    c.h2("Tema escuro e outro aparelho")
    c.p(
        "O tema escuro ({F:escuro}) pode seguir o sistema ou ser escolhido no perfil, e alcança também o mapa e os "
        "gráficos. A mesma navegação foi repetida com a emulação do iPhone 14."
    )
    c.figuras_lado_a_lado("escuro", "Tema escuro no mapa e na qualidade ambiental; mapa no iPhone 14", [
        (px / "39_escuro_mapa.png", "Mapa escuro"),
        (px / "41_escuro_ambiental.png", "Ambiente escuro"),
        (ip / "N02_mapa.png", "iPhone 14"),
    ])
    c.h2("Testes de tolerância a falhas", "falhas")
    c.p(
        "O script de testes distribuídos manipula os contêineres com `docker compose stop/start` e verifica o "
        "comportamento pelo gateway. Os cinco cenários passaram ({T:distribuido}); os logs completos e as imagens "
        "estão em `registros/testes/distribuido/`."
    )
    c.tabela(
        "distribuido",
        "Resultados dos testes de sistema distribuído",
        ["Teste", "Resultado obtido"],
        [
            ["Balanceamento de carga", "20 requisições: 10 em ocorrencias-1 e 10 em ocorrencias-2 (X-Instance-Id alternando)"],
            ["Falha de réplica", "Réplica 2 parada: 20 de 20 com sucesso, todas na réplica 1; religada, voltou ao rodízio (10/10)"],
            ["Queda do broker", "Broker fora por cerca de 20 s: 5 eventos ficaram pendentes no outbox; na volta, outbox zerado, relatórios de 65 para 70 ocorrências e alerta de manancial gerado"],
            ["Falha da Open-Meteo", "Circuito ABERTO e fonte “cache” durante a falha; FECHADO e “ao vivo” após o tempo de recuperação"],
            ["Rastreamento", "O mesmo X-Request-Id encontrado nos logs do gateway, da réplica 2, do serviço de alertas e do de relatórios"],
        ],
        [4.0, 12.0],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/testes/distribuido/resumo.md.",
    )
    c.p(
        "A {F:falha_replica} mostra o log do teste de falha de réplica e a tela de status durante a falha, em que o "
        "teste de balanceamento encontra apenas a réplica 1. Na {F:broker}, com o broker parado, a tela de status "
        "aponta AMQP e MQTT desconectados e cinco eventos pendentes no outbox; após o religamento, tudo volta a ficar "
        "conectado e o outbox é zerado. A {F:breaker} mostra a falha simulada da Open-Meteo: o aplicativo continua "
        "exibindo os últimos dados, marcados como “dados em cache”, e o status indica o circuito aberto. O "
        "rastreamento ponta a ponta pelo `X-Request-Id` aparece na {F:rastreamento}."
    )
    c.figuras_lado_a_lado("falha_replica", "Queda de uma réplica: log do teste e status com uma réplica", [
        (dist / "2_falha_de_replica.png", "Log do teste"),
        (dist / "2a_app_status_uma_replica.png", "Status no app"),
    ], largura_cm=[9.4, 4.8])
    c.figuras_lado_a_lado("broker", "Queda do broker: status com o broker fora e após o restabelecimento", [
        (dist / "3_queda_do_broker.png", "Log do teste"),
        (dist / "3a_app_status_broker_fora.png", "Broker fora"),
        (dist / "3b_app_status_broker_restabelecido.png", "Restabelecido"),
    ], largura_cm=[6.0, 4.3, 4.3])
    c.figuras_lado_a_lado("breaker", "Circuit breaker: dados em cache e circuito aberto no aplicativo", [
        (dist / "4a_app_dados_em_cache.png", "Dados em cache"),
        (dist / "4b_app_status_circuito_aberto.png", "Circuito aberto"),
    ])
    c.figura("rastreamento", "Mesmo X-Request-Id nos logs de quatro contêineres", dist / "5_rastreamento_request_id.png", 15.5)
    c.h2("Resultados dos testes")
    c.p(
        "A {T:resultados} consolida os resultados da execução completa registrada em 27/09/2026. Todos os testes "
        "passaram. A cobertura de linhas das regras de negócio ficou em 97,47%, bem acima da meta de 70% definida para o "
        "projeto; os 12 cenários E2E que aparecem como “ignorados” são o roteiro completo, configurado para rodar só no "
        "Pixel 7 — no iPhone 14 roda a navegação pelas telas principais."
    )
    c.tabela(
        "resultados",
        "Resumo dos testes executados",
        ["Tipo", "Resultado"],
        [
            ["Unitários (Vitest)", "105 testes em 10 arquivos, todos aprovados; cobertura de linhas 97,47% (501/514), instruções 95,15%, funções 89,92% e ramos 88,6%"],
            ["Integração (via gateway)", "20 de 20 aprovados, incluindo os erros 401, 403, 404, 409, 413, 415, 422 e 429"],
            ["Ponta a ponta (Playwright)", "16 de 16 aprovados (Pixel 7 e iPhone 14), 70 prints e 18 vídeos"],
            ["Sistema distribuído", "5 de 5 cenários aprovados"],
            ["Qualidade de código", "tsc e ESLint sem erros no backend, no app e nos testes; expo-doctor 21/21"],
        ],
        [4.6, 11.4],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/RELATORIO_DE_TESTES.md.",
    )
    c.h2("Teste de carga: uma e duas réplicas", "carga")
    c.p(
        "O autocannon disparou `GET /api/ocorrencias` pelo gateway com 50 conexões simultâneas durante 30 s, após 5 s "
        "de aquecimento, primeiro com uma réplica e depois com duas ({T:carga} e {F:carga}). Com duas réplicas a vazão "
        "subiu **69,5%**, de 1.474 para 2.498 requisições por segundo, e a latência mediana caiu de 33 para 20 ms, sem "
        "erros. O ganho não chega a 100% porque banco, broker, réplicas e gerador de carga dividem o mesmo computador; "
        "os números servem para comparar as configurações, não como capacidade absoluta."
    )
    c.tabela(
        "carga",
        "Teste de carga com 1 e 2 réplicas (latências em ms)",
        ["Cenário", "Requisições", "Req/s", "p50", "p95", "p99", "Máx.", "Erros"],
        [
            ["1 réplica", "44.209", "1.474", "33", "41", "46", "226", "0"],
            ["2 réplicas", "74.916", "2.498", "20", "35", "40", "205", "0"],
        ],
        [3.0, 2.6, 2.0, 1.6, 1.6, 1.6, 1.8, 1.8],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/testes/carga/resultado.md.",
        alinhar=["esq"] + ["dir"] * 7,
    )
    c.figura("carga", "Vazão e latências com 1 e 2 réplicas", reg / "testes" / "carga" / "grafico-carga.png", 15.0)
    c.h2("Infraestrutura em execução")
    c.p(
        "A {F:infra} mostra o painel do RabbitMQ com as conexões AMQP dos serviços e as conexões MQTT do simulador e do "
        "serviço ambiental, e a documentação OpenAPI do serviço de ocorrências; a {F:compose} mostra os dez contêineres "
        "saudáveis do Docker Compose, com apenas as portas 8080 e 15672 publicadas."
    )
    c.figuras_lado_a_lado("infra", "Conexões AMQP e MQTT no RabbitMQ e Swagger do serviço de ocorrências", [
        (reg / "screenshots" / "infraestrutura" / "02_rabbitmq_conexoes_amqp_mqtt.png", "RabbitMQ"),
        (reg / "screenshots" / "swagger" / "02_swagger_ocorrencias-service.png", "Swagger"),
    ], largura_cm=[7.4, 7.4])
    c.figura("compose", "Contêineres do Docker Compose em execução", reg / "screenshots" / "infraestrutura" / "06_docker_compose_ps.png", 15.5)
    c.h2("Defeitos encontrados pelos testes e corrigidos")
    c.p(
        "O refinamento do sistema veio em boa parte dos próprios testes. A {T:defeitos} resume os dez problemas "
        "encontrados e como foram corrigidos; o último foi um defeito do teste, e não do sistema."
    )
    c.tabela(
        "defeitos",
        "Defeitos encontrados pelos testes e correções",
        ["Problema e como foi detectado", "Correção"],
        [
            ["Cidadão recebia 422 em vez de 403 ao alterar status (teste de fumaça)", "Autorização movida para o hook onRequest, antes da validação do corpo"],
            ["Alerta “Péssima” suprimido após um “Ruim” (cenário do simulador)", "Escalonamento: severidade maior não é tratada como repetição"],
            ["Imagens Docker com 494 MB", "Código somente leitura para o usuário do contêiner: 368 MB"],
            ["Migração sem SRID e chaves estrangeiras com schema errado", "Tipo geometry(Point, 4326) próprio e pós-processamento das migrações"],
            ["App web abria em branco", "Aguardar a hidratação do estado persistido antes de renderizar"],
            ["Duas telas de login na pilha após sair (E2E)", "Reinício da pilha de navegação ao entrar e sair"],
            ["6 erros de socket no teste de carga", "keepalive_requests 10000 no Nginx; nova execução sem erros"],
            ["Seletor de raio estourava 375 px; zoom inicial muito aberto (prints)", "Quatro opções de raio e zoom 11"],
            ["429 para usuários diferentes da mesma rede", "Limite aplicado por IP + e-mail no preHandler, com teste de integração"],
            ["Teste de queda do broker falhou uma vez (defeito do teste)", "Ponto de manancial sorteado longe de alertas recentes"],
        ],
        [8.4, 7.6],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/RELATORIO_DE_TESTES.md e PROGRESSO.md.",
    )


# =====================================================================================
# 8 CONSIDERAÇÕES FINAIS, 9 BIBLIOGRAFIA, 10 FICHA
# =====================================================================================
def secao_final(c, fig: Path, reg: Path):
    c.h1("Considerações finais: formação e interdisciplinaridade", "final")
    c.p(
        "O EcoRadar Urbano atingiu os objetivos propostos: o aplicativo registra e consulta informações ambientais com "
        "foto, GPS e mapa, funciona sem conexão, recebe alertas em tempo real, e o backend distribuído se manteve "
        "funcional nos cenários de falha testados. Mais do que uma lista de funcionalidades, o trabalho permitiu ver "
        "na prática por que cada padrão existe, pois quase todos foram motivados por uma falha concreta observada "
        "durante o desenvolvimento ou os testes."
    )
    c.h2("Interdisciplinaridade")
    c.p("O projeto exigiu integrar conteúdos de várias disciplinas do curso:")
    c.lista([
        "**Sistemas Distribuídos**: microsserviços, mensageria, consistência eventual, idempotência, outbox, CQRS, "
        "circuit breaker, replicação e balanceamento, aplicados e testados sob falha;",
        "**Redes de Computadores**: HTTP e REST, WebSocket, MQTT e AMQP sobre TCP, proxy reverso, DNS interno do "
        "Docker, portas, NAT (que motivou a correção do limite de login por IP + e-mail) e firewall para o teste no "
        "celular;",
        "**Banco de Dados**: modelagem, transações ACID, restrições de unicidade, índices GiST, consultas espaciais, "
        "migrações e isolamento por schema e usuário;",
        "**Engenharia de Software**: requisitos, casos de uso, desenvolvimento incremental, controle de versão, testes "
        "em vários níveis, integração de qualidade e documentação;",
        "**Programação para Dispositivos Móveis**: React Native, navegação, permissões, câmera, GPS, armazenamento "
        "seguro, notificações e design __offline-first__;",
        "**Estruturas de Dados e Algoritmos**: filas (outbox e fila offline), janelas de média móvel, cache com TTL, "
        "interpolação linear do IQAr e cálculo de distância geodésica;",
        "**Segurança da Informação**: __hash__ de senhas, JWT, limitação de tentativas, validação de entrada, "
        "verificação do tipo real dos arquivos e menor privilégio no banco;",
        "**Computação Gráfica e Interface com o Usuário**: mapas, codificação por cor e ícone, gráficos, tema escuro, "
        "acessibilidade e paleta adequada a daltônicos.",
    ], marcador="ponto")
    c.p(
        "Fora da computação, o tema trouxe conceitos de **Ciências Ambientais** (poluentes, padrões de qualidade do ar, "
        "proteção de mananciais), **Geografia e Geoprocessamento** (sistemas de referência, polígonos, análise por "
        "proximidade), **Meteorologia** (inversão térmica, dados de clima), **Urbanismo** (drenagem, ocupação de áreas "
        "de proteção, mobilidade), **Saúde Pública** (efeitos da poluição, recomendações associadas às faixas do IQAr) "
        "e **Políticas Públicas** (legislação federal e estadual de qualidade do ar e de mananciais, participação "
        "cidadã e transparência de dados)."
    )
    c.h2("Contribuição para a formação")
    c.p(
        "[REVISAR: personalizar com a experiência real do grupo] Nós começamos o trabalho conhecendo os conceitos de "
        "sistemas distribuídos principalmente pela teoria. Ao construir o EcoRadar, percebemos que cada garantia tem um "
        "custo e um motivo: a idempotência só fez sentido quando vimos o mesmo registro chegar duas vezes depois de "
        "uma queda de rede; o outbox, quando paramos o broker no meio de um teste e precisamos provar que nenhum evento "
        "se perdeu; o limite de tentativas de login, quando descobrimos que ele bloqueava todos os colegas conectados "
        "na mesma rede.",
        destaque=True,
    )
    c.p(
        "Também aprendemos a tratar testes e evidências como parte do produto, e não como etapa final: vários defeitos "
        "só apareceram porque automatizamos cenários de falha, de carga e de uso em dois aparelhos ao mesmo tempo. "
        "Trabalhar com um domínio real — qualidade do ar, mananciais, alagamentos — mostrou que decisões técnicas afetam "
        "diretamente a utilidade da informação para a população. Levamos do projeto a prática de justificar escolhas "
        "tecnológicas, documentar decisões e medir resultados, habilidades que esperamos usar no estágio e na vida "
        "profissional.",
        destaque=True,
    )
    c.h2("Limitações e trabalhos futuros")
    c.lista([
        "os prints foram gerados na versão web em __viewport__ de celular, pois não havia Android SDK no computador de "
        "desenvolvimento; o teste em aparelho real está roteirizado no `COMO_TESTAR.md`;",
        "as notificações são locais, compatíveis com o Expo Go; notificações __push__ remotas exigiriam um "
        "__development build__ e um serviço de envio;",
        "as estações são simuladas e o IQAr usa média móvel curta em vez das médias oficiais de 1 h, 8 h e 24 h; uma "
        "evolução natural é consumir dados abertos de estações reais;",
        "os polígonos dos mananciais são aproximados; o uso real exigiria os limites oficiais das áreas de proteção;",
        "o teste de carga foi feito num único computador; uma avaliação de capacidade exigiria máquinas separadas e "
        "orquestração com escalonamento automático (por exemplo, Kubernetes);",
        "banco e broker são instâncias únicas; replicação do PostgreSQL e __cluster__ do RabbitMQ eliminariam esses "
        "pontos únicos de falha, e __tracing__ distribuído com OpenTelemetry ampliaria a observabilidade.",
    ], marcador="ponto")

    # ------------------------------------------------------------------ bibliografia
    c.h1("Bibliografia", "bibliografia")
    acesso = "Acesso em: 28 set. 2026."
    refs = [
        "ABNT — ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **ABNT NBR ISO 37122**: cidades e comunidades sustentáveis: indicadores para cidades inteligentes. Rio de Janeiro: ABNT, 2020.",
        "BRASIL. Conselho Nacional do Meio Ambiente. Resolução nº 491, de 19 de novembro de 2018. Dispõe sobre padrões de qualidade do ar. **Diário Oficial da União**: seção 1, Brasília, DF, 21 nov. 2018. Disponível em: https://www.in.gov.br/web/guest/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/51058895/do1-2018-11-21-resolucao-n-491-de-19-de-novembro-de-2018-51058603. " + acesso + " [CONFERIR: o link oficial não abriu durante a verificação; confirmar o acesso e a página do DOU.]",
        "BRASIL. Lei nº 14.850, de 2 de maio de 2024. Institui a Política Nacional de Qualidade do Ar. **Diário Oficial da União**: seção 1, Brasília, DF, 3 maio 2024. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14850.htm. " + acesso,
        "BRASIL. Conselho Nacional do Meio Ambiente. Resolução nº 506, de 5 de julho de 2024. Estabelece padrões nacionais de qualidade do ar e fornece diretrizes para sua aplicação. **Diário Oficial da União**: seção 1, Brasília, DF, ed. 130, p. 133, 9 jul. 2024. Disponível em: https://www.in.gov.br/web/dou/-/resolucao-n-506-de-5-de-julho-de-2024-570885907. " + acesso,
        "CETESB — COMPANHIA AMBIENTAL DO ESTADO DE SÃO PAULO. **Padrões de qualidade do ar**. São Paulo: CETESB, [2026]. Disponível em: https://www.cetesb.sp.gov.br/cetesb/qualidade_ambiental/ar/informacoes_basicas/padroes_de_qualidade_do_ar. " + acesso,
        "COULOURIS, George et al. **Sistemas distribuídos**: conceitos e projeto. 5. ed. Porto Alegre: Bookman, 2013.",
        "DOCKER. **Docker Compose**. [S. l.], [2026]. Disponível em: https://docs.docker.com/compose/. " + acesso,
        "EXPO. **Expo documentation**. [S. l.], [2026a]. Disponível em: https://docs.expo.dev/. " + acesso,
        "EXPO. **Introduction to Expo Router**. [S. l.], [2026b]. Disponível em: https://docs.expo.dev/router/introduction/. " + acesso,
        "FASTIFY. **Fastify documentation**. [S. l.], [2026]. Disponível em: https://fastify.dev/docs/latest/. " + acesso,
        "FETTE, Ian; MELNIKOV, Alexey. **RFC 6455**: the WebSocket protocol. [S. l.]: IETF, 2011. Disponível em: https://www.rfc-editor.org/rfc/rfc6455. " + acesso,
        "FIELDING, Roy; NOTTINGHAM, Mark; RESCHKE, Julian (ed.). **RFC 9110**: HTTP semantics. [S. l.]: IETF, 2022. Disponível em: https://www.rfc-editor.org/rfc/rfc9110. " + acesso,
        "FOWLER, Martin. **CQRS**. [S. l.], 14 jul. 2011. Disponível em: https://martinfowler.com/bliki/CQRS.html. " + acesso,
        "FOWLER, Martin. **CircuitBreaker**. [S. l.], 6 mar. 2014. Disponível em: https://martinfowler.com/bliki/CircuitBreaker.html. " + acesso,
        "GOODCHILD, Michael F. Citizens as sensors: the world of volunteered geography. **GeoJournal**, [s. l.], v. 69, n. 4, p. 211-221, 2007. DOI: https://doi.org/10.1007/s10708-007-9111-y.",
        "JONES, Michael; BRADLEY, John; SAKIMURA, Nat. **RFC 7519**: JSON Web Token (JWT). [S. l.]: IETF, 2015. Disponível em: https://www.rfc-editor.org/rfc/rfc7519. " + acesso,
        "KLEPPMANN, Martin. **Designing data-intensive applications**: the big ideas behind reliable, scalable, and maintainable systems. Sebastopol: O'Reilly Media, 2017.",
        "NEWMAN, Sam. **Criando microsserviços**: projetando sistemas com componentes menores e mais especializados. 2. ed. São Paulo: Novatec, 2022.",
        "NGINX. **Module ngx_http_upstream_module**. [S. l.], [2026a]. Disponível em: https://nginx.org/en/docs/http/ngx_http_upstream_module.html. " + acesso,
        "NGINX. **WebSocket proxying**. [S. l.], [2026b]. Disponível em: https://nginx.org/en/docs/http/websocket.html. " + acesso,
        "NYGARD, Michael T. **Release it!**: design and deploy production-ready software. 2. ed. Raleigh: Pragmatic Bookshelf, 2018.",
        "OASIS. **MQTT version 3.1.1**. Edited by Andrew Banks and Rahul Gupta. [S. l.]: OASIS, 29 out. 2014. OASIS Standard. Disponível em: https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html. " + acesso,
        "OPEN-METEO. **Air quality API**. [S. l.], [2026a]. Disponível em: https://open-meteo.com/en/docs/air-quality-api. " + acesso,
        "OPEN-METEO. **Weather forecast API**. [S. l.], [2026b]. Disponível em: https://open-meteo.com/en/docs. " + acesso,
        "OPENSTREETMAP. **Copyright and license**. [S. l.], [2026]. Disponível em: https://www.openstreetmap.org/copyright. " + acesso,
        "OPOSSUM. **Opossum documentation**. [S. l.], [2026]. Disponível em: https://nodeshift.dev/opossum/. " + acesso,
        "PLAYWRIGHT. **Playwright documentation**. [S. l.], [2026]. Disponível em: https://playwright.dev/docs/intro. " + acesso,
        "POSTGIS. **PostGIS 3.6 manual**. [S. l.], [2026]. Disponível em: https://postgis.net/docs/manual-3.6/. " + acesso,
        "POSTGRESQL. **PostgreSQL 18 documentation**. [S. l.]: The PostgreSQL Global Development Group, [2026]. Disponível em: https://www.postgresql.org/docs/18/. " + acesso,
        "RABBITMQ. **AMQP 0-9-1 model explained**. [S. l.], [2026a]. Disponível em: https://www.rabbitmq.com/tutorials/amqp-concepts. " + acesso,
        "RABBITMQ. **MQTT plugin**. [S. l.], [2026b]. Disponível em: https://www.rabbitmq.com/docs/mqtt. " + acesso,
        "RABBITMQ. **Consumer acknowledgements and publisher confirms**. [S. l.], [2026c]. Disponível em: https://www.rabbitmq.com/docs/confirms. " + acesso,
        "RABBITMQ. **Dead letter exchanges**. [S. l.], [2026d]. Disponível em: https://www.rabbitmq.com/docs/dlx. " + acesso,
        "REACT NATIVE. **Introduction**. [S. l.], [2026a]. Disponível em: https://reactnative.dev/docs/getting-started. " + acesso,
        "REACT NATIVE. **Platform-specific code**. [S. l.], [2026b]. Disponível em: https://reactnative.dev/docs/platform-specific-code. " + acesso,
        "RICHARDSON, Chris. **Microservices patterns**: with examples in Java. Shelter Island: Manning, 2018.",
        "RICHARDSON, Chris. **Pattern**: transactional outbox. [S. l.], [2026a]. Disponível em: https://microservices.io/patterns/data/transactional-outbox.html. " + acesso,
        "RICHARDSON, Chris. **Pattern**: API gateway / backends for frontends. [S. l.], [2026b]. Disponível em: https://microservices.io/patterns/apigateway.html. " + acesso,
        "SÃO PAULO (Estado). Lei nº 12.233, de 16 de janeiro de 2006. Define a Área de Proteção e Recuperação dos Mananciais da Bacia Hidrográfica do Guarapiranga. São Paulo: Assembleia Legislativa, 2006. Disponível em: https://www.al.sp.gov.br/repositorio/legislacao/lei/2006/lei-12233-16.01.2006.html. " + acesso,
        "SÃO PAULO (Estado). Lei nº 13.579, de 13 de julho de 2009. Define a Área de Proteção e Recuperação dos Mananciais da Bacia Hidrográfica do Reservatório Billings - APRM-B. São Paulo: Assembleia Legislativa, 2009. Disponível em: https://www.al.sp.gov.br/repositorio/legislacao/lei/2009/lei-13579-13.07.2009.html. " + acesso,
        "SOCKET.IO. **Socket.IO documentation**: introduction. [S. l.], [2026]. Disponível em: https://socket.io/docs/v4/. " + acesso,
        "TANENBAUM, Andrew S.; VAN STEEN, Maarten. **Sistemas distribuídos**: princípios e paradigmas. 2. ed. São Paulo: Pearson Prentice Hall, 2007.",
        "VITEST. **Getting started**. [S. l.], [2026]. Disponível em: https://vitest.dev/guide/. " + acesso,
    ]
    for r in refs:
        c.p(r, recuo=False, alinhamento="esquerda")

    # ------------------------------------------------------------------ ficha
    c.h1("Ficha de Atividades Práticas Supervisionadas", "ficha")
    c.p("**Anexar a ficha oficial da UNIP preenchida e assinada.**", recuo=False)
    c.p(
        "[REVISAR] Rascunho cronológico para ajudar o grupo a preencher a ficha oficial, montado a partir das datas "
        "dos __commits__ do Git e das fases do `PROGRESSO.md` ({T:ficha}). O Git registra apenas os momentos de "
        "integração; por isso a coluna de horas deve ser preenchida pelo grupo com o tempo real dedicado a cada "
        "atividade, incluindo estudo, reuniões e redação deste documento.",
        recuo=False,
    )
    h = "==[REVISAR]=="
    c.tabela(
        "ficha",
        "Rascunho da ficha de atividades (a revisar pelo grupo)",
        ["Data", "Atividade", "Horas", "Evidência"],
        [
            ["27/09/2026", "Verificação do ambiente, estrutura do projeto, app Expo e infraestrutura Docker (fases 1 e 2)", h, "commits ae28d60, b838007"],
            ["27/09/2026", "Pacote compartilhado e serviço de autenticação (fase 3)", h, "commit 7f580b1"],
            ["27/09/2026", "Serviço de ocorrências com PostGIS, outbox e idempotência (fase 4)", h, "commit ff037c4"],
            ["27/09/2026", "Simulador de sensores e serviço ambiental (fase 5)", h, "commit 0448dc8"],
            ["27/09/2026", "Serviços de alertas e relatórios (fase 6)", h, "commit 963c497"],
            ["27/09/2026", "Dados de demonstração, scripts e Swagger (fase 8)", h, "commit 529aec8"],
            ["27/09/2026", "Validação da stack no Docker e correções", h, "commits cadb638, 3f1ad6a"],
            ["27/09/2026", "Aplicativo móvel (fase 7)", h, "commit c12c5c3"],
            ["27/09/2026", "Testes de integração, E2E, distribuídos e de carga (fase 9)", h, "commits b701c91, ae38625, b379164"],
            ["27/09/2026", "Correções apontadas pelos testes e orquestração das evidências", h, "commits c714bdd, c3fb9a8, 7fe5f7a, 1575146"],
            ["27–28/09/2026", "Documentação final, evidências e build nativo (fase 10)", h, "commits f3b4af1, 36ffd80, cc8cce7"],
            ["28/09/2026", "Redação do trabalho escrito", h, "documentacao/"],
        ],
        [2.6, 6.9, 2.9, 3.6],
        fonte="Fonte: elaborado pelos autores (2026), a partir de git log e PROGRESSO.md.",
    )
