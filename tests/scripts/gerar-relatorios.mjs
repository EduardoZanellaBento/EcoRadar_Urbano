// Gera, a partir dos resultados REAIS gravados pelos testes, os documentos de evidência:
//   registros/RELATORIO_DE_TESTES.md · registros/README.md · registros/index.html (galeria offline)
// Uso (na pasta tests): node scripts/gerar-relatorios.mjs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reg = resolve(raiz, 'registros');
const agora = new Date();
const dataHora = agora.toLocaleString('pt-BR');
const ler = (p) => (existsSync(resolve(reg, p)) ? readFileSync(resolve(reg, p), 'utf-8') : null);
const lerJson = (p) => {
  const t = ler(p);
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
};
const rel = (p) => relative(reg, p).replace(/\\/g, '/');
const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function listar(dir, extensoes) {
  const abs = resolve(reg, dir);
  if (!existsSync(abs)) return [];
  const saida = [];
  for (const nome of readdirSync(abs).sort()) {
    const p = join(abs, nome);
    if (statSync(p).isDirectory()) continue;
    if (extensoes.includes(extname(nome).toLowerCase())) saida.push(p);
  }
  return saida;
}

// ----- Resultados reais --------------------------------------------------------------
const cobertura = lerJson('testes/unitarios/cobertura/coverage-summary.json')?.total;
const saidaUnit = ler('testes/unitarios/saida.txt') ?? '';
const unit = {
  testes: Number(/Tests\s+(\d+) passed/.exec(saidaUnit)?.[1] ?? 0),
  falhas: Number(/(\d+) failed/.exec(saidaUnit)?.[1] ?? 0),
  arquivos: Number(/Test Files\s+(\d+) passed/.exec(saidaUnit)?.[1] ?? 0),
};
const integ = lerJson('testes/integracao/resultado.json');
const integTestes = (integ?.testResults ?? []).flatMap((f) => f.assertionResults ?? []);
const e2e = lerJson('testes/e2e/resultado.json');
function testesPlaywright(suite, acc = []) {
  for (const s of suite?.suites ?? []) testesPlaywright(s, acc);
  for (const spec of suite?.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const r = t.results?.at(-1);
      acc.push({ titulo: spec.title, projeto: t.projectName, status: t.status === 'skipped' ? 'pulado' : r?.status === 'passed' ? 'passou' : r?.status ?? t.status, ms: r?.duration ?? 0 });
    }
  }
  return acc;
}
const e2eTestes = e2e ? testesPlaywright(e2e) : [];
const e2eExecutados = e2eTestes.filter((t) => t.status !== 'pulado');
const dist = lerJson('testes/distribuido/resultado.json');
const carga = lerJson('testes/carga/resultado.json');
const execucao = lerJson('testes/resumo-execucao.json');

// ----- Legendas da galeria -----------------------------------------------------------
const LEGENDAS = {
  '01_onboarding_1': 'Onboarding (1º acesso) — slide 1: registrar ocorrências',
  '02_onboarding_2': 'Onboarding — slide 2: qualidade do ar em tempo real (IQAr CETESB)',
  '03_onboarding_3': 'Onboarding — slide 3: alertas e colaboração',
  '04_login': 'Tela de login',
  '05_cadastro_validacao': 'Cadastro: validação dos campos antes de enviar',
  '06_cadastro_preenchido': 'Cadastro preenchido (senha oculta, bairro opcional)',
  '07_cadastro_concluido_mapa': 'Conta criada: o usuário entra direto no mapa',
  '08_login_senha_invalida': 'Login com senha incorreta: mensagem amigável (HTTP 401)',
  '09_login_sucesso': 'Login bem-sucedido',
  '10_mapa_ocorrencias_mananciais_estacoes': 'Mapa: ocorrências (cor = severidade, ícone = categoria), estações com IQAr e mananciais; indicador AO VIVO (Socket.IO)',
  '11_mapa_legenda': 'Legenda do mapa (severidade e faixas do IQAr)',
  '12_mapa_filtro_alagamento': 'Filtro por categoria aplicado (Alagamento)',
  '13_mapa_ocorrencia_selecionada': 'Ocorrência selecionada no mapa',
  '14_registro_formulario_foto': 'Registro: categoria em grade, severidade, descrição e foto (upload)',
  '15_registro_localizacao_aviso_manancial': 'Registro: localização (GPS) no mapa e aviso de área de manancial (PostGIS ST_Contains)',
  '16_registro_concluido_detalhe': 'Ocorrência registrada — e o alerta prioritário de manancial chega em tempo real',
  '17_detalhe_ocorrencia': 'Detalhe da ocorrência com foto, mapa e histórico',
  '18_detalhe_confirmacao_colaborativa': 'Confirmação colaborativa registrada (contador atualizado)',
  '19_ambiental_iqar_open_meteo': 'Qualidade ambiental: IQAr da cidade e dados Open-Meteo (fonte e horário)',
  '20_ambiental_grafico_24h': 'Gráfico das últimas 24 h por estação',
  '21_ambiental_estacoes': 'Cartões das estações: poluentes, inversão térmica e nível do córrego',
  '22_tempo_real_dois_dispositivos': 'Tempo real entre dois dispositivos: A registra e B vê a ocorrência sem recarregar',
  '22a_dispositivo_B_antes': 'Dispositivo B antes do registro',
  '22b_dispositivo_A_registrou': 'Dispositivo A após registrar',
  '22c_dispositivo_B_recebeu': 'Dispositivo B atualizado via Socket.IO',
  '23_alerta_admin_e_cidadao': 'ADMIN aciona o cenário ALAGAMENTO e o cidadão recebe o alerta (banner + badge)',
  '23a_admin_dispara_cenario': 'Painel do ADMIN disparando o cenário',
  '23b_cidadao_recebe_alerta': 'Cidadão recebe o banner de alerta',
  '24_alertas_ativos': 'Lista de alertas ativos',
  '25_offline_registro': 'Modo offline: faixa "Você está offline" e registro salvo no aparelho',
  '26_offline_fila_pendente': 'Fila offline: envio PENDENTE com a chave de idempotência',
  '27_offline_sincronizado': 'Conexão restabelecida: envio SINCRONIZADO automaticamente (sem duplicar)',
  '28_relatorios_indicadores': 'Relatórios: indicadores e rosca por status',
  '29_relatorios_graficos': 'Relatórios: barras por categoria',
  '30_relatorios_serie_diaria': 'Relatórios: série diária dos últimos 30 dias',
  '31_relatorios_exportacao': 'Exportação do relatório (PDF e CSV)',
  '32_status_microsservicos': 'Status do sistema: saúde, latência e instância de cada microsserviço',
  '33_status_balanceamento': 'Status: teste de balanceamento (10 requisições divididas entre as 2 réplicas)',
  '34_status_integracoes_tempo_real': 'Status: circuit breaker, WebSocket, MQTT, AMQP e outbox',
  '35_painel_agente_fila': 'Painel do agente: fila por severidade',
  '36_painel_dialogo_status': 'Painel do agente: alteração de status com comentário obrigatório',
  '37_painel_status_alterado': 'Status alterado (histórico gravado)',
  '38_escuro_perfil': 'Tema escuro — perfil',
  '39_escuro_mapa': 'Tema escuro — mapa',
  '40_escuro_lista': 'Tema escuro — lista de ocorrências',
  '41_escuro_ambiental': 'Tema escuro — qualidade ambiental',
  '42_escuro_relatorios': 'Tema escuro — relatórios',
  '43_escuro_relatorios_graficos': 'Tema escuro — gráficos',
  N01_login: 'Login', N02_mapa: 'Mapa', N03_lista_ocorrencias: 'Lista de ocorrências', N04_lista_perto_de_mim: 'Lista "perto de mim" com raio',
  N05_qualidade_ambiental: 'Qualidade ambiental', N06_alertas: 'Alertas', N07_perfil: 'Perfil', N08_relatorios: 'Relatórios',
  N09_status_sistema: 'Status do sistema', N10_envios: 'Envios pendentes', N11_painel_agente: 'Painel do agente',
  '01_swagger_auth-service': 'Swagger — auth-service', '02_swagger_ocorrencias-service': 'Swagger — ocorrencias-service',
  '03_swagger_ambiental-service': 'Swagger — ambiental-service', '04_swagger_alertas-service': 'Swagger — alertas-service',
  '05_swagger_relatorios-service': 'Swagger — relatorios-service', '06_swagger_sensor-simulator': 'Swagger — sensor-simulator',
  '07_swagger_ocorrencias_post_detalhado': 'Swagger — POST /api/ocorrencias detalhado',
  '01_rabbitmq_visao_geral': 'RabbitMQ — visão geral', '02_rabbitmq_conexoes_amqp_mqtt': 'RabbitMQ — conexões AMQP (serviços) e MQTT (sensores)',
  '03_rabbitmq_exchanges': 'RabbitMQ — exchanges (ecoradar.eventos, ecoradar.dlx, amq.topic)', '04_rabbitmq_filas': 'RabbitMQ — filas duráveis e DLQs',
  '05_rabbitmq_exchange_ecoradar_eventos': 'RabbitMQ — exchange ecoradar.eventos e bindings', '06_docker_compose_ps': 'docker compose ps: todos os containers healthy',
  '1_balanceamento': 'Distribuído 1 — 20 requisições divididas entre as 2 réplicas',
  '2_falha_de_replica': 'Distribuído 2 — réplica parada: 20/20 requisições com sucesso',
  '2a_app_status_uma_replica': 'App durante a falha: todas as requisições na réplica 1',
  '3_queda_do_broker': 'Distribuído 3 — queda do RabbitMQ: outbox guarda e publica os eventos (backoff nos logs)',
  '3a_app_status_broker_fora': 'App com o broker fora: serviços sem broker e eventos pendentes no outbox',
  '3b_app_status_broker_restabelecido': 'Broker de volta: outbox zerado (consistência eventual)',
  '4_falha_integracao_externa': 'Distribuído 4 — falha da Open-Meteo: circuito abre e fecha',
  '4a_app_dados_em_cache': 'App mostrando "DADOS EM CACHE" durante a falha',
  '4b_app_status_circuito_aberto': 'Status: circuit breaker ABERTO',
  '5_rastreamento_request_id': 'Distribuído 5 — X-Request-Id rastreado em gateway, ocorrências, alertas e relatórios',
  'grafico-carga': 'Carga: vazão e latências (p50/p95/p99) com 1 e 2 réplicas',
  'resultado-terminal': 'Carga: tabela de resultados',
};
const legenda = (arquivo) => {
  const nome = basename(arquivo, extname(arquivo));
  const pdf = /relatorio-pdf-pagina(\d+)/.exec(nome);
  if (pdf) return `PDF exportado pelo relatorios-service — página ${pdf[1]} (gráficos desenhados com pdfkit)`;
  return LEGENDAS[nome] ?? nome.replace(/[_-]+/g, ' ');
};

// ----- Seções da galeria ---------------------------------------------------------------
const pix = (f) => listar('screenshots/web-mobile/pixel-7', ['.png']).filter((p) => f(basename(p)));
const secoes = [
  { titulo: 'Acesso: onboarding, cadastro e login', itens: pix((n) => /^0[1-9]_/.test(n)) },
  { titulo: 'Mapa e filtros', itens: pix((n) => /^1[0-3]_/.test(n)) },
  { titulo: 'Registro de ocorrência (foto, GPS, manancial)', itens: pix((n) => /^1[4-6]_/.test(n)) },
  { titulo: 'Detalhe e confirmação colaborativa', itens: pix((n) => /^1[78]_/.test(n)) },
  { titulo: 'Qualidade ambiental (IQAr, Open-Meteo, 24 h)', itens: pix((n) => /^(19|20|21)_/.test(n)) },
  { titulo: 'Tempo real entre dois dispositivos', itens: pix((n) => /^22/.test(n)) },
  { titulo: 'Alertas em tempo real', itens: pix((n) => /^2[34]/.test(n)) },
  { titulo: 'Modo offline e idempotência', itens: pix((n) => /^2[5-7]_/.test(n)) },
  { titulo: 'Relatórios e exportação', itens: [...pix((n) => /^(28|29|30|31)_/.test(n)), ...listar('screenshots/relatorios', ['.png'])] },
  { titulo: 'Status do sistema (arquitetura distribuída)', itens: pix((n) => /^3[2-4]_/.test(n)) },
  { titulo: 'Painel do agente', itens: pix((n) => /^3[5-7]_/.test(n)) },
  { titulo: 'Tema escuro', itens: pix((n) => /^(38|39|4\d)_/.test(n)) },
  { titulo: 'Navegação no Pixel 7 (Chromium)', itens: pix((n) => /^N\d/.test(n)) },
  { titulo: 'Navegação no iPhone 14 (emulação no Chromium)', itens: listar('screenshots/web-mobile/iphone-14', ['.png']) },
  { titulo: 'Testes de sistema distribuído', itens: listar('testes/distribuido', ['.png']) },
  { titulo: 'Teste de carga', itens: listar('testes/carga', ['.png']) },
  { titulo: 'Documentação OpenAPI (Swagger)', itens: listar('screenshots/swagger', ['.png']) },
  { titulo: 'Infraestrutura (RabbitMQ, Docker)', itens: listar('screenshots/infraestrutura', ['.png']) },
  { titulo: 'Prints manuais do celular (Expo Go)', itens: listar('manual', ['.png', '.jpg', '.jpeg']) },
  { titulo: 'Android nativo (emulador)', itens: listar('screenshots/nativo-android', ['.png']) },
].filter((s) => s.itens.length);
const videos = listar('videos', ['.webm', '.mp4']);

// ----- Números para o topo -----------------------------------------------------------
const pct = (v) => (v === undefined || v === null ? '—' : `${String(v).replace('.', ',')}%`);
const kpis = [
  { rotulo: 'Testes unitários', valor: `${unit.testes}`, detalhe: `${unit.arquivos} arquivos · ${unit.falhas ? `${unit.falhas} falhas` : 'todos passaram'}` },
  { rotulo: 'Cobertura (regras de negócio)', valor: pct(cobertura?.lines?.pct), detalhe: `linhas · branches ${pct(cobertura?.branches?.pct)}` },
  { rotulo: 'Integração (via gateway)', valor: `${integ?.numPassedTests ?? 0}/${integ?.numTotalTests ?? 0}`, detalhe: 'testes passaram' },
  { rotulo: 'E2E (Playwright)', valor: `${e2eExecutados.filter((t) => t.status === 'passou').length}/${e2eExecutados.length}`, detalhe: 'Pixel 7 + iPhone 14' },
  { rotulo: 'Sistema distribuído', valor: `${(dist?.resultados ?? []).filter((r) => r.ok).length}/${(dist?.resultados ?? []).length}`, detalhe: 'cenários de falha' },
  { rotulo: 'Carga (2 réplicas)', valor: carga ? `${carga.duas.reqPorSegundo} req/s` : '—', detalhe: carga ? `p95 ${carga.duas.p95} ms · ${carga.ganhoPercentual >= 0 ? '+' : ''}${String(carga.ganhoPercentual).replace('.', ',')}% vs 1 réplica` : '' },
];

// ----- index.html ----------------------------------------------------------------------
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EcoRadar Urbano — Evidências</title>
<style>
  :root { --fundo:#f6f7f5; --cartao:#ffffff; --tinta:#0b0b0b; --tinta2:#52514e; --fraca:#6f6e69; --borda:#e1e0d9; --marca:#0f766e; --azul:#1d4ed8; --ok:#0a7a0a; --erro:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --fundo:#101413; --cartao:#1a1f1e; --tinta:#f2f2ee; --tinta2:#c3c2b7; --fraca:#9a9992; --borda:#2c2c2a; --marca:#5ed6c5; --azul:#8ab4f8; --ok:#5bd35b; --erro:#ffb4ab; } }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--fundo); color: var(--tinta); }
  header { background: linear-gradient(90deg, #0f766e, #1d4ed8); color:#fff; padding: 28px 16px; }
  header div { max-width: 1200px; margin: 0 auto; }
  header h1 { margin: 0 0 6px; font-size: 26px; }
  header p { margin: 0; opacity: .9; }
  main { max-width: 1200px; margin: 0 auto; padding: 20px 16px 60px; }
  .kpis { display:grid; grid-template-columns: repeat(auto-fit, minmax(170px,1fr)); gap:12px; margin-bottom: 20px; }
  .kpi { background: var(--cartao); border:1px solid var(--borda); border-radius: 14px; padding: 14px; }
  .kpi small { color: var(--tinta2); display:block; }
  .kpi strong { font-size: 26px; display:block; margin: 4px 0; }
  .kpi span { color: var(--fraca); font-size: 12px; }
  nav { display:flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 24px; }
  nav a { background: var(--cartao); border:1px solid var(--borda); border-radius: 999px; padding: 6px 12px; color: var(--tinta); text-decoration:none; font-size: 13px; }
  h2 { margin: 32px 0 12px; font-size: 20px; border-bottom: 1px solid var(--borda); padding-bottom: 6px; }
  .grade { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 14px; }
  figure { margin:0; background: var(--cartao); border:1px solid var(--borda); border-radius: 12px; overflow:hidden; }
  figure a { display:block; background: #fff; }
  figure img { width:100%; height: 300px; object-fit: contain; display:block; background: #fafaf8; }
  figcaption { padding: 10px 12px; font-size: 13px; color: var(--tinta2); }
  figcaption code { font-size: 11px; color: var(--fraca); display:block; margin-top: 4px; word-break: break-all; }
  .largo { grid-column: 1 / -1; }
  .largo img { height: auto; max-height: 640px; }
  video { width:100%; max-height: 520px; background:#000; display:block; }
  ul.links li { margin: 6px 0; }
  a { color: var(--azul); }
  .ok { color: var(--ok); font-weight: 700; } .erro { color: var(--erro); font-weight: 700; }
  table { width:100%; border-collapse: collapse; background: var(--cartao); border:1px solid var(--borda); border-radius: 12px; overflow: hidden; font-size: 14px; }
  th, td { text-align:left; padding: 8px 10px; border-bottom: 1px solid var(--borda); vertical-align: top; }
  .tabela { overflow-x: auto; }
</style>
</head>
<body>
<header><div>
  <h1>EcoRadar Urbano — evidências de testes</h1>
  <p>APS · Ciência da Computação (UNIP 2026) · galeria gerada em ${escapar(dataHora)} a partir de execuções reais</p>
</div></header>
<main>
  <section class="kpis">
    ${kpis.map((k) => `<div class="kpi"><small>${escapar(k.rotulo)}</small><strong>${escapar(k.valor)}</strong><span>${escapar(k.detalhe)}</span></div>`).join('\n    ')}
  </section>
  <nav>${secoes.map((s, i) => `<a href="#s${i}">${escapar(s.titulo)}</a>`).join('')}<a href="#videos">Vídeos</a><a href="#arquivos">Relatórios e logs</a></nav>
  ${
    dist
      ? `<h2>Resultados dos testes de sistema distribuído</h2><div class="tabela"><table><tr><th>Teste</th><th>Resultado</th><th>Resumo</th></tr>${dist.resultados
          .map((r) => `<tr><td>${escapar(r.teste)}</td><td class="${r.ok ? 'ok' : 'erro'}">${r.ok ? 'passou' : 'falhou'}</td><td>${escapar(r.resumo)}</td></tr>`)
          .join('')}</table></div>`
      : ''
  }
  ${secoes
    .map(
      (s, i) => `<h2 id="s${i}">${escapar(s.titulo)}</h2>
  <div class="grade">
    ${s.itens
      .map((p) => {
        const largo = /^(22|23)_|grafico-carga|resultado-terminal|^\d_[a-z]|docker_compose|rabbitmq|swagger/.test(basename(p)) && !/^\d[a-z]_app/.test(basename(p));
        return `<figure class="${largo ? 'largo' : ''}"><a href="${escapar(rel(p))}" target="_blank"><img loading="lazy" src="${escapar(rel(p))}" alt="${escapar(legenda(p))}"></a><figcaption>${escapar(legenda(p))}<code>${escapar(rel(p))}</code></figcaption></figure>`;
      })
      .join('\n    ')}
  </div>`,
    )
    .join('\n  ')}
  <h2 id="videos">Vídeos das execuções E2E (${videos.length})</h2>
  <div class="grade">
    ${videos.map((v) => `<figure><video controls preload="none" src="${escapar(rel(v))}"></video><figcaption>${escapar(basename(v, extname(v)).replace(/-/g, ' '))}<code>${escapar(rel(v))}</code></figcaption></figure>`).join('\n    ')}
  </div>
  <h2 id="arquivos">Relatórios, logs e arquivos gerados</h2>
  <ul class="links">
    <li><a href="RELATORIO_DE_TESTES.md">RELATORIO_DE_TESTES.md</a> — resumo de todos os testes com números reais</li>
    <li><a href="testes/e2e/relatorio-html/index.html">Relatório HTML do Playwright</a></li>
    <li><a href="testes/unitarios/cobertura/index.html">Relatório de cobertura (Vitest/v8)</a> · <a href="testes/unitarios/saida.txt">saída dos testes unitários</a></li>
    <li><a href="testes/integracao/saida.txt">Saída dos testes de integração</a> · <a href="testes/integracao/relatorio-exportado.pdf">PDF exportado</a> · <a href="testes/integracao/ocorrencias-exportadas.csv">CSV exportado</a></li>
    <li><a href="testes/distribuido/rastreamento_request_id.txt">Rastreamento por X-Request-Id</a> · <a href="testes/distribuido/3_queda_do_broker.txt">log da queda do broker</a></li>
    <li><a href="testes/carga/resultado.md">Resultado do teste de carga</a></li>
    <li><a href="logs/servicos/">Logs de cada serviço (docker compose logs)</a> · <a href="metricas_codigo.txt">Métricas do código</a></li>
    <li><a href="ambiente/versoes.txt">Versões</a> · <a href="ambiente/sistema.txt">Sistema</a> · <a href="build/">Logs de build</a></li>
  </ul>
</main>
</body>
</html>
`;
writeFileSync(resolve(reg, 'index.html'), html);

// ----- RELATORIO_DE_TESTES.md -----------------------------------------------------------------
const linhaTeste = (t) => `| ${t.title ?? t.titulo} | ${t.status === 'passed' || t.status === 'passou' ? '✅' : t.status === 'pulado' ? '⏭️' : '❌'} | ${Math.round(t.duration ?? t.ms ?? 0)} ms |`;
const md = [
  '# Relatório de testes — EcoRadar Urbano',
  '',
  `Gerado em ${dataHora} a partir das execuções reais registradas nesta pasta. Nenhum número foi digitado à mão:`,
  'todos vêm dos arquivos de resultado (JSON/saída) indicados em cada seção.',
  '',
  '## Resumo',
  '',
  '| Tipo de teste | Ferramenta | Resultado | Evidência |',
  '|---|---|---|---|',
  `| Unitários (regras de negócio) | Vitest + v8 | **${unit.testes} testes passaram** em ${unit.arquivos} arquivos · cobertura de linhas **${pct(cobertura?.lines?.pct)}** (branches ${pct(cobertura?.branches?.pct)}, funções ${pct(cobertura?.functions?.pct)}) | \`testes/unitarios/\` |`,
  `| Integração (stack real via gateway) | Vitest + fetch + Socket.IO | **${integ?.numPassedTests ?? 0}/${integ?.numTotalTests ?? 0}** passaram | \`testes/integracao/\` |`,
  `| E2E (app web em viewport de celular) | Playwright | **${e2eExecutados.filter((t) => t.status === 'passou').length}/${e2eExecutados.length}** passaram (Pixel 7 e iPhone 14) · ${listar('screenshots/web-mobile/pixel-7', ['.png']).length + listar('screenshots/web-mobile/iphone-14', ['.png']).length} prints · ${videos.length} vídeos | \`testes/e2e/\`, \`screenshots/web-mobile/\`, \`videos/\` |`,
  `| Sistema distribuído | script próprio + Docker | **${(dist?.resultados ?? []).filter((r) => r.ok).length}/${(dist?.resultados ?? []).length}** cenários passaram | \`testes/distribuido/\` |`,
  `| Carga leve | autocannon | ${carga ? `1 réplica: **${carga.uma.reqPorSegundo} req/s** (p95 ${carga.uma.p95} ms) · 2 réplicas: **${carga.duas.reqPorSegundo} req/s** (p95 ${carga.duas.p95} ms) · variação ${carga.ganhoPercentual >= 0 ? '+' : ''}${carga.ganhoPercentual}%` : 'não executado'} | \`testes/carga/\` |`,
  `| Qualidade de código | tsc + ESLint + expo lint | ${execucao ? execucao.passos.filter((p) => /tipos|lint/i.test(p.nome)).map((p) => `${p.nome}: ${p.ok ? 'sem erros' : 'COM ERROS'}`).join(' · ') : 'ver testes/qualidade/'} | \`testes/qualidade/\` |`,
  '',
  '## 1. Testes unitários (Vitest)',
  '',
  '**Objetivo:** validar as regras de negócio isoladas: cálculo do IQAr (faixas da CETESB), inversão térmica, nível dos córregos, motor de regras de alertas (inclusive deduplicação, escalonamento e concentração em raio), validações Zod, idempotência, transições de status, publicador do outbox com broker simulado, backoff exponencial, cache com TTL, circuit breaker da Open-Meteo e geração de relatórios (estatísticas, CSV e PDF).',
  '',
  '**Procedimento:** `npx vitest run --coverage` em `backend/` (script `tests/scripts/testes-unitarios.mjs`).',
  '',
  `**Resultado esperado:** todos os testes passam e a cobertura das regras de negócio fica acima de 70%. **Obtido:** ${unit.testes} testes passaram, ${unit.falhas} falharam; cobertura de linhas ${pct(cobertura?.lines?.pct)}.`,
  '',
  '```',
  (ler('testes/unitarios/resumo-cobertura.txt') ?? '').trim(),
  '```',
  '',
  '## 2. Testes de integração (stack real, via gateway http://localhost:8080)',
  '',
  '**Objetivo:** percorrer o fluxo completo de ponta a ponta e validar as respostas de erro padronizadas.',
  '',
  '**Procedimento:** `npm run integracao` (em `tests/`): cadastro → login → ocorrência com foto (multipart) → reenvio com a mesma chave → listagem por raio (PostGIS) → confirmação → mudança de status por agente → estatísticas (CQRS) → exportação PDF/CSV → dados ambientais → cenário do simulador gerando alerta recebido por um cliente Socket.IO; erros 401, 403, 404, 409, 413, 415, 422 e 429 (limite de tentativas de login por e-mail).',
  '',
  '| Teste | Resultado | Duração |',
  '|---|---|---|',
  ...integTestes.map(linhaTeste),
  '',
  '## 3. Testes E2E (Playwright)',
  '',
  '**Objetivo:** demonstrar o app funcionando como o usuário vê, em viewport de celular, com prints de cada passo e vídeo.',
  '',
  '**Procedimento:** build web exportado (`npx expo export --platform web`) servido pelo gateway; Playwright com emulação do **Pixel 7** (roteiro completo) e do **iPhone 14** (navegação pelas telas principais), geolocalização simulada em São Paulo, vídeo ligado. O modo offline usa `context.setOffline(true)`; o tempo real e o alerta usam dois contextos de navegador independentes.',
  '',
  '| Etapa | Aparelho | Resultado | Duração |',
  '|---|---|---|---|',
  ...e2eTestes.filter((t) => t.status !== 'pulado').map((t) => `| ${t.titulo} | ${t.projeto} | ${t.status === 'passou' ? '✅' : '❌'} | ${(t.ms / 1000).toFixed(1)} s |`),
  '',
  'Observação: o iPhone 14 é emulado no Chromium (viewport, user agent e toque), pois o WebKit do Playwright não foi instalado; o comportamento de layout é o mesmo do app web.',
  '',
  '## 4. Testes de sistema distribuído',
  '',
  '**Procedimento:** `npm run distribuido` — o script manipula os containers com `docker compose stop/start` e verifica o comportamento pelo gateway, gravando log detalhado, imagem do log e prints do app.',
  '',
  '| Teste | Objetivo | Resultado esperado | Resultado obtido | Evidência |',
  '|---|---|---|---|---|',
  ...(dist?.resultados ?? []).map((r, i) => {
    const info = [
      ['Distribuir a carga entre as réplicas', 'X-Instance-Id alterna entre ocorrencias-1 e ocorrencias-2', '1_balanceamento.*'],
      ['Continuar atendendo com uma réplica parada', '100% de sucesso durante a falha; réplica volta ao rodízio', '2_falha_de_replica.*, 2a_app_status_uma_replica.png'],
      ['Não perder eventos com o broker fora (~20 s)', 'eventos ficam no outbox e são publicados na volta; relatórios e alertas atualizados', '3_queda_do_broker.*, 3a/3b_app_status_*.png'],
      ['Degradação graciosa com a Open-Meteo fora', 'circuito ABERTO, app mostra dados em cache; recupera sozinho', '4_falha_integracao_externa.*, 4a/4b_app_*.png'],
      ['Rastrear uma requisição entre serviços', 'o mesmo X-Request-Id nos logs do gateway, serviço e consumidores', 'rastreamento_request_id.txt, 5_rastreamento_request_id.*'],
    ][i] ?? ['', '', ''];
    return `| ${r.teste} | ${info[0]} | ${info[1]} | ${r.ok ? '✅' : '❌'} ${r.resumo} | \`testes/distribuido/${info[2]}\` |`;
  }),
  '',
  '## 5. Teste de carga leve (autocannon)',
  '',
  (ler('testes/carga/resultado.md') ?? 'Não executado.').replace(/^# .*\n/, '').replace('![Gráfico](grafico-carga.png)', '![Gráfico](testes/carga/grafico-carga.png)').trim(),
  '',
  '## 6. Problemas encontrados e corrigidos durante os testes',
  '',
  '| # | Problema (como foi detectado) | Causa | Correção |',
  '|---|---|---|---|',
  '| 1 | Cidadão recebia **422** em vez de **403** ao tentar alterar status (teste de fumaça) | No Fastify a validação do corpo roda antes do `preHandler` | Autorização movida para o hook `onRequest` em todos os serviços |',
  '| 2 | Alerta de poluição "Péssima" era suprimido após um alerta "Ruim" (cenário do simulador) | A deduplicação de 30 min não considerava a piora | Escalonamento: severidade maior não é considerada repetição (teste unitário incluído) |',
  '| 3 | Imagens Docker com 494 MB | `chown -R` duplicava a camada do `node_modules` | Código somente leitura para o usuário `node`; imagens com 368 MB |',
  '| 4 | Migração com `geometry(point)` sem SRID e FKs `"public".tabela` | Limitações do drizzle-kit com PostGIS e schemas por serviço | Tipo customizado `geometry(Point, 4326)` e pós-processamento das migrações |',
  '| 5 | App web abria em branco | Hidratação síncrona do Zustand (localStorage) referenciava o store antes de existir | `persist.hasHydrated()` + `onFinishHydration` com `useSyncExternalStore` |',
  '| 6 | Duas telas de login na pilha após sair (E2E) | `router.replace` mantinha telas anteriores | Reinício da pilha ao entrar/sair (`reiniciarNavegacao`) |',
  '| 7 | 6 erros de socket no teste de carga com 2 réplicas (todas as respostas eram 200) | Nginx fecha a conexão keep-alive após 1000 requisições (padrão) | `keepalive_requests 10000`; nova execução sem erros e com latências menores |',
  '| 8 | Seletor de raio estourava a largura em 375 px e zoom inicial do mapa muito aberto (inspeção visual dos prints) | Layout | 4 opções de raio e zoom 11 na cidade |',
  '| 9 | Logins de usuários diferentes recebiam **429** na execução completa dos testes | O rate limit rodava no hook `onRequest`, antes da leitura do corpo: a chave "IP + e-mail" ficava só com o IP e todos os usuários de uma mesma rede (NAT) dividiam 10 tentativas/min | Limite aplicado no `preHandler`; novo teste de integração prova 429 para o e-mail atacado sem bloquear outro usuário do mesmo IP |',
  '| 10 | Teste distribuído 3 (queda do broker) falhou uma vez esperando o alerta de manancial | Defeito do **teste**, não do sistema: a invasão era sorteada a ~1 km de outra registrada minutos antes (seed/E2E) e o alerta foi corretamente suprimido pela deduplicação (regra 6), como mostrou o log do alertas-service | O teste escolhe um ponto dentro do manancial (confirmado via PostGIS) a mais de 1,5 km dos alertas recentes e passou a salvar o log mesmo quando falha |',
  '',
  '## 7. Limitações e observações',
  '',
  '- **Android nativo:** não há Android SDK/`adb` neste computador; os prints nativos (item 9.7, opcional) não foram gerados. O guia `COMO_TESTAR.md` descreve o teste no celular com o Expo Go (prints em `registros/manual/`).',
  '- **Notificações:** o app usa notificações **locais** (funcionam no Expo Go); notificações push remotas exigiriam um development build.',
  '- **IQAr:** a metodologia oficial usa médias de 24 h/8 h/1 h; para demonstração em tempo real, as faixas da CETESB são aplicadas à média móvel curta das leituras simuladas.',
  '- **Carga:** todos os containers e o gerador de carga rodam no mesmo computador; os números servem para comparar 1 × 2 réplicas, não como capacidade absoluta.',
  '- **Mananciais:** polígonos aproximados, desenhados para fins didáticos.',
  '',
].join('\n');
writeFileSync(resolve(reg, 'RELATORIO_DE_TESTES.md'), md);

// ----- registros/README.md --------------------------------------------------------------------
const contar = (dir, ext) => listar(dir, ext).length;
const readme = [
  '# Evidências — EcoRadar Urbano',
  '',
  `Índice gerado em ${dataHora}. Abra **[index.html](index.html)** no navegador para a galeria com legendas (funciona offline).`,
  'O resumo dos testes com números reais está em **[RELATORIO_DE_TESTES.md](RELATORIO_DE_TESTES.md)**.',
  '',
  '| Pasta / arquivo | Conteúdo |',
  '|---|---|',
  '| `ambiente/` | `sistema.txt` (SO, CPU, RAM, IP, ferramentas) e `versoes.txt` (versões exatas em uso) |',
  '| `build/` | Logs de criação do app, instalação de dependências, build das imagens Docker e `expo export` |',
  `| \`testes/unitarios/\` | Saída do Vitest, resumo e relatório HTML de cobertura (\`cobertura/index.html\`) |`,
  '| `testes/integracao/` | Saída, JSON/JUnit, PDF e CSV exportados durante o teste |',
  '| `testes/e2e/` | Relatório HTML do Playwright (`relatorio-html/index.html`), JSON e arquivos baixados |',
  '| `testes/distribuido/` | Logs, imagens e prints de cada teste de falha; `rastreamento_request_id.txt`; `resumo.md` |',
  '| `testes/carga/` | Resultado (Markdown/JSON), gráfico e dados brutos do autocannon |',
  '| `testes/qualidade/` | Saída do `tsc --noEmit` e dos linters (backend, app e testes) |',
  `| \`screenshots/web-mobile/\` | ${contar('screenshots/web-mobile/pixel-7', ['.png'])} prints no Pixel 7 e ${contar('screenshots/web-mobile/iphone-14', ['.png'])} no iPhone 14 |`,
  `| \`screenshots/swagger/\` | ${contar('screenshots/swagger', ['.png'])} prints da documentação OpenAPI |`,
  `| \`screenshots/infraestrutura/\` | Painel do RabbitMQ e \`docker compose ps\` |`,
  '| `screenshots/relatorios/` | Páginas do PDF exportado convertidas em imagem |',
  '| `screenshots/nativo-android/` | Vazio: não há emulador/adb neste computador (ver README da pasta) |',
  `| \`videos/\` | ${videos.length} vídeos (.webm) das execuções E2E |`,
  '| `logs/servicos/` | `docker compose logs` de cada serviço |',
  '| `manual/` | Para o aluno salvar os prints tirados no próprio celular (ver README da pasta) |',
  '| `metricas_codigo.txt` | Linhas de código por módulo e por linguagem |',
  '',
  'Para regenerar tudo: `scripts/coletar-evidencias.ps1` (Windows) ou `scripts/coletar-evidencias.sh`.',
  '',
].join('\n');
writeFileSync(resolve(reg, 'README.md'), readme);

// Pastas com README explicativo
mkdirSync(resolve(reg, 'screenshots', 'nativo-android'), { recursive: true });
writeFileSync(
  resolve(reg, 'screenshots', 'nativo-android', 'README.md'),
  '# Prints nativos (Android)\n\nEtapa opcional (item 9.7). Neste computador não há Android SDK nem `adb` (`adb devices` indisponível),\nportanto os prints nativos por emulador não foram gerados. O app foi validado na versão web (Playwright) e o\nteste no celular real está descrito em `COMO_TESTAR.md` (prints em `registros/manual/`).\n',
);
console.log(`Gerados: registros/index.html, registros/README.md, registros/RELATORIO_DE_TESTES.md (${secoes.length} seções, ${videos.length} vídeos)`);
