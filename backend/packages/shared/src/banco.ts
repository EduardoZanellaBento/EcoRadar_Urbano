import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Logger } from 'pino';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { comRetry } from './backoff.js';
import { INSTANCIA_ID } from './config.js';

// Retorna colunas NUMERIC como número (e não string) — usadas em médias/estatísticas
pg.types.setTypeParser(1700, (valor) => (valor === null ? null : Number(valor)));
// BIGINT (count) como número
pg.types.setTypeParser(20, (valor) => (valor === null ? null : Number(valor)));

export type Pool = pg.Pool;

export function criarPool(url: string, servico: string, logger: Logger, max = 10): pg.Pool {
  const pool = new pg.Pool({
    connectionString: url,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    application_name: `${servico}@${INSTANCIA_ID}`,
  });
  // Sem este handler, a queda do banco derrubaria o processo
  pool.on('error', (erro) => logger.warn({ err: erro }, 'Erro em conexão ociosa com o PostgreSQL'));
  return pool;
}

export function criarDb<T extends Record<string, unknown>>(pool: pg.Pool, schema: T): NodePgDatabase<T> {
  return drizzle(pool, { schema });
}

/** Aguarda o banco aceitar conexões (com backoff exponencial). */
export async function aguardarBanco(pool: pg.Pool, logger: Logger): Promise<void> {
  await comRetry(() => pool.query('SELECT 1'), {
    tentativas: 30,
    baseMs: 1000,
    maximoMs: 10_000,
    aoFalhar: (erro, tentativa, atrasoMs) =>
      logger.warn({ err: erro, tentativa, atrasoMs }, 'Banco indisponível; nova tentativa com backoff'),
  });
}

/**
 * Aplica as migrações geradas pelo drizzle-kit. Usa um advisory lock do PostgreSQL
 * para que duas réplicas do mesmo serviço não migrem ao mesmo tempo.
 */
export async function executarMigracoes(
  pool: pg.Pool,
  db: NodePgDatabase<Record<string, unknown>>,
  opcoes: { pasta: string; schema: string; logger: Logger },
): Promise<void> {
  const cliente = await pool.connect();
  const chave = `migracoes:${opcoes.schema}`;
  try {
    await cliente.query('SELECT pg_advisory_lock(hashtext($1))', [chave]);
    await migrate(db, {
      migrationsFolder: opcoes.pasta,
      migrationsSchema: opcoes.schema,
      migrationsTable: '__migracoes_drizzle',
    });
    opcoes.logger.info({ schema: opcoes.schema }, 'Migrações do banco aplicadas');
  } finally {
    await cliente.query('SELECT pg_advisory_unlock(hashtext($1))', [chave]).catch(() => undefined);
    cliente.release();
  }
}

/** Localiza a pasta de migrações tanto em desenvolvimento (src/..) quanto no bundle (dist/). */
export function resolverPastaMigracoes(metaUrl: string): string {
  const dir = dirname(fileURLToPath(metaUrl));
  const candidatos = [join(dir, 'drizzle'), join(dir, '..', 'drizzle'), join(dir, '..', '..', 'drizzle')];
  const pasta = candidatos.find((c) => existsSync(join(c, 'meta', '_journal.json')));
  if (!pasta) throw new Error(`Pasta de migrações não encontrada (procurado em: ${candidatos.join(', ')})`);
  return pasta;
}

export async function verificarBanco(pool: pg.Pool): Promise<void> {
  await pool.query('SELECT 1');
}
