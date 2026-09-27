import { describe, expect, it } from 'vitest';
import { avaliarLeitura } from '../src/dominio/avaliacao.js';
import {
  JanelaMovel,
  LimitadorEventos,
  avaliarNivelCorrego,
  descricaoTempo,
  detectarInversao,
} from '../src/dominio/indicadores.js';
import { interpretarPeriodo, leituraSensorSchema } from '../src/dominio/leitura.js';

describe('ambiental › inversão térmica', () => {
  it('detecta quando o ar a 300 m está mais quente que a superfície', () => {
    expect(detectarInversao(18, 19.5)).toEqual({ inversao: true, diferenca: 1.5, intensidade: 'MODERADA' });
    expect(detectarInversao(15, 18.2)).toMatchObject({ inversao: true, intensidade: 'FORTE' });
    expect(detectarInversao(15, 15.4)).toMatchObject({ inversao: true, intensidade: 'FRACA' });
  });

  it('perfil normal (temperatura cai com a altitude) não é inversão', () => {
    expect(detectarInversao(22, 20)).toEqual({ inversao: false, diferenca: -2, intensidade: null });
    expect(detectarInversao(20, 20)).toMatchObject({ inversao: false });
  });

  it('sem sensor de perfil térmico não há detecção', () => {
    expect(detectarInversao(null, 21)).toEqual({ inversao: false, diferenca: 0, intensidade: null });
  });
});

describe('ambiental › nível do córrego', () => {
  it('classifica em relação à cota de alerta', () => {
    expect(avaliarNivelCorrego(100, 180)).toBe('NORMAL');
    expect(avaliarNivelCorrego(150, 180)).toBe('ATENCAO');
    expect(avaliarNivelCorrego(190, 180)).toBe('ALERTA');
    expect(avaliarNivelCorrego(240, 180)).toBe('EXTRAVASAMENTO');
    expect(avaliarNivelCorrego(null, 180)).toBeNull();
    expect(avaliarNivelCorrego(100, 0)).toBeNull();
  });
});

describe('ambiental › limitador de eventos e média móvel', () => {
  it('publica no máximo um evento por janela para a mesma chave', () => {
    let agora = 0;
    const lim = new LimitadorEventos(60_000, () => agora);
    expect(lim.permitir('est-se:IQAR')).toBe(true);
    agora = 30_000;
    expect(lim.permitir('est-se:IQAR')).toBe(false);
    expect(lim.permitir('est-ipiranga:IQAR')).toBe(true);
    agora = 61_000;
    expect(lim.permitir('est-se:IQAR')).toBe(true);
    lim.liberar('est-se:IQAR');
    expect(lim.permitir('est-se:IQAR')).toBe(true);
  });

  it('calcula média móvel com tamanho fixo e ignora valores ausentes', () => {
    const j = new JanelaMovel(3);
    expect(j.media('x')).toBeNull();
    j.adicionar('x', 10);
    j.adicionar('x', 20);
    expect(j.adicionar('x', 30)).toBe(20);
    expect(j.adicionar('x', 40)).toBe(30); // janela: 20, 30, 40
    expect(j.adicionar('x', null)).toBe(30);
  });
});

describe('ambiental › avaliação de uma leitura', () => {
  const estacao = { id: 'est-ipiranga', nome: 'Estação Ipiranga', bairro: 'Ipiranga', latitude: -23.58, longitude: -46.61, cotaAlertaCm: 180 };
  const normais = { pm25: 10, pm10: 20, o3: 60, no2: 40, co: 0.5 };

  it('condições normais não geram eventos e liberam o limitador', () => {
    const r = avaliarLeitura(estacao, normais, { nivelCorregoCm: 70, tempSuperficie: 22, temp300m: 20, medidoEm: '2026-09-27T12:00:00Z' });
    expect(r.eventos).toHaveLength(0);
    expect(r.normalizadas).toEqual(['est-ipiranga:IQAR', 'est-ipiranga:NIVEL', 'est-ipiranga:INVERSAO']);
    expect(r.iqar!.classe).toBe('BOA');
  });

  it('IQAr ruim, córrego acima da cota e inversão geram os três eventos', () => {
    const r = avaliarLeitura(estacao, { ...normais, pm25: 160 }, { nivelCorregoCm: 210, tempSuperficie: 16, temp300m: 19, medidoEm: '2026-09-27T07:00:00Z' });
    const tipos = r.eventos.map((e) => `${e.tipo}:${'indicador' in e.dados ? e.dados.indicador : 'INVERSAO'}`);
    expect(tipos).toEqual(['ambiental.limite_excedido:IQAR', 'ambiental.limite_excedido:NIVEL_CORREGO', 'ambiental.inversao_termica:INVERSAO']);
    expect(r.eventos[0].dados).toMatchObject({ estacaoId: 'est-ipiranga', classe: 'PESSIMA', poluente: 'MP25' });
    expect(r.situacaoCorrego).toBe('ALERTA');
  });
});

describe('ambiental › mensagens e períodos', () => {
  it('valida a mensagem MQTT do simulador', () => {
    const ok = leituraSensorSchema.safeParse({ estacaoId: 'est-se', medidoEm: '2026-09-27T12:00:00.000Z', pm25: 12, nivel_corrego_cm: null });
    expect(ok.success).toBe(true);
    expect(leituraSensorSchema.safeParse({ estacaoId: 'est-se', medidoEm: 'ontem', pm25: -1 }).success).toBe(false);
  });

  it('interpreta períodos e escolhe o tamanho da agregação', () => {
    expect(interpretarPeriodo('6h')).toEqual({ horas: 6, baldeMinutos: 10 });
    expect(interpretarPeriodo('24h')).toEqual({ horas: 24, baldeMinutos: 30 });
    expect(interpretarPeriodo('3d')).toEqual({ horas: 72, baldeMinutos: 60 });
    expect(interpretarPeriodo('7d')).toEqual({ horas: 168, baldeMinutos: 180 });
    expect(() => interpretarPeriodo('ontem')).toThrow();
    expect(() => interpretarPeriodo('60d')).toThrow();
  });

  it('descreve os códigos de tempo WMO em português', () => {
    expect(descricaoTempo(0)).toBe('Céu limpo');
    expect(descricaoTempo(2)).toBe('Parcialmente nublado');
    expect(descricaoTempo(63)).toBe('Chuva');
    expect(descricaoTempo(81)).toBe('Pancadas de chuva');
    expect(descricaoTempo(95)).toBe('Trovoadas');
    expect(descricaoTempo(null)).toBe('Indisponível');
  });
});
