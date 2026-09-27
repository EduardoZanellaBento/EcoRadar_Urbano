import {
  TIPOS_EVENTO,
  type DadosInversaoTermica,
  type DadosLimiteExcedido,
  type DefinicaoEstacao,
  type TipoEvento,
} from '@ecoradar/shared';
import { calcularIqar, classeExigeAlerta, type ResultadoIqar } from './iqar.js';
import { avaliarNivelCorrego, detectarInversao, type ResultadoInversao, type SituacaoCorrego } from './indicadores.js';

export interface MediasPoluentes {
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  co: number | null;
}

export interface EventoAmbiental {
  /** Chave usada pelo limitador de frequência (estação + indicador). */
  chave: string;
  tipo: TipoEvento;
  dados: DadosLimiteExcedido | DadosInversaoTermica;
}

export interface ResultadoAvaliacao {
  iqar: ResultadoIqar | null;
  inversao: ResultadoInversao;
  situacaoCorrego: SituacaoCorrego | null;
  eventos: EventoAmbiental[];
  /** Chaves cujas condições voltaram ao normal (liberam o limitador). */
  normalizadas: string[];
}

/**
 * Avalia uma leitura (já suavizada pela média móvel) e decide quais eventos de domínio
 * devem ser emitidos: IQAr ≥ Ruim, nível do córrego acima da cota e inversão térmica.
 */
export function avaliarLeitura(
  estacao: Pick<DefinicaoEstacao, 'id' | 'nome' | 'bairro' | 'latitude' | 'longitude' | 'cotaAlertaCm'>,
  medias: MediasPoluentes,
  leitura: { nivelCorregoCm?: number | null; tempSuperficie?: number | null; temp300m?: number | null; medidoEm: string },
): ResultadoAvaliacao {
  const base = {
    estacaoId: estacao.id,
    estacaoNome: estacao.nome,
    bairro: estacao.bairro,
    latitude: estacao.latitude,
    longitude: estacao.longitude,
    medidoEm: leitura.medidoEm,
  };
  const eventos: EventoAmbiental[] = [];
  const normalizadas: string[] = [];

  const iqar = calcularIqar({ MP25: medias.pm25, MP10: medias.pm10, O3: medias.o3, NO2: medias.no2, CO: medias.co });
  const chaveIqar = `${estacao.id}:IQAR`;
  if (iqar && classeExigeAlerta(iqar.classe)) {
    eventos.push({
      chave: chaveIqar,
      tipo: TIPOS_EVENTO.AMBIENTAL_LIMITE_EXCEDIDO,
      dados: { ...base, indicador: 'IQAR', valor: iqar.indice, limite: 80, classe: iqar.classe, poluente: iqar.poluenteDominante },
    });
  } else {
    normalizadas.push(chaveIqar);
  }

  const situacaoCorrego = avaliarNivelCorrego(leitura.nivelCorregoCm, estacao.cotaAlertaCm);
  const chaveNivel = `${estacao.id}:NIVEL`;
  if ((situacaoCorrego === 'ALERTA' || situacaoCorrego === 'EXTRAVASAMENTO') && typeof leitura.nivelCorregoCm === 'number') {
    eventos.push({
      chave: chaveNivel,
      tipo: TIPOS_EVENTO.AMBIENTAL_LIMITE_EXCEDIDO,
      dados: { ...base, indicador: 'NIVEL_CORREGO', valor: leitura.nivelCorregoCm, limite: estacao.cotaAlertaCm ?? 0 },
    });
  } else if (situacaoCorrego !== null) {
    normalizadas.push(chaveNivel);
  }

  const inversao = detectarInversao(leitura.tempSuperficie, leitura.temp300m);
  const chaveInversao = `${estacao.id}:INVERSAO`;
  if (inversao.inversao) {
    eventos.push({
      chave: chaveInversao,
      tipo: TIPOS_EVENTO.AMBIENTAL_INVERSAO_TERMICA,
      dados: {
        ...base,
        tempSuperficie: leitura.tempSuperficie as number,
        temp300m: leitura.temp300m as number,
        diferenca: inversao.diferenca,
      },
    });
  } else if (typeof leitura.tempSuperficie === 'number') {
    normalizadas.push(chaveInversao);
  }

  return { iqar, inversao, situacaoCorrego, eventos, normalizadas };
}
