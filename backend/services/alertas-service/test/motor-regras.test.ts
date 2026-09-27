import { describe, expect, it } from 'vitest';
import { criarEvento, type SnapshotOcorrencia } from '@ecoradar/shared';
import { avaliarEvento, ehDuplicado, type AlertaExistente, type OcorrenciaRecente } from '../src/dominio/motor-regras.js';

const AGORA = new Date('2026-09-27T15:00:00-03:00');
const min = (m: number) => new Date(AGORA.getTime() - m * 60_000);

function ocorrencia(parcial: Partial<SnapshotOcorrencia> = {}): SnapshotOcorrencia {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    categoria: 'ALAGAMENTO',
    severidade: 'ALTA',
    status: 'ABERTA',
    descricao: 'Rua alagada',
    latitude: -23.5503,
    longitude: -46.6339,
    bairro: 'Sé',
    emAreaDeManancial: false,
    manancialNome: null,
    confirmacoes: 0,
    fotoUrl: null,
    usuarioId: 'u1',
    usuarioNome: 'Ana',
    criadoEm: AGORA.toISOString(),
    atualizadoEm: AGORA.toISOString(),
    resolvidoEm: null,
    versao: 1,
    ...parcial,
  };
}

const eventoOcorrencia = (o: SnapshotOcorrencia) => criarEvento('ocorrencia.criada', { ocorrencia: o }, { origem: 'teste' });

const limite = (d: Record<string, unknown>) =>
  criarEvento(
    'ambiental.limite_excedido',
    { estacaoId: 'est-se', estacaoNome: 'Estação Sé', bairro: 'Sé', latitude: -23.55, longitude: -46.63, medidoEm: AGORA.toISOString(), ...d },
    { origem: 'teste' },
  );

describe('regras 1–3 › eventos ambientais', () => {
  it('IQAr Ruim/Muito Ruim/Péssima gera POLUICAO com severidade proporcional', () => {
    const casos = [
      ['RUIM', 'MEDIA'],
      ['MUITO_RUIM', 'ALTA'],
      ['PESSIMA', 'CRITICA'],
    ] as const;
    for (const [classe, severidade] of casos) {
      const [a] = avaliarEvento(limite({ indicador: 'IQAR', valor: 150, limite: 80, classe, poluente: 'MP25' }), { agora: AGORA, ocorrenciasRecentes: [] });
      expect(a).toMatchObject({ tipo: 'POLUICAO', severidade, chaveArea: 'estacao:est-se', origem: 'ambiental' });
    }
  });

  it('IQAr Moderado não gera alerta', () => {
    expect(avaliarEvento(limite({ indicador: 'IQAR', valor: 60, limite: 80, classe: 'MODERADA' }), { agora: AGORA, ocorrenciasRecentes: [] })).toEqual([]);
  });

  it('nível acima da cota gera RISCO_ALAGAMENTO (crítico acima de 130% da cota)', () => {
    const [alto] = avaliarEvento(limite({ indicador: 'NIVEL_CORREGO', valor: 200, limite: 180 }), { agora: AGORA, ocorrenciasRecentes: [] });
    expect(alto).toMatchObject({ tipo: 'RISCO_ALAGAMENTO', severidade: 'ALTA' });
    const [critico] = avaliarEvento(limite({ indicador: 'NIVEL_CORREGO', valor: 250, limite: 180 }), { agora: AGORA, ocorrenciasRecentes: [] });
    expect(critico.severidade).toBe('CRITICA');
    expect(critico.mensagem).toContain('250 cm');
  });

  it('inversão térmica gera INVERSAO_TERMICA (ALTA a partir de 3 °C)', () => {
    const ev = (diferenca: number) =>
      criarEvento(
        'ambiental.inversao_termica',
        { estacaoId: 'est-se', estacaoNome: 'Estação Sé', bairro: 'Sé', latitude: -23.55, longitude: -46.63, tempSuperficie: 16, temp300m: 16 + diferenca, diferenca, medidoEm: AGORA.toISOString() },
        { origem: 'teste' },
      );
    expect(avaliarEvento(ev(1.5), { agora: AGORA, ocorrenciasRecentes: [] })[0]).toMatchObject({ tipo: 'INVERSAO_TERMICA', severidade: 'MEDIA' });
    expect(avaliarEvento(ev(3.4), { agora: AGORA, ocorrenciasRecentes: [] })[0]).toMatchObject({ severidade: 'ALTA' });
  });

  it('eventos de outros tipos não geram alertas', () => {
    expect(avaliarEvento(criarEvento('alerta.criado', {}, { origem: 'teste' }), { agora: AGORA, ocorrenciasRecentes: [] })).toEqual([]);
  });
});

describe('regra 4 › concentração de ocorrências (≥ 3, mesma categoria, 1 km, 60 min)', () => {
  const vizinha = (id: string, dLat: number, minutosAtras: number, categoria: OcorrenciaRecente['categoria'] = 'ALAGAMENTO'): OcorrenciaRecente => ({
    id,
    categoria,
    latitude: -23.5503 + dLat,
    longitude: -46.6339,
    criadoEm: min(minutosAtras),
  });

  it('três ocorrências próximas na última hora disparam o alerta', () => {
    const recentes = [vizinha('a', 0.002, 10), vizinha('b', -0.003, 40)]; // ~220 m e ~330 m
    const alertas = avaliarEvento(eventoOcorrencia(ocorrencia()), { agora: AGORA, ocorrenciasRecentes: recentes });
    const c = alertas.find((a) => a.tipo === 'CONCENTRACAO_OCORRENCIAS');
    expect(c).toBeDefined();
    expect(c!.severidade).toBe('MEDIA');
    expect(c!.dados.quantidade).toBe(3);
  });

  it('não dispara com só 2 ocorrências, com ocorrências distantes, antigas ou de outra categoria', () => {
    const casos: OcorrenciaRecente[][] = [
      [vizinha('a', 0.002, 10)],
      [vizinha('a', 0.002, 10), vizinha('b', 0.02, 10)], // ~2,2 km
      [vizinha('a', 0.002, 10), vizinha('b', 0.001, 90)], // fora dos 60 min
      [vizinha('a', 0.002, 10), vizinha('b', 0.001, 5, 'QUEIMADA')],
    ];
    for (const recentes of casos) {
      const alertas = avaliarEvento(eventoOcorrencia(ocorrencia()), { agora: AGORA, ocorrenciasRecentes: recentes });
      expect(alertas.some((a) => a.tipo === 'CONCENTRACAO_OCORRENCIAS')).toBe(false);
    }
  });

  it('cinco ou mais ocorrências elevam a severidade para ALTA', () => {
    const recentes = ['a', 'b', 'c', 'd'].map((id, i) => vizinha(id, 0.001 * (i + 1), 5 * (i + 1)));
    const c = avaliarEvento(eventoOcorrencia(ocorrencia()), { agora: AGORA, ocorrenciasRecentes: recentes }).find((a) => a.tipo === 'CONCENTRACAO_OCORRENCIAS');
    expect(c!.severidade).toBe('ALTA');
  });

  it('ocorrências antigas (ex.: dados históricos) não disparam alerta de concentração', () => {
    const antiga = ocorrencia({ criadoEm: min(24 * 60).toISOString() });
    const recentes = [vizinha('a', 0.001, 24 * 60 - 5), vizinha('b', 0.001, 24 * 60 - 10)];
    expect(avaliarEvento(eventoOcorrencia(antiga), { agora: AGORA, ocorrenciasRecentes: recentes })).toEqual([]);
  });
});

describe('regra 5 › prioridade em área de manancial', () => {
  it('invasão ou desmatamento dentro de manancial gera PRIORITARIO_MANANCIAL', () => {
    for (const categoria of ['INVASAO_MANANCIAL', 'DESMATAMENTO'] as const) {
      const o = ocorrencia({ categoria, emAreaDeManancial: true, manancialNome: 'Represa Guarapiranga', severidade: 'MEDIA' });
      const [a] = avaliarEvento(eventoOcorrencia(o), { agora: AGORA, ocorrenciasRecentes: [] });
      expect(a).toMatchObject({ tipo: 'PRIORITARIO_MANANCIAL', severidade: 'ALTA', categoria });
      expect(a.mensagem).toContain('Represa Guarapiranga');
    }
  });

  it('severidade crítica da ocorrência torna o alerta crítico', () => {
    const o = ocorrencia({ categoria: 'DESMATAMENTO', emAreaDeManancial: true, manancialNome: 'Represa Billings', severidade: 'CRITICA' });
    expect(avaliarEvento(eventoOcorrencia(o), { agora: AGORA, ocorrenciasRecentes: [] })[0].severidade).toBe('CRITICA');
  });

  it('fora do manancial, ou outra categoria, não gera o alerta prioritário', () => {
    const fora = ocorrencia({ categoria: 'DESMATAMENTO', emAreaDeManancial: false });
    const outra = ocorrencia({ categoria: 'QUEIMADA', emAreaDeManancial: true, manancialNome: 'Represa Billings' });
    expect(avaliarEvento(eventoOcorrencia(fora), { agora: AGORA, ocorrenciasRecentes: [] })).toEqual([]);
    expect(avaliarEvento(eventoOcorrencia(outra), { agora: AGORA, ocorrenciasRecentes: [] })).toEqual([]);
  });
});

describe('regra 6 › deduplicação (mesmo alerta, mesma área, 30 min)', () => {
  const [candidatoEstacao] = avaliarEvento(limite({ indicador: 'IQAR', valor: 150, limite: 80, classe: 'MUITO_RUIM' }), { agora: AGORA, ocorrenciasRecentes: [] });
  const existente = (p: Partial<AlertaExistente>): AlertaExistente => ({
    tipo: 'POLUICAO',
    severidade: 'ALTA',
    chaveArea: 'estacao:est-se',
    categoria: null,
    latitude: -23.55,
    longitude: -46.63,
    criadoEm: min(10),
    ...p,
  });

  it('suprime alerta da mesma estação dentro de 30 minutos', () => {
    expect(ehDuplicado(candidatoEstacao, [existente({})], AGORA)).toBe(true);
  });

  it('permite novamente após 30 minutos, em outra estação ou de outro tipo', () => {
    expect(ehDuplicado(candidatoEstacao, [existente({ criadoEm: min(31) })], AGORA)).toBe(false);
    expect(ehDuplicado(candidatoEstacao, [existente({ chaveArea: 'estacao:est-pinheiros' })], AGORA)).toBe(false);
    expect(ehDuplicado(candidatoEstacao, [existente({ tipo: 'RISCO_ALAGAMENTO' })], AGORA)).toBe(false);
    expect(ehDuplicado(candidatoEstacao, [], AGORA)).toBe(false);
  });

  it('situação que piorou (severidade maior) não é repetição: o alerta é emitido', () => {
    // candidato MUITO_RUIM -> ALTA; existente MEDIA (Ruim) -> escalonamento
    expect(ehDuplicado(candidatoEstacao, [existente({ severidade: 'MEDIA' })], AGORA)).toBe(false);
    // existente já CRITICA -> o candidato ALTA é repetição
    expect(ehDuplicado(candidatoEstacao, [existente({ severidade: 'CRITICA' })], AGORA)).toBe(true);
  });

  it('alertas de ocorrências são deduplicados por proximidade (1 km) e categoria', () => {
    const o = ocorrencia({ categoria: 'DESMATAMENTO', emAreaDeManancial: true, manancialNome: 'Represa Guarapiranga' });
    const [c] = avaliarEvento(eventoOcorrencia(o), { agora: AGORA, ocorrenciasRecentes: [] });
    const base = { tipo: 'PRIORITARIO_MANANCIAL' as const, severidade: 'ALTA' as const, chaveArea: 'manancial:Represa Guarapiranga', categoria: 'DESMATAMENTO' as const, criadoEm: min(5) };
    expect(ehDuplicado(c, [{ ...base, latitude: -23.5553, longitude: -46.6339 }], AGORA)).toBe(true); // ~560 m
    expect(ehDuplicado(c, [{ ...base, latitude: -23.58, longitude: -46.6339 }], AGORA)).toBe(false); // ~3,3 km
    expect(ehDuplicado(c, [{ ...base, categoria: 'INVASAO_MANANCIAL', latitude: -23.5503, longitude: -46.6339 }], AGORA)).toBe(false);
    expect(ehDuplicado(c, [{ ...base, latitude: null, longitude: null }], AGORA)).toBe(true);
  });
});
