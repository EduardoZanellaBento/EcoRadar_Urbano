// Roda os testes unitários do backend com cobertura e grava as evidências em
// registros/testes/unitarios (saída detalhada, resumo da cobertura e relatório HTML).
// Uso: node scripts/testes-unitarios.mjs  (a partir da pasta tests)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const backend = resolve(raiz, 'backend');
const saida = resolve(raiz, 'registros', 'testes', 'unitarios');
mkdirSync(saida, { recursive: true });

const r = spawnSync('npx vitest run --coverage --reporter=verbose', {
  cwd: backend,
  shell: true,
  encoding: 'utf-8',
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
});
const texto = `${r.stdout ?? ''}${r.stderr ?? ''}`
  .replace(/\x1b\[[0-9;]*m/g, '')
  .split('\n')
  .filter((l) => !l.includes('npm notice'))
  .join('\n');
writeFileSync(resolve(saida, 'saida.txt'), texto);

const s = JSON.parse(readFileSync(resolve(saida, 'cobertura', 'coverage-summary.json'), 'utf-8'));
const t = s.total;
const linhas = [
  `Cobertura dos testes unitários (regras de negócio) — ${new Date().toLocaleString('pt-BR')}`,
  '',
  `Linhas     : ${t.lines.pct}% (${t.lines.covered}/${t.lines.total})`,
  `Instruções : ${t.statements.pct}% (${t.statements.covered}/${t.statements.total})`,
  `Funções    : ${t.functions.pct}% (${t.functions.covered}/${t.functions.total})`,
  `Branches   : ${t.branches.pct}% (${t.branches.covered}/${t.branches.total})`,
  '',
  'Meta da APS: >= 70% nas regras de negócio. Relatório HTML: cobertura/index.html',
  '',
  'Por arquivo (linhas):',
  ...Object.entries(s)
    .filter(([f]) => f !== 'total')
    .map(([f, v]) => `  ${relative(backend, f).replace(/\\/g, '/').padEnd(64)} ${v.lines.pct}%`),
];
const testes = /Tests\s+(\d+) passed(?: \((\d+)\))?/.exec(texto);
const arquivos = /Test Files\s+(\d+) passed/.exec(texto);
linhas.splice(2, 0, `Testes     : ${testes?.[1] ?? '?'} passaram em ${arquivos?.[1] ?? '?'} arquivos (código de saída ${r.status})`);
writeFileSync(resolve(saida, 'resumo-cobertura.txt'), linhas.join('\n') + '\n');
console.log(linhas.join('\n'));
process.exit(r.status ?? 1);
