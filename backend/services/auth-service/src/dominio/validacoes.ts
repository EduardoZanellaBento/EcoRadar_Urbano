import { z } from 'zod';
import { PERFIS } from '@ecoradar/shared';

/**
 * Política de senha: mínimo de 8 caracteres, com pelo menos uma letra e um número.
 * Retorna a lista de problemas encontrados (vazia = senha aceita).
 */
export function problemasDaSenha(senha: string): string[] {
  const problemas: string[] = [];
  if (senha.length < 8) problemas.push('A senha deve ter pelo menos 8 caracteres.');
  if (senha.length > 72) problemas.push('A senha deve ter no máximo 72 caracteres.');
  if (!/[A-Za-zÀ-ÿ]/.test(senha)) problemas.push('A senha deve conter pelo menos uma letra.');
  if (!/\d/.test(senha)) problemas.push('A senha deve conter pelo menos um número.');
  return problemas;
}

export const senhaSchema = z.string().superRefine((senha, ctx) => {
  for (const mensagem of problemasDaSenha(senha)) ctx.addIssue({ code: 'custom', message: mensagem });
});

/** Normaliza o e-mail (espaços e caixa) antes de validar/gravar. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Informe um e-mail válido.' }).max(160));

export const registroSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
    .max(100, { message: 'O nome deve ter no máximo 100 caracteres.' }),
  email: emailSchema,
  senha: senhaSchema,
  bairro: z.string().trim().max(80).optional().nullable(),
});
export type DadosRegistro = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, { message: 'Informe a senha.' }).max(200),
});

export const alterarPerfilSchema = z.object({
  perfil: z.enum(PERFIS, { message: 'Perfil inválido. Use CIDADAO, AGENTE ou ADMIN.' }),
});

export const atualizarMeSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    bairro: z.string().trim().max(80).nullable().optional(),
  })
  .refine((d) => d.nome !== undefined || d.bairro !== undefined, { message: 'Informe ao menos um campo para atualizar.' });

/** Dados públicos do usuário (nunca expõe o hash da senha). */
export const usuarioPublicoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  perfil: z.enum(PERFIS),
  bairro: z.string().nullable(),
  criadoEm: z.string(),
});
export type UsuarioPublico = z.infer<typeof usuarioPublicoSchema>;

export function paraUsuarioPublico(u: {
  id: string;
  nome: string;
  email: string;
  perfil: (typeof PERFIS)[number];
  bairro: string | null;
  criadoEm: Date;
}): UsuarioPublico {
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, bairro: u.bairro, criadoEm: u.criadoEm.toISOString() };
}

/** Converte "12h", "30m", "7d" ou segundos em milissegundos (para informar a expiração ao app). */
export function duracaoParaMs(duracao: string): number {
  const m = /^(\d+)\s*([smhd]?)$/i.exec(duracao.trim());
  if (!m) throw new Error(`Duração inválida: ${duracao}`);
  const n = Number(m[1]);
  const unidade = (m[2] || 's').toLowerCase();
  const fator = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unidade as 's' | 'm' | 'h' | 'd'];
  return n * fator;
}
