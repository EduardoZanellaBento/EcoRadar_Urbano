import { defineConfig } from 'drizzle-kit';

// Gera as migrações SQL a partir de src/db/schema.ts (não precisa de banco rodando):
//   npm run db:gerar --workspace @ecoradar/auth-service
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  migrations: { table: '__migracoes_drizzle', schema: 'auth' },
});
