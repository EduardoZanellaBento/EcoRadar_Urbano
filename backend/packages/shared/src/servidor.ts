import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z, ZodError } from 'zod';
import type { Logger } from 'pino';
import { INSTANCIA_ID } from './config.js';
import { ErroAplicacao, ehErroDeBancoIndisponivel } from './erros.js';

// Mensagens de validação do Zod em português
z.config(z.locales.pt());

export type AppFastify = FastifyInstance<Server, IncomingMessage, ServerResponse, FastifyBaseLogger, ZodTypeProvider>;

export type VerificacaoProntidao = () => Promise<unknown> | unknown;

export interface OpcoesServidor {
  /** Nome do serviço (ex.: "auth-service"). */
  nome: string;
  /** Prefixo público no gateway (ex.: "/api/auth"). */
  prefixo: string;
  titulo: string;
  descricao: string;
  versao?: string;
  logger: Logger;
  /** Verificações do /ready (ex.: banco, broker). Devem lançar erro ou retornar false se indisponível. */
  prontidao?: Record<string, VerificacaoProntidao>;
  bodyLimit?: number;
  tags?: Array<{ name: string; description: string }>;
}

const HORA_INICIO = Date.now();

/** Converte issues do Zod em uma lista simples de { campo, mensagem }. */
function detalhesZod(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return issues.map((i) => ({ campo: i.path.map(String).join('.') || '(raiz)', mensagem: i.message }));
}

/**
 * Cria a instância Fastify padrão de todos os serviços:
 *  - request-id vindo do gateway (X-Request-Id) ou gerado, devolvido na resposta;
 *  - cabeçalho X-Instance-Id com o hostname do container (prova do balanceamento);
 *  - CORS, OpenAPI/Swagger UI em <prefixo>/docs, validação com Zod (erros 422 em português);
 *  - formato único de erro { erro: { codigo, mensagem, detalhes?, requestId } };
 *  - GET /health (liveness) e GET /ready (dependências), também sob o prefixo público.
 */
export async function criarServidor(opcoes: OpcoesServidor): Promise<AppFastify> {
  const app = Fastify({
    loggerInstance: opcoes.logger as unknown as FastifyBaseLogger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => randomUUID(),
    trustProxy: true,
    bodyLimit: opcoes.bodyLimit ?? 1024 * 1024,
    return503OnClosing: true,
    forceCloseConnections: 'idle',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id);
    reply.header('X-Instance-Id', INSTANCIA_ID);
  });

  const origem = process.env.CORS_ORIGEM || '*';
  await app.register(cors, {
    origin: origem === '*' ? true : origem.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'X-Instance-Id', 'X-Idempotent-Replay', 'Content-Disposition'],
    maxAge: 600,
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: opcoes.titulo, description: opcoes.descricao, version: opcoes.versao ?? '1.0.0' },
      servers: [{ url: '/', description: 'Gateway (Nginx) — http://localhost:8080' }],
      tags: [{ name: 'Sistema', description: 'Saúde e prontidão do serviço' }, ...(opcoes.tags ?? [])],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, {
    routePrefix: `${opcoes.prefixo}/docs`,
    uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: true },
  });

  app.setErrorHandler((erro: FastifyError | Error, req, reply) => {
    const requestId = req.id;
    const responder = (status: number, codigo: string, mensagem: string, detalhes?: unknown) =>
      reply.status(status).send({ erro: { codigo, mensagem, ...(detalhes !== undefined ? { detalhes } : {}), requestId } });

    if (erro instanceof ErroAplicacao) {
      if (erro.status >= 500) req.log.error({ err: erro }, erro.message);
      return responder(erro.status, erro.codigo, erro.message, erro.detalhes);
    }
    if (hasZodFastifySchemaValidationErrors(erro)) {
      const detalhes = erro.validation.map((v) => ({
        campo: String(v.instancePath || '').replace(/^\//, '').replace(/\//g, '.') || '(raiz)',
        mensagem: v.message ?? 'valor inválido',
      }));
      return responder(422, 'VALIDACAO', 'Os dados enviados são inválidos.', detalhes);
    }
    if (erro instanceof ZodError) {
      return responder(422, 'VALIDACAO', 'Os dados enviados são inválidos.', detalhesZod(erro.issues));
    }
    if (isResponseSerializationError(erro)) {
      req.log.error({ err: erro }, 'Falha ao serializar resposta');
      return responder(500, 'ERRO_INTERNO', 'Erro interno ao montar a resposta.');
    }
    const fe = erro as FastifyError;
    switch (fe.code) {
      case 'FST_REQ_FILE_TOO_LARGE':
        return responder(413, 'ARQUIVO_MUITO_GRANDE', 'A foto excede o tamanho máximo permitido de 5 MB.');
      case 'FST_ERR_CTP_BODY_TOO_LARGE':
      case 'FST_PARTS_LIMIT':
      case 'FST_FILES_LIMIT':
        return responder(413, 'ARQUIVO_MUITO_GRANDE', 'O conteúdo enviado excede o tamanho máximo permitido.');
      case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
      case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
        return responder(415, 'TIPO_NAO_SUPORTADO', 'Tipo de conteúdo não suportado.');
      case 'FST_ERR_CTP_EMPTY_JSON_BODY':
      case 'FST_ERR_CTP_INVALID_JSON_BODY':
        return responder(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
      default:
        break;
    }
    if (fe.code?.startsWith('FST_JWT')) {
      return responder(401, 'NAO_AUTENTICADO', 'Token ausente, inválido ou expirado.');
    }
    if (fe.statusCode === 429) {
      return responder(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.');
    }
    if (ehErroDeBancoIndisponivel(erro)) {
      req.log.error({ err: erro }, 'Banco de dados indisponível');
      return responder(503, 'BANCO_INDISPONIVEL', 'Banco de dados temporariamente indisponível. Tente novamente em instantes.');
    }
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      return responder(fe.statusCode, 'REQUISICAO_INVALIDA', fe.message);
    }
    req.log.error({ err: erro }, 'Erro não tratado');
    return responder(500, 'ERRO_INTERNO', 'Ocorreu um erro inesperado. Tente novamente.');
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send({
      erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.url} não existe.`, requestId: req.id },
    }),
  );

  // ----- Saúde e prontidão ------------------------------------------------------
  const respostaSaude = z.object({
    status: z.string(),
    servico: z.string(),
    instancia: z.string(),
    versao: z.string(),
    uptimeS: z.number(),
    horario: z.string(),
  });
  const saude = async () => ({
    status: 'ok',
    servico: opcoes.nome,
    instancia: INSTANCIA_ID,
    versao: opcoes.versao ?? '1.0.0',
    uptimeS: Math.round((Date.now() - HORA_INICIO) / 1000),
    horario: new Date().toISOString(),
  });
  for (const url of ['/health', `${opcoes.prefixo}/health`]) {
    app.get(url, {
      logLevel: 'warn',
      schema: { tags: ['Sistema'], summary: 'Liveness: o processo está no ar', hide: url === '/health', response: { 200: respostaSaude } },
      handler: saude,
    });
  }

  const pronto = async (_req: unknown, reply: { status: (n: number) => unknown }) => {
    const verificacoes: Record<string, 'ok' | 'falha'> = {};
    for (const [nome, verificar] of Object.entries(opcoes.prontidao ?? {})) {
      try {
        const r = await Promise.race([
          Promise.resolve(verificar()),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
        ]);
        verificacoes[nome] = r === false ? 'falha' : 'ok';
      } catch {
        verificacoes[nome] = 'falha';
      }
    }
    const ok = Object.values(verificacoes).every((v) => v === 'ok');
    reply.status(ok ? 200 : 503);
    return { status: ok ? 'pronto' : 'nao_pronto', servico: opcoes.nome, instancia: INSTANCIA_ID, verificacoes };
  };
  for (const url of ['/ready', `${opcoes.prefixo}/ready`]) {
    app.get(url, {
      logLevel: 'warn',
      schema: { tags: ['Sistema'], summary: 'Readiness: dependências (banco, broker) acessíveis', hide: url === '/ready' },
      handler: pronto,
    });
  }

  return app;
}

/** Inicia o servidor HTTP na porta configurada. */
export async function iniciarServidor(app: AppFastify): Promise<void> {
  const porta = Number(process.env.PORTA || 3000);
  await app.listen({ port: porta, host: '0.0.0.0' });
}
