/**
 * Erro de aplicação padronizado. Toda resposta de erro da API segue o formato:
 *   { "erro": { "codigo": "...", "mensagem": "...", "detalhes": ..., "requestId": "..." } }
 */
export class ErroAplicacao extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}

export const Erros = {
  requisicaoInvalida: (mensagem: string, detalhes?: unknown) =>
    new ErroAplicacao(400, 'REQUISICAO_INVALIDA', mensagem, detalhes),
  naoAutenticado: (mensagem = 'É necessário estar autenticado para acessar este recurso.') =>
    new ErroAplicacao(401, 'NAO_AUTENTICADO', mensagem),
  credenciaisInvalidas: () => new ErroAplicacao(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.'),
  proibido: (mensagem = 'Seu perfil de acesso não permite realizar esta operação.') =>
    new ErroAplicacao(403, 'ACESSO_NEGADO', mensagem),
  naoEncontrado: (recurso: string) => new ErroAplicacao(404, 'NAO_ENCONTRADO', `${recurso} não encontrado(a).`),
  conflito: (codigo: string, mensagem: string, detalhes?: unknown) => new ErroAplicacao(409, codigo, mensagem, detalhes),
  arquivoGrande: (limiteMb: number) =>
    new ErroAplicacao(413, 'ARQUIVO_MUITO_GRANDE', `A foto excede o tamanho máximo de ${limiteMb} MB.`),
  tipoNaoSuportado: (mensagem: string) => new ErroAplicacao(415, 'TIPO_NAO_SUPORTADO', mensagem),
  validacao: (mensagem: string, detalhes?: unknown) => new ErroAplicacao(422, 'VALIDACAO', mensagem, detalhes),
  indisponivel: (mensagem = 'Serviço temporariamente indisponível. Tente novamente em instantes.') =>
    new ErroAplicacao(503, 'SERVICO_INDISPONIVEL', mensagem),
};

/** Códigos de erro do driver pg / rede que indicam banco indisponível. */
const CODIGOS_BANCO_INDISPONIVEL = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001',
  '08003',
]);

export function ehErroDeBancoIndisponivel(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { code?: string; message?: string; cause?: unknown };
  if (e.code && CODIGOS_BANCO_INDISPONIVEL.has(e.code)) return true;
  if (typeof e.message === 'string' && /Connection terminated|timeout exceeded when trying to connect/i.test(e.message)) {
    return true;
  }
  return e.cause ? ehErroDeBancoIndisponivel(e.cause) : false;
}

/** Código de violação de unicidade do PostgreSQL. */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  let atual: unknown = erro;
  for (let i = 0; i < 3 && atual && typeof atual === 'object'; i++) {
    if ((atual as { code?: string }).code === '23505') return true;
    atual = (atual as { cause?: unknown }).cause;
  }
  return false;
}
