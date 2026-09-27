// Pós-processa as migrações geradas pelo drizzle-kit na pasta ./drizzle do serviço atual.
//
// O drizzle-kit qualifica as chaves estrangeiras com o schema "public"
// (REFERENCES "public"."tabela"), mas cada serviço grava no PRÓPRIO schema
// (search_path do usuário de banco). Removendo o qualificador, a referência passa a ser
// resolvida pelo search_path — mantendo o isolamento "database per service".
// Uso (na pasta do serviço): node ../../scripts/ajustar-migracoes.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const pasta = resolve(process.cwd(), 'drizzle');
if (!existsSync(pasta)) {
  console.log('Nenhuma pasta drizzle/ encontrada — nada a ajustar.');
  process.exit(0);
}
let alterados = 0;
for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith('.sql'))) {
  const caminho = join(pasta, arquivo);
  const original = readFileSync(caminho, 'utf-8');
  const ajustado = original.replaceAll('"public".', '');
  if (ajustado !== original) {
    writeFileSync(caminho, ajustado);
    alterados++;
    console.log(`Ajustado: ${arquivo}`);
  }
}
console.log(`Migrações verificadas (${alterados} arquivo(s) ajustado(s)).`);
