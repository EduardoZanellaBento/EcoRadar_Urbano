import { describe, expect, it } from 'vitest';
import {
  alterarPerfilSchema,
  duracaoParaMs,
  loginSchema,
  paraUsuarioPublico,
  problemasDaSenha,
  registroSchema,
} from '../src/dominio/validacoes.js';

describe('auth-service › política de senha', () => {
  it('aceita senha com letras e números e 8+ caracteres', () => {
    expect(problemasDaSenha('ecoradar2026')).toEqual([]);
  });

  it('rejeita senha curta, sem número ou sem letra', () => {
    expect(problemasDaSenha('abc1')).toContain('A senha deve ter pelo menos 8 caracteres.');
    expect(problemasDaSenha('somenteletras')).toContain('A senha deve conter pelo menos um número.');
    expect(problemasDaSenha('1234567890')).toContain('A senha deve conter pelo menos uma letra.');
  });

  it('rejeita senha acima do limite do bcrypt (72)', () => {
    expect(problemasDaSenha('a1'.repeat(40))).toContain('A senha deve ter no máximo 72 caracteres.');
  });
});

describe('auth-service › validação do cadastro (Zod)', () => {
  it('normaliza e-mail e aceita dados válidos', () => {
    const r = registroSchema.parse({ nome: '  Maria Souza ', email: ' Maria@EcoRadar.Local ', senha: 'segura123' });
    expect(r.email).toBe('maria@ecoradar.local');
    expect(r.nome).toBe('Maria Souza');
  });

  it('aponta cada campo inválido', () => {
    const r = registroSchema.safeParse({ nome: 'A', email: 'nao-e-email', senha: 'curta' });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path.join('.'));
    expect(campos).toEqual(expect.arrayContaining(['nome', 'email', 'senha']));
  });

  it('exige senha no login e valida perfil', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', senha: '' }).success).toBe(false);
    expect(alterarPerfilSchema.safeParse({ perfil: 'AGENTE' }).success).toBe(true);
    expect(alterarPerfilSchema.safeParse({ perfil: 'SUPERUSUARIO' }).success).toBe(false);
  });
});

describe('auth-service › utilitários', () => {
  it('converte durações para milissegundos', () => {
    expect(duracaoParaMs('12h')).toBe(12 * 3_600_000);
    expect(duracaoParaMs('30m')).toBe(1_800_000);
    expect(duracaoParaMs('2d')).toBe(172_800_000);
    expect(duracaoParaMs('45')).toBe(45_000);
    expect(() => duracaoParaMs('doze horas')).toThrow();
  });

  it('nunca expõe o hash da senha', () => {
    const publico = paraUsuarioPublico({
      id: '1',
      nome: 'Ana',
      email: 'ana@x.com',
      perfil: 'CIDADAO',
      bairro: null,
      criadoEm: new Date('2026-01-01T00:00:00Z'),
      ...({ senhaHash: 'segredo' } as object),
    });
    expect(publico).not.toHaveProperty('senhaHash');
    expect(publico.criadoEm).toBe('2026-01-01T00:00:00.000Z');
  });
});
