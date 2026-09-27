import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ROTULOS_CLASSE_IQAR, type ClasseIqar, type DefinicaoEstacao } from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { cacheIntegracoes, estacoes, leituras } from './db/schema.js';
import { avaliarNivelCorrego, detectarInversao } from './dominio/indicadores.js';
import type { DadosExternos, PersistenciaCache } from './integracoes/open-meteo.js';

export type Db = NodePgDatabase<typeof schema>;

/** Cadastra/atualiza as estações virtuais a partir da definição compartilhada. */
export async function sincronizarEstacoes(db: Db, definicoes: DefinicaoEstacao[]) {
  for (const e of definicoes) {
    const valores = {
      nome: e.nome,
      bairro: e.bairro,
      latitude: e.latitude,
      longitude: e.longitude,
      tipos: e.tipos,
      corrego: e.corrego ?? null,
      cotaAlertaCm: e.cotaAlertaCm ?? null,
      atualizadoEm: new Date(),
    };
    await db.insert(estacoes).values({ id: e.id, ...valores }).onConflictDoUpdate({ target: estacoes.id, set: valores });
  }
}

interface LinhaUltimaLeitura {
  estacao_id: string;
  medido_em: Date;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  co: number | null;
  temperatura: number | null;
  umidade: number | null;
  nivel_corrego_cm: number | null;
  temp_superficie: number | null;
  temp_300m: number | null;
  iqar: number | null;
  iqar_classe: ClasseIqar | null;
  poluente_dominante: string | null;
  cenario: string | null;
}

/** Estações com a leitura mais recente de cada uma (DISTINCT ON + índice por estação/data). */
export async function estacoesComUltimaLeitura(db: Db) {
  const lista = await db.select().from(estacoes).orderBy(estacoes.nome);
  const r = await db.execute<LinhaUltimaLeitura & Record<string, unknown>>(sql`
    SELECT DISTINCT ON (estacao_id) estacao_id, medido_em, pm25, pm10, o3, no2, co, temperatura, umidade,
           nivel_corrego_cm, temp_superficie, temp_300m, iqar, iqar_classe, poluente_dominante, cenario
    FROM ${leituras}
    WHERE medido_em > now() - interval '2 days'
    ORDER BY estacao_id, medido_em DESC`);
  const porEstacao = new Map(r.rows.map((l) => [l.estacao_id, l]));
  const agora = Date.now();
  return lista.map((e) => {
    const l = porEstacao.get(e.id);
    const medidoEm = l ? new Date(l.medido_em) : null;
    const inversao = detectarInversao(l?.temp_superficie, l?.temp_300m);
    const situacao = avaliarNivelCorrego(l?.nivel_corrego_cm, e.cotaAlertaCm);
    return {
      id: e.id,
      nome: e.nome,
      bairro: e.bairro,
      latitude: e.latitude,
      longitude: e.longitude,
      tipos: e.tipos,
      online: medidoEm !== null && agora - medidoEm.getTime() < 30_000,
      ultimaLeituraEm: medidoEm?.toISOString() ?? null,
      cenario: l?.cenario ?? null,
      leitura: l
        ? {
            pm25: l.pm25,
            pm10: l.pm10,
            o3: l.o3,
            no2: l.no2,
            co: l.co,
            temperatura: l.temperatura,
            umidade: l.umidade,
            nivelCorregoCm: l.nivel_corrego_cm,
            tempSuperficie: l.temp_superficie,
            temp300m: l.temp_300m,
          }
        : null,
      iqar:
        l && l.iqar !== null && l.iqar_classe
          ? { indice: l.iqar, classe: l.iqar_classe, rotulo: ROTULOS_CLASSE_IQAR[l.iqar_classe], poluenteDominante: l.poluente_dominante }
          : null,
      inversao: { ativa: inversao.inversao, diferenca: inversao.diferenca, intensidade: inversao.intensidade },
      corrego: e.corrego
        ? { nome: e.corrego, nivelCm: l?.nivel_corrego_cm ?? null, cotaAlertaCm: e.cotaAlertaCm, situacao }
        : null,
    };
  });
}
export type EstacaoResumo = Awaited<ReturnType<typeof estacoesComUltimaLeitura>>[number];

export async function estacaoExiste(db: Db, id: string) {
  const [e] = await db.select({ id: estacoes.id }).from(estacoes).where(eq(estacoes.id, id)).limit(1);
  return Boolean(e);
}

/** Série agregada por intervalos ("baldes") com date_bin — usada nos gráficos de 24 h. */
export async function serieTemporal(db: Db, estacaoId: string, horas: number, baldeMinutos: number) {
  const r = await db.execute<Record<string, unknown>>(sql`
    SELECT date_bin(${`${baldeMinutos} minutes`}::interval, medido_em, TIMESTAMPTZ '2000-01-01') AS instante,
           round(avg(pm25)::numeric, 1) AS pm25, round(avg(pm10)::numeric, 1) AS pm10,
           round(avg(o3)::numeric, 1) AS o3, round(avg(no2)::numeric, 1) AS no2,
           round(avg(co)::numeric, 2) AS co, round(avg(temperatura)::numeric, 1) AS temperatura,
           round(avg(umidade)::numeric, 0) AS umidade, round(avg(nivel_corrego_cm)::numeric, 0) AS nivel_corrego_cm,
           round(avg(temp_superficie)::numeric, 1) AS temp_superficie, round(avg(temp_300m)::numeric, 1) AS temp_300m,
           max(iqar) AS iqar, bool_or(inversao) AS inversao, count(*)::int AS amostras
    FROM ${leituras}
    WHERE estacao_id = ${estacaoId} AND medido_em > now() - ${`${horas} hours`}::interval
    GROUP BY 1 ORDER BY 1`);
  return r.rows.map((l) => ({
    instante: new Date(l.instante as string).toISOString(),
    pm25: l.pm25 as number | null,
    pm10: l.pm10 as number | null,
    o3: l.o3 as number | null,
    no2: l.no2 as number | null,
    co: l.co as number | null,
    temperatura: l.temperatura as number | null,
    umidade: l.umidade as number | null,
    nivelCorregoCm: l.nivel_corrego_cm as number | null,
    tempSuperficie: l.temp_superficie as number | null,
    temp300m: l.temp_300m as number | null,
    iqar: l.iqar as number | null,
    inversao: Boolean(l.inversao),
    amostras: l.amostras as number,
  }));
}

/** Remove leituras antigas para a série temporal não crescer indefinidamente. */
export async function limparLeituras(db: Db, dias = 7) {
  const r = await db.execute(sql`DELETE FROM ${leituras} WHERE medido_em < now() - ${`${dias} days`}::interval`);
  return r.rowCount ?? 0;
}

export function persistenciaCache(db: Db, chave: string): PersistenciaCache {
  return {
    async salvar(dados: DadosExternos) {
      await db
        .insert(cacheIntegracoes)
        .values({ chave, dados, obtidoEm: new Date(dados.obtidoEm) })
        .onConflictDoUpdate({ target: cacheIntegracoes.chave, set: { dados, obtidoEm: new Date(dados.obtidoEm) } });
    },
    async carregar() {
      const [l] = await db.select().from(cacheIntegracoes).where(eq(cacheIntegracoes.chave, chave)).limit(1);
      return l ? (l.dados as DadosExternos) : null;
    },
  };
}
