import { randomUUID } from 'node:crypto';
import mqtt, { type MqttClient } from 'mqtt';
import { z } from 'zod';
import {
  ESTACOES_PADRAO,
  Erros,
  INSTANCIA_ID,
  autenticar,
  calcularBackoff,
  configurarEncerramento,
  criarLogger,
  criarServidor,
  env,
  envNumero,
  exigirPerfil,
  iniciarServidor,
  registrarJwt,
  seguranca,
} from '@ecoradar/shared';
import { estadoInicial, gerarLeitura, validarCenario, type CenarioAtivo, type EstadoEstacao } from './dominio/modelo.js';

const SERVICO = 'sensor-simulator';
const logger = criarLogger(SERVICO);

async function main() {
  const intervaloMs = envNumero('SIMULADOR_INTERVALO_MS', 5000);
  const estados = new Map<string, EstadoEstacao>(ESTACOES_PADRAO.map((e) => [e.id, estadoInicial(e)]));
  const estatisticas = { publicadas: 0, descartadasOffline: 0, ultimaPublicacaoEm: null as string | null };
  let cenario: CenarioAtivo | null = null;

  // ----- Cliente MQTT com reconexão por backoff exponencial ---------------------------
  let tentativa = 0;
  let timerReconexao: NodeJS.Timeout | null = null;
  let encerrando = false;
  const cliente: MqttClient = mqtt.connect(env('MQTT_URL', 'mqtt://rabbitmq:1883'), {
    username: env('MQTT_USUARIO'),
    password: env('MQTT_SENHA'),
    clientId: `sensor-simulator-${INSTANCIA_ID}`,
    reconnectPeriod: 0,
    connectTimeout: 5000,
    protocolVersion: 4,
  });
  cliente.on('connect', () => {
    logger.info({ tentativasAnteriores: tentativa }, 'Simulador conectado ao broker MQTT');
    tentativa = 0;
  });
  cliente.on('error', (erro) => logger.warn({ err: erro }, 'Erro no cliente MQTT'));
  cliente.on('close', () => {
    if (encerrando || timerReconexao) return;
    const atrasoMs = calcularBackoff(tentativa++, { baseMs: 1000, maximoMs: 30_000 });
    logger.warn({ tentativa, atrasoMs }, 'Conexão MQTT perdida; reconectando com backoff exponencial');
    timerReconexao = setTimeout(() => {
      timerReconexao = null;
      if (!encerrando) cliente.reconnect();
    }, atrasoMs);
  });

  // ----- Laço de publicação --------------------------------------------------------------
  const publicar = () => {
    const agora = new Date();
    if (cenario && agora.getTime() > cenario.fim) {
      logger.info({ cenario: cenario.tipo }, 'Cenário encerrado; voltando às leituras normais');
      cenario = null;
    }
    for (const estacao of ESTACOES_PADRAO) {
      const leitura = gerarLeitura(estacao, agora, estados.get(estacao.id)!, cenario);
      if (!cliente.connected) {
        estatisticas.descartadasOffline++;
        continue;
      }
      const mensagem = { ...leitura, correlationId: randomUUID() };
      cliente.publish(`ecoradar/sensores/${estacao.id}/leituras`, JSON.stringify(mensagem), { qos: 1 }, (erro) => {
        if (erro) logger.warn({ err: erro, estacaoId: estacao.id }, 'Falha ao publicar leitura');
      });
      estatisticas.publicadas++;
      estatisticas.ultimaPublicacaoEm = agora.toISOString();
      if (leitura.cenario) logger.info({ requestId: mensagem.correlationId, estacaoId: estacao.id, cenario: leitura.cenario }, 'Leitura de cenário publicada');
    }
  };
  const laco = setInterval(publicar, intervaloMs);

  // ----- API HTTP (modo cenário) ------------------------------------------------------------
  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/simulador',
    titulo: 'EcoRadar Urbano — sensor-simulator',
    descricao: 'Simula as estações ambientais publicando leituras via MQTT a cada 5 s e permite forçar cenários (demonstração).',
    logger,
    prontidao: { mqtt: () => cliente.connected },
    tags: [{ name: 'Simulador', description: 'Estado e cenários de demonstração' }],
  });
  await registrarJwt(app);

  app.get('/api/simulador/estado', {
    onRequest: autenticar,
    schema: { tags: ['Simulador'], summary: 'Estado do simulador e cenário ativo', security: seguranca },
    handler: async () => ({
      intervaloMs,
      conectadoMqtt: cliente.connected,
      estacoes: ESTACOES_PADRAO.map((e) => ({ id: e.id, nome: e.nome, tipos: e.tipos })),
      cenarioAtivo: cenario
        ? { tipo: cenario.tipo, estacaoId: cenario.estacaoId, inicio: new Date(cenario.inicio).toISOString(), fim: new Date(cenario.fim).toISOString() }
        : null,
      estatisticas,
    }),
  });

  app.post('/api/simulador/cenario', {
    onRequest: exigirPerfil('ADMIN'),
    schema: {
      tags: ['Simulador'],
      summary: 'Força um cenário (ALAGAMENTO, POLUICAO_CRITICA, INVERSAO_TERMICA ou NORMAL) — somente ADMIN',
      security: seguranca,
      body: z.object({
        tipo: z.enum(['ALAGAMENTO', 'POLUICAO_CRITICA', 'INVERSAO_TERMICA', 'NORMAL']),
        estacaoId: z.string().optional().nullable(),
        duracaoSegundos: z.coerce.number().int().min(10).max(900).default(120),
      }),
    },
    handler: async (req, reply) => {
      const { tipo, estacaoId, duracaoSegundos } = req.body;
      if (tipo === 'NORMAL') {
        cenario = null;
        req.log.info({ por: req.user.sub }, 'Cenário normal restaurado');
        return reply.status(200).send({ mensagem: 'Leituras normais restauradas.', cenarioAtivo: null });
      }
      const estacao = estacaoId ? ESTACOES_PADRAO.find((e) => e.id === estacaoId) : undefined;
      const problema = validarCenario(tipo, estacao, estacaoId);
      if (problema) throw Erros.validacao(problema);
      const inicio = Date.now();
      cenario = { tipo, estacaoId: estacaoId ?? null, inicio, fim: inicio + duracaoSegundos * 1000 };
      req.log.warn({ cenario: tipo, estacaoId, duracaoSegundos, por: req.user.sub }, 'Cenário de demonstração ativado');
      publicar(); // aplica imediatamente, sem esperar o próximo ciclo
      return reply.status(202).send({
        mensagem: `Cenário ${tipo} ativado por ${duracaoSegundos} s.`,
        cenarioAtivo: { tipo, estacaoId: estacaoId ?? null, inicio: new Date(inicio).toISOString(), fim: new Date(cenario.fim).toISOString() },
      });
    },
  });

  configurarEncerramento(logger, [
    { nome: 'laço de publicação', executar: () => clearInterval(laco) },
    { nome: 'servidor HTTP', executar: () => app.close() },
    {
      nome: 'cliente MQTT',
      executar: () =>
        new Promise<void>((resolve) => {
          encerrando = true;
          if (timerReconexao) clearTimeout(timerReconexao);
          cliente.end(false, {}, () => resolve());
        }),
    },
  ]);
  await iniciarServidor(app);
  logger.info({ estacoes: ESTACOES_PADRAO.length, intervaloMs }, 'Simulador de sensores iniciado');
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o simulador');
  process.exit(1);
});
