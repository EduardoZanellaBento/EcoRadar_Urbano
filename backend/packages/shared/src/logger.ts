import { pino, type Logger } from 'pino';
import { INSTANCIA_ID } from './config.js';

export type { Logger };

/**
 * Logger estruturado (JSON) padrão de todos os serviços. Cada linha carrega o nome
 * do serviço e a instância, e as linhas de requisição carregam o requestId — isso
 * permite rastrear uma requisição entre serviços filtrando os logs pelo ID.
 */
export function criarLogger(servico: string): Logger {
  return pino({
    level: process.env.LOG_NIVEL || 'info',
    base: { servico, instancia: INSTANCIA_ID },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'msg',
    formatters: {
      level: (label) => ({ nivel: label }),
    },
    redact: {
      paths: ['req.headers.authorization', 'senha', '*.senha', 'token', '*.token'],
      censor: '[oculto]',
    },
  });
}
