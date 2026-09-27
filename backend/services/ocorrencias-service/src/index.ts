import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {
  ClienteAmqp,
  aguardarBanco,
  configurarEncerramento,
  criarDb,
  criarLogger,
  criarPool,
  criarServidor,
  env,
  executarMigracoes,
  iniciarServidor,
  registrarJwt,
  resolverPastaMigracoes,
  verificarBanco,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { PublicadorOutbox } from './dominio/publicador-outbox.js';
import { TAMANHO_MAXIMO_FOTO } from './dominio/regras.js';
import { criarFonteOutbox, limparOutbox, sincronizarMananciais } from './repositorio.js';
import { registrarRotas } from './rotas.js';

const SERVICO = 'ocorrencias-service';
const logger = criarLogger(SERVICO);

function caminhoDados(arquivo: string): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  const candidatos = [join(dir, 'dados', arquivo), join(dir, '..', 'dados', arquivo)];
  const achado = candidatos.find((c) => existsSync(c));
  if (!achado) throw new Error(`Arquivo de dados não encontrado: ${arquivo}`);
  return achado;
}

async function main() {
  const pool = criarPool(env('DATABASE_URL'), SERVICO, logger, 15);
  const db = criarDb(pool, schema);
  await aguardarBanco(pool, logger);
  await executarMigracoes(pool, db, {
    pasta: resolverPastaMigracoes(import.meta.url),
    schema: env('DB_SCHEMA', 'ocorrencias'),
    logger,
  });
  const qtd = await sincronizarMananciais(db, caminhoDados('mananciais.json'));
  logger.info({ quantidade: qtd }, 'Áreas de manancial de referência sincronizadas');

  // Broker: a conexão é feita em segundo plano (o serviço sobe mesmo com o RabbitMQ fora)
  const amqp = new ClienteAmqp({ url: env('AMQP_URL'), nomeServico: SERVICO, logger });
  amqp.iniciar();
  const publicador = new PublicadorOutbox(criarFonteOutbox(db), amqp, logger, { intervaloMs: 1000, tamanhoLote: 50 });
  publicador.iniciar();
  const limpeza = setInterval(() => void limparOutbox(db).catch(() => undefined), 60 * 60 * 1000);
  limpeza.unref();

  const pastaUploads = env('UPLOADS_DIR', join(process.cwd(), 'uploads'));
  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/ocorrencias',
    titulo: 'EcoRadar Urbano — ocorrencias-service',
    descricao:
      'Registro colaborativo de ocorrências ambientais com geolocalização (PostGIS), fotos, idempotência, ' +
      'confirmação colaborativa, fluxo de status e publicação de eventos via Transactional Outbox.',
    logger,
    bodyLimit: 7 * 1024 * 1024,
    prontidao: { banco: () => verificarBanco(pool), broker: () => amqp.conectado },
    tags: [
      { name: 'Ocorrências', description: 'Registro, consulta, confirmação e status' },
      { name: 'Mananciais', description: 'Áreas de proteção de mananciais (GeoJSON)' },
    ],
  });
  await registrarJwt(app);
  await app.register(multipart, {
    attachFieldsToBody: 'keyValues',
    limits: { fileSize: TAMANHO_MAXIMO_FOTO, files: 1, fields: 20, fieldSize: 16 * 1024 },
  });
  await app.register(fastifyStatic, {
    root: pastaUploads,
    prefix: '/uploads/',
    maxAge: '7d',
    immutable: true,
    index: false,
  });
  await registrarRotas(app, { db, pastaUploads, publicador });

  configurarEncerramento(logger, [
    { nome: 'servidor HTTP', executar: () => app.close() },
    { nome: 'publicador do outbox', executar: () => publicador.parar() },
    { nome: 'conexão AMQP', executar: () => amqp.fechar() },
    { nome: 'pool do PostgreSQL', executar: () => pool.end() },
  ]);
  await iniciarServidor(app);
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o serviço');
  process.exit(1);
});
