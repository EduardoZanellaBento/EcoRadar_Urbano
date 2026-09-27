import rateLimit from '@fastify/rate-limit';
import {
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
import { registrarRotas } from './rotas.js';

const SERVICO = 'auth-service';
const logger = criarLogger(SERVICO);

async function main() {
  const pool = criarPool(env('DATABASE_URL'), SERVICO, logger);
  const db = criarDb(pool, schema);
  await aguardarBanco(pool, logger);
  await executarMigracoes(pool, db, { pasta: resolverPastaMigracoes(import.meta.url), schema: env('DB_SCHEMA', 'auth'), logger });

  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/auth',
    titulo: 'EcoRadar Urbano — auth-service',
    descricao: 'Cadastro, login (JWT) e gestão de perfis de acesso (CIDADAO, AGENTE, ADMIN).',
    logger,
    prontidao: { banco: () => verificarBanco(pool) },
    tags: [
      { name: 'Autenticação', description: 'Cadastro e login' },
      { name: 'Usuários', description: 'Dados do usuário e perfis' },
    ],
  });
  await registrarJwt(app);
  await app.register(rateLimit, { global: false });
  await registrarRotas(app, { db });

  configurarEncerramento(logger, [
    { nome: 'servidor HTTP', executar: () => app.close() },
    { nome: 'pool do PostgreSQL', executar: () => pool.end() },
  ]);
  await iniciarServidor(app);
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o serviço');
  process.exit(1);
});
