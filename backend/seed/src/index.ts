/**
 * Carga de dados de demonstração do EcoRadar Urbano.
 *
 * Executado dentro da rede do Docker (docker compose --profile seed run --rm seed), com o
 * usuário administrador do PostgreSQL. Popula: usuários (auth), ocorrências com histórico,
 * confirmações e fotos (ocorrencias + eventos no outbox, que alimentam relatórios e alertas),
 * histórico de 24 h das estações (ambiental) e alertas históricos (alertas + visão de relatórios).
 *
 * É idempotente: se os dados já existem, não faz nada (use --forcar para recriar).
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import {
  BAIRROS_SP,
  CATEGORIAS,
  ESTACOES_PADRAO,
  ROTULOS_CLASSE_IQAR,
  TIPOS_EVENTO,
  criarEvento,
  esperar,
  type Categoria,
  type Perfil,
  type Severidade,
  type SnapshotOcorrencia,
  type StatusOcorrencia,
  type TipoAlerta,
} from '@ecoradar/shared';
import { calcularIqar } from '../../services/ambiental-service/src/dominio/iqar.js';
import { estadoInicial, gerarLeitura } from '../../services/sensor-simulator/src/dominio/modelo.js';
import { BAIRROS_POR_CATEGORIA, COMENTARIOS, DESCRICOES, PONTOS_MANANCIAL } from './dados.js';

const FORCAR = process.argv.includes('--forcar') || process.env.SEED_FORCAR === '1';
const aqui = dirname(fileURLToPath(import.meta.url));
const arquivo = (nome: string) => [join(aqui, nome), join(aqui, '..', nome)].find((c) => existsSync(c))!;

// Gerador pseudoaleatório determinístico (os mesmos dados a cada execução)
let semente = 20260927;
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const escolher = <T>(lista: T[]): T => lista[Math.floor(aleatorio() * lista.length)];
const entre = (a: number, b: number) => a + aleatorio() * (b - a);

interface UsuarioDemo {
  id: string;
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  bairro: string;
}

async function aguardarTabelas(pool: pg.Pool) {
  const tabelas = ['auth.usuarios', 'ocorrencias.ocorrencias', 'ocorrencias.outbox', 'ambiental.leituras', 'alertas.alertas', 'relatorios.alertas_view'];
  for (let tentativa = 1; tentativa <= 60; tentativa++) {
    try {
      const r = await pool.query<{ ok: boolean }>(
        `SELECT bool_and(to_regclass(t) IS NOT NULL) AS ok FROM unnest($1::text[]) AS t`,
        [tabelas],
      );
      if (r.rows[0]?.ok) return;
    } catch {
      /* banco ainda subindo */
    }
    console.log(`Aguardando os serviços criarem as tabelas (tentativa ${tentativa})...`);
    await esperar(2000);
  }
  throw new Error('As tabelas dos serviços não foram criadas a tempo. Os serviços estão no ar?');
}

async function limpar(cliente: pg.PoolClient) {
  console.log('--forcar: removendo dados de demonstração anteriores...');
  await cliente.query(`TRUNCATE ocorrencias.confirmacoes, ocorrencias.historico_status, ocorrencias.outbox, ocorrencias.ocorrencias CASCADE`);
  await cliente.query(`TRUNCATE alertas.alertas, alertas.ocorrencias_recentes, alertas.eventos_processados`);
  await cliente.query(`TRUNCATE relatorios.ocorrencias_view, relatorios.alertas_view, relatorios.eventos_processados`);
  await cliente.query(`TRUNCATE ambiental.leituras`);
  // Remove os usuários de demonstração e os criados pelos testes automatizados (*@teste.ecoradar.local)
  await cliente.query(`DELETE FROM auth.usuarios WHERE email LIKE '%ecoradar.local'`);
}

async function criarUsuarios(cliente: pg.PoolClient): Promise<UsuarioDemo[]> {
  const json = JSON.parse(readFileSync(arquivo('usuarios-demo.json'), 'utf-8')) as { usuarios: Omit<UsuarioDemo, 'id'>[] };
  const usuarios: UsuarioDemo[] = [];
  for (const u of json.usuarios) {
    const hash = await bcrypt.hash(u.senha, 10);
    const r = await cliente.query<{ id: string }>(
      `INSERT INTO auth.usuarios (nome, email, senha_hash, perfil, bairro, criado_em)
       VALUES ($1, $2, $3, $4, $5, now() - interval '45 days')
       ON CONFLICT ((lower(email))) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil, senha_hash = EXCLUDED.senha_hash
       RETURNING id`,
      [u.nome, u.email, hash, u.perfil, u.bairro],
    );
    usuarios.push({ ...u, id: r.rows[0].id });
  }
  console.log(`✔ ${usuarios.length} usuários (1 ADMIN, 2 AGENTES, 5 CIDADÃOS)`);
  return usuarios;
}

function pontoPara(categoria: Categoria): { latitude: number; longitude: number; bairro: string } {
  const noManancial =
    categoria === 'INVASAO_MANANCIAL' || (categoria === 'DESMATAMENTO' && aleatorio() < 0.6) || (categoria === 'DESCARTE_IRREGULAR_LIXO' && aleatorio() < 0.2);
  if (noManancial) {
    const p = escolher(PONTOS_MANANCIAL);
    return { latitude: p.latitude + entre(-0.004, 0.004), longitude: p.longitude + entre(-0.004, 0.004), bairro: p.bairro };
  }
  const nome = escolher(BAIRROS_POR_CATEGORIA[categoria].length ? BAIRROS_POR_CATEGORIA[categoria] : BAIRROS_SP.map((b) => b.nome));
  const b = BAIRROS_SP.find((x) => x.nome === nome) ?? escolher(BAIRROS_SP);
  return { latitude: b.latitude + entre(-0.006, 0.006), longitude: b.longitude + entre(-0.006, 0.006), bairro: b.nome };
}

const PESOS_SEVERIDADE: Array<[Severidade, number]> = [
  ['BAIXA', 0.25],
  ['MEDIA', 0.35],
  ['ALTA', 0.28],
  ['CRITICA', 0.12],
];
function sortearSeveridade(): Severidade {
  let x = aleatorio();
  for (const [s, p] of PESOS_SEVERIDADE) {
    if ((x -= p) <= 0) return s;
  }
  return 'MEDIA';
}

async function criarOcorrencias(cliente: pg.PoolClient, usuarios: UsuarioDemo[], pastaUploads: string) {
  const cidadaos = usuarios.filter((u) => u.perfil === 'CIDADAO');
  const agentes = usuarios.filter((u) => u.perfil !== 'CIDADAO');
  const pastaFotos = arquivo('fotos');
  mkdirSync(pastaUploads, { recursive: true });
  const agora = Date.now();
  const TOTAL = 60;
  let comFoto = 0;
  let eventos = 0;

  for (let i = 0; i < TOTAL; i++) {
    // Garante todas as categorias; distribui o restante
    const categoria: Categoria = i < CATEGORIAS.length ? CATEGORIAS[i] : escolher([...CATEGORIAS]);
    const autor = escolher(cidadaos);
    const local = pontoPara(categoria);
    const severidade = sortearSeveridade();
    // Mais ocorrências nos dias recentes (distribuição enviesada)
    const idadeDias = Math.pow(aleatorio(), 1.4) * 29.5 + 0.02;
    const criadoEm = new Date(agora - idadeDias * 86_400_000);
    const sorteioStatus = aleatorio();
    const statusFinal: StatusOcorrencia =
      idadeDias < 0.3 ? 'ABERTA' : sorteioStatus < 0.34 ? 'ABERTA' : sorteioStatus < 0.54 ? 'EM_ANALISE' : sorteioStatus < 0.9 ? 'RESOLVIDA' : 'DESCARTADA';

    let fotoUrl: string | null = null;
    if (aleatorio() < 0.45) {
      const nomeArquivo = `${randomUUID()}.jpg`;
      copyFileSync(join(pastaFotos, `${categoria.toLowerCase()}.jpg`), join(pastaUploads, nomeArquivo));
      fotoUrl = `/uploads/${nomeArquivo}`;
      comFoto++;
    }

    const id = randomUUID();
    const descricao = escolher(DESCRICOES[categoria]);
    const ins = await cliente.query<{ manancial: string | null }>(
      `INSERT INTO ocorrencias.ocorrencias
         (id, idempotency_key, usuario_id, usuario_nome, categoria, severidade, status, descricao, localizacao,
          latitude, longitude, bairro, foto_url, em_area_de_manancial, manancial_nome, confirmacoes, versao, criado_em, atualizado_em)
       SELECT $1, $2, $3, $4, $5, $6, 'ABERTA', $7, ST_SetSRID(ST_MakePoint($9, $8), 4326), $8, $9, $10, $11,
              m.nome IS NOT NULL, m.nome, 0, 1, $12, $12
       FROM (SELECT (SELECT nome FROM ocorrencias.areas_manancial a
                     WHERE ST_Contains(a.geom, ST_SetSRID(ST_MakePoint($9, $8), 4326)) LIMIT 1) AS nome) m
       RETURNING manancial_nome AS manancial`,
      [id, randomUUID(), autor.id, autor.nome, categoria, severidade, descricao, local.latitude, local.longitude, local.bairro, fotoUrl, criadoEm],
    );
    const manancial = ins.rows[0].manancial;
    await cliente.query(
      `INSERT INTO ocorrencias.historico_status (ocorrencia_id, status_anterior, status_novo, comentario, usuario_id, usuario_nome, criado_em)
       VALUES ($1, NULL, 'ABERTA', 'Ocorrência registrada pelo cidadão.', $2, $3, $4)`,
      [id, autor.id, autor.nome, criadoEm],
    );

    const snapshot: SnapshotOcorrencia = {
      id,
      categoria,
      severidade,
      status: 'ABERTA',
      descricao,
      latitude: local.latitude,
      longitude: local.longitude,
      bairro: local.bairro,
      emAreaDeManancial: Boolean(manancial),
      manancialNome: manancial,
      confirmacoes: 0,
      fotoUrl,
      usuarioId: autor.id,
      usuarioNome: autor.nome,
      criadoEm: criadoEm.toISOString(),
      atualizadoEm: criadoEm.toISOString(),
      resolvidoEm: null,
      versao: 1,
    };
    const outbox = async (tipo: (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO], dados: object, quando: Date) => {
      const ev = criarEvento(tipo, dados, { origem: 'seed' });
      await cliente.query(
        `INSERT INTO ocorrencias.outbox (id, tipo, agregado_id, payload, criado_em) VALUES ($1, $2, $3, $4, $5)`,
        [ev.id, tipo, id, JSON.stringify(ev), quando],
      );
      eventos++;
    };
    await outbox(TIPOS_EVENTO.OCORRENCIA_CRIADA, { ocorrencia: { ...snapshot } }, criadoEm);

    // Confirmações colaborativas (0 a 3 cidadãos diferentes do autor)
    const outros = cidadaos.filter((c) => c.id !== autor.id);
    const qtdConfirmacoes = statusFinal === 'DESCARTADA' ? 0 : Math.floor(Math.pow(aleatorio(), 1.3) * 4);
    for (const c of outros.slice(0, qtdConfirmacoes)) {
      const quando = new Date(criadoEm.getTime() + entre(10, 240) * 60_000);
      await cliente.query(
        `INSERT INTO ocorrencias.confirmacoes (ocorrencia_id, usuario_id, usuario_nome, criado_em) VALUES ($1, $2, $3, $4)`,
        [id, c.id, c.nome, quando],
      );
      snapshot.confirmacoes++;
      snapshot.versao++;
      snapshot.atualizadoEm = quando.toISOString();
    }

    // Histórico de status até o status final
    const caminho: StatusOcorrencia[] =
      statusFinal === 'EM_ANALISE' ? ['EM_ANALISE'] : statusFinal === 'RESOLVIDA' ? ['EM_ANALISE', 'RESOLVIDA'] : statusFinal === 'DESCARTADA' ? ['DESCARTADA'] : [];
    let anterior: StatusOcorrencia = 'ABERTA';
    let instante = criadoEm.getTime() + entre(1, 6) * 3_600_000;
    for (const st of caminho) {
      const agente = escolher(agentes);
      const quando = new Date(Math.min(instante, agora - 60_000));
      await cliente.query(
        `INSERT INTO ocorrencias.historico_status (ocorrencia_id, status_anterior, status_novo, comentario, usuario_id, usuario_nome, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, anterior, st, escolher(COMENTARIOS[st as keyof typeof COMENTARIOS]), agente.id, agente.nome, quando],
      );
      snapshot.status = st;
      snapshot.versao++;
      snapshot.atualizadoEm = quando.toISOString();
      if (st === 'RESOLVIDA') snapshot.resolvidoEm = quando.toISOString();
      anterior = st;
      instante += entre(4, 60) * 3_600_000;
    }

    await cliente.query(
      `UPDATE ocorrencias.ocorrencias SET status = $2, confirmacoes = $3, versao = $4, atualizado_em = $5, resolvido_em = $6 WHERE id = $1`,
      [id, snapshot.status, snapshot.confirmacoes, snapshot.versao, snapshot.atualizadoEm, snapshot.resolvidoEm],
    );
    if (snapshot.versao > 1) {
      const tipo = caminho.length ? TIPOS_EVENTO.OCORRENCIA_STATUS_ALTERADO : TIPOS_EVENTO.OCORRENCIA_CONFIRMADA;
      await outbox(tipo, { ocorrencia: { ...snapshot }, ...(caminho.length ? { statusAnterior: 'ABERTA' as const } : {}) }, new Date(snapshot.atualizadoEm));
    }
  }
  console.log(`✔ ${TOTAL} ocorrências (todas as categorias e status), ${comFoto} com foto ilustrativa, ${eventos} eventos no outbox`);
}

async function criarHistoricoEstacoes(cliente: pg.PoolClient) {
  const agora = Date.now();
  let linhas = 0;
  for (const estacao of ESTACOES_PADRAO) {
    const estado = estadoInicial(estacao);
    const valores: unknown[] = [];
    const tuplas: string[] = [];
    for (let m = 24 * 60; m >= 10; m -= 10) {
      const instante = new Date(agora - m * 60_000);
      const l = gerarLeitura(estacao, instante, estado, null, aleatorio);
      const iqar = calcularIqar({ MP25: l.pm25, MP10: l.pm10, O3: l.o3, NO2: l.no2, CO: l.co });
      const inversao = l.temp_superficie !== null && l.temp_300m !== null && l.temp_300m > l.temp_superficie;
      const base = valores.length;
      tuplas.push(`(${Array.from({ length: 16 }, (_, k) => `$${base + k + 1}`).join(',')})`);
      valores.push(
        estacao.id,
        instante,
        l.pm25,
        l.pm10,
        l.o3,
        l.no2,
        l.co,
        l.temperatura,
        l.umidade,
        l.nivel_corrego_cm,
        l.temp_superficie,
        l.temp_300m,
        iqar?.indice ?? null,
        iqar?.classe ?? null,
        iqar?.poluenteDominante ?? null,
        inversao,
      );
      linhas++;
    }
    await cliente.query(
      `INSERT INTO ambiental.leituras (estacao_id, medido_em, pm25, pm10, o3, no2, co, temperatura, umidade, nivel_corrego_cm,
         temp_superficie, temp_300m, iqar, iqar_classe, poluente_dominante, inversao) VALUES ${tuplas.join(',')}`,
      valores,
    );
  }
  console.log(`✔ ${linhas} leituras históricas (24 h, a cada 10 min) para ${ESTACOES_PADRAO.length} estações`);
}

async function criarAlertasHistoricos(cliente: pg.PoolClient) {
  const agora = Date.now();
  const est = (id: string) => ESTACOES_PADRAO.find((e) => e.id === id)!;
  const lista: Array<{ tipo: TipoAlerta; severidade: Severidade; titulo: string; mensagem: string; dias: number; lat: number; lon: number; chave: string; ativo?: boolean; categoria?: Categoria }> = [
    { tipo: 'POLUICAO', severidade: 'ALTA', titulo: `Qualidade do ar ${ROTULOS_CLASSE_IQAR.MUITO_RUIM.toLowerCase()} — ${est('est-se').nome}`, mensagem: 'IQAr 138 (Muito Ruim) na Estação Sé (Centro), poluente dominante MP25. Evite atividades físicas ao ar livre.', dias: 3.2, lat: est('est-se').latitude, lon: est('est-se').longitude, chave: 'estacao:est-se' },
    { tipo: 'RISCO_ALAGAMENTO', severidade: 'ALTA', titulo: 'Risco de alagamento — Ipiranga', mensagem: 'Nível do córrego em 196 cm, acima da cota de alerta (180 cm), na região de Ipiranga. Evite a área.', dias: 6.5, lat: est('est-ipiranga').latitude, lon: est('est-ipiranga').longitude, chave: 'estacao:est-ipiranga' },
    { tipo: 'INVERSAO_TERMICA', severidade: 'MEDIA', titulo: 'Inversão térmica — Santana', mensagem: 'Inversão térmica detectada sobre Santana: o ar a 300 m está 1,8 °C mais quente que na superfície.', dias: 8.7, lat: est('est-santana').latitude, lon: est('est-santana').longitude, chave: 'estacao:est-santana' },
    { tipo: 'CONCENTRACAO_OCORRENCIAS', severidade: 'MEDIA', titulo: 'Concentração de ocorrências: Alagamento', mensagem: '3 ocorrências de alagamento num raio de 1 km na última hora, região de Itaquera.', dias: 12.1, lat: -23.5392, lon: -46.4553, chave: 'concentracao:ALAGAMENTO', categoria: 'ALAGAMENTO' },
    { tipo: 'PRIORITARIO_MANANCIAL', severidade: 'ALTA', titulo: 'Invasão de manancial em área de manancial', mensagem: 'Ocorrência de invasão de manancial registrada dentro da área de proteção Represa Guarapiranga (Jardim Ângela).', dias: 15.4, lat: -23.765, lon: -46.77, chave: 'manancial:Represa Guarapiranga', categoria: 'INVASAO_MANANCIAL' },
    { tipo: 'POLUICAO', severidade: 'MEDIA', titulo: 'Qualidade do ar ruim — Estação Pinheiros', mensagem: 'IQAr 92 (Ruim) na Estação Pinheiros, poluente dominante O3.', dias: 18.6, lat: est('est-pinheiros').latitude, lon: est('est-pinheiros').longitude, chave: 'estacao:est-pinheiros' },
    { tipo: 'RISCO_ALAGAMENTO', severidade: 'CRITICA', titulo: 'Transbordamento — Santo Amaro', mensagem: 'Nível do córrego em 214 cm, acima da cota de alerta (160 cm), na região de Santo Amaro.', dias: 22.3, lat: est('est-santo-amaro').latitude, lon: est('est-santo-amaro').longitude, chave: 'estacao:est-santo-amaro' },
    { tipo: 'INVERSAO_TERMICA', severidade: 'ALTA', titulo: 'Inversão térmica — Sé', mensagem: 'Inversão térmica detectada sobre Sé: o ar a 300 m está 3,2 °C mais quente que na superfície.', dias: 26.8, lat: est('est-se').latitude, lon: est('est-se').longitude, chave: 'estacao:est-se' },
    { tipo: 'PRIORITARIO_MANANCIAL', severidade: 'ALTA', titulo: 'Desmatamento em área de manancial', mensagem: 'Ocorrência de desmatamento registrada dentro da área de proteção Represa Billings (Grajaú). Prioridade de fiscalização.', dias: 0.08, lat: -23.76, lon: -46.6, chave: 'manancial:Represa Billings', ativo: true, categoria: 'DESMATAMENTO' },
  ];
  for (const a of lista) {
    const id = randomUUID();
    const criado = new Date(agora - a.dias * 86_400_000);
    const encerrado = a.ativo ? null : new Date(criado.getTime() + entre(1, 5) * 3_600_000);
    await cliente.query(
      `INSERT INTO alertas.alertas (id, tipo, severidade, titulo, mensagem, latitude, longitude, raio_km, chave_area, categoria, origem, referencia_id, dados, status, criado_em, encerrado_em, encerrado_por, comentario_encerramento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'{}'::jsonb,$13,$14,$15,$16,$17)`,
      [id, a.tipo, a.severidade, a.titulo, a.mensagem, a.lat, a.lon, a.chave.startsWith('estacao') ? 3 : 1, a.chave, a.categoria ?? null,
        a.chave.startsWith('estacao') ? 'ambiental' : 'ocorrencias', 'seed', a.ativo ? 'ATIVO' : 'ENCERRADO', criado, encerrado,
        a.ativo ? null : 'Rafael Souza (Agente)', a.ativo ? null : 'Situação normalizada (dado histórico de demonstração).'],
    );
    await cliente.query(
      `INSERT INTO relatorios.alertas_view (id, tipo, severidade, titulo, status, criado_em, encerrado_em) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, a.tipo, a.severidade, a.titulo, a.ativo ? 'ATIVO' : 'ENCERRADO', criado, encerrado],
    );
  }
  console.log(`✔ ${lista.length} alertas históricos (1 ativo)`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL (usuário administrador do PostgreSQL).');
  const pastaUploads = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    await aguardarTabelas(pool);
    const cliente = await pool.connect();
    try {
      const existe = await cliente.query(`SELECT 1 FROM auth.usuarios WHERE email = 'admin@ecoradar.local'`);
      if (existe.rowCount && !FORCAR) {
        console.log('Dados de demonstração já existem — nada a fazer (use --forcar para recriar).');
        return;
      }
      await cliente.query('BEGIN');
      if (FORCAR) await limpar(cliente);
      const usuarios = await criarUsuarios(cliente);
      await criarOcorrencias(cliente, usuarios, pastaUploads);
      await criarHistoricoEstacoes(cliente);
      await criarAlertasHistoricos(cliente);
      await cliente.query('COMMIT');
      console.log('Seed concluído. Os eventos do outbox serão publicados em instantes (relatórios e alertas atualizam sozinhos).');
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error('Falha no seed:', erro);
  process.exit(1);
});
