import { readFileSync } from 'node:fs';
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { criarEvento, type DadosOcorrenciaEvento, type EnvelopeEvento, type TipoEvento } from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { areasManancial, confirmacoes, historicoStatus, ocorrencias, outbox } from './db/schema.js';
import type { FonteOutbox, LinhaOutbox, ResultadoLote } from './dominio/publicador-outbox.js';
import { paraSnapshot, type FiltrosListagem } from './dominio/regras.js';

export type Db = NodePgDatabase<typeof schema>;
type Transacao = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Transacao;

const SERVICO = 'ocorrencias-service';

const ponto = (lat: number, lon: number) => sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;

/** Grava um evento na tabela outbox usando a MESMA transação da alteração de dados. */
export async function gravarNoOutbox(tx: Executor, tipo: TipoEvento, dados: DadosOcorrenciaEvento, correlationId: string) {
  const evento = criarEvento(tipo, dados, { origem: SERVICO, correlationId });
  await tx.insert(outbox).values({ id: evento.id, tipo, agregadoId: dados.ocorrencia.id, payload: evento });
  return evento;
}

export async function buscarPorIdempotencyKey(db: Executor, chave: string) {
  const [linha] = await db
    .select({ id: ocorrencias.id, usuarioId: ocorrencias.usuarioId })
    .from(ocorrencias)
    .where(eq(ocorrencias.idempotencyKey, chave))
    .limit(1);
  return linha;
}

export async function buscarPorId(db: Executor, id: string) {
  const [linha] = await db.select().from(ocorrencias).where(eq(ocorrencias.id, id)).limit(1);
  return linha;
}

export async function buscarPorIdParaAtualizar(tx: Transacao, id: string) {
  const [linha] = await tx.select().from(ocorrencias).where(eq(ocorrencias.id, id)).for('update').limit(1);
  return linha;
}

export async function historicoDa(db: Executor, ocorrenciaId: string) {
  return db
    .select()
    .from(historicoStatus)
    .where(eq(historicoStatus.ocorrenciaId, ocorrenciaId))
    .orderBy(asc(historicoStatus.criadoEm));
}

export async function confirmouAntes(db: Executor, ocorrenciaId: string, usuarioId: string) {
  const [linha] = await db
    .select({ u: confirmacoes.usuarioId })
    .from(confirmacoes)
    .where(and(eq(confirmacoes.ocorrenciaId, ocorrenciaId), eq(confirmacoes.usuarioId, usuarioId)))
    .limit(1);
  return Boolean(linha);
}

/** Retorna o manancial que contém o ponto (ST_Contains), se houver. */
export async function manancialNoPonto(db: Executor, lat: number, lon: number) {
  const r = await db
    .select({ id: areasManancial.id, nome: areasManancial.nome })
    .from(areasManancial)
    .where(sql`ST_Contains(${areasManancial.geom}, ${ponto(lat, lon)})`)
    .limit(1);
  return r[0] ?? null;
}

export async function listarMananciaisGeoJson(db: Executor) {
  const linhas = await db
    .select({
      id: areasManancial.id,
      nome: areasManancial.nome,
      descricao: areasManancial.descricao,
      geometria: sql<string>`ST_AsGeoJSON(${areasManancial.geom}, 6)`,
    })
    .from(areasManancial)
    .orderBy(asc(areasManancial.nome));
  return {
    type: 'FeatureCollection' as const,
    observacao: 'Polígonos aproximados e simplificados, para fins didáticos.',
    features: linhas.map((l) => ({
      type: 'Feature' as const,
      properties: { id: l.id, nome: l.nome, descricao: l.descricao, aproximado: true },
      geometry: JSON.parse(l.geometria) as { type: string; coordinates: unknown },
    })),
  };
}

/** Garante que os polígonos de referência (dados/mananciais.json) estejam no banco. */
export async function sincronizarMananciais(db: Db, caminhoGeoJson: string) {
  const geo = JSON.parse(readFileSync(caminhoGeoJson, 'utf-8')) as {
    features: Array<{ properties: { id: string; nome: string; descricao: string }; geometry: unknown }>;
  };
  for (const f of geo.features) {
    const geomSql = sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326))`;
    await db
      .insert(areasManancial)
      .values({ id: f.properties.id, nome: f.properties.nome, descricao: f.properties.descricao, geom: geomSql as unknown as string })
      .onConflictDoUpdate({
        target: areasManancial.id,
        set: { nome: f.properties.nome, descricao: f.properties.descricao, geom: geomSql as unknown as string },
      });
  }
  return geo.features.length;
}

export async function listar(db: Db, f: FiltrosListagem, usuarioId: string) {
  const condicoes: SQL[] = [];
  if (f.categoria?.length) condicoes.push(inArray(ocorrencias.categoria, f.categoria));
  if (f.status?.length) condicoes.push(inArray(ocorrencias.status, f.status));
  if (f.severidade?.length) condicoes.push(inArray(ocorrencias.severidade, f.severidade));
  if (f.desde) condicoes.push(gte(ocorrencias.criadoEm, f.desde));
  if (f.ate) condicoes.push(lte(ocorrencias.criadoEm, f.ate));
  if (f.emManancial !== undefined) condicoes.push(eq(ocorrencias.emAreaDeManancial, f.emManancial));
  if (f.minhas) condicoes.push(eq(ocorrencias.usuarioId, usuarioId));
  if (f.busca) {
    const termo = `%${f.busca}%`;
    const c = or(ilike(ocorrencias.descricao, termo), ilike(ocorrencias.bairro, termo), ilike(ocorrencias.usuarioNome, termo));
    if (c) condicoes.push(c);
  }
  const temPonto = f.lat !== undefined && f.lon !== undefined;
  const origem = temPonto ? ponto(f.lat!, f.lon!) : null;
  if (origem && f.raioKm !== undefined) {
    // ST_DWithin sobre geography: distância em metros, usa o índice GiST
    condicoes.push(sql`ST_DWithin(${ocorrencias.localizacao}::geography, ${origem}::geography, ${f.raioKm * 1000})`);
  }
  const where = condicoes.length ? and(...condicoes) : undefined;
  const distancia = origem
    ? sql<number>`round((ST_Distance(${ocorrencias.localizacao}::geography, ${origem}::geography) / 1000.0)::numeric, 3)`
    : sql<null>`NULL`;

  const pesoSeveridade = sql`CASE ${ocorrencias.severidade} WHEN 'CRITICA' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END`;
  const ordem: SQL[] = {
    recentes: [desc(ocorrencias.criadoEm)],
    antigas: [asc(ocorrencias.criadoEm)],
    severidade: [sql`${pesoSeveridade} DESC`, desc(ocorrencias.criadoEm)],
    confirmacoes: [desc(ocorrencias.confirmacoes), desc(ocorrencias.criadoEm)],
    distancia: [sql`${distancia} ASC`],
  }[f.ordenacao];

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(ocorrencias).where(where);
  // A coluna geométrica não é necessária na resposta (latitude/longitude já estão na linha)
  const { localizacao: _localizacao, ...colunas } = getTableColumns(ocorrencias);
  const linhas = await db
    .select({ ...colunas, distanciaKm: distancia })
    .from(ocorrencias)
    .where(where)
    .orderBy(...ordem)
    .limit(f.tamanhoPagina)
    .offset((f.pagina - 1) * f.tamanhoPagina);

  return {
    itens: linhas.map((l) => ({ ...paraSnapshot(l), distanciaKm: l.distanciaKm === null ? null : Number(l.distanciaKm) })),
    total,
    pagina: f.pagina,
    tamanhoPagina: f.tamanhoPagina,
  };
}

export async function estatisticasOutbox(db: Db) {
  const [r] = await db
    .select({
      pendentes: sql<number>`count(*) FILTER (WHERE ${outbox.publicadoEm} IS NULL)::int`,
      publicados: sql<number>`count(*) FILTER (WHERE ${outbox.publicadoEm} IS NOT NULL)::int`,
      maisAntigoPendenteEm: sql<string | null>`min(${outbox.criadoEm}) FILTER (WHERE ${outbox.publicadoEm} IS NULL)`,
    })
    .from(outbox);
  return r;
}

/** Implementação PostgreSQL da fonte do outbox (FOR UPDATE SKIP LOCKED). */
export function criarFonteOutbox(db: Db): FonteOutbox {
  return {
    async processarPendentes(limite, processar) {
      return db.transaction(async (tx) => {
        const linhas = (await tx
          .select({ id: outbox.id, payload: outbox.payload })
          .from(outbox)
          .where(isNull(outbox.publicadoEm))
          .orderBy(asc(outbox.criadoEm), asc(outbox.id))
          .limit(limite)
          .for('update', { skipLocked: true })) as LinhaOutbox[];
        if (!linhas.length) return { publicados: [], falhas: [] } satisfies ResultadoLote;
        const resultado = await processar(linhas);
        if (resultado.publicados.length) {
          await tx
            .update(outbox)
            .set({ publicadoEm: new Date(), tentativas: sql`${outbox.tentativas} + 1`, ultimoErro: null })
            .where(inArray(outbox.id, resultado.publicados));
        }
        for (const falha of resultado.falhas) {
          await tx
            .update(outbox)
            .set({ tentativas: sql`${outbox.tentativas} + 1`, ultimoErro: falha.erro.slice(0, 500) })
            .where(eq(outbox.id, falha.id));
        }
        return resultado;
      });
    },
  };
}

/** Remove eventos já publicados há mais de 7 dias (a tabela não cresce indefinidamente). */
export async function limparOutbox(db: Db) {
  const r = await db.execute(sql`DELETE FROM ${outbox} WHERE ${outbox.publicadoEm} < now() - interval '7 days'`);
  return r.rowCount ?? 0;
}

export type { EnvelopeEvento };
export { ponto };
