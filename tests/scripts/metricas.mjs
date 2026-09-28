// Métricas do código-fonte (linhas por módulo e por linguagem) -> registros/metricas_codigo.txt
// Script próprio (não depende do cloc/Perl). Conta arquivos, linhas totais e linhas não vazias.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IGNORAR = new Set(['node_modules', 'dist', '.expo', '.cache', 'test-results', 'coverage', '.git', 'meta', 'playwright-report']);
const LINGUAGENS = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (TSX)',
  '.mjs': 'JavaScript',
  '.js': 'JavaScript',
  '.sql': 'SQL',
  '.conf': 'Configuração (Nginx/RabbitMQ)',
  '.yml': 'YAML',
  '.ps1': 'PowerShell',
  '.sh': 'Shell',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.html': 'HTML',
};

function arquivos(dir) {
  const lista = [];
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome) || nome === 'package-lock.json') continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) lista.push(...arquivos(caminho));
    else if (LINGUAGENS[extname(nome)]) lista.push(caminho);
  }
  return lista;
}

function contar(lista) {
  let linhas = 0;
  let naoVazias = 0;
  for (const a of lista) {
    const t = readFileSync(a, 'utf-8').split(/\r?\n/);
    linhas += t.length;
    naoVazias += t.filter((l) => l.trim()).length;
  }
  return { arquivos: lista.length, linhas, naoVazias };
}

const modulos = [
  ['backend/packages/shared', 'Pacote compartilhado'],
  ['backend/services/auth-service', 'auth-service'],
  ['backend/services/ocorrencias-service', 'ocorrencias-service'],
  ['backend/services/ambiental-service', 'ambiental-service'],
  ['backend/services/alertas-service', 'alertas-service'],
  ['backend/services/relatorios-service', 'relatorios-service'],
  ['backend/services/sensor-simulator', 'sensor-simulator'],
  ['backend/seed', 'seed (dados de demonstração)'],
  ['mobile/src', 'App móvel (mobile/src)'],
  ['tests', 'Testes (integração, E2E, distribuído, carga)'],
  ['scripts', 'Scripts de automação'],
  ['gateway', 'Gateway (Nginx)'],
  ['infra', 'Infraestrutura (PostgreSQL, RabbitMQ)'],
];

const largura = 46;
const linhas = [`Métricas do código-fonte — EcoRadar Urbano — ${new Date().toLocaleString('pt-BR')}`, '', 'Por módulo (código-fonte e testes; exclui node_modules, dist e arquivos gerados):', ''];
linhas.push(`${'Módulo'.padEnd(largura)} ${'Arquivos'.padStart(8)} ${'Linhas'.padStart(8)} ${'Não vazias'.padStart(11)}`);
let total = { arquivos: 0, linhas: 0, naoVazias: 0 };
for (const [pasta, nome] of modulos) {
  const c = contar(arquivos(resolve(raiz, pasta)).filter((a) => !a.endsWith('.md') && !a.includes(`${join('drizzle', '')}`)));
  total = { arquivos: total.arquivos + c.arquivos, linhas: total.linhas + c.linhas, naoVazias: total.naoVazias + c.naoVazias };
  linhas.push(`${nome.padEnd(largura)} ${String(c.arquivos).padStart(8)} ${String(c.linhas).padStart(8)} ${String(c.naoVazias).padStart(11)}`);
}
linhas.push(`${'TOTAL'.padEnd(largura)} ${String(total.arquivos).padStart(8)} ${String(total.linhas).padStart(8)} ${String(total.naoVazias).padStart(11)}`);

linhas.push('', 'Por linguagem (todo o projeto, inclusive documentação e migrações SQL):', '');
const porLinguagem = {};
for (const a of arquivos(raiz)) {
  if (relative(raiz, a).startsWith('registros')) continue;
  const lg = LINGUAGENS[extname(a)];
  const c = contar([a]);
  porLinguagem[lg] ??= { arquivos: 0, linhas: 0, naoVazias: 0 };
  porLinguagem[lg].arquivos += c.arquivos;
  porLinguagem[lg].linhas += c.linhas;
  porLinguagem[lg].naoVazias += c.naoVazias;
}
linhas.push(`${'Linguagem'.padEnd(largura)} ${'Arquivos'.padStart(8)} ${'Linhas'.padStart(8)} ${'Não vazias'.padStart(11)}`);
for (const [lg, c] of Object.entries(porLinguagem).sort((a, b) => b[1].linhas - a[1].linhas)) {
  linhas.push(`${lg.padEnd(largura)} ${String(c.arquivos).padStart(8)} ${String(c.linhas).padStart(8)} ${String(c.naoVazias).padStart(11)}`);
}
writeFileSync(resolve(raiz, 'registros', 'metricas_codigo.txt'), linhas.join('\n') + '\n');
console.log(linhas.join('\n'));
