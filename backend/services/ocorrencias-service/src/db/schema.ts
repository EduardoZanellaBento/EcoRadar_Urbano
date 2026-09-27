import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { CATEGORIAS, SEVERIDADES, STATUS_OCORRENCIA, type EnvelopeEvento } from '@ecoradar/shared';

/**
 * Ponto PostGIS em WGS84 (SRID 4326). Gravado com ST_SetSRID(ST_MakePoint(lon, lat), 4326).
 * (O tipo nativo "geometry" do Drizzle não preserva o SRID na migração gerada.)
 */
const pontoWgs84 = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(Point, 4326)',
});

/** Polígono PostGIS (o Drizzle só tem tipo nativo para pontos). Lido/escrito via SQL do PostGIS. */
const multipoligono = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(MultiPolygon, 4326)',
});

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

/**
 * Tabelas do ocorrencias-service (schema "ocorrencias", via search_path do usuário svc_ocorrencias).
 */
export const ocorrencias = pgTable(
  'ocorrencias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Chave gerada pelo app (UUID v4) — impede duplicatas no reenvio (modo offline). */
    idempotencyKey: uuid('idempotency_key').notNull().unique('ocorrencias_idempotency_key_unica'),
    usuarioId: uuid('usuario_id').notNull(),
    usuarioNome: text('usuario_nome').notNull(),
    categoria: text('categoria', { enum: CATEGORIAS }).notNull(),
    severidade: text('severidade', { enum: SEVERIDADES }).notNull(),
    status: text('status', { enum: STATUS_OCORRENCIA }).notNull().default('ABERTA'),
    descricao: text('descricao').notNull(),
    localizacao: pontoWgs84('localizacao').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    bairro: text('bairro'),
    fotoUrl: text('foto_url'),
    emAreaDeManancial: boolean('em_area_de_manancial').notNull().default(false),
    manancialNome: text('manancial_nome'),
    confirmacoes: integer('confirmacoes').notNull().default(0),
    versao: integer('versao').notNull().default(1),
    criadoEm: criadoEm(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
    resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
  },
  (t) => [
    index('ocorrencias_localizacao_gist').using('gist', t.localizacao),
    index('ocorrencias_criado_em_idx').on(t.criadoEm),
    index('ocorrencias_status_idx').on(t.status),
    index('ocorrencias_categoria_idx').on(t.categoria),
  ],
);

export const historicoStatus = pgTable(
  'historico_status',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ocorrenciaId: uuid('ocorrencia_id')
      .notNull()
      .references(() => ocorrencias.id, { onDelete: 'cascade' }),
    statusAnterior: text('status_anterior', { enum: STATUS_OCORRENCIA }),
    statusNovo: text('status_novo', { enum: STATUS_OCORRENCIA }).notNull(),
    comentario: text('comentario').notNull(),
    usuarioId: uuid('usuario_id').notNull(),
    usuarioNome: text('usuario_nome').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index('historico_ocorrencia_idx').on(t.ocorrenciaId, t.criadoEm)],
);

export const confirmacoes = pgTable(
  'confirmacoes',
  {
    ocorrenciaId: uuid('ocorrencia_id')
      .notNull()
      .references(() => ocorrencias.id, { onDelete: 'cascade' }),
    usuarioId: uuid('usuario_id').notNull(),
    usuarioNome: text('usuario_nome').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [primaryKey({ name: 'confirmacoes_pk', columns: [t.ocorrenciaId, t.usuarioId] })],
);

export const areasManancial = pgTable(
  'areas_manancial',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull(),
    geom: multipoligono('geom').notNull(),
  },
  (t) => [index('areas_manancial_geom_gist').using('gist', t.geom)],
);

/**
 * Transactional Outbox: o evento é gravado na MESMA transação da alteração da
 * ocorrência e publicado depois no RabbitMQ por um publicador periódico.
 */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    tipo: text('tipo').notNull(),
    agregadoId: uuid('agregado_id').notNull(),
    payload: jsonb('payload').$type<EnvelopeEvento>().notNull(),
    criadoEm: criadoEm(),
    publicadoEm: timestamp('publicado_em', { withTimezone: true }),
    tentativas: integer('tentativas').notNull().default(0),
    ultimoErro: text('ultimo_erro'),
  },
  (t) => [index('outbox_pendentes_idx').on(t.criadoEm).where(sql`${t.publicadoEm} IS NULL`)],
);

export type LinhaOcorrencia = typeof ocorrencias.$inferSelect;
