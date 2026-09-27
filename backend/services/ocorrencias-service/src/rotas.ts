import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  type AppFastify,
  Erros,
  STATUS_OCORRENCIA,
  TIPOS_EVENTO,
  autenticar,
  bairroMaisProximo,
  ehViolacaoDeUnicidade,
  exigirPerfil,
  seguranca,
  snapshotOcorrenciaSchema,
} from '@ecoradar/shared';
import { confirmacoes, historicoStatus, ocorrencias } from './db/schema.js';
import {
  TAMANHO_MAXIMO_FOTO,
  alterarStatusSchema,
  criarOcorrenciaSchema,
  decidirIdempotencia,
  detectarTipoImagem,
  filtrosListagemSchema,
  paraSnapshot,
  podeConfirmar,
  validarTransicao,
} from './dominio/regras.js';
import type { PublicadorOutbox } from './dominio/publicador-outbox.js';
import * as repo from './repositorio.js';

const erroSchema = z.object({
  erro: z.object({ codigo: z.string(), mensagem: z.string(), detalhes: z.unknown().optional(), requestId: z.string() }),
});
const itemListaSchema = snapshotOcorrenciaSchema.extend({ distanciaKm: z.number().nullable().optional() });
const historicoSchema = z.object({
  id: z.string(),
  statusAnterior: z.enum(STATUS_OCORRENCIA).nullable(),
  statusNovo: z.enum(STATUS_OCORRENCIA),
  comentario: z.string(),
  usuarioId: z.string(),
  usuarioNome: z.string(),
  criadoEm: z.string(),
});
const detalheSchema = snapshotOcorrenciaSchema.extend({
  historico: z.array(historicoSchema),
  confirmadoPorMim: z.boolean(),
});
const idParams = z.object({ id: z.string().uuid({ message: 'Identificador de ocorrência inválido.' }) });

export interface DependenciasRotas {
  db: repo.Db;
  pastaUploads: string;
  publicador: PublicadorOutbox;
}

export async function registrarRotas(app: AppFastify, { db, pastaUploads, publicador }: DependenciasRotas) {
  await mkdir(pastaUploads, { recursive: true });

  // ----- Criar ocorrência ---------------------------------------------------------
  app.post('/api/ocorrencias', {
    onRequest: autenticar,
    // Aceita a chave de idempotência também pelo cabeçalho Idempotency-Key
    preValidation: async (req) => {
      const corpo = req.body as Record<string, unknown> | undefined;
      const cabecalho = req.headers['idempotency-key'];
      if (corpo && !corpo.idempotencyKey && typeof cabecalho === 'string') corpo.idempotencyKey = cabecalho;
    },
    schema: {
      tags: ['Ocorrências'],
      summary: 'Registra uma ocorrência (multipart com foto opcional ou JSON)',
      description:
        'Envie como multipart/form-data (campos + arquivo "foto" jpeg/png/webp até 5 MB) ou application/json. ' +
        'O campo idempotencyKey (UUID v4 gerado pelo app) garante que reenvios não dupliquem o registro: ' +
        'se a chave já foi usada pelo mesmo usuário, a ocorrência original é devolvida com status 200.',
      consumes: ['multipart/form-data', 'application/json'],
      security: seguranca,
      body: criarOcorrenciaSchema,
      response: { 200: snapshotOcorrenciaSchema, 201: snapshotOcorrenciaSchema, 401: erroSchema, 409: erroSchema, 413: erroSchema, 415: erroSchema, 422: erroSchema },
    },
    handler: async (req, reply) => {
      const dados = req.body;
      const usuario = req.user;

      // 1) Idempotência: a chave já foi usada?
      const decisao = decidirIdempotencia(await repo.buscarPorIdempotencyKey(db, dados.idempotencyKey), usuario.sub);
      if (decisao.tipo === 'CONFLITO') {
        throw Erros.conflito('IDEMPOTENCY_KEY_EM_USO', 'Esta chave de idempotência já foi usada por outro usuário.');
      }
      if (decisao.tipo === 'REPETIDA') {
        const original = await repo.buscarPorId(db, decisao.ocorrenciaId);
        req.log.info({ ocorrenciaId: decisao.ocorrenciaId, idempotencyKey: dados.idempotencyKey }, 'Reenvio idempotente: devolvendo registro original');
        reply.header('X-Idempotent-Replay', 'true');
        return reply.status(200).send(paraSnapshot(original!));
      }

      // 2) Foto (opcional): valida o conteúdo real pelos magic bytes
      let arquivoFoto: { caminho: string; url: string } | null = null;
      const foto = dados.foto as unknown;
      if (Buffer.isBuffer(foto) && foto.length > 0) {
        if (foto.length > TAMANHO_MAXIMO_FOTO) throw Erros.arquivoGrande(5);
        const tipo = detectarTipoImagem(foto);
        if (!tipo) throw Erros.tipoNaoSuportado('A foto deve ser uma imagem JPEG, PNG ou WebP.');
        const nome = `${randomUUID()}.${tipo.extensao}`;
        arquivoFoto = { caminho: join(pastaUploads, nome), url: `/uploads/${nome}` };
        await writeFile(arquivoFoto.caminho, foto);
      } else if (foto !== undefined && foto !== '' && !Buffer.isBuffer(foto)) {
        throw Erros.validacao('O campo "foto" deve ser um arquivo de imagem.');
      }

      // 3) Área de manancial (PostGIS ST_Contains)
      const manancial = await repo.manancialNoPonto(db, dados.latitude, dados.longitude);
      const bairro = dados.bairro?.trim() || bairroMaisProximo(dados.latitude, dados.longitude) || (manancial ? `Região ${manancial.nome}` : null);

      // 4) Ocorrência + histórico + evento no outbox na MESMA transação
      try {
        const criada = await db.transaction(async (tx) => {
          const [linha] = await tx
            .insert(ocorrencias)
            .values({
              idempotencyKey: dados.idempotencyKey,
              usuarioId: usuario.sub,
              usuarioNome: usuario.nome,
              categoria: dados.categoria,
              severidade: dados.severidade,
              descricao: dados.descricao,
              localizacao: repo.ponto(dados.latitude, dados.longitude) as unknown as string,
              latitude: dados.latitude,
              longitude: dados.longitude,
              bairro,
              fotoUrl: arquivoFoto?.url ?? null,
              emAreaDeManancial: Boolean(manancial),
              manancialNome: manancial?.nome ?? null,
            })
            .returning();
          await tx.insert(historicoStatus).values({
            ocorrenciaId: linha.id,
            statusAnterior: null,
            statusNovo: 'ABERTA',
            comentario: 'Ocorrência registrada pelo cidadão.',
            usuarioId: usuario.sub,
            usuarioNome: usuario.nome,
          });
          const snapshot = paraSnapshot(linha);
          await repo.gravarNoOutbox(tx, TIPOS_EVENTO.OCORRENCIA_CRIADA, { ocorrencia: snapshot }, req.id);
          return snapshot;
        });
        req.log.info(
          { ocorrenciaId: criada.id, categoria: criada.categoria, emAreaDeManancial: criada.emAreaDeManancial },
          'Ocorrência registrada',
        );
        reply.header('X-Idempotent-Replay', 'false');
        return reply.status(201).send(criada);
      } catch (erro) {
        if (arquivoFoto) await rm(arquivoFoto.caminho, { force: true });
        // Corrida entre réplicas com a mesma chave: a outra venceu; devolve o registro dela
        if (ehViolacaoDeUnicidade(erro)) {
          const existente = await repo.buscarPorIdempotencyKey(db, dados.idempotencyKey);
          const d = decidirIdempotencia(existente, usuario.sub);
          if (d.tipo === 'REPETIDA') {
            reply.header('X-Idempotent-Replay', 'true');
            return reply.status(200).send(paraSnapshot((await repo.buscarPorId(db, d.ocorrenciaId))!));
          }
          throw Erros.conflito('IDEMPOTENCY_KEY_EM_USO', 'Esta chave de idempotência já foi usada por outro usuário.');
        }
        throw erro;
      }
    },
  });

  // ----- Listar ---------------------------------------------------------------------
  app.get('/api/ocorrencias', {
    onRequest: autenticar,
    schema: {
      tags: ['Ocorrências'],
      summary: 'Lista ocorrências com filtros (categoria, status, severidade, período, raio em km, busca) e paginação',
      security: seguranca,
      querystring: filtrosListagemSchema,
      response: {
        200: z.object({ itens: z.array(itemListaSchema), total: z.number(), pagina: z.number(), tamanhoPagina: z.number() }),
        401: erroSchema,
        422: erroSchema,
      },
    },
    handler: async (req) => repo.listar(db, req.query, req.user.sub),
  });

  // ----- Mananciais -------------------------------------------------------------------
  app.get('/api/ocorrencias/mananciais', {
    schema: {
      tags: ['Mananciais'],
      summary: 'Polígonos (GeoJSON) das áreas de proteção de mananciais — aproximados, para fins didáticos',
    },
    handler: async (_req, reply) => {
      reply.header('Cache-Control', 'public, max-age=3600');
      return repo.listarMananciaisGeoJson(db);
    },
  });

  app.get('/api/ocorrencias/verificar-manancial', {
    schema: {
      tags: ['Mananciais'],
      summary: 'Verifica se um ponto está dentro de uma área de manancial (PostGIS ST_Contains)',
      querystring: z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }),
      response: {
        200: z.object({ emAreaDeManancial: z.boolean(), manancial: z.object({ id: z.string(), nome: z.string() }).nullable() }),
        422: erroSchema,
      },
    },
    handler: async (req) => {
      const m = await repo.manancialNoPonto(db, req.query.lat, req.query.lon);
      return { emAreaDeManancial: Boolean(m), manancial: m };
    },
  });

  // ----- Estado do outbox (observabilidade / testes de consistência eventual) ---------
  app.get('/api/ocorrencias/sistema/outbox', {
    onRequest: autenticar,
    schema: {
      tags: ['Sistema'],
      summary: 'Eventos pendentes/publicados no outbox e estatísticas do publicador desta réplica',
      security: seguranca,
    },
    handler: async () => ({ ...(await repo.estatisticasOutbox(db)), publicadorDestaReplica: publicador.estatisticas }),
  });

  // ----- Detalhe ------------------------------------------------------------------------
  app.get('/api/ocorrencias/:id', {
    onRequest: autenticar,
    schema: {
      tags: ['Ocorrências'],
      summary: 'Detalhe da ocorrência com histórico de status',
      security: seguranca,
      params: idParams,
      response: { 200: detalheSchema, 401: erroSchema, 404: erroSchema, 422: erroSchema },
    },
    handler: async (req) => {
      const linha = await repo.buscarPorId(db, req.params.id);
      if (!linha) throw Erros.naoEncontrado('Ocorrência');
      const [historico, confirmadoPorMim] = await Promise.all([
        repo.historicoDa(db, linha.id),
        repo.confirmouAntes(db, linha.id, req.user.sub),
      ]);
      return {
        ...paraSnapshot(linha),
        confirmadoPorMim,
        historico: historico.map((h) => ({
          id: h.id,
          statusAnterior: h.statusAnterior,
          statusNovo: h.statusNovo,
          comentario: h.comentario,
          usuarioId: h.usuarioId,
          usuarioNome: h.usuarioNome,
          criadoEm: h.criadoEm.toISOString(),
        })),
      };
    },
  });

  // ----- Confirmação colaborativa --------------------------------------------------------
  app.post('/api/ocorrencias/:id/confirmar', {
    onRequest: autenticar,
    schema: {
      tags: ['Ocorrências'],
      summary: 'Confirma a ocorrência de outro cidadão (1 confirmação por usuário)',
      security: seguranca,
      params: idParams,
      response: { 200: snapshotOcorrenciaSchema, 401: erroSchema, 404: erroSchema, 409: erroSchema, 422: erroSchema },
    },
    handler: async (req) => {
      const usuario = req.user;
      try {
        return await db.transaction(async (tx) => {
          const atual = await repo.buscarPorIdParaAtualizar(tx, req.params.id);
          if (!atual) throw Erros.naoEncontrado('Ocorrência');
          const regra = podeConfirmar(atual, usuario.sub);
          if (!regra.ok) throw Erros.conflito(regra.codigo, regra.mensagem);
          await tx.insert(confirmacoes).values({ ocorrenciaId: atual.id, usuarioId: usuario.sub, usuarioNome: usuario.nome });
          const [linha] = await tx
            .update(ocorrencias)
            .set({ confirmacoes: sql`${ocorrencias.confirmacoes} + 1`, versao: sql`${ocorrencias.versao} + 1`, atualizadoEm: new Date() })
            .where(eq(ocorrencias.id, atual.id))
            .returning();
          const snapshot = paraSnapshot(linha);
          await repo.gravarNoOutbox(tx, TIPOS_EVENTO.OCORRENCIA_CONFIRMADA, { ocorrencia: snapshot, confirmadoPor: usuario.sub }, req.id);
          req.log.info({ ocorrenciaId: atual.id, confirmacoes: linha.confirmacoes }, 'Ocorrência confirmada');
          return snapshot;
        });
      } catch (erro) {
        if (ehViolacaoDeUnicidade(erro)) throw Erros.conflito('JA_CONFIRMADA', 'Você já confirmou esta ocorrência.');
        throw erro;
      }
    },
  });

  // ----- Alteração de status (agente/admin) ------------------------------------------------
  app.patch('/api/ocorrencias/:id/status', {
    onRequest: exigirPerfil('AGENTE', 'ADMIN'),
    schema: {
      tags: ['Ocorrências'],
      summary: 'Altera o status (somente AGENTE/ADMIN, comentário obrigatório) e grava o histórico',
      security: seguranca,
      params: idParams,
      body: alterarStatusSchema,
      response: { 200: snapshotOcorrenciaSchema, 401: erroSchema, 403: erroSchema, 404: erroSchema, 409: erroSchema, 422: erroSchema },
    },
    handler: async (req) => {
      const usuario = req.user;
      const { status, comentario } = req.body;
      return db.transaction(async (tx) => {
        const atual = await repo.buscarPorIdParaAtualizar(tx, req.params.id);
        if (!atual) throw Erros.naoEncontrado('Ocorrência');
        const regra = validarTransicao(atual.status, status);
        if (!regra.ok) throw Erros.conflito(regra.codigo, regra.mensagem);
        const agora = new Date();
        const [linha] = await tx
          .update(ocorrencias)
          .set({
            status,
            atualizadoEm: agora,
            resolvidoEm: status === 'RESOLVIDA' ? agora : status === 'ABERTA' || status === 'EM_ANALISE' ? null : atual.resolvidoEm,
            versao: sql`${ocorrencias.versao} + 1`,
          })
          .where(eq(ocorrencias.id, atual.id))
          .returning();
        await tx.insert(historicoStatus).values({
          ocorrenciaId: atual.id,
          statusAnterior: atual.status,
          statusNovo: status,
          comentario,
          usuarioId: usuario.sub,
          usuarioNome: usuario.nome,
        });
        const snapshot = paraSnapshot(linha);
        await repo.gravarNoOutbox(
          tx,
          TIPOS_EVENTO.OCORRENCIA_STATUS_ALTERADO,
          { ocorrencia: snapshot, statusAnterior: atual.status, comentario },
          req.id,
        );
        req.log.info({ ocorrenciaId: atual.id, de: atual.status, para: status, por: usuario.sub }, 'Status da ocorrência alterado');
        return snapshot;
      });
    },
  });
}
