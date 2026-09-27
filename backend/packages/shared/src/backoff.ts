/**
 * Utilitários de retry com backoff exponencial e jitter.
 *
 * atraso(n) = min(maximo, base * fator^n) ± jitter
 * Ex.: base 500 ms, fator 2 -> 500, 1000, 2000, 4000, 8000... (limitado ao máximo)
 */
export interface OpcoesBackoff {
  /** Atraso inicial em ms (tentativa 0). */
  baseMs?: number;
  /** Atraso máximo em ms. */
  maximoMs?: number;
  /** Multiplicador a cada tentativa. */
  fator?: number;
  /** Fração de variação aleatória (0 a 1) para evitar sincronizar clientes ("thundering herd"). */
  jitter?: number;
}

export function calcularBackoff(tentativa: number, opcoes: OpcoesBackoff = {}, aleatorio: () => number = Math.random): number {
  const { baseMs = 500, maximoMs = 30_000, fator = 2, jitter = 0.2 } = opcoes;
  const n = Math.max(0, Math.floor(tentativa));
  const semJitter = Math.min(maximoMs, baseMs * Math.pow(fator, n));
  if (jitter <= 0) return Math.round(semJitter);
  const variacao = semJitter * jitter * (aleatorio() * 2 - 1);
  return Math.max(0, Math.round(Math.min(maximoMs, semJitter + variacao)));
}

export const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface OpcoesRetry extends OpcoesBackoff {
  /** Número máximo de tentativas (incluindo a primeira). */
  tentativas?: number;
  /** Decide se o erro merece nova tentativa (padrão: sempre). */
  deveTentarNovamente?: (erro: unknown) => boolean;
  /** Chamado antes de cada nova tentativa (útil para log). */
  aoFalhar?: (erro: unknown, tentativa: number, proximoAtrasoMs: number) => void;
  /** Função de espera injetável (para testes). */
  dormir?: (ms: number) => Promise<void>;
}

/** Executa `fn` com novas tentativas e backoff exponencial. Lança o último erro se esgotar. */
export async function comRetry<T>(fn: (tentativa: number) => Promise<T>, opcoes: OpcoesRetry = {}): Promise<T> {
  const { tentativas = 3, deveTentarNovamente = () => true, aoFalhar, dormir = esperar } = opcoes;
  let ultimoErro: unknown;
  for (let t = 0; t < tentativas; t++) {
    try {
      return await fn(t);
    } catch (erro) {
      ultimoErro = erro;
      const ultima = t === tentativas - 1;
      if (ultima || !deveTentarNovamente(erro)) break;
      const atraso = calcularBackoff(t, opcoes);
      aoFalhar?.(erro, t + 1, atraso);
      await dormir(atraso);
    }
  }
  throw ultimoErro;
}
