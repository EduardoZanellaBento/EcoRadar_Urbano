import os from 'node:os';

/** Lê uma variável de ambiente obrigatória (ou usa o valor padrão informado). */
export function env(nome: string, padrao?: string): string {
  const valor = process.env[nome];
  if (valor !== undefined && valor !== '') return valor;
  if (padrao !== undefined) return padrao;
  throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
}

export function envNumero(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  const n = Number(bruto);
  if (Number.isNaN(n)) throw new Error(`Variável de ambiente ${nome} deveria ser numérica: "${bruto}"`);
  return n;
}

/** Identificador da instância (hostname do container) — enviado no cabeçalho X-Instance-Id. */
export const INSTANCIA_ID = process.env.INSTANCIA_ID || os.hostname();

export interface CidadePadrao {
  nome: string;
  latitude: number;
  longitude: number;
}

export function cidadePadrao(): CidadePadrao {
  return {
    nome: env('CIDADE_PADRAO_NOME', 'São Paulo/SP'),
    latitude: envNumero('CIDADE_PADRAO_LAT', -23.5505),
    longitude: envNumero('CIDADE_PADRAO_LON', -46.6333),
  };
}
