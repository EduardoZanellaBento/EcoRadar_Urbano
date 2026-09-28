/**
 * Testes de sistema distribuído (item 9.4 da APS). Executa, em sequência, contra a stack real:
 *  1. Balanceamento de carga entre as 2 réplicas do ocorrencias-service
 *  2. Tolerância a falha de uma réplica
 *  3. Queda do broker (RabbitMQ) e consistência eventual via Transactional Outbox
 *  4. Falha da integração externa (Open-Meteo) e circuit breaker
 *  5. Rastreamento de uma requisição pelo X-Request-Id nos logs de todos os serviços
 * Cada teste grava log detalhado (.txt), imagem do log (.png) e prints do app em
 * registros/testes/distribuido. Uso: npm run distribuido (na pasta tests)
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import { REGISTROS, aguardar, esperar, login, novaOcorrencia, req } from '../utils/api.js';
import { compose, saudeDoServico } from '../utils/docker.js';
import { terminalParaPng } from '../utils/imagem.js';
import { abrirApp, fecharNavegador, visivel } from '../utils/navegador.js';

const SAIDA = resolve(REGISTROS, 'testes', 'distribuido');
mkdirSync(SAIDA, { recursive: true });

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');

class Registro {
  readonly linhas: string[] = [];
  constructor(readonly titulo: string) {
    this.log(`== ${titulo}`);
  }
  log(msg: string) {
    const linha = `[${hora()}] ${msg}`;
    console.log(linha);
    this.linhas.push(linha);
  }
  bloco(titulo: string, texto: string) {
    this.log(`>> ${titulo}`);
    for (const l of texto.trim().split(/\r?\n/)) this.linhas.push(`   ${l}`);
  }
  async salvar(nome: string) {
    const texto = this.linhas.join('\n');
    writeFileSync(resolve(SAIDA, `${nome}.txt`), texto + '\n', 'utf-8');
    await terminalParaPng(this.titulo, texto, resolve(SAIDA, `${nome}.png`));
  }
}

interface Resultado {
  teste: string;
  ok: boolean;
  resumo: string;
}
const resultados: Resultado[] = [];

async function print(pagina: Awaited<ReturnType<typeof abrirApp>>, nome: string) {
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: resolve(SAIDA, `${nome}.png`) });
  await pagina.context().close();
}

async function aguardarSaudavel(servico: string, reg: Registro, timeoutMs = 180_000) {
  const inicio = Date.now();
  await aguardar(`${servico} healthy`, async () => saudeDoServico(servico) === 'healthy', timeoutMs, 2000);
  reg.log(`${servico} está healthy novamente (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
}

async function distribuicao(token: string, n: number, reg: Registro) {
  const contagem: Record<string, number> = {};
  let sucesso = 0;
  for (let i = 1; i <= n; i++) {
    const r = await req('GET', '/api/ocorrencias?tamanhoPagina=1', { token });
    const inst = r.cabecalhos.get('x-instance-id') ?? '(sem cabeçalho)';
    contagem[inst] = (contagem[inst] ?? 0) + 1;
    if (r.status === 200) sucesso++;
    reg.log(`requisição ${String(i).padStart(2, '0')} -> HTTP ${r.status}  X-Instance-Id: ${inst.padEnd(14)} ${r.ms} ms  X-Request-Id: ${r.cabecalhos.get('x-request-id')}`);
  }
  return { contagem, sucesso };
}

// ---------------------------------------------------------------------------------------------
async function teste1Balanceamento() {
  const reg = new Registro('Teste 1 — Balanceamento de carga (Nginx round-robin, 2 réplicas)');
  const token = await login('ana@ecoradar.local');
  const { contagem, sucesso } = await distribuicao(token, 20, reg);
  reg.log(`Resumo: ${sucesso}/20 com sucesso · distribuição ${JSON.stringify(contagem)}`);
  const ok = sucesso === 20 && (contagem['ocorrencias-1'] ?? 0) >= 5 && (contagem['ocorrencias-2'] ?? 0) >= 5;
  reg.log(ok ? '✓ PASSOU: as requisições foram distribuídas entre as duas réplicas' : '✗ FALHOU: distribuição inesperada');
  await reg.salvar('1_balanceamento');
  resultados.push({ teste: 'Balanceamento de carga', ok, resumo: `20 requisições: ${Object.entries(contagem).map(([k, v]) => `${k}=${v}`).join(', ')}` });
}

// ---------------------------------------------------------------------------------------------
async function teste2FalhaReplica() {
  const reg = new Registro('Teste 2 — Tolerância a falha de uma réplica do ocorrencias-service');
  const token = await login('ana@ecoradar.local');
  reg.bloco('docker compose stop ocorrencias-service-2', compose('stop ocorrencias-service-2'));
  reg.log(`Estado da réplica 2: ${saudeDoServico('ocorrencias-service-2')}`);
  const durante = await distribuicao(token, 20, reg);
  const criada = await req('POST', '/api/ocorrencias', { token, corpo: novaOcorrencia({ descricao: 'Teste distribuído: registro com uma réplica fora do ar' }) });
  reg.log(`POST /api/ocorrencias com uma réplica fora -> HTTP ${criada.status} (instância ${criada.cabecalhos.get('x-instance-id')})`);
  // Print da tela de status do app durante a falha (teste de balanceamento com 1 réplica)
  const status = await abrirApp('admin@ecoradar.local', '/status');
  await expect(visivel(status, 'botao-testar-balanceamento')).toBeVisible({ timeout: 30_000 });
  await visivel(status, 'botao-testar-balanceamento').scrollIntoViewIfNeeded();
  await visivel(status, 'botao-testar-balanceamento').click();
  await expect(visivel(status, 'cartao-balanceamento')).toContainText('ocorrencias-1', { timeout: 30_000 });
  await print(status, '2a_app_status_uma_replica');

  reg.bloco('docker compose start ocorrencias-service-2', compose('start ocorrencias-service-2'));
  await aguardarSaudavel('ocorrencias-service-2', reg);
  await esperar(6000); // DNS do Nginx (resolver valid=5s) volta a enxergar a réplica
  const depois = await distribuicao(token, 20, reg);
  const ok =
    durante.sucesso === 20 &&
    criada.status === 201 &&
    Object.keys(durante.contagem).every((k) => k === 'ocorrencias-1') &&
    (depois.contagem['ocorrencias-2'] ?? 0) > 0;
  reg.log(`Durante a falha: ${durante.sucesso}/20 OK ${JSON.stringify(durante.contagem)} · depois de religar: ${JSON.stringify(depois.contagem)}`);
  reg.log(ok ? '✓ PASSOU: sem erros para o usuário durante a falha e a réplica voltou ao rodízio' : '✗ FALHOU');
  await reg.salvar('2_falha_de_replica');
  resultados.push({ teste: 'Tolerância a falha de réplica', ok, resumo: `réplica 2 parada: ${durante.sucesso}/20 sucesso (todas em ocorrencias-1); religada: ${JSON.stringify(depois.contagem)}` });
}

// ---------------------------------------------------------------------------------------------
async function teste3QuedaBroker() {
  const reg = new Registro('Teste 3 — Queda do RabbitMQ e consistência eventual (Transactional Outbox)');
  const admin = await login('admin@ecoradar.local');
  const elisa = await login('elisa@ecoradar.local');
  const base = await req('GET', '/api/relatorios/estatisticas', { token: admin });
  const totalInicial = base.corpo.total as number;
  reg.log(`Estatísticas antes: ${totalInicial} ocorrências na visão de leitura (relatorios-service)`);
  const inicioQueda = Date.now();
  const desde = new Date(inicioQueda - 5000).toISOString();
  reg.bloco('docker compose stop rabbitmq', compose('stop rabbitmq'));

  // Ocorrências criadas com o broker FORA: gravadas no banco + outbox, eventos pendentes
  const criadas: string[] = [];
  const pontoInvasao = { latitude: -23.8 + (Math.random() - 0.5) * 0.02, longitude: -46.55 + (Math.random() - 0.5) * 0.02 };
  for (let i = 0; i < 5; i++) {
    const dados =
      i === 0
        ? novaOcorrencia({ categoria: 'INVASAO_MANANCIAL', severidade: 'ALTA', descricao: 'Teste distribuído: invasão registrada com o broker fora', ...pontoInvasao })
        : novaOcorrencia({ categoria: 'DESCARTE_IRREGULAR_LIXO', descricao: `Teste distribuído: registro ${i + 1} com o broker fora` });
    const r = await req('POST', '/api/ocorrencias', { token: elisa, corpo: dados });
    criadas.push(r.corpo.id);
    reg.log(`POST /api/ocorrencias (broker fora) -> HTTP ${r.status} id=${r.corpo.id} instância=${r.cabecalhos.get('x-instance-id')}`);
  }
  const pend = await req('GET', '/api/ocorrencias/sistema/outbox', { token: admin });
  reg.log(`Outbox com o broker fora: ${pend.corpo.pendentes} evento(s) PENDENTE(S) — nada foi perdido, está guardado no banco`);
  const pronto = await req('GET', '/api/ocorrencias/ready');
  reg.log(`/api/ocorrencias/ready -> HTTP ${pronto.status} ${JSON.stringify(pronto.corpo.verificacoes)} (serviço segue atendendo)`);
  const statusFora = await abrirApp('admin@ecoradar.local', '/status');
  await expect(visivel(statusFora, 'estado-outbox')).toContainText('pendentes', { timeout: 30_000 });
  await visivel(statusFora, 'estado-outbox').scrollIntoViewIfNeeded();
  await print(statusFora, '3a_app_status_broker_fora');

  const restante = 20_000 - (Date.now() - inicioQueda);
  if (restante > 0) await esperar(restante);
  reg.log(`Broker ficou fora por ${((Date.now() - inicioQueda) / 1000).toFixed(1)} s`);
  const religado = Date.now();
  reg.bloco('docker compose start rabbitmq', compose('start rabbitmq'));
  await aguardarSaudavel('rabbitmq', reg);

  await aguardar('outbox zerado', async () => (await req('GET', '/api/ocorrencias/sistema/outbox', { token: admin })).corpo.pendentes === 0, 180_000, 2000);
  reg.log(`Outbox zerado ${((Date.now() - religado) / 1000).toFixed(1)} s após religar o broker (reconexão com backoff exponencial)`);
  const est = await aguardar(
    'relatórios atualizados',
    async () => {
      const r = await req('GET', '/api/relatorios/estatisticas', { token: admin });
      return r.corpo.total >= totalInicial + 5 ? r.corpo : false;
    },
    120_000,
    2000,
  );
  reg.log(`Relatórios atualizados: ${totalInicial} -> ${est.total} ocorrências (${((Date.now() - religado) / 1000).toFixed(1)} s após religar)`);
  const alerta = await aguardar(
    'alerta prioritário do manancial',
    async () => {
      const r = await req('GET', '/api/alertas?status=TODOS&tipo=PRIORITARIO_MANANCIAL', { token: admin });
      return r.corpo.itens.find((a: { referenciaId: string }) => a.referenciaId === criadas[0]);
    },
    120_000,
    2000,
  );
  reg.log(`Alerta gerado após a volta do broker: "${alerta.titulo}" (${alerta.severidade})`);
  const statusVolta = await abrirApp('admin@ecoradar.local', '/status');
  await expect(visivel(statusVolta, 'estado-outbox')).toContainText('0 pendentes', { timeout: 30_000 });
  await visivel(statusVolta, 'estado-outbox').scrollIntoViewIfNeeded();
  await print(statusVolta, '3b_app_status_broker_restabelecido');

  const logs = compose(`logs --no-color --since ${desde} ocorrencias-service-1 ocorrencias-service-2 alertas-service relatorios-service`, { ignorarErro: true })
    .split('\n')
    .filter((l) => /RabbitMQ|AMQP|backoff|outbox|Conectado/i.test(l))
    .slice(0, 40)
    .map((l) => l.replace(/"stack":"[^"]*"/g, '"stack":"…"').slice(0, 260))
    .join('\n');
  reg.bloco('Trechos dos logs: perda de conexão, backoff exponencial, reconexão e publicação do outbox', logs);
  const ok = pend.corpo.pendentes >= 5 && est.total >= totalInicial + 5 && Boolean(alerta);
  reg.log(ok ? '✓ PASSOU: nenhum evento perdido; relatórios e alertas atualizados após a volta do broker (consistência eventual)' : '✗ FALHOU');
  await reg.salvar('3_queda_do_broker');
  resultados.push({
    teste: 'Queda do broker + outbox',
    ok,
    resumo: `${pend.corpo.pendentes} eventos pendentes com o broker fora ~20 s; outbox zerado e relatórios ${totalInicial}→${est.total} após religar; alerta de manancial gerado`,
  });
}

// ---------------------------------------------------------------------------------------------
async function teste4FalhaIntegracao() {
  const reg = new Registro('Teste 4 — Falha da integração externa (Open-Meteo) e circuit breaker');
  const admin = await login('admin@ecoradar.local');
  const antes = await req('GET', '/api/ambiental/resumo?atualizar=true');
  reg.log(`Antes: fonte=${antes.corpo.openMeteo.fonte} circuito=${antes.corpo.openMeteo.estadoCircuito}`);
  const falha = await req('POST', '/api/ambiental/integracoes/simular-falha', { token: admin, corpo: { ativo: true } });
  reg.log(`POST /api/ambiental/integracoes/simular-falha {ativo:true} -> HTTP ${falha.status} (requisições passam a ir para um host inexistente .invalid)`);
  let ultimo = antes;
  for (let i = 1; i <= 8; i++) {
    ultimo = await req('GET', '/api/ambiental/resumo?atualizar=true');
    const om = ultimo.corpo.openMeteo;
    reg.log(`consulta ${i}: fonte=${om.fonte.padEnd(12)} circuito=${om.estadoCircuito.padEnd(12)} ${ultimo.ms} ms  motivo: ${om.motivo ?? '-'}`);
    if (om.estadoCircuito === 'ABERTO' && i >= 4) break;
  }
  const st = await req('GET', '/api/ambiental/status-integracoes');
  reg.log(`status-integracoes: ${JSON.stringify(st.corpo.openMeteo.estatisticas)} estado=${st.corpo.openMeteo.estadoCircuito}`);
  const app = await abrirApp('ana@ecoradar.local', '/ambiental');
  await expect(visivel(app, 'fonte-open-meteo')).toContainText('DADOS EM CACHE', { timeout: 30_000 });
  await visivel(app, 'cartao-open-meteo').scrollIntoViewIfNeeded();
  await print(app, '4a_app_dados_em_cache');
  const status = await abrirApp('admin@ecoradar.local', '/status');
  await visivel(status, 'cartao-integracoes').scrollIntoViewIfNeeded();
  await expect(visivel(status, 'estado-circuito')).toContainText('ABERTO', { timeout: 30_000 });
  await print(status, '4b_app_status_circuito_aberto');

  await req('POST', '/api/ambiental/integracoes/simular-falha', { token: admin, corpo: { ativo: false } });
  reg.log('Falha simulada desligada; aguardando o resetTimeout (30 s) para o circuito testar a API (MEIO_ABERTO)…');
  const recuperado = await aguardar(
    'circuito fechado novamente',
    async () => {
      const r = await req('GET', '/api/ambiental/resumo?atualizar=true');
      return r.corpo.openMeteo.estadoCircuito === 'FECHADO' && r.corpo.openMeteo.fonte === 'ao_vivo' ? r.corpo.openMeteo : false;
    },
    90_000,
    5000,
  );
  reg.log(`Recuperado: fonte=${recuperado.fonte} circuito=${recuperado.estadoCircuito} atualizadoEm=${recuperado.atualizadoEm}`);
  const ok = ultimo.corpo.openMeteo.fonte === 'cache' && ultimo.corpo.openMeteo.estadoCircuito === 'ABERTO' && recuperado.estadoCircuito === 'FECHADO';
  reg.log(ok ? '✓ PASSOU: circuito abriu, o app mostrou o último dado em cache e a integração se recuperou sozinha' : '✗ FALHOU');
  await reg.salvar('4_falha_integracao_externa');
  resultados.push({ teste: 'Falha da Open-Meteo + circuit breaker', ok, resumo: 'circuito ABERTO e fonte "cache" durante a falha; FECHADO e "ao_vivo" após o resetTimeout' });
}

// ---------------------------------------------------------------------------------------------
async function teste5Rastreamento() {
  const reg = new Registro('Teste 5 — Rastreamento distribuído pelo X-Request-Id');
  const token = await login('bruno@ecoradar.local');
  const id = `rastreio-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const desde = new Date(Date.now() - 2000).toISOString();
  const r = await req('POST', '/api/ocorrencias', {
    token,
    corpo: novaOcorrencia({ categoria: 'TRANSITO', descricao: 'Teste de rastreamento distribuído' }),
    cabecalhos: { 'X-Request-Id': id },
  });
  reg.log(`POST /api/ocorrencias com X-Request-Id: ${id} -> HTTP ${r.status}; resposta devolveu X-Request-Id=${r.cabecalhos.get('x-request-id')}`);
  await esperar(6000); // outbox -> RabbitMQ -> consumidores
  const logs = compose(`logs --no-color --since ${desde}`, { ignorarErro: true });
  const linhas = logs.split('\n').filter((l) => l.includes(id));
  const servicos = [...new Set(linhas.map((l) => l.split('|')[0].trim()))];
  writeFileSync(resolve(SAIDA, 'rastreamento_request_id.txt'), `X-Request-Id: ${id}\nServiços onde o ID aparece: ${servicos.join(', ')}\n\n${linhas.join('\n')}\n`, 'utf-8');
  reg.log(`Linhas de log com o ID: ${linhas.length} · serviços: ${servicos.join(', ')}`);
  for (const l of linhas) reg.linhas.push(`   ${l.replace(/\s+/g, ' ').slice(0, 250)}`);
  const esperados = ['gateway', 'ocorrencias-service', 'alertas-service', 'relatorios-service'];
  const ok = esperados.every((s) => servicos.some((x) => x.includes(s)));
  reg.log(ok ? '✓ PASSOU: o mesmo ID aparece no gateway, no serviço que atendeu e nos consumidores do evento' : `✗ FALHOU: esperados ${esperados.join(', ')}`);
  await reg.salvar('5_rastreamento_request_id');
  resultados.push({ teste: 'Rastreamento por X-Request-Id', ok, resumo: `ID encontrado em: ${servicos.join(', ')}` });
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const inicio = Date.now();
  const etapas: Array<[string, () => Promise<void>]> = [
    ['1', teste1Balanceamento],
    ['2', teste2FalhaReplica],
    ['3', teste3QuedaBroker],
    ['4', teste4FalhaIntegracao],
    ['5', teste5Rastreamento],
  ];
  const filtro = process.argv.slice(2);
  for (const [n, fn] of etapas) {
    if (filtro.length && !filtro.includes(n)) continue;
    try {
      await fn();
    } catch (e) {
      console.error(`Teste ${n} falhou com erro:`, e);
      resultados.push({ teste: `Teste ${n}`, ok: false, resumo: `erro: ${(e as Error).message.slice(0, 200)}` });
    }
  }
  await fecharNavegador();
  const md = [
    '# Testes de sistema distribuído',
    '',
    `Executado em ${new Date().toLocaleString('pt-BR')} · duração ${((Date.now() - inicio) / 1000).toFixed(0)} s`,
    '',
    '| Teste | Resultado | Resumo |',
    '|---|---|---|',
    ...resultados.map((r) => `| ${r.teste} | ${r.ok ? '✅ passou' : '❌ falhou'} | ${r.resumo} |`),
    '',
  ].join('\n');
  writeFileSync(resolve(SAIDA, filtro.length ? `resumo-parcial-${filtro.join('-')}.md` : 'resumo.md'), md, 'utf-8');
  console.log(md);
  process.exit(resultados.every((r) => r.ok) ? 0 : 1);
}

void main();
