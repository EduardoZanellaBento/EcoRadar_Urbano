import { z } from 'zod';
import {
  CATEGORIAS,
  PESO_SEVERIDADE,
  ROTULOS_CATEGORIA,
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_OCORRENCIA,
  type Categoria,
  type Severidade,
  type StatusOcorrencia,
} from '@ecoradar/shared';

export const filtrosRelatorioSchema = z
  .object({
    desde: z.coerce.date().optional(),
    ate: z.coerce.date().optional(),
    categoria: z.enum(CATEGORIAS).optional(),
    status: z.enum(STATUS_OCORRENCIA).optional(),
    bairro: z.string().trim().max(80).optional(),
  })
  .refine((f) => !f.desde || !f.ate || f.desde <= f.ate, { message: 'A data inicial deve ser anterior à final.', path: ['desde'] });
export type FiltrosRelatorio = z.infer<typeof filtrosRelatorioSchema>;

/** Ocorrência mínima usada nos cálculos (vinda da visão de leitura). */
export interface OcorrenciaRelatorio {
  id: string;
  categoria: Categoria;
  severidade: Severidade;
  status: StatusOcorrencia;
  bairro: string | null;
  confirmacoes: number;
  emAreaDeManancial: boolean;
  criadoEm: Date;
  resolvidoEm: Date | null;
}

export interface AreaCritica {
  bairro: string;
  total: number;
  emAberto: number;
  pontuacao: number;
  categoriaPredominante: string;
}

/**
 * Ranking das áreas mais críticas: para cada bairro soma-se o peso da severidade das
 * ocorrências ainda em aberto (ABERTA/EM_ANALISE) — Baixa 1, Média 2, Alta 3, Crítica 5 —
 * mais 0,5 ponto por ocorrência já encerrada (histórico da região). Desempate: total.
 */
export function rankingAreasCriticas(ocorrencias: OcorrenciaRelatorio[], limite = 5): AreaCritica[] {
  const porBairro = new Map<string, { total: number; emAberto: number; pontuacao: number; categorias: Map<Categoria, number> }>();
  for (const o of ocorrencias) {
    const bairro = o.bairro?.trim() || 'Não identificado';
    const b = porBairro.get(bairro) ?? { total: 0, emAberto: 0, pontuacao: 0, categorias: new Map() };
    b.total++;
    const aberta = o.status === 'ABERTA' || o.status === 'EM_ANALISE';
    if (aberta) {
      b.emAberto++;
      b.pontuacao += PESO_SEVERIDADE[o.severidade];
    } else {
      b.pontuacao += 0.5;
    }
    b.categorias.set(o.categoria, (b.categorias.get(o.categoria) ?? 0) + 1);
    porBairro.set(bairro, b);
  }
  return [...porBairro.entries()]
    .map(([bairro, b]) => {
      const [categoria] = [...b.categorias.entries()].sort((x, y) => y[1] - x[1])[0];
      return { bairro, total: b.total, emAberto: b.emAberto, pontuacao: b.pontuacao, categoriaPredominante: ROTULOS_CATEGORIA[categoria] };
    })
    .sort((a, b) => b.pontuacao - a.pontuacao || b.total - a.total || a.bairro.localeCompare(b.bairro))
    .slice(0, limite);
}

/** Tempo médio (horas) entre o registro e a resolução, considerando apenas as resolvidas. */
export function tempoMedioResolucaoHoras(ocorrencias: OcorrenciaRelatorio[]): number | null {
  const resolvidas = ocorrencias.filter((o) => o.status === 'RESOLVIDA' && o.resolvidoEm);
  if (!resolvidas.length) return null;
  const somaMs = resolvidas.reduce((s, o) => s + (o.resolvidoEm!.getTime() - o.criadoEm.getTime()), 0);
  return Math.round((somaMs / resolvidas.length / 3_600_000) * 10) / 10;
}

/** Taxa de validação colaborativa: % de ocorrências com ao menos uma confirmação. */
export function taxaConfirmacao(ocorrencias: OcorrenciaRelatorio[]) {
  const total = ocorrencias.length;
  const confirmadas = ocorrencias.filter((o) => o.confirmacoes > 0).length;
  const soma = ocorrencias.reduce((s, o) => s + o.confirmacoes, 0);
  return {
    ocorrenciasConfirmadas: confirmadas,
    percentual: total ? Math.round((confirmadas / total) * 1000) / 10 : 0,
    mediaConfirmacoes: total ? Math.round((soma / total) * 100) / 100 : 0,
  };
}

/** Série diária (últimos N dias, incluindo dias sem ocorrências), no fuso de São Paulo. */
export function serieDiaria(ocorrencias: OcorrenciaRelatorio[], dias: number, hoje: Date) {
  const chave = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
  const contagem = new Map<string, { total: number; resolvidas: number }>();
  for (const o of ocorrencias) {
    const k = chave(o.criadoEm);
    const c = contagem.get(k) ?? { total: 0, resolvidas: 0 };
    c.total++;
    if (o.status === 'RESOLVIDA') c.resolvidas++;
    contagem.set(k, c);
  }
  const serie: Array<{ dia: string; total: number; resolvidas: number }> = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 86_400_000);
    const k = chave(d);
    serie.push({ dia: k, ...(contagem.get(k) ?? { total: 0, resolvidas: 0 }) });
  }
  return serie;
}

export function contarPor<T extends string>(itens: T[], valores: readonly T[], rotulos: Record<T, string>) {
  const mapa = new Map<T, number>(valores.map((v) => [v, 0]));
  for (const i of itens) mapa.set(i, (mapa.get(i) ?? 0) + 1);
  return valores.map((v) => ({ chave: v, rotulo: rotulos[v], total: mapa.get(v) ?? 0 }));
}

export function montarEstatisticas(ocorrencias: OcorrenciaRelatorio[], agora: Date) {
  return {
    total: ocorrencias.length,
    porCategoria: contarPor(ocorrencias.map((o) => o.categoria), CATEGORIAS, ROTULOS_CATEGORIA),
    porStatus: contarPor(ocorrencias.map((o) => o.status), STATUS_OCORRENCIA, ROTULOS_STATUS),
    porSeveridade: contarPor(ocorrencias.map((o) => o.severidade), SEVERIDADES, ROTULOS_SEVERIDADE),
    serieDiaria: serieDiaria(ocorrencias, 30, agora),
    tempoMedioResolucaoHoras: tempoMedioResolucaoHoras(ocorrencias),
    areasCriticas: rankingAreasCriticas(ocorrencias, 5),
    confirmacao: taxaConfirmacao(ocorrencias),
    emAreaDeManancial: ocorrencias.filter((o) => o.emAreaDeManancial).length,
  };
}
export type Estatisticas = ReturnType<typeof montarEstatisticas>;

// ----- CSV ------------------------------------------------------------------------------

/** Escapa um valor para CSV (separador ";", padrão do Excel em português). */
export function celulaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  // Evita injeção de fórmulas ao abrir no Excel/LibreOffice
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function gerarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const BOM = '﻿'; // para o Excel reconhecer UTF-8 (acentos)
  return BOM + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n';
}
