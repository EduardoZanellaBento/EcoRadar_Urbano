import {
  ClienteAmqp,
  ESTACOES_PADRAO,
  aguardarBanco,
  cidadePadrao,
  configurarEncerramento,
  criarDb,
  criarLogger,
  criarPool,
  criarServidor,
  env,
  envNumero,
  executarMigracoes,
  iniciarServidor,
  registrarJwt,
  resolverPastaMigracoes,
  verificarBanco,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { AssinanteMqtt } from './integracoes/mqtt.js';
import { IntegracaoOpenMeteo } from './integracoes/open-meteo.js';
import { ProcessadorLeituras } from './processador.js';
import { limparLeituras, persistenciaCache, sincronizarEstacoes } from './repositorio.js';
import { registrarRotas } from './rotas.js';

const SERVICO = 'ambiental-service';
const logger = criarLogger(SERVICO);

async function main() {
  const pool = criarPool(env('DATABASE_URL'), SERVICO, logger);
  const db = criarDb(pool, schema);
  await aguardarBanco(pool, logger);
  await executarMigracoes(pool, db, { pasta: resolverPastaMigracoes(import.meta.url), schema: env('DB_SCHEMA', 'ambiental'), logger });
  await sincronizarEstacoes(db, ESTACOES_PADRAO);
  logger.info({ quantidade: ESTACOES_PADRAO.length }, 'Estações ambientais sincronizadas');

  const amqp = new ClienteAmqp({ url: env('AMQP_URL'), nomeServico: SERVICO, logger });
  amqp.iniciar();

  const cidade = cidadePadrao();
  const openMeteo = new IntegracaoOpenMeteo({
    urlAr: env('OPEN_METEO_AR_URL', 'https://air-quality-api.open-meteo.com/v1/air-quality'),
    urlClima: env('OPEN_METEO_CLIMA_URL', 'https://api.open-meteo.com/v1/forecast'),
    latitude: cidade.latitude,
    longitude: cidade.longitude,
    timeoutMs: envNumero('OPEN_METEO_TIMEOUT_MS', 5000),
    ttlMs: envNumero('OPEN_METEO_CACHE_TTL_S', 600) * 1000,
    logger,
    persistencia: persistenciaCache(db, 'open-meteo'),
  });
  await openMeteo.carregarCachePersistido();
  // Atualização em segundo plano (o /resumo responde rápido usando o cache)
  void openMeteo.obter(true);
  const atualizacao = setInterval(() => void openMeteo.obter(true), envNumero('OPEN_METEO_CACHE_TTL_S', 600) * 1000);
  atualizacao.unref();

  const processador = new ProcessadorLeituras({ db, amqp, logger, estacoes: new Map(ESTACOES_PADRAO.map((e) => [e.id, e])) });
  const mqtt = new AssinanteMqtt({
    url: env('MQTT_URL', 'mqtt://rabbitmq:1883'),
    usuario: env('MQTT_USUARIO'),
    senha: env('MQTT_SENHA'),
    topico: 'ecoradar/sensores/+/leituras',
    logger,
    aoReceber: (topico, conteudo) => processador.processar(topico, conteudo),
  });
  mqtt.iniciar();
  const limpeza = setInterval(() => void limparLeituras(db).catch(() => undefined), 60 * 60 * 1000);
  limpeza.unref();

  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/ambiental',
    titulo: 'EcoRadar Urbano — ambiental-service',
    descricao:
      'Telemetria das estações (MQTT), cálculo do IQAr (CETESB/CONAMA 491/2018), inversão térmica, nível de córregos ' +
      'e integração com a Open-Meteo protegida por circuit breaker e cache.',
    logger,
    prontidao: { banco: () => verificarBanco(pool), broker: () => amqp.conectado, mqtt: () => mqtt.conectado },
    tags: [
      { name: 'Estações', description: 'Estações ambientais e séries temporais' },
      { name: 'Resumo', description: 'Visão geral da qualidade ambiental' },
    ],
  });
  await registrarJwt(app);
  await registrarRotas(app, { db, openMeteo, mqtt, amqp, processador });

  configurarEncerramento(logger, [
    { nome: 'servidor HTTP', executar: () => app.close() },
    { nome: 'assinante MQTT', executar: () => mqtt.fechar() },
    { nome: 'circuit breaker', executar: () => openMeteo.encerrar() },
    { nome: 'conexão AMQP', executar: () => amqp.fechar() },
    { nome: 'pool do PostgreSQL', executar: () => pool.end() },
  ]);
  await iniciarServidor(app);
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o serviço');
  process.exit(1);
});
