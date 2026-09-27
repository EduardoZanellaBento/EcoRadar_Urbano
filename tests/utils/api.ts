import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REGISTROS = resolve(RAIZ, 'registros');
export const API = process.env.ECORADAR_URL || 'http://localhost:8080';

export interface UsuarioDemo {
  nome: string;
  email: string;
  senha: string;
  perfil: 'CIDADAO' | 'AGENTE' | 'ADMIN';
  bairro: string;
}

/** Credenciais de demonstração: lidas do seed (fonte única). */
export const USUARIOS: UsuarioDemo[] = JSON.parse(readFileSync(resolve(RAIZ, 'backend', 'seed', 'usuarios-demo.json'), 'utf-8')).usuarios;
export const usuario = (email: string) => {
  const u = USUARIOS.find((x) => x.email === email);
  if (!u) throw new Error(`Usuário de demonstração não encontrado: ${email}`);
  return u;
};

export interface Resposta<T = any> {
  status: number;
  corpo: T;
  cabecalhos: Headers;
  ms: number;
}

export async function req<T = any>(
  metodo: string,
  caminho: string,
  opcoes: { token?: string; corpo?: unknown; form?: FormData; cabecalhos?: Record<string, string> } = {},
): Promise<Resposta<T>> {
  const inicio = Date.now();
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: {
      ...(opcoes.corpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
      ...opcoes.cabecalhos,
    },
    body: opcoes.form ?? (opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined),
  });
  const tipo = r.headers.get('content-type') ?? '';
  const corpo = tipo.includes('application/json') ? await r.json() : tipo.startsWith('text/') ? await r.text() : Buffer.from(await r.arrayBuffer());
  return { status: r.status, corpo: corpo as T, cabecalhos: r.headers, ms: Date.now() - inicio };
}

const cacheTokens = new Map<string, string>();
/** Login (com cache — o login tem rate limit por IP+e-mail). */
export async function login(email: string): Promise<string> {
  const salvo = cacheTokens.get(email);
  if (salvo) return salvo;
  const r = await req('POST', '/api/auth/login', { corpo: { email, senha: usuario(email).senha } });
  if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${r.status} ${JSON.stringify(r.corpo)}`);
  cacheTokens.set(email, r.corpo.token);
  return r.corpo.token;
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repete a verificação até ela retornar um valor "verdadeiro" ou estourar o tempo. */
export async function aguardar<T>(descricao: string, verificar: () => Promise<T | false | null | undefined>, timeoutMs = 60_000, intervaloMs = 1000): Promise<T> {
  const limite = Date.now() + timeoutMs;
  let ultimo: unknown;
  while (Date.now() < limite) {
    try {
      const r = await verificar();
      if (r) return r;
      ultimo = r;
    } catch (e) {
      ultimo = e;
    }
    await esperar(intervaloMs);
  }
  throw new Error(`Tempo esgotado aguardando: ${descricao} (último valor: ${String(ultimo)})`);
}

export function novaOcorrencia(parcial: Record<string, unknown> = {}) {
  return {
    categoria: 'ALAGAMENTO',
    severidade: 'MEDIA',
    descricao: `Teste automatizado ${new Date().toISOString()}`,
    latitude: -23.5866,
    longitude: -46.6103,
    idempotencyKey: randomUUID(),
    ...parcial,
  };
}

export const agoraIso = () => new Date().toISOString();
