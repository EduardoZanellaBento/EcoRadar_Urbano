import { and, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from 'pino';
import {
  ROTULOS_TIPO_ALERTA,
  TIPOS_ALERTA,
  dadosOcorrenciaEventoSchema,
  snapshotAlertaSchema,
  type EnvelopeEvento,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { alertasView, eventosProcessados, ocorrenciasView } from './db/schema.js';
import type { FiltrosRelatorio } from './dominio/relatorio.js';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Projeção (lado de leitura do CQRS): aplica cada evento à visão local. As atualizações
 * só valem se a versão do evento for maior que a gravada — eventos atrasados ou fora de
 * ordem (possíveis com 2 réplicas publicando) não sobrescrevem dados mais novos.
 */
export async function aplicarEvento(db: Db, evento: EnvelopeEvento, logger: Logger): Promise<void> {
  await db.transaction(async (tx) => {
    const novo = await tx
      .insert(eventosProcessados)
      .values({ eventoId: evento.id, tipo: evento.tipo })
      .onConflictDoNothing()
      .returning({ id: eventosProcessados.eventoId });
    if (!novo.length) {
      logger.info({ eventoId: evento.id, requestId: evento.correlationId }, 'Evento já aplicado à visão (ignorado)');
      return;
    }

    if (evento.tipo.startsWith('ocorrencia.')) {
      const { ocorrencia: o } = dadosOcorrenciaEventoSchema.parse(evento.dados);
      const valores = {
        categoria: o.categoria,
        severidade: o.severidade,
        status: o.status,
        descricao: o.descricao,
        latitude: o.latitude,
        longitude: o.longitude,
        bairro: o.bairro,
        emAreaDeManancial: o.emAreaDeManancial,
        manancialNome: o.manancialNome,
        confirmacoes: o.confirmacoes,
        usuarioNome: o.usuarioNome,
        criadoEm: new Date(o.criadoEm),
        atualizadoEm: new Date(o.atualizadoEm),
        resolvidoEm: o.resolvidoEm ? new Date(o.resolvidoEm) : null,
        versao: o.versao,
      };
      await tx
        .insert(ocorrenciasView)
        .values({ id: o.id, ...valores })
        .onConflictDoUpdate({ target: ocorrenciasView.id, set: valores, setWhere: sql`${ocorrenciasView.versao} < ${o.versao}` });
    } else if (evento.tipo.startsWith('alerta.')) {
      const a = snapshotAlertaSchema.parse(evento.dados);
      const valores = {
        tipo: a.tipo,
        severidade: a.severidade,
        titulo: a.titulo,
        status: a.status,
        criadoEm: new Date(a.criadoEm),
        encerradoEm: a.encerradoEm ? new Date(a.encerradoEm) : null,
      };
      await tx.insert(alertasView).values({ id: a.id, ...valores }).onConflictDoUpdate({ target: alertasView.id, set: valores });
    }
  });
}

function condicoes(f: FiltrosRelatorio) {
  const c: SQL[] = [];
  if (f.desde) c.push(gte(ocorrenciasView.criadoEm, f.desde));
  if (f.ate) c.push(lte(ocorrenciasView.criadoEm, f.ate));
  if (f.categoria) c.push(eq(ocorrenciasView.categoria, f.categoria));
  if (f.status) c.push(eq(ocorrenciasView.status, f.status));
  if (f.bairro) c.push(ilike(ocorrenciasView.bairro, `%${f.bairro}%`));
  return c.length ? and(...c) : undefined;
}

export async function buscarOcorrencias(db: Db, f: FiltrosRelatorio, limite?: number) {
  const q = db.select().from(ocorrenciasView).where(condicoes(f)).orderBy(desc(ocorrenciasView.criadoEm));
  return limite ? q.limit(limite) : q;
}

export async function resumoAlertas(db: Db, f: FiltrosRelatorio) {
  const c: SQL[] = [];
  if (f.desde) c.push(gte(alertasView.criadoEm, f.desde));
  if (f.ate) c.push(lte(alertasView.criadoEm, f.ate));
  const where = c.length ? and(...c) : undefined;
  const linhas = await db
    .select({ tipo: alertasView.tipo, total: sql<number>`count(*)::int`, ativos: sql<number>`count(*) FILTER (WHERE ${alertasView.status} = 'ATIVO')::int` })
    .from(alertasView)
    .where(where)
    .groupBy(alertasView.tipo);
  const porTipo = TIPOS_ALERTA.map((t) => {
    const l = linhas.find((x) => x.tipo === t);
    return { chave: t, rotulo: ROTULOS_TIPO_ALERTA[t], total: l?.total ?? 0, ativos: l?.ativos ?? 0 };
  });
  return {
    total: porTipo.reduce((s, t) => s + t.total, 0),
    ativos: porTipo.reduce((s, t) => s + t.ativos, 0),
    porTipo,
  };
}

export function descreverFiltros(f: FiltrosRelatorio): string {
  const partes: string[] = [];
  const d = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  if (f.desde) partes.push(`desde ${d(f.desde)}`);
  if (f.ate) partes.push(`até ${d(f.ate)}`);
  if (f.categoria) partes.push(`categoria ${f.categoria}`);
  if (f.status) partes.push(`status ${f.status}`);
  if (f.bairro) partes.push(`bairro contém "${f.bairro}"`);
  return partes.length ? partes.join(', ') : 'nenhum (todas as ocorrências)';
}

export { eq };
