/**
 * Teste de carga leve (item 9.5 da APS): autocannon em GET /api/ocorrencias via gateway,
 * 30 s com 50 conexões, primeiro com as 2 réplicas do ocorrencias-service e depois com 1.
 * Salva JSON bruto, comparação em Markdown e gráfico PNG em registros/testes/carga.
 * Uso: npm run carga (na pasta tests)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import autocannon from 'autocannon';
import sharp from 'sharp';
import { API, REGISTROS, aguardar, esperar, login } from '../utils/api.js';
import { compose, saudeDoServico } from '../utils/docker.js';
import { terminalParaPng } from '../utils/imagem.js';

const SAIDA = resolve(REGISTROS, 'testes', 'carga');
mkdirSync(SAIDA, { recursive: true });
const DURACAO_S = Number(process.env.CARGA_DURACAO_S || 30);
const CONEXOES = Number(process.env.CARGA_CONEXOES || 50);
const ROTA = '/api/ocorrencias?tamanhoPagina=20';

interface Medicao {
  cenario: string;
  requisicoes: number;
  erros: number;
  naoDois: number;
  reqPorSegundo: number;
  p50: number;
  p95: number;
  p99: number;
  media: number;
  max: number;
  instancias: Record<string, number>;
}

function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) return 0;
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[i];
}

async function medir(cenario: string, token: string): Promise<Medicao> {
  const tempos: number[] = [];
  // Aquecimento (JIT, pool de conexões)
  await autocannon({ url: API + ROTA, connections: 10, duration: 5, headers: { authorization: `Bearer ${token}` } });
  const errosDetalhados: string[] = [];
  const r = await new Promise<autocannon.Result>((ok, falha) => {
    const instancia = autocannon(
      { url: API + ROTA, connections: CONEXOES, duration: DURACAO_S, headers: { authorization: `Bearer ${token}` } },
      (erro, resultado) => (erro ? falha(erro) : ok(resultado)),
    );
    instancia.on('response', (_cliente: unknown, _status: number, _bytes: number, tempoMs: number) => tempos.push(tempoMs));
    instancia.on('reqError', (erro: Error) => errosDetalhados.push(`${new Date().toISOString()} ${erro.message}`));
  });
  if (errosDetalhados.length) writeFileSync(resolve(SAIDA, `erros-${cenario.replace(/\s+/g, '-')}.txt`), errosDetalhados.join('\n') + '\n');
  // Distribuição entre réplicas numa amostra após a carga
  const instancias: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    const resp = await fetch(API + ROTA, { headers: { authorization: `Bearer ${token}` } });
    const id = resp.headers.get('x-instance-id') ?? '?';
    instancias[id] = (instancias[id] ?? 0) + 1;
    await resp.arrayBuffer();
  }
  tempos.sort((a, b) => a - b);
  const media = tempos.reduce((s, t) => s + t, 0) / Math.max(1, tempos.length);
  writeFileSync(resolve(SAIDA, `autocannon-${cenario.replace(/\s+/g, '-')}.json`), JSON.stringify(r, null, 2));
  return {
    cenario,
    requisicoes: r.requests.total,
    erros: r.errors + r.timeouts,
    naoDois: r.non2xx,
    reqPorSegundo: Math.round(r.requests.average),
    p50: Math.round(percentil(tempos, 50)),
    p95: Math.round(percentil(tempos, 95)),
    p99: Math.round(percentil(tempos, 99)),
    media: Math.round(media),
    max: Math.round(tempos.at(-1) ?? 0),
    instancias,
  };
}

/** Gráfico (SVG -> PNG): vazão e latências, duas séries (1 e 2 réplicas) com rótulos diretos. */
async function grafico(m1: Medicao, m2: Medicao, destino: string) {
  const COR = { uma: '#eb6834', duas: '#2a78d6', tinta: '#0b0b0b', tinta2: '#52514e', grade: '#e1e0d9', base: '#c3c2b7' };
  const W = 1200;
  const H = 500;
  const painel = (x0: number, largura: number, titulo: string, unidade: string, grupos: Array<{ rotulo: string; uma: number; duas: number }>) => {
    const topo = 110;
    const altura = 330;
    const maximo = Math.max(...grupos.flatMap((g) => [g.uma, g.duas])) * 1.15 || 1;
    const passo = Math.pow(10, Math.floor(Math.log10(maximo / 4)));
    const marca = Math.ceil(maximo / 4 / passo) * passo;
    let s = `<text x="${x0}" y="80" font-size="20" font-weight="700" fill="${COR.tinta}">${titulo}</text>`;
    for (let i = 0; i <= 4; i++) {
      const v = marca * i;
      const y = topo + altura - (v / (marca * 4)) * altura;
      s += `<line x1="${x0 + 50}" x2="${x0 + largura}" y1="${y}" y2="${y}" stroke="${i === 0 ? COR.base : COR.grade}" stroke-width="1"/>`;
      s += `<text x="${x0 + 42}" y="${y + 4}" font-size="12" text-anchor="end" fill="${COR.tinta2}">${v}</text>`;
    }
    const larguraGrupo = (largura - 60) / grupos.length;
    const barra = Math.min(46, larguraGrupo / 3);
    grupos.forEach((g, i) => {
      const cx = x0 + 60 + larguraGrupo * i + larguraGrupo / 2;
      ([['uma', g.uma, -1], ['duas', g.duas, 1]] as const).forEach(([serie, valor, lado]) => {
        const h = (valor / (marca * 4)) * altura;
        const x = cx + (lado < 0 ? -barra - 1 : 1);
        s += `<rect x="${x}" y="${topo + altura - h}" width="${barra}" height="${h}" rx="4" fill="${COR[serie]}"/>`;
        s += `<text x="${x + barra / 2}" y="${topo + altura - h - 6}" font-size="13" text-anchor="middle" fill="${COR.tinta}">${valor}</text>`;
      });
      s += `<text x="${cx}" y="${topo + altura + 22}" font-size="14" text-anchor="middle" fill="${COR.tinta2}">${g.rotulo}</text>`;
    });
    s += `<text x="${x0 + 60}" y="${topo - 14}" font-size="12" fill="${COR.tinta2}">${unidade}</text>`;
    return s;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">
    <rect width="100%" height="100%" fill="#fcfcfb"/>
    <text x="40" y="40" font-size="24" font-weight="700" fill="${COR.tinta}">Carga em GET /api/ocorrencias — ${CONEXOES} conexões, ${DURACAO_S} s (via gateway)</text>
    <rect x="930" y="62" width="14" height="14" rx="3" fill="${COR.uma}"/><text x="950" y="74" font-size="15" fill="${COR.tinta}">1 réplica</text>
    <rect x="1040" y="62" width="14" height="14" rx="3" fill="${COR.duas}"/><text x="1060" y="74" font-size="15" fill="${COR.tinta}">2 réplicas</text>
    ${painel(40, 330, 'Vazão média', 'requisições por segundo', [{ rotulo: 'req/s', uma: m1.reqPorSegundo, duas: m2.reqPorSegundo }])}
    ${painel(430, 730, 'Latência (percentis)', 'milissegundos — menor é melhor', [
      { rotulo: 'p50', uma: m1.p50, duas: m2.p50 },
      { rotulo: 'p95', uma: m1.p95, duas: m2.p95 },
      { rotulo: 'p99', uma: m1.p99, duas: m2.p99 },
    ])}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(destino);
}

async function main() {
  if (process.argv.includes('--apenas-grafico')) {
    const { uma, duas } = JSON.parse(readFileSync(resolve(SAIDA, 'resultado.json'), 'utf-8')) as { uma: Medicao; duas: Medicao };
    await grafico(uma, duas, resolve(SAIDA, 'grafico-carga.png'));
    return;
  }
  const token = await login('ana@ecoradar.local');
  console.log(`Carga: ${CONEXOES} conexões, ${DURACAO_S} s, ${API}${ROTA}`);

  console.log('>> Cenário A: 2 réplicas');
  const duas = await medir('2 replicas', token);
  console.log(duas);

  console.log('>> Cenário B: 1 réplica (ocorrencias-service-2 parado)');
  compose('stop ocorrencias-service-2');
  await esperar(7000); // DNS do Nginx deixa de resolver a réplica parada
  let uma: Medicao;
  try {
    uma = await medir('1 replica', token);
    console.log(uma);
  } finally {
    compose('start ocorrencias-service-2');
    await aguardar('réplica 2 saudável', async () => saudeDoServico('ocorrencias-service-2') === 'healthy', 180_000, 2000);
  }

  const ganho = ((duas.reqPorSegundo / Math.max(1, uma.reqPorSegundo) - 1) * 100).toFixed(1);
  const linha = (m: Medicao) =>
    `| ${m.cenario.replace('replicas', 'réplicas').replace('replica', 'réplica')} | ${m.requisicoes} | ${m.reqPorSegundo} | ${m.p50} | ${m.p95} | ${m.p99} | ${m.media} | ${m.max} | ${m.erros} | ${m.naoDois} | ${Object.entries(m.instancias).map(([k, v]) => `${k}: ${v}`).join(', ')} |`;
  const md = [
    '# Teste de carga — GET /api/ocorrencias',
    '',
    `Executado em ${new Date().toLocaleString('pt-BR')} com autocannon: ${CONEXOES} conexões simultâneas, ${DURACAO_S} s por cenário (após 5 s de aquecimento), via gateway Nginx (${API}).`,
    'Latências calculadas a partir do tempo de cada resposta registrado durante o teste.',
    '',
    '| Cenário | Requisições | Req/s (média) | p50 (ms) | p95 (ms) | p99 (ms) | Média (ms) | Máx. (ms) | Erros/timeouts | Respostas não-2xx | Amostra de X-Instance-Id |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    linha(uma),
    linha(duas),
    '',
    `**Variação da vazão com 2 réplicas: ${Number(ganho) >= 0 ? '+' : ''}${ganho}%** em relação a 1 réplica.`,
    '',
    'Observação: todos os containers (banco, broker, réplicas e gerador de carga) rodam no mesmo computador; o ganho',
    'de escalar horizontalmente fica limitado pelos recursos compartilhados (CPU e PostgreSQL). Em produção, as réplicas',
    'ficariam em máquinas distintas.',
    '',
    '![Gráfico](grafico-carga.png)',
    '',
  ].join('\n');
  writeFileSync(resolve(SAIDA, 'resultado.md'), md, 'utf-8');
  writeFileSync(resolve(SAIDA, 'resultado.json'), JSON.stringify({ uma, duas, ganhoPercentual: Number(ganho) }, null, 2));
  await grafico(uma, duas, resolve(SAIDA, 'grafico-carga.png'));
  await terminalParaPng('Teste de carga (autocannon)', md.replace(/\|/g, ' | ').replace(/!\[.*\]\(.*\)/, ''), resolve(SAIDA, 'resultado-terminal.png'), 1700);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
