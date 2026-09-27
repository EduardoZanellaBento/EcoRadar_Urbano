import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, MAX_TENTATIVAS, TIMEOUT_MS } from '@/config';
import { useSessao } from '@/estado/sessao';
import type { ErroApiCorpo } from '@/tipos';
import { gerarId } from '@/utils/id';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Não repetir automaticamente em falha de rede (ex.: verificações de saúde). */
    semRepeticao?: boolean;
    /** Permite repetir um POST (seguro quando a requisição é idempotente). */
    repetirMesmoSendoPost?: boolean;
  }
}

/** Erro padronizado exibido ao usuário. */
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    public readonly status: number | null,
    public readonly codigo: string,
    public readonly ehDeRede: boolean,
    public readonly detalhes?: { campo: string; mensagem: string }[],
    public readonly requestId?: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

const MENSAGENS: Record<number, string> = {
  400: 'A requisição enviada é inválida.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O item procurado não foi encontrado.',
  409: 'Esta ação entra em conflito com o estado atual.',
  413: 'A foto é muito grande (máximo de 5 MB).',
  415: 'Formato de arquivo não suportado. Use JPEG, PNG ou WebP.',
  422: 'Alguns dados estão inválidos. Revise o formulário.',
  429: 'Muitas tentativas em pouco tempo. Aguarde um minuto.',
  500: 'Ocorreu um erro inesperado no servidor.',
  502: 'O serviço está temporariamente indisponível.',
  503: 'O serviço está temporariamente indisponível. Tente novamente em instantes.',
  504: 'O servidor demorou para responder. Tente novamente.',
};

type ConfigComTentativa = InternalAxiosRequestConfig & { _tentativa?: number };

// eslint-disable-next-line import/no-named-as-default-member -- axios.create é a API documentada da instância
export const api = axios.create({ baseURL: API_URL, timeout: TIMEOUT_MS });

api.interceptors.request.use((config) => {
  const token = useSessao.getState().token;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  if (!config.headers['X-Request-Id']) config.headers['X-Request-Id'] = gerarId();
  return config;
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function paraErroApi(erro: unknown): ErroApi {
  if (erro instanceof ErroApi) return erro;
  const e = erro as AxiosError<ErroApiCorpo>;
  if (!e?.isAxiosError) return new ErroApi(erro instanceof Error ? erro.message : 'Erro inesperado.', null, 'DESCONHECIDO', false);
  if (!e.response) {
    const timeout = e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT';
    return new ErroApi(
      timeout ? 'O servidor demorou mais de 10 segundos para responder.' : 'Não foi possível conectar ao servidor. Verifique sua conexão.',
      null,
      timeout ? 'TEMPO_ESGOTADO' : 'SEM_CONEXAO',
      true,
    );
  }
  const status = e.response.status;
  const corpo = e.response.data?.erro;
  const detalhes = Array.isArray(corpo?.detalhes) ? (corpo.detalhes as { campo: string; mensagem: string }[]) : undefined;
  // Mensagens do servidor já vêm em português; usamos a genérica quando não houver
  const mensagem = status >= 500 ? MENSAGENS[status] ?? MENSAGENS[500] : corpo?.mensagem || MENSAGENS[status] || `Erro ${status}.`;
  return new ErroApi(mensagem, status, corpo?.codigo ?? `HTTP_${status}`, false, detalhes, corpo?.requestId);
}

api.interceptors.response.use(
  (r) => r,
  async (erro: AxiosError<ErroApiCorpo>) => {
    const config = erro.config as ConfigComTentativa | undefined;
    const status = erro.response?.status;
    const falhaTransitoria = !erro.response || status === 502 || status === 503 || status === 504;
    const metodo = (config?.method ?? 'get').toLowerCase();
    const repetivel = metodo === 'get' || config?.repetirMesmoSendoPost;
    const tentativa = config?._tentativa ?? 0;
    // Retry automático com backoff exponencial (500 ms, 1 s) — no máximo 3 tentativas no total
    if (config && falhaTransitoria && repetivel && !config.semRepeticao && tentativa < MAX_TENTATIVAS - 1) {
      config._tentativa = tentativa + 1;
      await esperar(500 * 2 ** tentativa);
      return api.request(config);
    }
    const url = config?.url ?? '';
    if (status === 401 && useSessao.getState().token && !url.includes('/api/auth/login')) {
      useSessao.getState().sair('Sua sessão expirou. Entre novamente.');
    }
    throw paraErroApi(erro);
  },
);

export function mensagemDeErro(erro: unknown): string {
  const e = paraErroApi(erro);
  if (e.detalhes?.length) return `${e.message} ${e.detalhes.map((d) => d.mensagem).join(' ')}`;
  return e.message;
}
