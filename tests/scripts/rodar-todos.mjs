// Executa TODAS as verificações e testes do EcoRadar em sequência e grava um resumo em
// registros/testes/resumo-execucao.md. Uso (na pasta tests): node scripts/rodar-todos.mjs [--sem-carga]
// Pré-requisito: a stack no ar (scripts/iniciar).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testes = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = resolve(testes, '..');
const registros = resolve(raiz, 'registros');
const semCarga = process.argv.includes('--sem-carga');
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(testes, '.cache', 'ms-playwright');
process.env.FORCE_COLOR = '0';
process.env.NO_COLOR = '1';
const DOCKER_WIN = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_WIN) && !process.env.PATH.includes(DOCKER_WIN)) process.env.PATH = `${DOCKER_WIN};${process.env.PATH}`;

const limpar = (t) => t.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((l) => !l.includes('npm notice')).join('\n');

/** Executa um passo, salva a saída em arquivo e registra duração e resultado. */
function passo(nome, comando, cwd, arquivoLog) {
  const inicio = Date.now();
  console.log(`\n==> ${nome}\n    $ ${comando}`);
  const r = spawnSync(comando, { cwd, shell: true, encoding: 'utf-8', env: process.env, maxBuffer: 256 * 1024 * 1024 });
  const saida = limpar(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (arquivoLog) {
    mkdirSync(dirname(arquivoLog), { recursive: true });
    writeFileSync(arquivoLog, `$ ${comando}\n\n${saida}`);
  }
  const ok = r.status === 0;
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`    ${ok ? '✓ OK' : '✗ FALHOU'} em ${segundos} s${arquivoLog ? ` — log: ${arquivoLog.replace(raiz, '.')}` : ''}`);
  if (!ok) console.log(saida.split('\n').slice(-25).join('\n'));
  return { nome, ok, segundos, log: arquivoLog ? arquivoLog.replace(raiz + (process.platform === 'win32' ? '\\' : '/'), '').replace(/\\/g, '/') : '' };
}

// A stack precisa estar no ar para os testes de integração em diante
try {
  const r = await fetch('http://localhost:8080/health');
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error('O gateway (http://localhost:8080) não respondeu. Suba a stack com scripts/iniciar antes de rodar os testes.');
  process.exit(2);
}

const L = (p) => resolve(registros, p);
const passos = [
  passo('Backend: checagem de tipos (tsc --noEmit)', 'npx tsc -p tsconfig.json --noEmit', resolve(raiz, 'backend'), L('testes/qualidade/backend-tsc.txt')),
  passo('Backend: lint (ESLint)', 'npx eslint .', resolve(raiz, 'backend'), L('testes/qualidade/backend-eslint.txt')),
  passo('Backend: testes unitários + cobertura (Vitest)', 'node scripts/testes-unitarios.mjs', testes, L('testes/unitarios/execucao.txt')),
  passo('App: checagem de tipos (tsc --noEmit)', 'npx tsc --noEmit', resolve(raiz, 'mobile'), L('testes/qualidade/mobile-tsc.txt')),
  passo('App: lint (expo lint)', 'npx expo lint', resolve(raiz, 'mobile'), L('testes/qualidade/mobile-lint.txt')),
  passo('Testes: checagem de tipos', 'npx tsc --noEmit', testes, L('testes/qualidade/testes-tsc.txt')),
  passo('Integração via gateway (Vitest)', 'npx vitest run --config integracao/vitest.config.ts', testes, L('testes/integracao/saida.txt')),
  passo('E2E com Playwright (Pixel 7 e iPhone 14)', 'npx playwright test --config e2e/playwright.config.ts', testes, L('testes/e2e/saida.txt')),
  passo('Sistema distribuído (falhas, broker, circuit breaker, rastreamento)', 'npx tsx distribuido/executar.ts', testes, L('testes/distribuido/saida-console.txt')),
];
if (!semCarga) passos.push(passo('Carga leve (autocannon, 1 x 2 réplicas)', 'npx tsx carga/executar.ts', testes, L('testes/carga/saida-console.txt')));

const md = [
  '# Resumo da execução dos testes',
  '',
  `Executado em ${new Date().toLocaleString('pt-BR')} (${process.platform}).`,
  '',
  '| Passo | Resultado | Duração | Log |',
  '|---|---|---|---|',
  ...passos.map((p) => `| ${p.nome} | ${p.ok ? '✅ passou' : '❌ falhou'} | ${p.segundos} s | ${p.log ? `\`${p.log.replace(/^registros\//, '')}\`` : ''} |`),
  '',
].join('\n');
writeFileSync(L('testes/resumo-execucao.md'), md);
writeFileSync(L('testes/resumo-execucao.json'), JSON.stringify({ executadoEm: new Date().toISOString(), passos }, null, 2));
console.log(`\n${md}`);
process.exit(passos.every((p) => p.ok) ? 0 : 1);
