// Regenera TODA a pasta registros/ a partir de execuções reais:
//  1. ambiente (sistema.txt) · 2. dados de demonstração limpos (seed --forcar) · 3. build das imagens e do app web
//  4. todos os testes (qualidade, unitários, integração, E2E, distribuído, carga) · 5. prints de infraestrutura e logs
//  6. métricas e versões · 7. RELATORIO_DE_TESTES.md, README.md e index.html
// Uso (na pasta tests): node scripts/coletar-evidencias.mjs [--sem-carga] [--manter-dados]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testes = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = resolve(testes, '..');
const registros = resolve(raiz, 'registros');
const args = process.argv.slice(2);
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(testes, '.cache', 'ms-playwright');
process.env.FORCE_COLOR = '0';
const DOCKER_WIN = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_WIN) && !process.env.PATH.includes(DOCKER_WIN)) process.env.PATH = `${DOCKER_WIN};${process.env.PATH}`;

const inicio = Date.now();
function executar(titulo, comando, cwd, { log, obrigatorio = true } = {}) {
  console.log(`\n######## ${titulo}\n$ ${comando}`);
  const r = spawnSync(comando, { cwd, shell: true, encoding: 'utf-8', env: process.env, maxBuffer: 512 * 1024 * 1024, stdio: log ? 'pipe' : 'inherit' });
  if (log) {
    mkdirSync(dirname(log), { recursive: true });
    const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
    writeFileSync(log, `$ ${comando}\n\n${saida}`);
    console.log(saida.split('\n').slice(-6).join('\n'));
  }
  if (r.status !== 0) {
    console.log(`!! ${titulo} terminou com código ${r.status}`);
    if (obrigatorio) process.exit(r.status ?? 1);
  }
  return r.status === 0;
}

// Dependências dos testes e navegador do Playwright (dentro do projeto)
if (!existsSync(resolve(testes, 'node_modules'))) executar('Instalando dependências dos testes', 'npm install --no-audit --no-fund', testes);
if (!existsSync(resolve(testes, '.cache', 'ms-playwright'))) executar('Instalando o Chromium do Playwright', 'node scripts/instalar-navegadores.mjs', testes);

// 1. Ambiente
if (process.platform === 'win32') executar('Registrando o ambiente', 'powershell -ExecutionPolicy Bypass -File scripts/registrar-ambiente.ps1', raiz);
else executar('Registrando o ambiente', 'bash scripts/registrar-ambiente.sh', raiz);

// Limpa evidências geradas anteriormente (preserva manual/, ambiente/ e build/)
for (const p of ['screenshots/web-mobile', 'screenshots/relatorios', 'screenshots/swagger', 'screenshots/infraestrutura', 'videos', 'testes', 'logs/servicos']) {
  rmSync(resolve(registros, p), { recursive: true, force: true });
  mkdirSync(resolve(registros, p), { recursive: true });
}
rmSync(resolve(testes, 'test-results'), { recursive: true, force: true });

// 2. Imagens atualizadas e stack no ar
executar('Build das imagens Docker', 'docker compose --profile seed build', raiz, { log: resolve(registros, 'build/03_docker-compose-build.log') });
executar('Build web do app (expo export)', 'npx expo export --platform web --output-dir dist', resolve(raiz, 'mobile'), { log: resolve(registros, 'build/04_expo-export-web.log') });
executar('Subindo a stack (aguardando healthy)', 'docker compose up -d --wait --wait-timeout 420', raiz, { log: resolve(registros, 'build/05_docker-compose-up.log') });
executar('Reiniciando o gateway (novo build web)', 'docker compose restart gateway', raiz);
if (!args.includes('--manter-dados')) {
  executar('Dados de demonstração limpos (seed --forcar)', 'docker compose --profile seed run --rm seed node --enable-source-maps dist/index.js --forcar', raiz, {
    log: resolve(registros, 'build/06_seed.log'),
  });
  // Tempo para o outbox publicar os eventos do seed (relatórios/alertas)
  spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 15000)']);
}

// 3. Todos os testes (o resumo sai em registros/testes/resumo-execucao.md)
const testesOk = executar('Todos os testes', `node scripts/rodar-todos.mjs ${args.includes('--sem-carga') ? '--sem-carga' : ''}`, testes, { obrigatorio: false });

// 4. Infraestrutura, logs, métricas, versões e relatórios
executar('Prints de infraestrutura e logs dos serviços', 'npx tsx infra/prints.ts', testes, { obrigatorio: false });
executar('Métricas do código', 'node scripts/metricas.mjs', testes, { log: resolve(registros, 'testes/qualidade/metricas-execucao.txt') });
executar('Versões', 'node scripts/versoes.mjs', testes, { log: resolve(registros, 'testes/qualidade/versoes-execucao.txt') });
executar('Relatórios e galeria', 'node scripts/gerar-relatorios.mjs', testes);

console.log(`\nEvidências regeneradas em ${((Date.now() - inicio) / 60000).toFixed(1)} min. Abra registros/index.html.`);
process.exit(testesOk ? 0 : 1);
