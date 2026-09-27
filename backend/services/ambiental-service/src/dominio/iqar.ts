import type { ClasseIqar } from '@ecoradar/shared';

/**
 * Índice de Qualidade do Ar (IQAr) — metodologia CETESB, vinculada à Resolução CONAMA nº 491/2018.
 *
 * Fonte das faixas (consultada em 27/09/2026):
 *   CETESB — "Padrões de Qualidade do Ar" / "Índice de Qualidade do Ar e Saúde"
 *   https://www.cetesb.sp.gov.br/cetesb/qualidade_ambiental/ar/informacoes_basicas/padroes_de_qualidade_do_ar
 *
 * | Qualidade        | Índice    | MP10 24h | MP2,5 24h | O3 8h     | CO 8h (ppm) | NO2 1h      | SO2 24h    |
 * |------------------|-----------|----------|-----------|-----------|-------------|-------------|------------|
 * | N1 – Boa         | 0 – 40    | 0 – 45   | 0 – 15    | 0 – 100   | 0 – 9       | 0 – 200     | 0 – 40     |
 * | N2 – Moderada    | 41 – 80   | >45–100  | >15–50    | >100–130  | >9–11       | >200–240    | >40–50     |
 * | N3 – Ruim        | 81 – 120  | >100–150 | >50–75    | >130–160  | >11–13      | >240–320    | >50–125    |
 * | N4 – Muito Ruim  | 121 – 200 | >150–250 | >75–125   | >160–200  | >13–15      | >320–1130   | >125–800   |
 * | N5 – Péssima     | > 200     | >250     | >125      | >200      | >15         | >1130       | >800       |
 * (concentrações em µg/m³, exceto CO em ppm)
 *
 * Cálculo (interpolação linear dentro da faixa, como na metodologia CETESB/MMA):
 *   IQAr = Iini + (Ifin − Iini) / (Cfin − Cini) × (C − Cini)
 * O índice divulgado é o MAIOR entre os poluentes (pior caso).
 *
 * Observações do protótipo:
 *  - A tabela oficial não define limite superior para N5; para interpolar, adotou-se o
 *    índice 400 nas concentrações de referência de "emergência" usadas historicamente pela
 *    CETESB (MP10 600, MP2,5 300, O3 800, CO 50 ppm, NO2 3750, SO2 2620). Acima disso o
 *    índice é extrapolado e limitado a 500.
 *  - A metodologia oficial usa médias de 24 h/8 h/1 h. Para demonstração em tempo real, o
 *    serviço aplica as faixas sobre a média móvel curta das leituras simuladas (documentado
 *    no README).
 */
export type Poluente = 'MP10' | 'MP25' | 'O3' | 'CO' | 'NO2' | 'SO2';

export const ROTULOS_POLUENTE: Record<Poluente, string> = {
  MP10: 'MP10',
  MP25: 'MP2,5',
  O3: 'O₃',
  CO: 'CO',
  NO2: 'NO₂',
  SO2: 'SO₂',
};

const FAIXAS_INDICE: Array<[number, number]> = [
  [0, 40],
  [41, 80],
  [81, 120],
  [121, 200],
  [201, 400],
];

const CLASSES: ClasseIqar[] = ['BOA', 'MODERADA', 'RUIM', 'MUITO_RUIM', 'PESSIMA'];

/** Limite superior de concentração de cada faixa (N1..N5). */
export const LIMITES_CONCENTRACAO: Record<Poluente, [number, number, number, number, number]> = {
  MP10: [45, 100, 150, 250, 600],
  MP25: [15, 50, 75, 125, 300],
  O3: [100, 130, 160, 200, 800],
  CO: [9, 11, 13, 15, 50],
  NO2: [200, 240, 320, 1130, 3750],
  SO2: [40, 50, 125, 800, 2620],
};

export interface IndicePoluente {
  poluente: Poluente;
  concentracao: number;
  indice: number;
  classe: ClasseIqar;
}

export interface ResultadoIqar {
  indice: number;
  classe: ClasseIqar;
  poluenteDominante: Poluente;
  porPoluente: IndicePoluente[];
}

const INDICE_MAXIMO = 500;

/** Calcula o índice (0–500) e a classe de um único poluente. */
export function indicePoluente(poluente: Poluente, concentracao: number): IndicePoluente {
  const limites = LIMITES_CONCENTRACAO[poluente];
  const c = Math.max(0, concentracao);
  let faixa = limites.findIndex((lim) => c <= lim);
  let indice: number;
  if (faixa === -1) {
    // Acima da última faixa: extrapola com a inclinação de N5 e limita
    faixa = 4;
    const [iIni, iFin] = FAIXAS_INDICE[4];
    const cIni = limites[3];
    const cFin = limites[4];
    indice = Math.min(INDICE_MAXIMO, iIni + ((iFin - iIni) / (cFin - cIni)) * (c - cIni));
  } else {
    const [iIni, iFin] = FAIXAS_INDICE[faixa];
    const cIni = faixa === 0 ? 0 : limites[faixa - 1];
    const cFin = limites[faixa];
    indice = iIni + ((iFin - iIni) / (cFin - cIni)) * (c - cIni);
  }
  return { poluente, concentracao: c, indice: Math.round(indice), classe: CLASSES[faixa] };
}

/** Classe correspondente a um valor de índice já calculado. */
export function classeDoIndice(indice: number): ClasseIqar {
  if (indice <= 40) return 'BOA';
  if (indice <= 80) return 'MODERADA';
  if (indice <= 120) return 'RUIM';
  if (indice <= 200) return 'MUITO_RUIM';
  return 'PESSIMA';
}

/** IQAr da estação = maior índice entre os poluentes informados (null se não houver dados). */
export function calcularIqar(concentracoes: Partial<Record<Poluente, number | null | undefined>>): ResultadoIqar | null {
  const porPoluente = (Object.entries(concentracoes) as Array<[Poluente, number | null | undefined]>)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .map(([p, v]) => indicePoluente(p, v as number));
  if (!porPoluente.length) return null;
  const pior = porPoluente.reduce((a, b) => (b.indice > a.indice ? b : a));
  return { indice: pior.indice, classe: pior.classe, poluenteDominante: pior.poluente, porPoluente };
}

/** A classe é "Ruim" ou pior? (regra de alerta de poluição) */
export function classeExigeAlerta(classe: ClasseIqar): boolean {
  return classe === 'RUIM' || classe === 'MUITO_RUIM' || classe === 'PESSIMA';
}

/** Converte CO de µg/m³ (Open-Meteo) para ppm (25 °C, 1 atm; massa molar 28,01 g/mol). */
export function coMicrogramasParaPpm(microgramas: number): number {
  return microgramas / 1145;
}
