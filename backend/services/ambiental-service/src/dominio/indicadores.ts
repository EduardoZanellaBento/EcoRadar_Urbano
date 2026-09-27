/**
 * Regras ambientais complementares ao IQAr: inversão térmica, nível de córregos e
 * controle de frequência de eventos publicados no broker.
 */

// ----- Inversão térmica -------------------------------------------------------------

export type IntensidadeInversao = 'FRACA' | 'MODERADA' | 'FORTE';

export interface ResultadoInversao {
  inversao: boolean;
  /** temp_300m − temp_superficie (°C). Positivo = ar mais quente acima: inversão. */
  diferenca: number;
  intensidade: IntensidadeInversao | null;
}

/**
 * Normalmente a temperatura DIMINUI com a altitude. Há inversão térmica quando a camada
 * a 300 m está mais quente que a superfície: o ar frio (e poluído) fica "preso" embaixo,
 * dificultando a dispersão dos poluentes — fenômeno comum nas manhãs de inverno em SP.
 */
export function detectarInversao(tempSuperficie: number | null | undefined, temp300m: number | null | undefined): ResultadoInversao {
  if (typeof tempSuperficie !== 'number' || typeof temp300m !== 'number') {
    return { inversao: false, diferenca: 0, intensidade: null };
  }
  const diferenca = Math.round((temp300m - tempSuperficie) * 10) / 10;
  if (!(temp300m > tempSuperficie)) return { inversao: false, diferenca, intensidade: null };
  const intensidade: IntensidadeInversao = diferenca >= 3 ? 'FORTE' : diferenca >= 1 ? 'MODERADA' : 'FRACA';
  return { inversao: true, diferenca, intensidade };
}

// ----- Nível do córrego -------------------------------------------------------------

export type SituacaoCorrego = 'NORMAL' | 'ATENCAO' | 'ALERTA' | 'EXTRAVASAMENTO';

/**
 * Classifica o nível em relação à cota de alerta:
 *   < 80% da cota: NORMAL · 80–100%: ATENÇÃO · > cota: ALERTA · > 130% da cota: EXTRAVASAMENTO
 */
export function avaliarNivelCorrego(nivelCm: number | null | undefined, cotaAlertaCm: number | null | undefined): SituacaoCorrego | null {
  if (typeof nivelCm !== 'number' || typeof cotaAlertaCm !== 'number' || cotaAlertaCm <= 0) return null;
  if (nivelCm > cotaAlertaCm * 1.3) return 'EXTRAVASAMENTO';
  if (nivelCm > cotaAlertaCm) return 'ALERTA';
  if (nivelCm >= cotaAlertaCm * 0.8) return 'ATENCAO';
  return 'NORMAL';
}

// ----- Controle de frequência de eventos ---------------------------------------------

/**
 * Evita inundar o broker: enquanto uma condição persiste (ex.: IQAr ruim), o evento da
 * mesma estação/tipo é publicado no máximo uma vez por janela. A deduplicação "de negócio"
 * (30 min por área) fica no alertas-service.
 */
export class LimitadorEventos {
  private readonly ultimos = new Map<string, number>();

  constructor(
    private readonly janelaMs = 60_000,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Retorna true se o evento pode ser publicado agora (e registra o envio). */
  permitir(chave: string): boolean {
    const t = this.agora();
    const ultimo = this.ultimos.get(chave);
    if (ultimo !== undefined && t - ultimo < this.janelaMs) return false;
    this.ultimos.set(chave, t);
    return true;
  }

  /** Esquece a chave (ex.: quando a condição volta ao normal). */
  liberar(chave: string): void {
    this.ultimos.delete(chave);
  }
}

// ----- Média móvel -------------------------------------------------------------------

/** Janela deslizante de leituras por estação (suaviza ruído antes do cálculo do IQAr). */
export class JanelaMovel {
  private readonly valores = new Map<string, number[]>();

  constructor(private readonly tamanho = 12) {}

  adicionar(chave: string, valor: number | null | undefined): number | null {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return this.media(chave);
    const lista = this.valores.get(chave) ?? [];
    lista.push(valor);
    while (lista.length > this.tamanho) lista.shift();
    this.valores.set(chave, lista);
    return this.media(chave);
  }

  media(chave: string): number | null {
    const lista = this.valores.get(chave);
    if (!lista?.length) return null;
    return Math.round((lista.reduce((a, b) => a + b, 0) / lista.length) * 100) / 100;
  }
}

// ----- Clima (códigos WMO da Open-Meteo) ------------------------------------------------

export function descricaoTempo(codigo: number | null | undefined): string {
  if (codigo === null || codigo === undefined) return 'Indisponível';
  if (codigo === 0) return 'Céu limpo';
  if (codigo === 1) return 'Predominantemente limpo';
  if (codigo === 2) return 'Parcialmente nublado';
  if (codigo === 3) return 'Nublado';
  if (codigo === 45 || codigo === 48) return 'Nevoeiro';
  if (codigo >= 51 && codigo <= 57) return 'Garoa';
  if (codigo >= 61 && codigo <= 67) return 'Chuva';
  if (codigo >= 71 && codigo <= 77) return 'Neve';
  if (codigo >= 80 && codigo <= 82) return 'Pancadas de chuva';
  if (codigo >= 95) return 'Trovoadas';
  return 'Condição desconhecida';
}
