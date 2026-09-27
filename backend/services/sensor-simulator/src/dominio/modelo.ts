import type { DefinicaoEstacao } from '@ecoradar/shared';

export type TipoCenario = 'ALAGAMENTO' | 'POLUICAO_CRITICA' | 'INVERSAO_TERMICA' | 'NORMAL';

export interface CenarioAtivo {
  tipo: Exclude<TipoCenario, 'NORMAL'>;
  estacaoId: string | null;
  inicio: number;
  fim: number;
}

export interface Leitura {
  estacaoId: string;
  medidoEm: string;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  co: number;
  temperatura: number;
  umidade: number;
  nivel_corrego_cm: number | null;
  temp_superficie: number | null;
  temp_300m: number | null;
  cenario: string | null;
}

/** Estado que evolui entre leituras (nível do córrego com "memória"). */
export interface EstadoEstacao {
  nivelCm: number;
  chuvaRestante: number;
}

const arred = (v: number, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;
const gauss = (x: number, centro: number, largura: number) => Math.exp(-((x - centro) ** 2) / (2 * largura ** 2));

/** Fator de tráfego ao longo do dia: picos às 8h e às 18h30. */
export function fatorTrafego(hora: number): number {
  return 1 + 0.6 * gauss(hora, 8, 1.4) + 0.7 * gauss(hora, 18.5, 1.6) - 0.35 * gauss(hora, 3, 2);
}

/** Temperatura típica do dia (mínima ~5h, máxima ~15h). */
export function temperaturaBase(hora: number): number {
  return 20 + 6 * Math.sin(((hora - 9) / 24) * 2 * Math.PI);
}

export function estadoInicial(estacao: DefinicaoEstacao): EstadoEstacao {
  return { nivelCm: estacao.nivelBaseCm ?? 0, chuvaRestante: 0 };
}

/**
 * Gera uma leitura realista para a estação: ciclo diário (tráfego, fotoquímica do ozônio,
 * temperatura), fator local de poluição, ruído aleatório e, quando há cenário ativo,
 * valores forçados para disparar as regras de alerta (demonstração).
 */
export function gerarLeitura(
  estacao: DefinicaoEstacao,
  instante: Date,
  estado: EstadoEstacao,
  cenario: CenarioAtivo | null,
  aleatorio: () => number = Math.random,
): Leitura {
  const hora = instante.getHours() + instante.getMinutes() / 60;
  const ruido = (amplitude: number) => (aleatorio() * 2 - 1) * amplitude;
  const trafego = fatorTrafego(hora) * estacao.fatorPoluicao;

  let pm25 = Math.max(2, 8.5 * trafego + ruido(1.5));
  let pm10 = Math.max(4, pm25 * 1.8 + ruido(3));
  const o3 = Math.max(5, 35 + 50 * Math.max(0, Math.sin(((hora - 8) / 12) * Math.PI)) + ruido(6));
  let no2 = Math.max(5, 32 * trafego + ruido(5));
  let co = Math.max(0.1, 0.45 * trafego + ruido(0.08));
  const temperatura = temperaturaBase(hora) + ruido(0.4) - (estacao.id === 'est-santo-amaro' ? 0.8 : 0);
  const umidade = Math.min(100, Math.max(25, 72 - 18 * Math.sin(((hora - 9) / 24) * 2 * Math.PI) + ruido(3)));

  // Nível do córrego: passeio aleatório que tende ao nível base, com eventuais pancadas de chuva
  let nivel: number | null = null;
  if (estacao.tipos.includes('PLUVIOMETRICA')) {
    const base = estacao.nivelBaseCm ?? 60;
    if (estado.chuvaRestante <= 0 && aleatorio() < 0.002) estado.chuvaRestante = 60; // ~5 min de chuva
    const chuva = estado.chuvaRestante > 0 ? 1.2 : 0;
    estado.chuvaRestante = Math.max(0, estado.chuvaRestante - 1);
    estado.nivelCm = Math.max(10, estado.nivelCm + (base - estado.nivelCm) * 0.05 + chuva + ruido(1.5));
    // Sem cenário, o nível fica abaixo de 75% da cota de alerta
    if (estacao.cotaAlertaCm) estado.nivelCm = Math.min(estado.nivelCm, estacao.cotaAlertaCm * 0.75);
    nivel = estado.nivelCm;
  }

  // Perfil térmico: normalmente o ar a 300 m é ~2 °C mais frio que na superfície
  let tempSup: number | null = null;
  let temp300: number | null = null;
  if (estacao.tipos.includes('PERFIL_TERMICO')) {
    tempSup = temperatura;
    temp300 = temperatura - 2 + ruido(0.3);
  }

  let nomeCenario: string | null = null;
  const agora = instante.getTime();
  if (cenario && agora >= cenario.inicio && agora <= cenario.fim && (!cenario.estacaoId || cenario.estacaoId === estacao.id)) {
    const progresso = Math.min(1, (agora - cenario.inicio) / Math.max(1, Math.min(30_000, cenario.fim - cenario.inicio)));
    switch (cenario.tipo) {
      case 'ALAGAMENTO':
        if (estacao.tipos.includes('PLUVIOMETRICA') && estacao.cotaAlertaCm) {
          nivel = estacao.cotaAlertaCm * (1.1 + 0.35 * progresso) + ruido(3);
          estado.nivelCm = nivel;
          nomeCenario = 'ALAGAMENTO';
        }
        break;
      case 'POLUICAO_CRITICA':
        pm25 = 150 + 30 * progresso + ruido(8);
        pm10 = 270 + 40 * progresso + ruido(10);
        no2 = 340 + ruido(20);
        co = 12 + ruido(0.5);
        nomeCenario = 'POLUICAO_CRITICA';
        break;
      case 'INVERSAO_TERMICA':
        if (tempSup !== null) {
          temp300 = tempSup + 3 + progresso + ruido(0.2);
          pm25 *= 1.5;
          pm10 *= 1.5;
          nomeCenario = 'INVERSAO_TERMICA';
        }
        break;
    }
  }

  return {
    estacaoId: estacao.id,
    medidoEm: instante.toISOString(),
    pm25: arred(pm25),
    pm10: arred(pm10),
    o3: arred(o3),
    no2: arred(no2),
    co: arred(co, 2),
    temperatura: arred(temperatura),
    umidade: arred(umidade, 0),
    nivel_corrego_cm: nivel === null ? null : arred(nivel, 0),
    temp_superficie: tempSup === null ? null : arred(tempSup),
    temp_300m: temp300 === null ? null : arred(temp300),
    cenario: nomeCenario,
  };
}

/** Valida se o cenário pode ser aplicado à estação escolhida. */
export function validarCenario(tipo: TipoCenario, estacao: DefinicaoEstacao | undefined, estacaoId?: string | null): string | null {
  if (estacaoId && !estacao) return `Estação ${estacaoId} não existe.`;
  if (!estacao) return null;
  if (tipo === 'ALAGAMENTO' && !estacao.tipos.includes('PLUVIOMETRICA')) {
    return `A estação ${estacao.nome} não monitora córrego (não é pluviométrica).`;
  }
  if (tipo === 'INVERSAO_TERMICA' && !estacao.tipos.includes('PERFIL_TERMICO')) {
    return `A estação ${estacao.nome} não possui perfil térmico vertical.`;
  }
  return null;
}
