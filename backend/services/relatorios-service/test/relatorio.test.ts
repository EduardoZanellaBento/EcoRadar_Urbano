import { describe, expect, it } from 'vitest';
import {
  celulaCsv,
  filtrosRelatorioSchema,
  gerarCsv,
  montarEstatisticas,
  rankingAreasCriticas,
  serieDiaria,
  taxaConfirmacao,
  tempoMedioResolucaoHoras,
  type OcorrenciaRelatorio,
} from '../src/dominio/relatorio.js';
import { gerarPdf } from '../src/pdf.js';

const HOJE = new Date('2026-09-27T15:00:00-03:00');
const h = (horas: number) => new Date(HOJE.getTime() - horas * 3_600_000);
let n = 0;
function oc(p: Partial<OcorrenciaRelatorio>): OcorrenciaRelatorio {
  n++;
  return {
    id: `id-${n}`,
    categoria: 'ALAGAMENTO',
    severidade: 'MEDIA',
    status: 'ABERTA',
    bairro: 'Sé',
    confirmacoes: 0,
    emAreaDeManancial: false,
    criadoEm: h(2),
    resolvidoEm: null,
    ...p,
  };
}

const AMOSTRA: OcorrenciaRelatorio[] = [
  oc({ bairro: 'Sé', severidade: 'CRITICA', confirmacoes: 2 }),
  oc({ bairro: 'Sé', severidade: 'ALTA', categoria: 'QUEIMADA' }),
  oc({ bairro: 'Sé', status: 'RESOLVIDA', criadoEm: h(30), resolvidoEm: h(20) }),
  oc({ bairro: 'Mooca', severidade: 'BAIXA', confirmacoes: 1 }),
  oc({ bairro: 'Mooca', status: 'RESOLVIDA', criadoEm: h(10), resolvidoEm: h(6), categoria: 'TRANSITO' }),
  oc({ bairro: null, severidade: 'MEDIA', status: 'DESCARTADA', emAreaDeManancial: true }),
];

describe('relatórios › indicadores', () => {
  it('tempo médio de resolução considera apenas as resolvidas', () => {
    expect(tempoMedioResolucaoHoras(AMOSTRA)).toBe(7); // (10 h + 4 h) / 2
    expect(tempoMedioResolucaoHoras([oc({})])).toBeNull();
  });

  it('taxa de validação colaborativa', () => {
    expect(taxaConfirmacao(AMOSTRA)).toEqual({ ocorrenciasConfirmadas: 2, percentual: 33.3, mediaConfirmacoes: 0.5 });
    expect(taxaConfirmacao([])).toEqual({ ocorrenciasConfirmadas: 0, percentual: 0, mediaConfirmacoes: 0 });
  });

  it('ranking de áreas críticas pondera severidade das ocorrências em aberto', () => {
    const r = rankingAreasCriticas(AMOSTRA);
    expect(r[0]).toMatchObject({ bairro: 'Sé', total: 3, emAberto: 2, pontuacao: 8.5 }); // 5 + 3 + 0,5
    expect(r[1]).toMatchObject({ bairro: 'Mooca', pontuacao: 1.5 });
    expect(r.map((a) => a.bairro)).toContain('Não identificado');
    expect(rankingAreasCriticas(AMOSTRA, 1)).toHaveLength(1);
  });

  it('série diária cobre todos os dias, inclusive os sem ocorrências', () => {
    const s = serieDiaria(AMOSTRA, 30, HOJE);
    expect(s).toHaveLength(30);
    expect(s.at(-1)!.dia).toBe('2026-09-27');
    expect(s.reduce((t, d) => t + d.total, 0)).toBe(AMOSTRA.length);
  });

  it('monta todas as contagens com rótulos em português', () => {
    const e = montarEstatisticas(AMOSTRA, HOJE);
    expect(e.total).toBe(6);
    expect(e.porCategoria.find((c) => c.chave === 'ALAGAMENTO')).toMatchObject({ rotulo: 'Alagamento', total: 4 });
    expect(e.porStatus.find((c) => c.chave === 'EM_ANALISE')).toMatchObject({ rotulo: 'Em análise', total: 0 });
    expect(e.porSeveridade.map((c) => c.chave)).toEqual(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']);
    expect(e.emAreaDeManancial).toBe(1);
  });

  it('valida filtros (período invertido é rejeitado)', () => {
    expect(filtrosRelatorioSchema.safeParse({ desde: '2026-09-01', ate: '2026-09-30', categoria: 'QUEIMADA' }).success).toBe(true);
    expect(filtrosRelatorioSchema.safeParse({ desde: '2026-09-30', ate: '2026-09-01' }).success).toBe(false);
    expect(filtrosRelatorioSchema.safeParse({ categoria: 'TERREMOTO' }).success).toBe(false);
  });
});

describe('relatórios › CSV', () => {
  it('escapa separador, aspas, quebras de linha e fórmulas', () => {
    expect(celulaCsv('simples')).toBe('simples');
    expect(celulaCsv('a;b')).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv('linha\nnova')).toBe('"linha\nnova"');
    expect(celulaCsv('=SOMA(A1:A2)')).toBe("'=SOMA(A1:A2)");
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
  });

  it('gera arquivo com BOM, cabeçalho e CRLF', () => {
    const csv = gerarCsv(['a', 'b'], [[1, 'ç'], [2, 'ã']]);
    expect(csv.startsWith('﻿a;b\r\n1;ç\r\n2;ã')).toBe(true);
  });
});

describe('relatórios › PDF', () => {
  it('gera um PDF válido com as seções principais', async () => {
    const pdf = await gerarPdf({
      cidade: 'São Paulo/SP',
      geradoEm: HOJE,
      filtros: 'nenhum (todas as ocorrências)',
      estatisticas: montarEstatisticas(AMOSTRA, HOJE),
      alertas: { total: 3, ativos: 1, porTipo: [{ rotulo: 'Poluição do ar', total: 3 }] },
      ultimas: AMOSTRA.map((o) => ({ ...o })),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });
});
