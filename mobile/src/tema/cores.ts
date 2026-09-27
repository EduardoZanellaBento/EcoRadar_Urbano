import type { Categoria, ClasseIqar, Severidade, StatusOcorrencia, TipoAlerta } from '@/tipos';

/** Identidade visual do EcoRadar. */
export const MARCA = {
  verde: '#0f766e',
  verdeClaro: '#14b8a6',
  azul: '#1d4ed8',
  folha: '#16a34a',
};

type NomeIcone = string;

/** Categoria: ícone (identidade) + rótulo. A cor do marcador no mapa vem da severidade. */
export const CATEGORIA: Record<Categoria, { rotulo: string; icone: NomeIcone }> = {
  ALAGAMENTO: { rotulo: 'Alagamento', icone: 'home-flood' },
  POLUICAO_AR: { rotulo: 'Poluição do ar', icone: 'smog' },
  TRANSITO: { rotulo: 'Trânsito', icone: 'car-multiple' },
  TRANSPORTE_PUBLICO: { rotulo: 'Transporte público', icone: 'bus' },
  INVASAO_MANANCIAL: { rotulo: 'Invasão de manancial', icone: 'water-alert' },
  DESMATAMENTO: { rotulo: 'Desmatamento', icone: 'forest' },
  INVERSAO_TERMICA: { rotulo: 'Inversão térmica', icone: 'thermometer-lines' },
  QUEIMADA: { rotulo: 'Queimada', icone: 'fire' },
  DESCARTE_IRREGULAR_LIXO: { rotulo: 'Descarte irregular de lixo', icone: 'trash-can' },
  OUTROS: { rotulo: 'Outros', icone: 'alert-circle-outline' },
};

/**
 * Severidade (ordinal): cores de "status" (informativo → crítico), SEMPRE acompanhadas do
 * rótulo em texto — a cor nunca é o único canal de informação.
 */
export const SEVERIDADE: Record<Severidade, { rotulo: string; cor: string; corTexto: string; icone: NomeIcone }> = {
  BAIXA: { rotulo: 'Baixa', cor: '#2a78d6', corTexto: '#ffffff', icone: 'chevron-down-circle' },
  MEDIA: { rotulo: 'Média', cor: '#fab219', corTexto: '#1f1600', icone: 'minus-circle' },
  ALTA: { rotulo: 'Alta', cor: '#ec835a', corTexto: '#1f0d00', icone: 'chevron-up-circle' },
  CRITICA: { rotulo: 'Crítica', cor: '#d03b3b', corTexto: '#ffffff', icone: 'alert-octagon' },
};

export const STATUS: Record<StatusOcorrencia, { rotulo: string; cor: string; icone: NomeIcone }> = {
  ABERTA: { rotulo: 'Aberta', cor: '#2a78d6', icone: 'alert-circle-outline' },
  EM_ANALISE: { rotulo: 'Em análise', cor: '#c98500', icone: 'progress-clock' },
  RESOLVIDA: { rotulo: 'Resolvida', cor: '#0ca30c', icone: 'check-circle' },
  DESCARTADA: { rotulo: 'Descartada', cor: '#898781', icone: 'close-circle-outline' },
};

/** Cores oficiais das faixas do IQAr (CETESB), sempre exibidas com o nome da faixa. */
export const IQAR: Record<ClasseIqar, { rotulo: string; cor: string; corTexto: string; recomendacao: string }> = {
  BOA: { rotulo: 'Boa', cor: '#1b9e3e', corTexto: '#ffffff', recomendacao: 'Aproveite as atividades ao ar livre.' },
  MODERADA: {
    rotulo: 'Moderada',
    cor: '#e5b800',
    corTexto: '#1f1600',
    recomendacao: 'Pessoas sensíveis podem sentir tosse seca e cansaço.',
  },
  RUIM: { rotulo: 'Ruim', cor: '#f07b12', corTexto: '#1f0d00', recomendacao: 'Reduza esforços ao ar livre; grupos sensíveis devem evitar.' },
  MUITO_RUIM: {
    rotulo: 'Muito Ruim',
    cor: '#d32f2f',
    corTexto: '#ffffff',
    recomendacao: 'Evite atividades ao ar livre; risco de falta de ar e ardor nos olhos.',
  },
  PESSIMA: { rotulo: 'Péssima', cor: '#7b1fa2', corTexto: '#ffffff', recomendacao: 'Permaneça em ambientes fechados sempre que possível.' },
};

export const TIPO_ALERTA: Record<TipoAlerta, { rotulo: string; icone: NomeIcone }> = {
  POLUICAO: { rotulo: 'Poluição do ar', icone: 'smog' },
  RISCO_ALAGAMENTO: { rotulo: 'Risco de alagamento', icone: 'home-flood' },
  INVERSAO_TERMICA: { rotulo: 'Inversão térmica', icone: 'thermometer-lines' },
  CONCENTRACAO_OCORRENCIAS: { rotulo: 'Concentração de ocorrências', icone: 'map-marker-multiple' },
  PRIORITARIO_MANANCIAL: { rotulo: 'Prioritário — manancial', icone: 'water-alert' },
};

/**
 * Paleta categórica dos gráficos (validada para daltonismo com o script da skill de
 * visualização: CVD ΔE ≥ 8,4 e contraste adequado no modo escuro). Ordem fixa.
 */
export const SERIES = {
  claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  escuro: ['#3987e5', '#d95926', '#199e70', '#c98500'],
};
