import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { CATEGORIAS, SEVERIDADES, STATUS_OCORRENCIA, TIPOS_ALERTA } from '@ecoradar/shared';

/**
 * Visão de leitura (CQRS): cópia desnormalizada das ocorrências, montada SOMENTE a partir
 * dos eventos publicados pelo ocorrencias-service — este serviço nunca lê o schema de outro.
 */
export const ocorrenciasView = pgTable(
  'ocorrencias_view',
  {
    id: uuid('id').primaryKey(),
    categoria: text('categoria', { enum: CATEGORIAS }).notNull(),
    severidade: text('severidade', { enum: SEVERIDADES }).notNull(),
    status: text('status', { enum: STATUS_OCORRENCIA }).notNull(),
    descricao: text('descricao').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    bairro: text('bairro'),
    emAreaDeManancial: boolean('em_area_de_manancial').notNull(),
    manancialNome: text('manancial_nome'),
    confirmacoes: integer('confirmacoes').notNull(),
    usuarioNome: text('usuario_nome').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull(),
    resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
    versao: integer('versao').notNull(),
  },
  (t) => [index('view_criado_idx').on(t.criadoEm), index('view_bairro_idx').on(t.bairro)],
);

export const alertasView = pgTable('alertas_view', {
  id: uuid('id').primaryKey(),
  tipo: text('tipo', { enum: TIPOS_ALERTA }).notNull(),
  severidade: text('severidade', { enum: SEVERIDADES }).notNull(),
  titulo: text('titulo').notNull(),
  status: text('status', { enum: ['ATIVO', 'ENCERRADO'] }).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull(),
  encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
});

/** Inbox para consumo idempotente. */
export const eventosProcessados = pgTable('eventos_processados', {
  eventoId: uuid('evento_id').primaryKey(),
  tipo: text('tipo').notNull(),
  processadoEm: timestamp('processado_em', { withTimezone: true }).notNull().defaultNow(),
});
