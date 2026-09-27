/** Enumerações e rótulos do domínio compartilhados entre serviços. */

export const CATEGORIAS = [
  'ALAGAMENTO',
  'POLUICAO_AR',
  'TRANSITO',
  'TRANSPORTE_PUBLICO',
  'INVASAO_MANANCIAL',
  'DESMATAMENTO',
  'INVERSAO_TERMICA',
  'QUEIMADA',
  'DESCARTE_IRREGULAR_LIXO',
  'OUTROS',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULOS_CATEGORIA: Record<Categoria, string> = {
  ALAGAMENTO: 'Alagamento',
  POLUICAO_AR: 'Poluição do ar',
  TRANSITO: 'Trânsito',
  TRANSPORTE_PUBLICO: 'Transporte público',
  INVASAO_MANANCIAL: 'Invasão de manancial',
  DESMATAMENTO: 'Desmatamento',
  INVERSAO_TERMICA: 'Inversão térmica',
  QUEIMADA: 'Queimada',
  DESCARTE_IRREGULAR_LIXO: 'Descarte irregular de lixo',
  OUTROS: 'Outros',
};

export const SEVERIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export const ROTULOS_SEVERIDADE: Record<Severidade, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

/** Peso usado em rankings de criticidade. */
export const PESO_SEVERIDADE: Record<Severidade, number> = { BAIXA: 1, MEDIA: 2, ALTA: 3, CRITICA: 5 };

export const STATUS_OCORRENCIA = ['ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'DESCARTADA'] as const;
export type StatusOcorrencia = (typeof STATUS_OCORRENCIA)[number];

export const ROTULOS_STATUS: Record<StatusOcorrencia, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  RESOLVIDA: 'Resolvida',
  DESCARTADA: 'Descartada',
};

export const PERFIS = ['CIDADAO', 'AGENTE', 'ADMIN'] as const;
export type Perfil = (typeof PERFIS)[number];

export const TIPOS_ALERTA = [
  'POLUICAO',
  'RISCO_ALAGAMENTO',
  'INVERSAO_TERMICA',
  'CONCENTRACAO_OCORRENCIAS',
  'PRIORITARIO_MANANCIAL',
] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

export const ROTULOS_TIPO_ALERTA: Record<TipoAlerta, string> = {
  POLUICAO: 'Poluição do ar',
  RISCO_ALAGAMENTO: 'Risco de alagamento',
  INVERSAO_TERMICA: 'Inversão térmica',
  CONCENTRACAO_OCORRENCIAS: 'Concentração de ocorrências',
  PRIORITARIO_MANANCIAL: 'Prioritário — área de manancial',
};

/** Classes do IQAr (CETESB). */
export const CLASSES_IQAR = ['BOA', 'MODERADA', 'RUIM', 'MUITO_RUIM', 'PESSIMA'] as const;
export type ClasseIqar = (typeof CLASSES_IQAR)[number];

export const ROTULOS_CLASSE_IQAR: Record<ClasseIqar, string> = {
  BOA: 'Boa',
  MODERADA: 'Moderada',
  RUIM: 'Ruim',
  MUITO_RUIM: 'Muito Ruim',
  PESSIMA: 'Péssima',
};
