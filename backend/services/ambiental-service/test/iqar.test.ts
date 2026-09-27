import { describe, expect, it } from 'vitest';
import { calcularIqar, classeDoIndice, classeExigeAlerta, coMicrogramasParaPpm, indicePoluente } from '../src/dominio/iqar.js';

/**
 * Valores esperados calculados manualmente com a fórmula da CETESB:
 *   IQAr = Iini + (Ifin − Iini)/(Cfin − Cini) × (C − Cini)
 */
describe('IQAr (CETESB/CONAMA 491) › índice por poluente', () => {
  it('limites superiores de cada faixa do MP2,5 caem exatamente nos índices 40/80/120/200', () => {
    expect(indicePoluente('MP25', 15)).toMatchObject({ indice: 40, classe: 'BOA' });
    expect(indicePoluente('MP25', 50)).toMatchObject({ indice: 80, classe: 'MODERADA' });
    expect(indicePoluente('MP25', 75)).toMatchObject({ indice: 120, classe: 'RUIM' });
    expect(indicePoluente('MP25', 125)).toMatchObject({ indice: 200, classe: 'MUITO_RUIM' });
  });

  it('interpola dentro da faixa', () => {
    // CO 10 ppm: faixa N2 (9–11 ppm, índice 41–80): 41 + 39/2 × 1 = 60,5 -> 61
    expect(indicePoluente('CO', 10)).toMatchObject({ indice: 61, classe: 'MODERADA' });
    // MP2,5 100 µg/m³: N4 (75–125, 121–200): 121 + 79/50 × 25 = 160,5 -> 161
    expect(indicePoluente('MP25', 100)).toMatchObject({ indice: 161, classe: 'MUITO_RUIM' });
    // O3 157 µg/m³: N3 (130–160, 81–120): 81 + 39/30 × 27 = 116,1 -> 116
    expect(indicePoluente('O3', 157)).toMatchObject({ indice: 116, classe: 'RUIM' });
    // MP10 30 µg/m³: N1 (0–45, 0–40): 40/45 × 30 = 26,7 -> 27
    expect(indicePoluente('MP10', 30)).toMatchObject({ indice: 27, classe: 'BOA' });
  });

  it('classifica Péssima acima da faixa N4 e limita índices extremos a 500', () => {
    // MP2,5 200: N5 (125–300, 201–400): 201 + 199/175 × 75 = 286,3 -> 286
    expect(indicePoluente('MP25', 200)).toMatchObject({ indice: 286, classe: 'PESSIMA' });
    expect(indicePoluente('MP25', 5000)).toMatchObject({ indice: 500, classe: 'PESSIMA' });
  });

  it('usa as faixas atuais da CETESB para NO2 e SO2', () => {
    expect(indicePoluente('NO2', 200)).toMatchObject({ indice: 40, classe: 'BOA' });
    expect(indicePoluente('NO2', 250).classe).toBe('RUIM');
    expect(indicePoluente('SO2', 45).classe).toBe('MODERADA');
    expect(indicePoluente('SO2', 900).classe).toBe('PESSIMA');
  });

  it('trata concentração negativa como zero', () => {
    expect(indicePoluente('MP10', -3)).toMatchObject({ indice: 0, classe: 'BOA' });
  });
});

describe('IQAr › índice da estação (pior caso)', () => {
  it('o índice divulgado é o maior entre os poluentes', () => {
    const r = calcularIqar({ MP25: 10, MP10: 20, O3: 157, NO2: 40, CO: 0.5 });
    expect(r).not.toBeNull();
    expect(r!.indice).toBe(116);
    expect(r!.classe).toBe('RUIM');
    expect(r!.poluenteDominante).toBe('O3');
    expect(r!.porPoluente).toHaveLength(5);
  });

  it('ignora poluentes sem medição e retorna null sem dados', () => {
    expect(calcularIqar({ MP25: null, O3: undefined })).toBeNull();
    expect(calcularIqar({ MP25: 12, O3: null })!.poluenteDominante).toBe('MP25');
  });

  it('classe a partir do índice e regra de alerta (≥ Ruim)', () => {
    expect([0, 40, 41, 80, 81, 120, 121, 200, 201].map(classeDoIndice)).toEqual([
      'BOA',
      'BOA',
      'MODERADA',
      'MODERADA',
      'RUIM',
      'RUIM',
      'MUITO_RUIM',
      'MUITO_RUIM',
      'PESSIMA',
    ]);
    expect(classeExigeAlerta('MODERADA')).toBe(false);
    expect(classeExigeAlerta('RUIM')).toBe(true);
    expect(classeExigeAlerta('PESSIMA')).toBe(true);
  });

  it('converte CO de µg/m³ para ppm', () => {
    expect(coMicrogramasParaPpm(1145)).toBeCloseTo(1, 5);
    expect(coMicrogramasParaPpm(236)).toBeCloseTo(0.206, 2);
  });
});
