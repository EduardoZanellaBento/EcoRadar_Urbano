import {
  ROTULOS_CATEGORIA,
  ROTULOS_CLASSE_IQAR,
  TIPOS_EVENTO,
  dadosInversaoTermicaSchema,
  dadosLimiteExcedidoSchema,
  dadosOcorrenciaEventoSchema,
  distanciaKm,
  type Categoria,
  type ClasseIqar,
  type EnvelopeEvento,
  type Severidade,
  type TipoAlerta,
} from '@ecoradar/shared';

/** Parâmetros das regras (centralizados para facilitar ajustes e testes). */
export const PARAMETROS = {
  /** Regra 4: mínimo de ocorrências da mesma categoria... */
  concentracaoMinima: 3,
  /** ...num raio de 1 km... */
  concentracaoRaioKm: 1,
  /** ...dentro de 60 minutos. */
  concentracaoJanelaMin: 60,
  /** Regra 6: não repetir o mesmo alerta para a mesma área dentro de 30 minutos. */
  deduplicacaoJanelaMin: 30,
  deduplicacaoRaioKm: 1,
  /** Ocorrências mais antigas que isso não geram alerta de manancial (ex.: dados históricos). */
  manancialRecenciaHoras: 24,
};

export interface AlertaCandidato {
  tipo: TipoAlerta;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  latitude: number | null;
  longitude: number | null;
  raioKm: number | null;
  /** Identifica a "área" do alerta: estacao:<id> para alertas ambientais; para ocorrências, a proximidade (≤ 1 km). */
  chaveArea: string;
  categoria: Categoria | null;
  origem: 'ambiental' | 'ocorrencias';
  referenciaId: string;
  dados: Record<string, unknown>;
}

export interface OcorrenciaRecente {
  id: string;
  categoria: Categoria;
  latitude: number;
  longitude: number;
  criadoEm: Date;
}

export interface ContextoRegras {
  agora: Date;
  /** Ocorrências recentes conhecidas (inclui a do evento atual). */
  ocorrenciasRecentes: OcorrenciaRecente[];
}

export interface AlertaExistente {
  tipo: TipoAlerta;
  chaveArea: string;
  categoria: Categoria | null;
  latitude: number | null;
  longitude: number | null;
  criadoEm: Date;
}

const SEVERIDADE_POR_CLASSE: Partial<Record<ClasseIqar, Severidade>> = {
  RUIM: 'MEDIA',
  MUITO_RUIM: 'ALTA',
  PESSIMA: 'CRITICA',
};

const minutos = (ms: number) => ms / 60_000;

/**
 * Motor de regras: recebe um evento de domínio e devolve os alertas que ele dispara.
 *  1. IQAr ≥ "Ruim" em qualquer estação ........................ POLUICAO
 *  2. Nível do córrego acima da cota de alerta .................. RISCO_ALAGAMENTO
 *  3. Inversão térmica detectada ................................. INVERSAO_TERMICA
 *  4. ≥ 3 ocorrências da mesma categoria em 1 km e 60 min ........ CONCENTRACAO_OCORRENCIAS
 *  5. INVASAO_MANANCIAL/DESMATAMENTO dentro de área de manancial . PRIORITARIO_MANANCIAL
 * (A regra 6 — deduplicação — é aplicada em seguida por `ehDuplicado`.)
 */
export function avaliarEvento(evento: EnvelopeEvento, ctx: ContextoRegras): AlertaCandidato[] {
  switch (evento.tipo) {
    case TIPOS_EVENTO.AMBIENTAL_LIMITE_EXCEDIDO: {
      const d = dadosLimiteExcedidoSchema.parse(evento.dados);
      const base = { latitude: d.latitude, longitude: d.longitude, chaveArea: `estacao:${d.estacaoId}`, categoria: null, origem: 'ambiental' as const, referenciaId: d.estacaoId, dados: d };
      if (d.indicador === 'IQAR' && d.classe && SEVERIDADE_POR_CLASSE[d.classe]) {
        const rotulo = ROTULOS_CLASSE_IQAR[d.classe];
        return [
          {
            ...base,
            tipo: 'POLUICAO',
            severidade: SEVERIDADE_POR_CLASSE[d.classe]!,
            titulo: `Qualidade do ar ${rotulo.toLowerCase()} — ${d.estacaoNome}`,
            mensagem:
              `IQAr ${Math.round(d.valor)} (${rotulo}) na ${d.estacaoNome}, bairro ${d.bairro}` +
              (d.poluente ? `, poluente dominante ${d.poluente}` : '') +
              '. Evite atividades físicas ao ar livre; crianças, idosos e pessoas com doenças respiratórias devem permanecer em ambientes fechados.',
            raioKm: 3,
          },
        ];
      }
      if (d.indicador === 'NIVEL_CORREGO') {
        const critico = d.valor > d.limite * 1.3;
        return [
          {
            ...base,
            tipo: 'RISCO_ALAGAMENTO',
            severidade: critico ? 'CRITICA' : 'ALTA',
            titulo: `${critico ? 'Transbordamento' : 'Risco de alagamento'} — ${d.bairro}`,
            mensagem: `Nível do córrego em ${Math.round(d.valor)} cm, acima da cota de alerta (${Math.round(d.limite)} cm), na região de ${d.bairro}. Evite a área e não atravesse vias alagadas.`,
            raioKm: 2,
          },
        ];
      }
      return [];
    }

    case TIPOS_EVENTO.AMBIENTAL_INVERSAO_TERMICA: {
      const d = dadosInversaoTermicaSchema.parse(evento.dados);
      return [
        {
          tipo: 'INVERSAO_TERMICA',
          severidade: d.diferenca >= 3 ? 'ALTA' : 'MEDIA',
          titulo: `Inversão térmica — ${d.bairro}`,
          mensagem: `Inversão térmica detectada sobre ${d.bairro}: o ar a 300 m está ${d.diferenca.toFixed(1)} °C mais quente que na superfície, o que dificulta a dispersão dos poluentes. Evite queimadas e, se possível, o uso do carro.`,
          latitude: d.latitude,
          longitude: d.longitude,
          raioKm: 5,
          chaveArea: `estacao:${d.estacaoId}`,
          categoria: null,
          origem: 'ambiental',
          referenciaId: d.estacaoId,
          dados: d,
        },
      ];
    }

    case TIPOS_EVENTO.OCORRENCIA_CRIADA: {
      const { ocorrencia: o } = dadosOcorrenciaEventoSchema.parse(evento.dados);
      const criadoEm = new Date(o.criadoEm);
      const idadeMin = minutos(ctx.agora.getTime() - criadoEm.getTime());
      const alertas: AlertaCandidato[] = [];

      // Regra 5 — prioridade para mananciais
      if ((o.categoria === 'INVASAO_MANANCIAL' || o.categoria === 'DESMATAMENTO') && o.emAreaDeManancial && idadeMin <= PARAMETROS.manancialRecenciaHoras * 60) {
        alertas.push({
          tipo: 'PRIORITARIO_MANANCIAL',
          severidade: o.severidade === 'CRITICA' ? 'CRITICA' : 'ALTA',
          titulo: `${ROTULOS_CATEGORIA[o.categoria]} em área de manancial`,
          mensagem: `Ocorrência de ${ROTULOS_CATEGORIA[o.categoria].toLowerCase()} registrada dentro da área de proteção ${o.manancialNome ?? 'de manancial'} (${o.bairro ?? 'local não identificado'}). Prioridade de fiscalização para proteger o abastecimento de água.`,
          latitude: o.latitude,
          longitude: o.longitude,
          raioKm: 1,
          chaveArea: `manancial:${o.manancialNome ?? 'desconhecido'}`,
          categoria: o.categoria,
          origem: 'ocorrencias',
          referenciaId: o.id,
          dados: { ocorrenciaId: o.id, manancial: o.manancialNome, categoria: o.categoria },
        });
      }

      // Regra 4 — concentração de ocorrências (somente para ocorrências recentes)
      if (idadeMin <= PARAMETROS.concentracaoJanelaMin) {
        const proximas = ctx.ocorrenciasRecentes.filter(
          (r) =>
            r.categoria === o.categoria &&
            Math.abs(minutos(criadoEm.getTime() - r.criadoEm.getTime())) <= PARAMETROS.concentracaoJanelaMin &&
            distanciaKm(r, o) <= PARAMETROS.concentracaoRaioKm,
        );
        const ids = new Set(proximas.map((p) => p.id));
        ids.add(o.id);
        if (ids.size >= PARAMETROS.concentracaoMinima) {
          alertas.push({
            tipo: 'CONCENTRACAO_OCORRENCIAS',
            severidade: ids.size >= 5 ? 'ALTA' : 'MEDIA',
            titulo: `Concentração de ocorrências: ${ROTULOS_CATEGORIA[o.categoria]}`,
            mensagem: `${ids.size} ocorrências de ${ROTULOS_CATEGORIA[o.categoria].toLowerCase()} num raio de ${PARAMETROS.concentracaoRaioKm} km na última hora${o.bairro ? `, região de ${o.bairro}` : ''}. Situação em evolução — agentes foram notificados.`,
            latitude: o.latitude,
            longitude: o.longitude,
            raioKm: PARAMETROS.concentracaoRaioKm,
            chaveArea: `concentracao:${o.categoria}`,
            categoria: o.categoria,
            origem: 'ocorrencias',
            referenciaId: o.id,
            dados: { ocorrencias: [...ids], categoria: o.categoria, quantidade: ids.size },
          });
        }
      }
      return alertas;
    }

    default:
      return [];
  }
}

/**
 * Regra 6 — deduplicação: um alerta é considerado repetido se já existe outro do mesmo
 * tipo, na mesma área, criado há menos de 30 minutos. "Mesma área" é a mesma estação
 * (alertas ambientais) ou um ponto a até 1 km com a mesma categoria (alertas de ocorrências).
 */
export function ehDuplicado(candidato: AlertaCandidato, existentes: AlertaExistente[], agora: Date): boolean {
  return existentes.some((a) => {
    if (a.tipo !== candidato.tipo) return false;
    if (minutos(agora.getTime() - a.criadoEm.getTime()) >= PARAMETROS.deduplicacaoJanelaMin) return false;
    if (candidato.chaveArea.startsWith('estacao:')) return a.chaveArea === candidato.chaveArea;
    if ((a.categoria ?? null) !== (candidato.categoria ?? null)) return false;
    if (a.latitude === null || a.longitude === null || candidato.latitude === null || candidato.longitude === null) {
      return a.chaveArea === candidato.chaveArea;
    }
    return (
      distanciaKm({ latitude: a.latitude, longitude: a.longitude }, { latitude: candidato.latitude, longitude: candidato.longitude }) <=
      PARAMETROS.deduplicacaoRaioKm
    );
  });
}
