import bcrypt from 'bcryptjs';
import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import {
  type AppFastify,
  type UsuarioToken,
  Erros,
  PERFIS,
  autenticar,
  ehViolacaoDeUnicidade,
  exigirPerfil,
  seguranca,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { usuarios } from './db/schema.js';
import {
  alterarPerfilSchema,
  atualizarMeSchema,
  duracaoParaMs,
  loginSchema,
  paraUsuarioPublico,
  registroSchema,
  usuarioPublicoSchema,
} from './dominio/validacoes.js';

const CUSTO_BCRYPT = 10;
// Hash "fantasma" usado quando o e-mail não existe, para que o tempo de resposta
// seja semelhante e não revele quais e-mails estão cadastrados.
const HASH_FANTASMA = bcrypt.hashSync('senha-inexistente-ecoradar-1', CUSTO_BCRYPT);

const respostaSessao = z.object({ token: z.string(), expiraEm: z.string(), usuario: usuarioPublicoSchema });
const respostaErro = z.object({
  erro: z.object({ codigo: z.string(), mensagem: z.string(), detalhes: z.unknown().optional(), requestId: z.string() }),
});

export interface DependenciasRotas {
  db: NodePgDatabase<typeof schema>;
}

export async function registrarRotas(app: AppFastify, { db }: DependenciasRotas): Promise<void> {
  const validadeMs = duracaoParaMs(process.env.JWT_VALIDADE || '12h');
  const limiteLogin = Number(process.env.LOGIN_LIMITE_POR_MINUTO || 10);

  const emitirSessao = (u: schema.Usuario) => {
    const payload: UsuarioToken = { sub: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
    return {
      token: app.jwt.sign(payload),
      expiraEm: new Date(Date.now() + validadeMs).toISOString(),
      usuario: paraUsuarioPublico(u),
    };
  };

  app.post('/api/auth/registrar', {
    schema: {
      tags: ['Autenticação'],
      summary: 'Cadastra um novo cidadão',
      body: registroSchema,
      response: { 201: respostaSessao, 409: respostaErro, 422: respostaErro },
    },
    handler: async (req, reply) => {
      const { nome, email, senha, bairro } = req.body;
      const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
      try {
        const [criado] = await db
          .insert(usuarios)
          .values({ nome, email, senhaHash, bairro: bairro || null, perfil: 'CIDADAO' })
          .returning();
        req.log.info({ usuarioId: criado.id }, 'Novo usuário cadastrado');
        return reply.status(201).send(emitirSessao(criado));
      } catch (erro) {
        if (ehViolacaoDeUnicidade(erro)) {
          throw Erros.conflito('EMAIL_JA_CADASTRADO', 'Já existe uma conta com este e-mail.');
        }
        throw erro;
      }
    },
  });

  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: limiteLogin,
        timeWindow: '1 minute',
        // Limita por IP + e-mail: dificulta ataques de força bruta a uma conta
        keyGenerator: (req) => {
          const corpo = (req.body ?? {}) as { email?: unknown };
          const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
          return `${req.ip}|${email}`;
        },
      },
    },
    schema: {
      tags: ['Autenticação'],
      summary: 'Autentica e devolve um token JWT (validade de 12 h)',
      body: loginSchema,
      response: { 200: respostaSessao, 401: respostaErro, 422: respostaErro, 429: respostaErro },
    },
    handler: async (req) => {
      const { email, senha } = req.body;
      const [usuario] = await db
        .select()
        .from(usuarios)
        .where(sql`lower(${usuarios.email}) = ${email}`)
        .limit(1);
      const senhaOk = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FANTASMA);
      if (!usuario || !senhaOk) {
        req.log.warn({ email }, 'Tentativa de login inválida');
        throw Erros.credenciaisInvalidas();
      }
      await db.update(usuarios).set({ ultimoLoginEm: new Date() }).where(eq(usuarios.id, usuario.id));
      req.log.info({ usuarioId: usuario.id, perfil: usuario.perfil }, 'Login realizado');
      return emitirSessao(usuario);
    },
  });

  app.get('/api/auth/me', {
    preHandler: autenticar,
    schema: {
      tags: ['Usuários'],
      summary: 'Dados do usuário autenticado',
      security: seguranca,
      response: { 200: usuarioPublicoSchema, 401: respostaErro, 404: respostaErro },
    },
    handler: async (req) => {
      const [u] = await db.select().from(usuarios).where(eq(usuarios.id, req.user.sub)).limit(1);
      if (!u) throw Erros.naoEncontrado('Usuário');
      return paraUsuarioPublico(u);
    },
  });

  app.patch('/api/auth/me', {
    preHandler: autenticar,
    schema: {
      tags: ['Usuários'],
      summary: 'Atualiza nome e/ou bairro do próprio usuário',
      security: seguranca,
      body: atualizarMeSchema,
      response: { 200: usuarioPublicoSchema, 401: respostaErro, 422: respostaErro },
    },
    handler: async (req) => {
      const [u] = await db
        .update(usuarios)
        .set({
          ...(req.body.nome !== undefined ? { nome: req.body.nome } : {}),
          ...(req.body.bairro !== undefined ? { bairro: req.body.bairro || null } : {}),
          atualizadoEm: new Date(),
        })
        .where(eq(usuarios.id, req.user.sub))
        .returning();
      if (!u) throw Erros.naoEncontrado('Usuário');
      return paraUsuarioPublico(u);
    },
  });

  app.get('/api/auth/usuarios', {
    preHandler: exigirPerfil('ADMIN'),
    schema: {
      tags: ['Usuários'],
      summary: 'Lista usuários (somente ADMIN)',
      security: seguranca,
      querystring: z.object({
        busca: z.string().trim().max(80).optional(),
        perfil: z.enum(PERFIS).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        tamanhoPagina: z.coerce.number().int().min(1).max(100).default(20),
      }),
      response: {
        200: z.object({ itens: z.array(usuarioPublicoSchema), total: z.number(), pagina: z.number(), tamanhoPagina: z.number() }),
        401: respostaErro,
        403: respostaErro,
      },
    },
    handler: async (req) => {
      const { busca, perfil, pagina, tamanhoPagina } = req.query;
      const condicoes: SQL[] = [];
      if (perfil) condicoes.push(eq(usuarios.perfil, perfil));
      if (busca) {
        const termo = `%${busca}%`;
        const filtroBusca = or(ilike(usuarios.nome, termo), ilike(usuarios.email, termo));
        if (filtroBusca) condicoes.push(filtroBusca);
      }
      const where = condicoes.length ? and(...condicoes) : undefined;
      const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(usuarios).where(where);
      const linhas = await db
        .select()
        .from(usuarios)
        .where(where)
        .orderBy(asc(usuarios.nome))
        .limit(tamanhoPagina)
        .offset((pagina - 1) * tamanhoPagina);
      return { itens: linhas.map(paraUsuarioPublico), total, pagina, tamanhoPagina };
    },
  });

  app.patch('/api/auth/usuarios/:id/perfil', {
    preHandler: exigirPerfil('ADMIN'),
    schema: {
      tags: ['Usuários'],
      summary: 'Altera o perfil de acesso de um usuário (somente ADMIN)',
      security: seguranca,
      params: z.object({ id: z.string().uuid({ message: 'Identificador de usuário inválido.' }) }),
      body: alterarPerfilSchema,
      response: { 200: usuarioPublicoSchema, 401: respostaErro, 403: respostaErro, 404: respostaErro, 409: respostaErro, 422: respostaErro },
    },
    handler: async (req) => {
      if (req.params.id === req.user.sub) {
        throw Erros.conflito('OPERACAO_NAO_PERMITIDA', 'Um administrador não pode alterar o próprio perfil.');
      }
      const [u] = await db
        .update(usuarios)
        .set({ perfil: req.body.perfil, atualizadoEm: new Date() })
        .where(eq(usuarios.id, req.params.id))
        .returning();
      if (!u) throw Erros.naoEncontrado('Usuário');
      req.log.info({ alvo: u.id, novoPerfil: u.perfil, por: req.user.sub }, 'Perfil de usuário alterado');
      return paraUsuarioPublico(u);
    },
  });
}
