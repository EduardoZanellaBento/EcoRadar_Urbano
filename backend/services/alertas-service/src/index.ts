import { Server as ServidorSocket } from 'socket.io';
import { z } from 'zod';
import {
  ClienteAmqp,
  Erros,
  INSTANCIA_ID,
  TIPOS_ALERTA,
  aguardarBanco,
  autenticar,
  configurarEncerramento,
  criarDb,
  criarLogger,
  criarPool,
  criarServidor,
  env,
  executarMigracoes,
  exigirPerfil,
  iniciarServidor,
  registrarJwt,
  resolverPastaMigracoes,
  seguranca,
  snapshotAlertaSchema,
  verificarBanco,
  type UsuarioToken,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { ServicoAlertas } from './servico-alertas.js';

const SERVICO = 'alertas-service';
const logger = criarLogger(SERVICO);

async function main() {
  const pool = criarPool(env('DATABASE_URL'), SERVICO, logger);
  const db = criarDb(pool, schema);
  await aguardarBanco(pool, logger);
  await executarMigracoes(pool, db, { pasta: resolverPastaMigracoes(import.meta.url), schema: env('DB_SCHEMA', 'alertas'), logger });

  const amqp = new ClienteAmqp({ url: env('AMQP_URL'), nomeServico: SERVICO, logger });

  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/alertas',
    titulo: 'EcoRadar Urbano — alertas-service',
    descricao:
      'Motor de regras de alertas (poluição, alagamento, inversão térmica, concentração de ocorrências e mananciais) ' +
      'com deduplicação e transmissão em tempo real via Socket.IO (eventos alerta:novo, ocorrencia:nova).',
    logger,
    prontidao: { banco: () => verificarBanco(pool), broker: () => amqp.conectado },
    tags: [{ name: 'Alertas', description: 'Alertas ativos e histórico' }],
  });
  await registrarJwt(app);

  // ----- Socket.IO no mesmo servidor HTTP (o gateway faz o upgrade em /socket.io/) ------
  const io = new ServidorSocket(app.server, {
    path: '/socket.io',
    cors: { origin: true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error('NAO_AUTENTICADO: token ausente'));
    try {
      socket.data.usuario = app.jwt.verify<UsuarioToken>(token);
      next();
    } catch {
      next(new Error('NAO_AUTENTICADO: token inválido ou expirado'));
    }
  });

  const servico = new ServicoAlertas(db, io, amqp, logger);
  io.on('connection', async (socket) => {
    const u = socket.data.usuario as UsuarioToken;
    socket.join(`perfil:${u.perfil}`);
    logger.info({ usuarioId: u.sub, socketId: socket.id, conectados: io.engine.clientsCount }, 'Cliente Socket.IO conectado');
    socket.emit('boas-vindas', { instancia: INSTANCIA_ID, alertasAtivos: await servico.contarAtivos().catch(() => null) });
    socket.on('disconnect', (motivo) => logger.info({ usuarioId: u.sub, motivo }, 'Cliente Socket.IO desconectado'));
  });

  // Consumidor: prefetch 1 processa um evento por vez (evita corrida na deduplicação)
  await amqp.assinar('alertas.eventos', ['ocorrencia.*', 'ambiental.*'], (evento) => servico.processarEvento(evento), 1);
  amqp.iniciar();

  const expiracao = setInterval(() => void servico.expirarAntigos().catch((e) => logger.warn({ err: e }, 'Falha na expiração de alertas')), 60_000);
  expiracao.unref();

  // ----- Rotas REST ---------------------------------------------------------------------
  const erroSchema = z.object({ erro: z.object({ codigo: z.string(), mensagem: z.string(), detalhes: z.unknown().optional(), requestId: z.string() }) });
  const alertaSchema = snapshotAlertaSchema.extend({
    categoria: z.string().nullable(),
    origem: z.string(),
    referenciaId: z.string(),
    encerradoPor: z.string().nullable(),
    comentarioEncerramento: z.string().nullable(),
  });

  app.get('/api/alertas', {
    onRequest: autenticar,
    schema: {
      tags: ['Alertas'],
      summary: 'Lista alertas ativos e/ou histórico',
      security: seguranca,
      querystring: z.object({
        status: z.enum(['ATIVO', 'ENCERRADO', 'TODOS']).default('TODOS'),
        tipo: z.enum(TIPOS_ALERTA).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        tamanhoPagina: z.coerce.number().int().min(1).max(200).default(30),
      }),
    },
    handler: async (req) => servico.listar(req.query),
  });

  app.get('/api/alertas/sistema/conexoes', {
    onRequest: autenticar,
    schema: { tags: ['Sistema'], summary: 'Clientes Socket.IO conectados e estatísticas do motor de regras', security: seguranca },
    handler: async () => ({ instancia: INSTANCIA_ID, clientesConectados: io.engine.clientsCount, estatisticas: servico.estatisticas }),
  });

  app.get('/api/alertas/:id', {
    onRequest: autenticar,
    schema: { tags: ['Alertas'], summary: 'Detalhe de um alerta', security: seguranca, params: z.object({ id: z.string().uuid() }), response: { 200: alertaSchema, 404: erroSchema } },
    handler: async (req) => {
      const a = await servico.buscar(req.params.id);
      if (!a) throw Erros.naoEncontrado('Alerta');
      return a;
    },
  });

  app.patch('/api/alertas/:id/encerrar', {
    onRequest: exigirPerfil('AGENTE', 'ADMIN'),
    schema: {
      tags: ['Alertas'],
      summary: 'Encerra um alerta ativo (somente AGENTE/ADMIN)',
      security: seguranca,
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ comentario: z.string().trim().max(500).optional() }).optional(),
      response: { 200: alertaSchema, 401: erroSchema, 403: erroSchema, 404: erroSchema, 409: erroSchema },
    },
    handler: async (req) => {
      const r = await servico.encerrar(req.params.id, { sub: req.user.sub, nome: req.user.nome }, req.body?.comentario, req.id);
      if (!r) {
        const existe = await servico.buscar(req.params.id);
        if (!existe) throw Erros.naoEncontrado('Alerta');
        throw Erros.conflito('ALERTA_JA_ENCERRADO', 'Este alerta já foi encerrado.');
      }
      req.log.info({ alertaId: r.id, por: req.user.sub }, 'Alerta encerrado');
      return r;
    },
  });

  configurarEncerramento(logger, [
    { nome: 'Socket.IO', executar: () => new Promise<void>((resolve) => io.close(() => resolve())) },
    { nome: 'servidor HTTP', executar: () => app.close() },
    { nome: 'conexão AMQP', executar: () => amqp.fechar() },
    { nome: 'pool do PostgreSQL', executar: () => pool.end() },
  ]);
  await iniciarServidor(app);
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o serviço');
  process.exit(1);
});
