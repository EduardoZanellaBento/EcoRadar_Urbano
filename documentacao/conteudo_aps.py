"""
Conteúdo do trabalho escrito da APS (EcoRadar Urbano).

Marcação usada nos textos:
  **negrito**   __itálico__   ==destaque amarelo==
  {F:chave} -> "Figura N"   {T:chave} -> "Tabela N"   {L:chave} -> "Listagem N"   {S:chave} -> nº da seção
Números citados vêm de registros/ (testes, métricas, versões) e do código-fonte.
"""
from pathlib import Path

from secoes_aps import secao_apresentacao, secao_codigo, secao_final, secao_projeto


def montar(c, raiz: Path, aqui: Path):
    fig = aqui / "figuras"
    reg = raiz / "registros"

    # ------------------------------------------------------------------ capa e índice
    c.capa(
        tema="Desenvolvimento de uma aplicação de sistema distribuído para dispositivo móvel",
        titulo="EcoRadar Urbano: aplicação distribuída para gerenciamento de informações ambientais urbanas",
        alunos=[
            "==[NOME COMPLETO 1] – RA [RA1]==",
            "==[NOME COMPLETO 2] – RA [RA2]==",
            "==[NOME COMPLETO 3] – RA [RA3]==",
        ],
        professor="Fábio",
        campus="==[CAMPUS]==",
        cidade="==[CIDADE]==",
        ano="2026",
    )
    c.indice()

    secao_objetivo(c)
    c.inicio_numeracao()
    secao_introducao(c)
    secao_fundamentos(c)
    secao_plano(c, fig, reg)
    secao_projeto(c, fig, reg)
    secao_codigo(c, fig, reg)
    secao_apresentacao(c, fig, reg)
    secao_final(c, fig, reg)


# =====================================================================================
# 1 OBJETIVO E MOTIVAÇÃO
# =====================================================================================
def secao_objetivo(c):
    c.h1("Objetivo e motivação do trabalho", "objetivo")
    c.h2("Objetivo geral")
    c.p(
        "Desenvolver o **EcoRadar Urbano**, uma aplicação de sistema distribuído para dispositivos móveis que permite a "
        "cidadãos, agentes públicos e sensores ambientais registrar, consultar e acompanhar em tempo real informações "
        "ambientais urbanas: ocorrências como alagamentos, queimadas, invasão de mananciais, desmatamento e descarte "
        "irregular de lixo, e indicadores como o Índice de Qualidade do Ar (IQAr), o nível dos córregos e a inversão "
        "térmica, com uma infraestrutura distribuída que continua funcionando quando parte do sistema falha."
    )
    c.h2("Objetivos específicos")
    c.lista([
        "construir um aplicativo multiplataforma (Android, iOS e web) em React Native com Expo, com mapa, registro de "
        "ocorrência com foto e GPS, uso sem conexão e notificações em tempo real;",
        "dividir o backend em seis microsserviços, cada um com o próprio schema de banco de dados, atrás de um API "
        "Gateway;",
        "integrar os serviços por mensageria assíncrona (AMQP), receber a telemetria dos sensores por MQTT e entregar "
        "os eventos aos aparelhos por WebSocket (Socket.IO);",
        "armazenar e consultar dados geoespaciais com PostgreSQL e PostGIS, identificando automaticamente ocorrências "
        "dentro de áreas de manancial;",
        "calcular o IQAr com as faixas divulgadas pela CETESB e detectar inversão térmica a partir das leituras;",
        "aplicar padrões de tolerância a falhas e consistência (balanceamento, __outbox__, idempotência, CQRS, "
        "__circuit breaker__ e __retry__) e comprová-los com testes de falha controlada;",
        "gerar relatórios com indicadores e exportação em PDF e CSV;",
        "registrar evidências reais com testes unitários, de integração, ponta a ponta, distribuídos e de carga.",
    ])
    c.h2("Motivação")
    c.p(
        "As grandes cidades brasileiras convivem com problemas ambientais que se somam. No inverno, a inversão térmica "
        "dificulta a dispersão dos poluentes e agrava episódios de má qualidade do ar; em dias de chuva forte, córregos "
        "canalizados transbordam e alagam vias; nas bordas da mancha urbana, a ocupação irregular e o desmatamento "
        "avançam sobre as áreas que protegem os reservatórios de abastecimento; queimadas e descarte irregular de lixo "
        "completam o quadro, junto com uma mobilidade apoiada no transporte rodoviário, que também é fonte de emissões. "
        "A cidade de São Paulo foi adotada como referência do protótipo: as represas Guarapiranga e Billings são "
        "protegidas por leis estaduais específicas (SÃO PAULO, 2006; 2009) e a CETESB publica o IQAr das estações da "
        "sua rede de monitoramento (CETESB, 2026)."
    )
    c.p(
        "Muitos desses problemas são percebidos primeiro por quem está no local. Um cidadão com um celular consegue "
        "registrar, em segundos, uma foto georreferenciada de um córrego transbordando ou de uma construção irregular "
        "na margem de uma represa — é a ideia de “cidadãos como sensores” descrita por Goodchild (2007). Essa informação "
        "só tem valor se chegar depressa a quem pode agir e for confirmada e cruzada com dados de sensores. A Lei nº 14.850/2024, que instituiu a Política "
        "Nacional de Qualidade do Ar, e a Resolução CONAMA nº 506/2024 reforçam essa necessidade ao prever a divulgação "
        "do IQAr à população em tempo real, horário ou diário (BRASIL, 2024a; 2024b)."
    )
    c.p(
        "Esse cenário justifica uma arquitetura distribuída e orientada a eventos. Os dados chegam de muitas fontes ao "
        "mesmo tempo (aparelhos, estações e uma API externa), o volume varia com os eventos climáticos, falhas "
        "parciais são inevitáveis (rede móvel instável, um serviço reiniciando, "
        "a API externa fora do ar) e um alerta perde valor se chega atrasado. Por isso o grupo optou por serviços "
        "independentes, mensageria com garantia de entrega, réplicas atrás de um balanceador e envio ativo de "
        "notificações, em vez de um sistema único consultado periodicamente."
    )


# =====================================================================================
# 2 INTRODUÇÃO
# =====================================================================================
def secao_introducao(c):
    c.h1("Introdução", "introducao")
    c.h2("Sistemas distribuídos e computação móvel")
    c.p(
        "Para Tanenbaum e Van Steen (2007), um sistema distribuído é um conjunto de computadores independentes que se "
        "apresenta aos usuários como um sistema único e coerente. Coulouris et al. (2013) destacam que seus componentes, "
        "localizados em computadores ligados em rede, comunicam-se e coordenam suas ações apenas pela troca de "
        "mensagens, o que traz três consequências de projeto: concorrência entre os componentes, ausência de um relógio "
        "global e falhas independentes — uma parte pode parar enquanto as demais continuam. Essas três características "
        "aparecem o tempo todo no EcoRadar Urbano: dois aparelhos registram ocorrências ao mesmo tempo, eventos chegam "
        "fora de ordem e o broker de mensagens pode cair sem que o restante do sistema pare."
    )
    c.p(
        "A computação móvel acrescenta um participante com características próprias. O __smartphone__ é ao mesmo tempo "
        "cliente e fonte de dados: tem GPS, câmera e armazenamento local, mas opera com conectividade intermitente, "
        "bateria limitada e redes de latência variável. Em vez de tratar a falta de rede como exceção, o aplicativo "
        "precisa ser projetado para funcionar desconectado (abordagem __offline-first__), guardar o que o usuário "
        "fez e sincronizar depois sem gerar duplicidade. Do lado do servidor, isso exige operações idempotentes, "
        "porque o mesmo pedido pode chegar mais de uma vez."
    )
    c.h2("Cidades inteligentes, sensoriamento e participação cidadã")
    c.p(
        "O conceito de cidade inteligente reúne o uso de tecnologias da informação para melhorar serviços urbanos e a "
        "qualidade de vida, com indicadores padronizados, por exemplo, pela ABNT NBR ISO 37122 (ABNT, 2020). Parte "
        "desses dados vem de sensores espalhados pela cidade — estações de qualidade do ar, pluviômetros, medidores de "
        "nível de córregos e perfis de temperatura —, dispositivos de Internet das Coisas (IoT) que publicam leituras "
        "periódicas usando protocolos leves como o MQTT (OASIS, 2014)."
    )
    c.p(
        "A outra parte vem das pessoas. O __crowdsourcing__ de dados urbanos, chamado por Goodchild (2007) de "
        "informação geográfica voluntária, transforma moradores em observadores distribuídos pelo território. Essa "
        "fonte é rápida e capilar, mas heterogênea: um relato pode estar incompleto, repetido ou errado. Por isso o "
        "EcoRadar combina as duas fontes e acrescenta mecanismos de validação — confirmação colaborativa por outros "
        "cidadãos, triagem por agentes com histórico de status e regras automáticas que cruzam relatos próximos no "
        "tempo e no espaço."
    )
    c.h2("Visão geral da solução")
    c.p(
        "O EcoRadar Urbano é formado por um aplicativo móvel e por um backend distribuído executado em contêineres "
        "Docker. O aplicativo, escrito em TypeScript com React Native e Expo, foi feito para o Android e o iOS, pelo "
        "Expo Go, e também roda no navegador. Toda a comunicação passa por um API Gateway Nginx, que distribui as requisições entre seis "
        "microsserviços Node.js: autenticação, ocorrências (com duas réplicas), dados ambientais, alertas, relatórios e "
        "um simulador de sensores. Os dados ficam em PostgreSQL com a extensão PostGIS, com um schema isolado por "
        "serviço, e a comunicação assíncrona usa o RabbitMQ, que atende tanto AMQP (eventos entre serviços) quanto MQTT "
        "(leituras dos sensores)."
    )
    c.p(
        "Três fluxos resumem o funcionamento. Quando um cidadão registra uma ocorrência, ela é gravada junto com um "
        "evento na mesma transação e publicada no broker; o serviço de alertas avalia as regras e todos os aparelhos "
        "conectados recebem a novidade por WebSocket. Enquanto isso, seis estações virtuais publicam leituras a cada "
        "cinco segundos, o serviço ambiental calcula o IQAr, detecta inversão térmica e nível crítico de córregos e "
        "gera eventos que também podem virar alertas. Por fim, dados reais de qualidade do ar e clima são obtidos da API "
        "pública Open-Meteo, protegida por __circuit breaker__ e cache. Relatórios são calculados a partir de uma visão "
        "de leitura própria (CQRS) e exportados em PDF ou CSV."
    )
    c.p(
        "O sistema foi executado e testado de ponta a ponta: 105 testes unitários, 20 testes de integração pelo "
        "gateway, 16 cenários ponta a ponta com Playwright em __viewport__ de celular, cinco testes de falha "
        "controlada e um teste de carga comparando uma e duas réplicas. Todas as evidências (prints, vídeos, logs e "
        "relatórios) estão na pasta `registros/` do repositório e são apresentadas na seção {S:apresentacao}."
    )
    c.h2("Organização do documento")
    c.p(
        "A seção {S:objetivo} apresentou o objetivo e a motivação do trabalho. A seção {S:fundamentos} reúne os "
        "fundamentos das tecnologias móveis e dos conceitos de sistemas distribuídos usados, sempre ligados ao uso que "
        "tiveram no projeto. A seção {S:plano} descreve o plano de desenvolvimento: ferramentas e justificativas, "
        "ambiente, metodologia, requisitos, casos de uso, cronograma, estratégia de testes e riscos. A seção "
        "{S:projeto} detalha a estrutura do programa — arquitetura, microsserviços, eventos, fluxos, modelo de dados, "
        "organização do aplicativo e tratamento de erros. A seção {S:codigo} traz as métricas do código e trechos "
        "comentados dos pontos centrais. A seção {S:apresentacao} mostra o programa em funcionamento com os prints das "
        "execuções reais, incluindo os testes de tolerância a falhas e de carga. A seção {S:final} discute a "
        "interdisciplinaridade, a contribuição do trabalho para a formação do grupo e as limitações. Seguem a "
        "bibliografia e a ficha de atividades práticas supervisionadas."
    )


# =====================================================================================
# 3 FUNDAMENTOS
# =====================================================================================
def secao_fundamentos(c):
    c.h1("Fundamentos das tecnologias para dispositivos móveis escolhidas (conceitos gerais)", "fundamentos")
    c.h2("Plataformas móveis e abordagens de desenvolvimento")
    c.p(
        "O mercado de __smartphones__ é dominado por duas plataformas: o Android, mantido pelo Google sobre um núcleo "
        "Linux, com aplicativos escritos principalmente em Kotlin ou Java, e o iOS, da Apple, com aplicativos em Swift ou "
        "Objective-C. Cada uma tem seu SDK, suas lojas, suas regras de permissão e seus componentes visuais. Há três "
        "caminhos para atender às duas:"
    )
    c.lista([
        "**desenvolvimento nativo**: um projeto por plataforma, com acesso total às APIs e o melhor desempenho, ao "
        "custo de manter dois códigos e duas equipes de conhecimento;",
        "**desenvolvimento híbrido**: uma aplicação web empacotada dentro de uma __WebView__ (Cordova, Ionic/Capacitor), "
        "com um só código, mas interface web e acesso a recursos do aparelho por __plugins__;",
        "**desenvolvimento multiplataforma com interface nativa**: um só código que gera componentes nativos (React "
        "Native) ou desenha a interface com motor próprio (Flutter).",
    ])
    c.p(
        "O grupo escolheu o React Native com Expo. O React Native usa JavaScript/TypeScript e React, e cada componente "
        "declarado (`View`, `Text`, `Image`) vira um componente nativo real da plataforma (REACT NATIVE, 2026a). Pesaram "
        "na decisão: a mesma linguagem do backend (TypeScript); o Expo Go, que executa o aplicativo no celular a partir de um QR code, sem compilar projeto Android ou "
        "iOS; e o suporte à web (react-native-web), que tornou possível testar o aplicativo automaticamente em "
        "__viewport__ de celular com o Playwright no computador de desenvolvimento, que não tinha Android SDK."
    )
    c.h2("React Native e Expo no projeto")
    c.p(
        "O Expo (SDK 57, com React Native 0.86.3 e React 19.2.3) é um conjunto de ferramentas e módulos em torno do "
        "React Native (EXPO, 2026a). O **Metro** empacota o código JavaScript e o serve pela rede local ao **Expo Go**, "
        "aplicativo instalado no celular que carrega esse pacote e expõe os módulos nativos do SDK. O **Expo Router** "
        "implementa rotas baseadas em arquivos (EXPO, 2026b): cada arquivo em `mobile/src/app` é uma tela, grupos entre "
        "parênteses, como `(abas)`, definem a barra de abas, e nomes entre colchetes, como `ocorrencia/[id].tsx`, são "
        "rotas dinâmicas."
    )
    c.p(
        "Quando uma funcionalidade precisa de implementações diferentes por plataforma, o Metro escolhe o arquivo pela "
        "extensão: `Mapa.native.tsx` no Android e no iOS, `Mapa.web.tsx` no navegador (REACT NATIVE, 2026b). O projeto "
        "usa esse recurso no mapa (react-native-maps com Google Maps no Android e Apple Maps no iOS; Leaflet com "
        "OpenStreetMap na web), no armazenamento, nas notificações, na mídia e na exportação de arquivos. O estado local "
        "fica no Zustand (sessão, preferências, conexão e fila offline) e as consultas à API passam pelo TanStack "
        "Query, cujo cache é persistido no aparelho por 24 horas em modo __offline-first__; o Axios faz as requisições "
        "com tempo limite de 10 segundos e até três tentativas em falhas transitórias."
    )
    c.h2("Recursos do dispositivo utilizados")
    c.lista([
        "**GPS e geolocalização** (expo-location): o aplicativo pede permissão de uso em primeiro plano, obtém a "
        "posição com precisão balanceada e, se ela não vier a tempo, usa a última posição conhecida; o usuário ainda "
        "pode ajustar o ponto arrastando um pino no mapa;",
        "**câmera e galeria** (expo-image-picker): a foto da ocorrência é capturada com qualidade 0,6 e sem metadados "
        "EXIF, o que reduz o envio e protege a privacidade;",
        "**armazenamento local e seguro**: o AsyncStorage guarda a fila offline, o cache de consultas e as "
        "preferências; o token de acesso fica no expo-secure-store, que usa o Keychain do iOS e o Keystore do Android;",
        "**notificações** (expo-notifications): cada alerta recebido em tempo real gera uma notificação local e um "
        "__badge__ na aba Alertas, respeitando o raio configurado pelo usuário;",
        "**detecção de conectividade** (NetInfo): além de saber se há rede, o aplicativo testa se o gateway responde em "
        "`/health`; ao recuperar a conexão, a fila de envios pendentes é sincronizada automaticamente.",
    ])
    c.h2("Fundamentos de sistemas distribuídos aplicados")
    c.h3("Transparências, escalabilidade e tolerância a falhas")
    c.p(
        "Tanenbaum e Van Steen (2007) descrevem formas de transparência que escondem do usuário a natureza distribuída "
        "do sistema. No EcoRadar, o aplicativo conhece um único endereço, o do gateway (transparência de localização); "
        "não sabe que o serviço de ocorrências tem duas réplicas (transparência de replicação); e falhas transitórias são "
        "mascaradas por novas tentativas no gateway e no cliente (transparência de falha, parcial). A escalabilidade "
        "horizontal vem de serviços sem estado em memória — todo estado fica no banco ou no broker —, de modo que basta "
        "subir mais réplicas atrás do balanceador. A tolerância a falhas combina redundância (réplicas), detecção "
        "(__health checks__), isolamento (um serviço fora não derruba os outros) e recuperação automática "
        "(reconexão e reenvio)."
    )
    c.h3("Comunicação síncrona, assíncrona e publish/subscribe")
    c.p(
        "Na comunicação síncrona, o cliente envia uma requisição e aguarda a resposta. É o modelo do HTTP e das APIs "
        "REST, em que recursos são identificados por URLs, manipulados por métodos como GET, POST e PATCH e respondidos "
        "com códigos de status padronizados (FIELDING; NOTTINGHAM; RESCHKE, 2022). O aplicativo usa esse modelo para "
        "tudo o que precisa de resposta imediata. Já a comunicação assíncrona desacopla emissor e receptor no tempo: a "
        "mensagem é entregue a um intermediário (__broker__), que a guarda até que o consumidor possa processá-la. No "
        "modelo __publish/subscribe__, quem publica não conhece quem consome; cada interessado assina os tipos de evento "
        "que deseja. Assim, um único evento `ocorrencia.criada` chega ao serviço de alertas e ao de relatórios."
    )
    c.h3("MQTT e AMQP")
    c.p(
        "O **MQTT** é um protocolo __publish/subscribe__ leve sobre TCP, pensado para dispositivos com poucos recursos "
        "(OASIS, 2014). As mensagens são publicadas em tópicos hierárquicos, e as assinaturas aceitam curingas (`+` para "
        "um nível, `#` para vários). O nível de qualidade de serviço define a garantia de entrega: QoS 0 (no máximo uma "
        "vez), QoS 1 (pelo menos uma vez) e QoS 2 (exatamente uma vez). No projeto, cada estação publica em "
        "`ecoradar/sensores/{id}/leituras` com QoS 1, e o serviço ambiental assina `ecoradar/sensores/+/leituras`."
    )
    c.p(
        "O **AMQP 0-9-1**, modelo usado pelo RabbitMQ, separa o roteamento da armazenagem (RABBITMQ, 2026a): o produtor "
        "publica em uma __exchange__ com uma chave de roteamento; filas se ligam à __exchange__ por __bindings__; e os "
        "consumidores leem das filas, confirmando cada mensagem (__ack__). Uma __exchange__ do tipo __topic__ aceita "
        "padrões nas ligações (`*` para uma palavra, `#` para várias). O projeto usa a __exchange__ `ecoradar.eventos` "
        "com filas duráveis por serviço, mensagens persistentes, __publisher confirms__ — o produtor só considera a "
        "mensagem publicada após a confirmação do broker (RABBITMQ, 2026c) — e __dead letter exchange__ para mensagens "
        "que falham repetidamente (RABBITMQ, 2026d). Como o RabbitMQ implementa os dois (o MQTT por meio de um "
        "__plugin__), um único broker atende às duas necessidades (RABBITMQ, 2026b)."
    )
    c.h3("WebSocket e Socket.IO")
    c.p(
        "No HTTP, o servidor só responde quando é chamado. O **WebSocket** (FETTE; MELNIKOV, 2011) abre, a partir de um "
        "__handshake__ HTTP com o cabeçalho `Upgrade`, uma conexão persistente e bidirecional pela qual o servidor pode "
        "enviar dados a qualquer momento, sem que o cliente precise consultar periodicamente (__polling__). O "
        "**Socket.IO** acrescenta sobre ele eventos nomeados, reconexão automática com __backoff__, salas e "
        "__middlewares__ de autenticação (SOCKET.IO, 2026). No EcoRadar, o aplicativo abre a conexão autenticada com o "
        "token JWT e recebe os eventos `ocorrencia:nova`, `ocorrencia:atualizada`, `alerta:novo` e `alerta:encerrado`; "
        "o Nginx repassa a conexão com os cabeçalhos de __upgrade__ (NGINX, 2026b)."
    )
    c.h3("Microsserviços, API Gateway e balanceamento de carga")
    c.p(
        "Microsserviços são serviços pequenos e independentes, modelados em torno de uma capacidade de negócio, "
        "implantados separadamente e donos dos próprios dados (NEWMAN, 2022). Os ganhos — implantação e escala "
        "independentes, isolamento de falhas, liberdade tecnológica por serviço — têm como custo a complexidade "
        "operacional e a necessidade de lidar com consistência entre bancos distintos. O padrão __database per "
        "service__ (RICHARDSON, 2018) foi seguido à risca: cada serviço tem um schema e um usuário de banco próprios e "
        "nenhum lê as tabelas de outro. Um **API Gateway** é o ponto único de entrada que roteia as requisições para o "
        "serviço certo e concentra funções transversais (RICHARDSON, 2026b). O **balanceamento de carga** distribui as "
        "requisições entre réplicas de um serviço; o Nginx usa por padrão o algoritmo __round-robin__, marca "
        "temporariamente como indisponível a réplica que falha e pode repetir a requisição na próxima (NGINX, 2026a)."
    )
    c.h3("Consistência eventual, idempotência, outbox e CQRS")
    c.p(
        "Sem transações distribuídas, os dados de serviços diferentes convergem com algum atraso: é a **consistência "
        "eventual** (KLEPPMANN, 2017). No teste de integração que consulta as estatísticas logo após registrar uma "
        "ocorrência e mudar seu status, foi preciso aguardar 1,06 s até a visão de leitura do serviço de relatórios "
        "refletir as duas alterações. Como as mensagens são entregues “pelo menos uma vez”, "
        "o mesmo evento pode chegar duas vezes, e as operações precisam ser **idempotentes** — repeti-las tem o mesmo "
        "efeito que executá-las uma vez. O aplicativo gera uma chave UUID v4 para cada registro e o servidor recusa "
        "duplicatas por uma restrição de unicidade; os consumidores guardam o identificador de cada evento já processado "
        "(tabela de __inbox__)."
    )
    c.p(
        "Outro problema clássico é a escrita dupla: gravar no banco e publicar no broker não é atômico, e uma falha entre "
        "os dois passos perde o evento ou publica algo que não foi salvo. O padrão **Transactional Outbox** resolve isso "
        "gravando o evento numa tabela `outbox` na mesma transação local da alteração; um publicador separado envia os "
        "eventos pendentes ao broker e os marca como publicados (RICHARDSON, 2026a). Já o **CQRS** separa o modelo de "
        "escrita do modelo de leitura (FOWLER, 2011): o serviço de relatórios mantém uma visão própria, alimentada por "
        "eventos e otimizada para consultas agregadas, sem consultar o banco do serviço de ocorrências."
    )
    c.h3("Circuit breaker, retry e observabilidade")
    c.p(
        "Chamar um serviço externo lento ou fora do ar pode prender recursos e propagar a falha. O **circuit breaker** "
        "(NYGARD, 2018; FOWLER, 2014) monitora as chamadas: com muitas falhas, o circuito **abre** e as chamadas "
        "seguintes falham imediatamente; após um intervalo, fica **meio-aberto** e deixa passar uma chamada de teste; se "
        "ela der certo, **fecha** de novo. Complementam o padrão o __timeout__ por chamada, o __retry__ com __backoff__ "
        "exponencial e __jitter__ (esperas crescentes com variação aleatória) e a degradação graciosa, que entrega o último dado válido em vez de um erro. Para operar "
        "tudo isso é preciso **observabilidade**: logs estruturados em JSON, um identificador de correlação "
        "(`X-Request-Id`) que acompanha a requisição do gateway aos serviços e aos consumidores de eventos, e "
        "verificações de saúde separadas em __liveness__ (`/health`, o processo está no ar) e __readiness__ (`/ready`, "
        "banco e broker acessíveis)."
    )
    c.h3("Conteinerização")
    c.p(
        "Um contêiner empacota a aplicação com suas dependências numa imagem imutável e a executa isolada do sistema "
        "hospedeiro, com custo muito menor que o de uma máquina virtual. O **Docker Compose** descreve, num único "
        "arquivo, todos os contêineres da aplicação, suas redes, volumes, variáveis de ambiente e verificações de saúde "
        "(DOCKER, 2026). No projeto, o `docker-compose.yml` sobe dez contêineres, e cada serviço só inicia depois que o "
        "banco e o broker estão saudáveis (`depends_on` com `service_healthy`)."
    )
    c.h2("Dados geoespaciais com PostGIS")
    c.p(
        "O PostGIS acrescenta ao PostgreSQL tipos, funções e índices espaciais (POSTGIS, 2026). Toda coordenada precisa "
        "de um sistema de referência, identificado por um SRID; o GPS dos celulares usa o WGS 84, de SRID 4326, com "
        "latitude e longitude em graus. As ocorrências são gravadas como `geometry(Point, 4326)` e os mananciais como "
        "`geometry(MultiPolygon, 4326)`, ambos com índices GiST. Duas consultas são centrais: a **busca por raio**, "
        "com `ST_DWithin` sobre o tipo `geography` (distância em metros, usando o índice) e `ST_Distance` para ordenar "
        "pela proximidade; e o **ponto-em-polígono**, com `ST_Contains`, que indica se uma ocorrência está dentro da "
        "área de proteção da Guarapiranga ou da Billings (polígonos aproximados, para fins didáticos)."
    )
    c.h2("Índice de Qualidade do Ar e inversão térmica")
    c.p(
        "O IQAr é uma ferramenta de comunicação que traduz a concentração de cada poluente numa escala única associada "
        "a efeitos sobre a saúde. O projeto usa as faixas publicadas pela CETESB ({T:iqar}), que remetem à Resolução "
        "CONAMA nº 491/2018 (CETESB, 2026; BRASIL, 2018). Para cada poluente, o índice é obtido por interpolação linear "
        "dentro da faixa em que a concentração se encontra, e o IQAr divulgado é o maior entre os poluentes:"
    )
    c.p("IQAr = Iini + (Ifin − Iini) / (Cfin − Cini) × (C − Cini)", recuo=False, alinhamento="centro")
    c.p(
        recuo=False,
        texto="em que Iini e Ifin são os índices inicial e final da faixa, Cini e Cfin as concentrações inicial e final e C a "
        "concentração medida. A Resolução CONAMA nº 506/2024 revogou a maior parte da nº 491/2018 e passou a definir o "
        "cálculo do IQAr no seu Anexo II, que mantém a mesma equação e a mesma faixa N1 (BRASIL, 2024b). "
        "[CONFERIR: comparar as faixas N2 a N5 da tabela com o Anexo II da Resolução CONAMA nº 506/2024.] Duas "
        "simplificações foram documentadas no código: a metodologia oficial usa médias de 24 h, 8 h ou 1 h, enquanto o "
        "protótipo aplica as faixas à média móvel das últimas 12 leituras (cerca de um minuto), para que a demonstração "
        "reaja em tempo real; e, como a faixa N5 não tem limite superior, adotou-se o índice 400 nas concentrações de "
        "referência de emergência, com teto de 500."
    )
    c.tabela(
        "iqar",
        "Faixas do IQAr usadas no projeto (concentrações em µg/m³; CO em ppm)",
        ["Poluente (média)", "N1 Boa", "N2 Moderada", "N3 Ruim", "N4 Muito Ruim", "N5 Péssima"],
        [
            ["Índice", "0–40", "41–80", "81–120", "121–200", ">200"],
            ["MP10 (24 h)", "0–45", ">45–100", ">100–150", ">150–250", ">250"],
            ["MP2,5 (24 h)", "0–15", ">15–50", ">50–75", ">75–125", ">125"],
            ["O3 (8 h)", "0–100", ">100–130", ">130–160", ">160–200", ">200"],
            ["CO (8 h)", "0–9", ">9–11", ">11–13", ">13–15", ">15"],
            ["NO2 (1 h)", "0–200", ">200–240", ">240–320", ">320–1130", ">1130"],
            ["SO2 (24 h)", "0–40", ">40–50", ">50–125", ">125–800", ">800"],
        ],
        [3.5, 2.5, 2.5, 2.5, 2.5, 2.5],
        fonte="Fonte: elaborado pelos autores (2026), com base em CETESB (2026).",
        alinhar=["esq"] + ["centro"] * 5,
    )
    c.p(
        "A **inversão térmica** ocorre quando uma camada de ar mais quente se forma acima de uma camada mais fria junto "
        "ao solo. Normalmente a temperatura diminui com a altitude e o ar aquecido na superfície sobe, levando os "
        "poluentes; na inversão, o ar frio fica preso embaixo e os poluentes se acumulam. No EcoRadar, as estações com "
        "sensor de perfil térmico informam a temperatura na superfície e a 300 m: há inversão quando a temperatura a "
        "300 m é maior que a da superfície, classificada como fraca (diferença menor que 1 °C), moderada (a partir de "
        "1 °C) ou forte (a partir de 3 °C), e o alerta correspondente recebe severidade alta quando a diferença chega a "
        "3 °C."
    )


# =====================================================================================
# 4 PLANO DE DESENVOLVIMENTO
# =====================================================================================
def secao_plano(c, fig, reg):
    c.h1("Plano de desenvolvimento da aplicação", "plano")
    c.p(
        "Esta seção descreve os elementos e ferramentas usados, o ambiente em que o sistema foi construído, a forma de "
        "trabalho, os requisitos, os atores e casos de uso, o cronograma registrado no Git, a estratégia de testes e os "
        "riscos considerados."
    )
    c.h2("Elementos e ferramentas")
    c.p(
        "A {T:stack} resume a pilha tecnológica. O critério principal foi usar uma única linguagem (TypeScript) do "
        "aplicativo ao backend, ferramentas de código aberto que rodassem inteiramente num computador pessoal e "
        "tecnologias que expusessem, de forma visível, os conceitos de sistemas distribuídos estudados."
    )
    c.tabela(
        "stack",
        "Pilha tecnológica, justificativas e alternativas descartadas",
        ["Camada", "Tecnologia", "Por que foi escolhida", "Alternativas descartadas"],
        [
            ["App", "React Native 0.86 + Expo SDK 57, TypeScript", "Um código para Android, iOS e web; Expo Go dispensa build nativo; mesma linguagem do backend", "Kotlin/Swift nativos (dois códigos); Flutter (Dart); Ionic (WebView)"],
            ["App", "Expo Router", "Rotas por arquivos, abas e rotas dinâmicas sem configuração manual", "React Navigation configurado à mão"],
            ["App", "React Native Paper (Material 3)", "Componentes acessíveis prontos e tema claro/escuro", "Estilização manual completa"],
            ["App", "Zustand + TanStack Query + Axios", "Estado simples persistido; cache de consultas offline; interceptadores de erro e retry", "Redux Toolkit (mais verboso)"],
            ["App", "react-native-maps / Leaflet + OpenStreetMap", "Mapas nativos no celular e mapa aberto na web, sem chave paga", "Mapbox e Google Maps JS (exigem chave)"],
            ["Backend", "Node.js 24 LTS + Fastify 5", "Alto desempenho, validação por esquema, hooks e Swagger integrados", "Express (sem esquemas nativos); NestJS (mais cerimônia); Spring Boot (outra linguagem)"],
            ["Backend", "Zod 4", "Um só esquema valida a entrada e gera a documentação OpenAPI", "Joi, validação manual"],
            ["Dados", "PostgreSQL 18 + PostGIS 3.6", "Transações ACID para o outbox e consultas espaciais com índice", "MongoDB (sem transação com outbox tão simples); MySQL Spatial"],
            ["Dados", "Drizzle ORM + drizzle-kit", "Consultas tipadas próximas do SQL e migrações versionadas", "Prisma (suporte limitado a PostGIS); TypeORM"],
            ["Mensageria", "RabbitMQ 4.3 (AMQP + plugin MQTT)", "Um só broker para eventos entre serviços e telemetria de sensores", "Kafka (mais pesado, sem MQTT); Mosquitto + outro broker"],
            ["Tempo real", "Socket.IO 4.8", "Reconexão automática, eventos nomeados, autenticação no handshake", "WebSocket puro; SSE (unidirecional); Firebase (serviço externo)"],
            ["Gateway", "Nginx 1.30", "Proxy reverso maduro, round-robin, WebSocket e logs em JSON", "Traefik; Kong; gateway escrito em Node"],
            ["Resiliência", "opossum 10, backoff próprio", "Circuit breaker testado; retry com jitter reaproveitado em todos os serviços", "Implementação própria do breaker"],
            ["Relatórios", "pdfkit + CSV", "Geração de PDF no servidor, sem navegador", "Puppeteer (pesado)"],
            ["Infra", "Docker + Docker Compose", "Sobe tudo com um comando, com healthchecks e ordem de inicialização", "Kubernetes (excessivo para o escopo)"],
            ["Testes", "Vitest, Playwright, autocannon", "Unitários e integração rápidos; E2E com prints e vídeos; carga via gateway", "Jest; Cypress/Detox; k6"],
        ],
        [2.1, 3.7, 5.8, 4.4],
        fonte="Fonte: elaborado pelos autores (2026), com versões de registros/ambiente/versoes.txt.",
    )
    c.h2("Ambiente de desenvolvimento")
    c.p(
        "O sistema foi desenvolvido e executado num único computador com Windows 11 Home (build 26200), processador "
        "AMD Ryzen 5 7600 (6 núcleos e 12 __threads__) e 30,9 GB de memória, com o Docker Desktop sobre o WSL 2. As "
        "versões efetivamente usadas foram registradas automaticamente pelos scripts do projeto e estão na {T:versoes}. "
        "O TypeScript foi fixado na versão 6.0.3, e não na 7, porque o typescript-eslint suporta versões anteriores à "
        "6.1 e o modelo do Expo SDK 57 também usa a 6.0.3. Os navegadores do Playwright foram instalados dentro da pasta "
        "`tests/`, sem instalação global."
    )
    c.tabela(
        "versoes",
        "Versões das ferramentas e servidores usados",
        ["Ferramenta ou servidor", "Versão", "Ferramenta ou pacote", "Versão"],
        [
            ["Node.js (máquina)", "24.19.0", "TypeScript", "6.0.3"],
            ["Node.js (contêineres)", "24.21.0", "Fastify", "5.12.5"],
            ["npm", "12.0.2", "Zod", "4.6.5"],
            ["Git", "2.55.0", "Drizzle ORM", "0.45.3"],
            ["Docker / Compose", "29.8.0 / 5.5.1", "amqplib / mqtt", "2.0.1 / 5.16.0"],
            ["PostgreSQL", "18.6", "Socket.IO", "4.8.4"],
            ["PostGIS", "3.6.4", "opossum", "10.0.0"],
            ["RabbitMQ", "4.3.6", "Expo / React Native", "57.0.25 / 0.86.3"],
            ["Nginx", "1.30.5", "Playwright / Vitest", "1.63.0 / 5.0.2"],
        ],
        [4.3, 3.2, 4.8, 3.7],
        fonte="Fonte: elaborado pelos autores (2026), a partir de registros/ambiente/versoes.txt.",
    )
    c.h2("Metodologia")
    c.p(
        "O desenvolvimento foi incremental, em dez fases registradas no arquivo `PROGRESSO.md`: ambiente e estrutura; "
        "infraestrutura (Compose, PostGIS, RabbitMQ e Nginx); pacote compartilhado e serviço de autenticação; serviço de "
        "ocorrências; simulador e serviço ambiental; alertas e relatórios; aplicativo móvel; dados de demonstração, "
        "scripts e documentação OpenAPI; testes e evidências; e documentação final. Cada fase entregava uma fatia "
        "vertical funcionando e só era encerrada após uma verificação — teste automatizado ou chamada real pelo "
        "gateway. O `PROGRESSO.md` também serviu de diário de decisões, e os __commits__ seguiram o padrão "
        "__Conventional Commits__ (`feat`, `fix`, `test`, `docs`, `chore`)."
    )
    c.p(
        "Portões de qualidade foram aplicados a todo o código: checagem de tipos (`tsc --noEmit`) no backend, no "
        "aplicativo e nos testes, ESLint e `expo lint` sem erros e `expo-doctor` com as 21 verificações aprovadas. Os "
        "próprios testes encontraram dez defeitos, todos corrigidos e registrados — entre eles, a autorização executada "
        "depois da validação (o cidadão recebia 422 em vez de 403), o escalonamento de alertas suprimido pela "
        "deduplicação, erros de __socket__ sob carga causados pelo limite de requisições por conexão __keep-alive__ do "
        "Nginx e o limite de tentativas de login que contava apenas o IP, bloqueando todos os usuários de uma mesma rede. "
        "A lista completa está na seção {S:apresentacao}."
    )
    c.h2("Requisitos funcionais")
    c.p("A {T:rf} lista os requisitos funcionais implementados e onde cada um é atendido.")
    c.tabela(
        "rf",
        "Requisitos funcionais",
        ["ID", "Requisito", "Onde é atendido"],
        [
            ["RF01", "Cadastrar cidadão e autenticar por e-mail e senha, com sessão de 12 h", "auth-service; telas login e cadastro"],
            ["RF02", "Controlar o acesso por perfil: cidadão, agente e administrador", "todos os serviços (JWT)"],
            ["RF03", "Registrar ocorrência com categoria (10), severidade (4), descrição, foto opcional e localização por GPS ajustável no mapa", "ocorrencias-service; tela ocorrencia/nova"],
            ["RF04", "Identificar e avisar quando o ponto está em área de manancial", "ocorrencias-service (PostGIS)"],
            ["RF05", "Exibir mapa com ocorrências, estações com IQAr e polígonos dos mananciais, com filtro por categoria", "aba Mapa"],
            ["RF06", "Listar ocorrências com busca, filtros, cinco ordenações e “perto de mim” por raio", "aba Ocorrências"],
            ["RF07", "Exibir detalhe da ocorrência com foto, mapa e histórico de status", "tela ocorrencia/[id]"],
            ["RF08", "Permitir confirmação colaborativa (uma por usuário, nunca a própria, só em ocorrências abertas)", "ocorrencias-service"],
            ["RF09", "Permitir ao agente alterar o status com comentário obrigatório e transições válidas", "tela painel; ocorrencias-service"],
            ["RF10", "Receber leituras de seis estações por MQTT e calcular IQAr, inversão térmica e nível de córregos, com série de 24 h", "ambiental-service; aba Ambiente"],
            ["RF11", "Integrar dados de ar e clima da Open-Meteo, indicando se são ao vivo ou de cache", "ambiental-service"],
            ["RF12", "Gerar alertas por cinco regras, com deduplicação de 30 min e escalonamento", "alertas-service"],
            ["RF13", "Notificar em tempo real com banner, badge e notificação local, conforme o raio escolhido", "alertas-service (Socket.IO); app"],
            ["RF14", "Encerrar alertas (agente/admin) e expirá-los após 12 h", "alertas-service"],
            ["RF15", "Registrar sem conexão em fila persistente e sincronizar sem duplicar", "app (fila offline); tela envios"],
            ["RF16", "Gerar relatórios com indicadores, gráficos e áreas críticas, exportando PDF e CSV com filtros", "relatorios-service; tela relatorios"],
            ["RF17", "Mostrar o status do sistema: saúde e latência dos serviços, réplica, balanceamento, circuit breaker, WebSocket, MQTT, AMQP e outbox", "tela status"],
            ["RF18", "Permitir ao administrador disparar cenários do simulador e simular falha da Open-Meteo", "sensor-simulator; ambiental-service; painel"],
            ["RF19", "Configurar tema claro/escuro/sistema e raio de alertas (2, 5, 10 ou 20 km)", "aba Perfil"],
            ["RF20", "Permitir ao administrador listar usuários e alterar perfis", "auth-service"],
        ],
        [1.5, 9.4, 5.1],
        fonte="Fonte: elaborado pelos autores (2026).",
    )
    c.h2("Requisitos não funcionais")
    c.p("A {T:rnf} apresenta os requisitos não funcionais e a evidência de que foram atendidos.")
    c.tabela(
        "rnf",
        "Requisitos não funcionais",
        ["ID", "Requisito", "Como foi atendido e verificado"],
        [
            ["RNF01", "Tolerância a falha de instância", "2 réplicas do serviço de ocorrências; com uma parada, 20 de 20 requisições atendidas"],
            ["RNF02", "Escalabilidade horizontal", "Serviços sem estado atrás do balanceador; +69,5% de vazão com 2 réplicas"],
            ["RNF03", "Nenhum evento perdido", "Outbox transacional e publisher confirms; com o broker fora por ~20 s, os 5 eventos pendentes foram publicados na volta"],
            ["RNF04", "Idempotência", "Chave UUID do app com restrição única; inbox nos consumidores; reenvio devolve o original (200)"],
            ["RNF05", "Desempenho interativo", "Listagem pelo gateway com p95 de 41 ms (1 réplica) e 35 ms (2 réplicas) sob 50 conexões"],
            ["RNF06", "Segurança", "bcrypt, JWT de 12 h, limite de login por IP + e-mail, validação Zod, tipo de foto pelos bytes, token no Keychain/Keystore, usuário de banco por serviço, só 2 portas expostas"],
            ["RNF07", "Observabilidade", "X-Request-Id ponta a ponta, logs JSON, /health e /ready, X-Instance-Id, tela de status"],
            ["RNF08", "Portabilidade", "Mesmo código para Android, iOS e web; backend em contêineres"],
            ["RNF09", "Operação sem conexão", "Cache de consultas persistido por 24 h e fila offline com sincronização automática"],
            ["RNF10", "Resiliência a serviço externo", "Timeout de 5 s, circuit breaker (50% de erro, 30 s) e cache de 10 min persistido"],
            ["RNF11", "Usabilidade e acessibilidade", "Tema escuro, rótulos de acessibilidade, mensagens em português, paleta de gráficos validada para daltonismo"],
            ["RNF12", "Manutenibilidade", "TypeScript em todo o código, lint e tipos sem erros, cobertura de 97,47% das linhas das regras de negócio"],
        ],
        [1.6, 4.2, 10.2],
        fonte="Fonte: elaborado pelos autores (2026), com resultados de registros/RELATORIO_DE_TESTES.md.",
    )
    c.h2("Atores e casos de uso")
    c.p(
        "Cinco atores interagem com o sistema ({F:casos_uso}). O **cidadão** registra e consulta ocorrências, confirma "
        "relatos de outras pessoas, acompanha a qualidade ambiental, recebe alertas e gera relatórios. O **agente** "
        "tem tudo o que o cidadão tem e, além disso, faz a triagem: altera o status das ocorrências e encerra alertas. "
        "O **administrador** herda as permissões do agente, altera perfis de usuários e dispara cenários de "
        "demonstração e a falha simulada da API externa. Os atores não humanos são o **sensor**, representado pelas "
        "estações virtuais que publicam leituras por MQTT, e o **serviço externo** Open-Meteo, que fornece dados reais "
        "de qualidade do ar e clima."
    )
    c.figura("casos_uso", "Diagrama de casos de uso", fig / "casos_de_uso.png", 9.2)
    c.h2("Cronograma")
    c.p(
        "O cronograma da {T:cronograma} foi extraído do histórico do Git e mostra os marcos de integração de cada fase. "
        "As datas correspondem aos __commits__ no repositório; atividades de estudo, planejamento e reuniões anteriores "
        "ao primeiro __commit__ não ficam registradas no Git. [REVISAR: complementar com as datas reais de "
        "planejamento, estudo e reuniões do grupo, se desejado.]"
    )
    c.tabela(
        "cronograma",
        "Marcos do desenvolvimento registrados no Git",
        ["Data e hora", "Commit", "Entrega"],
        [
            ["27/09/2026 16:44", "ae28d60", "Verificação do ambiente, estrutura do projeto e app Expo SDK 57"],
            ["27/09/2026 16:44", "b838007", "Docker Compose com PostGIS, RabbitMQ (AMQP + MQTT) e gateway Nginx"],
            ["27/09/2026 16:44", "7f580b1", "Pacote compartilhado e auth-service (JWT, bcrypt, rate limit)"],
            ["27/09/2026 16:51", "ff037c4", "ocorrencias-service com PostGIS, outbox transacional e idempotência"],
            ["27/09/2026 16:58", "0448dc8", "Simulador MQTT, IQAr (CETESB), inversão térmica e Open-Meteo"],
            ["27/09/2026 17:07", "963c497", "Motor de regras com Socket.IO e relatórios CQRS em PDF/CSV"],
            ["27/09/2026 17:13", "529aec8", "Dados de demonstração, fotos ilustrativas e scripts de operação"],
            ["27/09/2026 17:57", "3f1ad6a", "Validação da stack no Docker; correção de autorização e escalonamento"],
            ["27/09/2026 18:26", "c12c5c3", "Aplicativo móvel: mapa, registro offline, tempo real e relatórios"],
            ["27/09/2026 18:30", "b701c91", "Testes de integração via gateway"],
            ["27/09/2026 23:16", "ae38625", "Roteiro E2E com Playwright: prints, vídeos, dois dispositivos, offline"],
            ["27/09/2026 23:25", "b379164", "Testes de falha (réplica, broker, integração), rastreamento e carga"],
            ["27/09/2026 23:48", "c714bdd e outros", "Correções: login por IP + e-mail, seed e teste distribuído 3"],
            ["27/09/2026 23:57", "f3b4af1, 36ffd80", "README final, guia de testes e evidências completas em registros/"],
            ["28/09/2026 00:00", "cc8cce7", "Bundles nativos Android e iOS compilados com expo export"],
        ],
        [3.4, 3.2, 9.4],
        fonte="Fonte: elaborado pelos autores (2026), a partir de git log.",
    )
    c.h2("Estratégia de testes")
    c.p(
        "Os testes foram organizados em camadas, das mais rápidas e isoladas às que exercitam o sistema inteiro "
        "({T:testes}). Um único comando (`scripts/rodar-todos-testes`) executa todas elas em sequência e grava as saídas "
        "em `registros/`; outro (`scripts/coletar-evidencias`) sobe a stack, roda os testes e gera a galeria de "
        "evidências, de modo que os números deste documento podem ser reproduzidos."
    )
    c.tabela(
        "testes",
        "Estratégia de testes",
        ["Nível", "Ferramenta", "O que verifica"],
        [
            ["Unitário", "Vitest + cobertura v8", "Regras de negócio isoladas: IQAr, inversão, córregos, motor de regras, validações, idempotência, transições de status, outbox com broker simulado, backoff, cache, circuit breaker e relatórios"],
            ["Integração", "Vitest + fetch + Socket.IO", "Fluxo completo pela stack real via gateway e respostas de erro 401, 403, 404, 409, 413, 415, 422 e 429"],
            ["Ponta a ponta", "Playwright (Pixel 7 e iPhone 14)", "O aplicativo como o usuário vê, com prints e vídeos: cadastro, mapa, registro, tempo real entre dois aparelhos, alerta, offline, relatórios, status e tema escuro"],
            ["Distribuído", "Script próprio + Docker", "Balanceamento, queda de réplica, queda do broker, falha da Open-Meteo e rastreamento por X-Request-Id"],
            ["Carga", "autocannon", "Vazão e latências p50/p95/p99 com 1 e com 2 réplicas"],
            ["Qualidade", "tsc, ESLint, expo lint", "Tipos e padrões de código no backend, no app e nos testes"],
        ],
        [2.5, 3.9, 9.6],
        fonte="Fonte: elaborado pelos autores (2026).",
    )
    c.h2("Riscos e mitigação")
    c.p("A {T:riscos} relaciona os principais riscos identificados, a mitigação adotada e como ela foi verificada.")
    c.tabela(
        "riscos",
        "Riscos e mitigação",
        ["Risco", "Mitigação adotada", "Verificação"],
        [
            ["Queda do broker de mensagens", "Outbox transacional, reconexão com backoff e reassinatura das filas", "Teste distribuído 3"],
            ["Queda de uma instância", "2 réplicas, max_fails e proxy_next_upstream no Nginx", "Teste distribuído 2"],
            ["API externa lenta ou fora do ar", "Timeout, circuit breaker e cache persistido", "Teste distribuído 4"],
            ["Celular sem conexão", "Fila offline persistente e sincronização idempotente", "E2E 08"],
            ["Registros duplicados em reenvios", "idempotencyKey única e inbox nos consumidores", "Integração 4 e E2E 08"],
            ["Eventos fora de ordem entre réplicas", "Versão no retrato da ocorrência; projeções só aceitam versão maior", "Testes unitários"],
            ["Upload malicioso ou grande", "Limite de 5 MB (serviço) e 8 MB (gateway); tipo pelos bytes iniciais", "Integração (413 e 415)"],
            ["Força bruta no login", "10 tentativas por minuto por IP + e-mail", "Integração (429)"],
            ["Sem Android SDK no computador", "App validado na web em viewport de celular, bundles nativos compilados e roteiro de teste no celular (COMO_TESTAR.md)", "Build 08 e E2E"],
        ],
        [4.4, 7.4, 4.2],
        fonte="Fonte: elaborado pelos autores (2026).",
    )
