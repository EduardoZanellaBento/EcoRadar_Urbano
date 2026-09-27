/** Tipos das respostas da API (espelham os contratos dos microsserviços). */

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

export const SEVERIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export const STATUS = ['ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'DESCARTADA'] as const;
export type StatusOcorrencia = (typeof STATUS)[number];

export type Perfil = 'CIDADAO' | 'AGENTE' | 'ADMIN';
export type ClasseIqar = 'BOA' | 'MODERADA' | 'RUIM' | 'MUITO_RUIM' | 'PESSIMA';
export type TipoAlerta = 'POLUICAO' | 'RISCO_ALAGAMENTO' | 'INVERSAO_TERMICA' | 'CONCENTRACAO_OCORRENCIAS' | 'PRIORITARIO_MANANCIAL';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  bairro: string | null;
  criadoEm: string;
}

export interface Sessao {
  token: string;
  expiraEm: string;
  usuario: Usuario;
}

export interface Ocorrencia {
  id: string;
  categoria: Categoria;
  severidade: Severidade;
  status: StatusOcorrencia;
  descricao: string;
  latitude: number;
  longitude: number;
  bairro: string | null;
  emAreaDeManancial: boolean;
  manancialNome: string | null;
  confirmacoes: number;
  fotoUrl: string | null;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: string;
  atualizadoEm: string;
  resolvidoEm: string | null;
  versao: number;
  distanciaKm?: number | null;
}

export interface ItemHistorico {
  id: string;
  statusAnterior: StatusOcorrencia | null;
  statusNovo: StatusOcorrencia;
  comentario: string;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: string;
}

export interface DetalheOcorrencia extends Ocorrencia {
  historico: ItemHistorico[];
  confirmadoPorMim: boolean;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface FeatureManancial {
  type: 'Feature';
  properties: { id: string; nome: string; descricao: string; aproximado: boolean };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}
export interface ColecaoMananciais {
  type: 'FeatureCollection';
  observacao: string;
  features: FeatureManancial[];
}

export interface Estacao {
  id: string;
  nome: string;
  bairro: string;
  latitude: number;
  longitude: number;
  tipos: ('QUALIDADE_AR' | 'PLUVIOMETRICA' | 'PERFIL_TERMICO')[];
  online: boolean;
  ultimaLeituraEm: string | null;
  cenario: string | null;
  leitura: {
    pm25: number | null;
    pm10: number | null;
    o3: number | null;
    no2: number | null;
    co: number | null;
    temperatura: number | null;
    umidade: number | null;
    nivelCorregoCm: number | null;
    tempSuperficie: number | null;
    temp300m: number | null;
  } | null;
  iqar: { indice: number; classe: ClasseIqar; rotulo: string; poluenteDominante: string | null } | null;
  inversao: { ativa: boolean; diferenca: number; intensidade: 'FRACA' | 'MODERADA' | 'FORTE' | null };
  corrego: { nome: string; nivelCm: number | null; cotaAlertaCm: number | null; situacao: 'NORMAL' | 'ATENCAO' | 'ALERTA' | 'EXTRAVASAMENTO' | null } | null;
}

export interface DadosOpenMeteo {
  fonte: 'ao_vivo' | 'cache' | 'indisponivel';
  atualizadoEm: string | null;
  idadeSegundos: number | null;
  motivo: string | null;
  estadoCircuito: 'FECHADO' | 'ABERTO' | 'MEIO_ABERTO';
  dados: {
    ar: { pm10: number | null; pm25: number | null; coPpm: number | null; no2: number | null; so2: number | null; o3: number | null; iqar: { indice: number; classe: ClasseIqar; poluenteDominante: string } | null };
    clima: {
      temperatura: number | null;
      sensacaoTermica: number | null;
      umidade: number | null;
      precipitacaoMm: number | null;
      descricao: string;
      ventoKmh: number | null;
      maximaDia: number | null;
      minimaDia: number | null;
      probabilidadeChuva: number | null;
    };
    obtidoEm: string;
  } | null;
}

export interface ResumoAmbiental {
  cidade: { nome: string; latitude: number; longitude: number };
  geradoEm: string;
  indicadores: {
    iqarMedio: number | null;
    iqarMedioClasse: ClasseIqar | null;
    iqarMedioRotulo: string | null;
    piorEstacao: { id: string; nome: string; iqar: Estacao['iqar'] } | null;
    temperaturaMedia: number | null;
    estacoesOnline: number;
    estacoesTotal: number;
    inversaoTermicaAtiva: boolean;
    corregosEmAlerta: number;
  };
  estacoes: Estacao[];
  openMeteo: DadosOpenMeteo;
}

export interface PontoSerie {
  instante: string;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  co: number | null;
  temperatura: number | null;
  umidade: number | null;
  nivelCorregoCm: number | null;
  tempSuperficie: number | null;
  temp300m: number | null;
  iqar: number | null;
  inversao: boolean;
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  latitude: number | null;
  longitude: number | null;
  raioKm: number | null;
  status: 'ATIVO' | 'ENCERRADO';
  categoria: Categoria | null;
  origem: string;
  referenciaId: string;
  criadoEm: string;
  encerradoEm: string | null;
  encerradoPor: string | null;
  comentarioEncerramento: string | null;
}

export interface Contagem<T extends string = string> {
  chave: T;
  rotulo: string;
  total: number;
}

export interface Estatisticas {
  geradoEm: string;
  filtros: string;
  total: number;
  porCategoria: Contagem<Categoria>[];
  porStatus: Contagem<StatusOcorrencia>[];
  porSeveridade: Contagem<Severidade>[];
  serieDiaria: { dia: string; total: number; resolvidas: number }[];
  tempoMedioResolucaoHoras: number | null;
  areasCriticas: { bairro: string; total: number; emAberto: number; pontuacao: number; categoriaPredominante: string }[];
  confirmacao: { ocorrenciasConfirmadas: number; percentual: number; mediaConfirmacoes: number };
  emAreaDeManancial: number;
  alertas: { total: number; ativos: number; porTipo: { chave: TipoAlerta; rotulo: string; total: number; ativos: number }[] };
}

export interface ErroApiCorpo {
  erro: { codigo: string; mensagem: string; detalhes?: { campo: string; mensagem: string }[] | unknown; requestId?: string };
}
