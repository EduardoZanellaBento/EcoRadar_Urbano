import type {
  Alerta,
  Categoria,
  ColecaoMananciais,
  DetalheOcorrencia,
  Estacao,
  Estatisticas,
  Ocorrencia,
  Pagina,
  PontoSerie,
  ResumoAmbiental,
  Sessao,
  Severidade,
  StatusOcorrencia,
  Usuario,
} from '@/tipos';
import { api } from './cliente';

// ----- Autenticação ---------------------------------------------------------------
export const autenticacao = {
  login: async (email: string, senha: string) => (await api.post<Sessao>('/api/auth/login', { email, senha })).data,
  registrar: async (d: { nome: string; email: string; senha: string; bairro?: string }) =>
    (await api.post<Sessao>('/api/auth/registrar', d)).data,
  eu: async () => (await api.get<Usuario>('/api/auth/me')).data,
  atualizarEu: async (d: { nome?: string; bairro?: string | null }) => (await api.patch<Usuario>('/api/auth/me', d)).data,
};

// ----- Ocorrências --------------------------------------------------------------------
export interface FiltrosOcorrencias {
  categoria?: Categoria[];
  status?: StatusOcorrencia[];
  severidade?: Severidade[];
  busca?: string;
  lat?: number;
  lon?: number;
  raioKm?: number;
  ordenacao?: 'recentes' | 'antigas' | 'severidade' | 'confirmacoes' | 'distancia';
  minhas?: boolean;
  pagina?: number;
  tamanhoPagina?: number;
}

function paramsDe(f: FiltrosOcorrencias) {
  return {
    categoria: f.categoria?.length ? f.categoria.join(',') : undefined,
    status: f.status?.length ? f.status.join(',') : undefined,
    severidade: f.severidade?.length ? f.severidade.join(',') : undefined,
    busca: f.busca?.trim() || undefined,
    lat: f.lat,
    lon: f.lon,
    raioKm: f.raioKm,
    ordenacao: f.ordenacao,
    minhas: f.minhas ? 'true' : undefined,
    pagina: f.pagina,
    tamanhoPagina: f.tamanhoPagina,
  };
}

export const ocorrencias = {
  listar: async (f: FiltrosOcorrencias) => (await api.get<Pagina<Ocorrencia>>('/api/ocorrencias', { params: paramsDe(f) })).data,
  detalhe: async (id: string) => (await api.get<DetalheOcorrencia>(`/api/ocorrencias/${id}`)).data,
  confirmar: async (id: string) => (await api.post<Ocorrencia>(`/api/ocorrencias/${id}/confirmar`)).data,
  alterarStatus: async (id: string, status: StatusOcorrencia, comentario: string) =>
    (await api.patch<Ocorrencia>(`/api/ocorrencias/${id}/status`, { status, comentario })).data,
  mananciais: async () => (await api.get<ColecaoMananciais>('/api/ocorrencias/mananciais')).data,
  verificarManancial: async (lat: number, lon: number) =>
    (await api.get<{ emAreaDeManancial: boolean; manancial: { id: string; nome: string } | null }>('/api/ocorrencias/verificar-manancial', { params: { lat, lon } })).data,
  outbox: async () => (await api.get<{ pendentes: number; publicados: number }>('/api/ocorrencias/sistema/outbox')).data,
};

// ----- Ambiental ------------------------------------------------------------------------
export const ambiental = {
  estacoes: async () => (await api.get<Estacao[]>('/api/ambiental/estacoes')).data,
  resumo: async (atualizar = false) => (await api.get<ResumoAmbiental>('/api/ambiental/resumo', { params: atualizar ? { atualizar: 'true' } : {} })).data,
  leituras: async (id: string, periodo = '24h') =>
    (await api.get<{ estacaoId: string; periodo: string; intervaloMinutos: number; pontos: PontoSerie[] }>(`/api/ambiental/estacoes/${id}/leituras`, { params: { periodo } })).data,
  statusIntegracoes: async () => (await api.get<StatusIntegracoes>('/api/ambiental/status-integracoes')).data,
  simularFalha: async (ativo: boolean) => (await api.post('/api/ambiental/integracoes/simular-falha', { ativo })).data,
};

export interface StatusIntegracoes {
  openMeteo: {
    estadoCircuito: 'FECHADO' | 'ABERTO' | 'MEIO_ABERTO';
    simulandoFalha: boolean;
    ultimoSucessoEm: string | null;
    ultimoErro: { mensagem: string; em: string } | null;
    cacheIdadeSegundos: number | null;
    estatisticas: { chamadas: number; sucessos: number; falhas: number; timeouts: number; rejeitadasCircuitoAberto: number };
  };
  mqtt: { conectado: boolean; mensagensRecebidas: number; ultimaMensagemEm: string | null };
  amqp: { conectado: boolean };
}

// ----- Alertas ------------------------------------------------------------------------------
export const alertas = {
  listar: async (status: 'ATIVO' | 'ENCERRADO' | 'TODOS', pagina = 1) =>
    (await api.get<Pagina<Alerta>>('/api/alertas', { params: { status, pagina, tamanhoPagina: 50 } })).data,
  encerrar: async (id: string, comentario?: string) => (await api.patch<Alerta>(`/api/alertas/${id}/encerrar`, { comentario })).data,
  conexoes: async () => (await api.get<{ instancia: string; clientesConectados: number }>('/api/alertas/sistema/conexoes')).data,
};

// ----- Relatórios ----------------------------------------------------------------------------
export const relatorios = {
  estatisticas: async () => (await api.get<Estatisticas>('/api/relatorios/estatisticas')).data,
};

// ----- Simulador (ADMIN) ----------------------------------------------------------------------
export type TipoCenario = 'ALAGAMENTO' | 'POLUICAO_CRITICA' | 'INVERSAO_TERMICA' | 'NORMAL';
export const simulador = {
  cenario: async (tipo: TipoCenario, estacaoId?: string, duracaoSegundos = 120) =>
    (await api.post<{ mensagem: string }>('/api/simulador/cenario', { tipo, estacaoId, duracaoSegundos })).data,
  estado: async () => (await api.get<{ cenarioAtivo: { tipo: string; fim: string } | null; conectadoMqtt: boolean }>('/api/simulador/estado')).data,
};

// ----- Saúde dos serviços (tela de status) ---------------------------------------------------
export interface ResultadoSaude {
  ok: boolean;
  status: number | null;
  latenciaMs: number;
  instancia: string | null;
  requestId: string | null;
  verificacoes?: Record<string, 'ok' | 'falha'>;
  erro?: string;
}

export async function verificarSaude(caminho: string): Promise<ResultadoSaude> {
  const inicio = Date.now();
  try {
    const r = await api.get(caminho, { timeout: 5000, semRepeticao: true, validateStatus: () => true } as never);
    const corpo = r.data as { verificacoes?: Record<string, 'ok' | 'falha'> };
    return {
      ok: r.status === 200,
      status: r.status,
      latenciaMs: Date.now() - inicio,
      instancia: (r.headers['x-instance-id'] as string) ?? null,
      requestId: (r.headers['x-request-id'] as string) ?? null,
      verificacoes: corpo?.verificacoes,
    };
  } catch (e) {
    return { ok: false, status: null, latenciaMs: Date.now() - inicio, instancia: null, requestId: null, erro: (e as Error).message };
  }
}
