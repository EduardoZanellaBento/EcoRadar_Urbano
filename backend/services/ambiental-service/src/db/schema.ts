import { bigint, boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Tabelas do ambiental-service (schema "ambiental", via search_path do usuário svc_ambiental). */
export const estacoes = pgTable('estacoes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  bairro: text('bairro').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  tipos: text('tipos').array().notNull(),
  corrego: text('corrego'),
  cotaAlertaCm: integer('cota_alerta_cm'),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Série temporal das leituras recebidas via MQTT. */
export const leituras = pgTable(
  'leituras',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    estacaoId: text('estacao_id')
      .notNull()
      .references(() => estacoes.id, { onDelete: 'cascade' }),
    medidoEm: timestamp('medido_em', { withTimezone: true }).notNull(),
    recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
    pm25: doublePrecision('pm25'),
    pm10: doublePrecision('pm10'),
    o3: doublePrecision('o3'),
    no2: doublePrecision('no2'),
    co: doublePrecision('co'),
    temperatura: doublePrecision('temperatura'),
    umidade: doublePrecision('umidade'),
    nivelCorregoCm: doublePrecision('nivel_corrego_cm'),
    tempSuperficie: doublePrecision('temp_superficie'),
    temp300m: doublePrecision('temp_300m'),
    iqar: integer('iqar'),
    iqarClasse: text('iqar_classe'),
    poluenteDominante: text('poluente_dominante'),
    inversao: boolean('inversao').notNull().default(false),
    cenario: text('cenario'),
  },
  (t) => [index('leituras_estacao_medido_idx').on(t.estacaoId, t.medidoEm.desc())],
);

/** Último valor obtido das integrações externas (sobrevive a reinícios: degradação graciosa). */
export const cacheIntegracoes = pgTable('cache_integracoes', {
  chave: text('chave').primaryKey(),
  dados: jsonb('dados').notNull(),
  obtidoEm: timestamp('obtido_em', { withTimezone: true }).notNull(),
});
