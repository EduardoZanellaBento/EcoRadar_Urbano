import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppFastify } from './servidor.js';
import type { Perfil } from './dominio.js';
import { Erros } from './erros.js';

/** Conteúdo do token JWT emitido pelo auth-service e validado por todos os serviços. */
export interface UsuarioToken {
  sub: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UsuarioToken;
    user: UsuarioToken;
  }
}

/** Registra o plugin JWT com o segredo compartilhado (JWT_SEGREDO). */
export async function registrarJwt(app: AppFastify): Promise<void> {
  const segredo = process.env.JWT_SEGREDO;
  if (!segredo) throw new Error('Variável de ambiente obrigatória ausente: JWT_SEGREDO');
  await app.register(jwt, {
    secret: segredo,
    sign: { expiresIn: process.env.JWT_VALIDADE || '12h', iss: 'ecoradar-auth' },
    verify: { allowedIss: 'ecoradar-auth' },
  });
}

/** preHandler: exige um token válido. */
export async function autenticar(req: FastifyRequest, _reply?: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw Erros.naoAutenticado('Token ausente, inválido ou expirado. Faça login novamente.');
  }
}

/** preHandler: exige token válido e um dos perfis informados. */
export function exigirPerfil(...perfis: Perfil[]) {
  return async (req: FastifyRequest, reply?: FastifyReply): Promise<void> => {
    await autenticar(req, reply);
    if (!perfis.includes(req.user.perfil)) {
      throw Erros.proibido(`Esta operação é restrita aos perfis: ${perfis.join(', ')}.`);
    }
  };
}

/** Documentação OpenAPI: rota protegida por Bearer JWT. */
export const seguranca = [{ bearerAuth: [] as string[] }];
