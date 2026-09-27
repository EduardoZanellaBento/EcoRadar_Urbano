import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { PERFIS } from '@ecoradar/shared';

/**
 * Tabelas do auth-service. Sem schema explícito: o usuário de banco "svc_auth"
 * tem search_path = auth, public — as tabelas ficam no schema "auth".
 */
export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    senhaHash: text('senha_hash').notNull(),
    perfil: text('perfil', { enum: PERFIS }).notNull().default('CIDADAO'),
    bairro: text('bairro'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
    ultimoLoginEm: timestamp('ultimo_login_em', { withTimezone: true }),
  },
  (t) => [uniqueIndex('usuarios_email_unico').on(sql`lower(${t.email})`)],
);

export type Usuario = typeof usuarios.$inferSelect;
