import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { CATEGORIAS, SEVERIDADES, STATUS_OCORRENCIA, TIPOS_ALERTA } from '@ecoradar/shared';

/** Tabelas do alertas-service (schema "alertas"). */
export const alertas = pgTable(
  'alertas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tipo: text('tipo', { enum: TIPOS_ALERTA }).notNull(),
    severidade: text('severidade', { enum: SEVERIDADES }).notNull(),
    titulo: text('titulo').notNull(),
    mensagem: text('mensagem').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    raioKm: doublePrecision('raio_km'),
    chaveArea: text('chave_area').notNull(),
    categoria: text('categoria', { enum: CATEGORIAS }),
    origem: text('origem').notNull(),
    referenciaId: text('referencia_id').notNull(),
    dados: jsonb('dados').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status', { enum: ['ATIVO', 'ENCERRADO'] }).notNull().default('ATIVO'),
    correlationId: text('correlation_id'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
    encerradoPor: text('encerrado_por'),
    comentarioEncerramento: text('comentario_encerramento'),
  },
  (t) => [index('alertas_tipo_criado_idx').on(t.tipo, t.criadoEm), index('alertas_status_idx').on(t.status, t.criadoEm)],
);

/** Réplica local mínima das ocorrências recentes (alimentada por eventos) — regra de concentração. */
export const ocorrenciasRecentes = pgTable(
  'ocorrencias_recentes',
  {
    id: uuid('id').primaryKey(),
    categoria: text('categoria', { enum: CATEGORIAS }).notNull(),
    status: text('status', { enum: STATUS_OCORRENCIA }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull(),
    versao: integer('versao').notNull(),
  },
  (t) => [index('recentes_categoria_criado_idx').on(t.categoria, t.criadoEm)],
);

/** Inbox: ids de eventos já processados (consumo idempotente — reentregas são ignoradas). */
export const eventosProcessados = pgTable('eventos_processados', {
  eventoId: uuid('evento_id').primaryKey(),
  tipo: text('tipo').notNull(),
  processadoEm: timestamp('processado_em', { withTimezone: true }).notNull().defaultNow(),
});
