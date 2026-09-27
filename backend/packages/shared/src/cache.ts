/** Cache em memória com tempo de vida (TTL). Mantém o último valor mesmo expirado,
 * para permitir degradação graciosa (servir dado "velho" quando a fonte falha). */
export interface EntradaCache<T> {
  valor: T;
  gravadoEm: number;
}

export class CacheTTL<T> {
  private readonly entradas = new Map<string, EntradaCache<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  definir(chave: string, valor: T, gravadoEm = this.agora()): void {
    this.entradas.set(chave, { valor, gravadoEm });
  }

  /** Retorna o valor apenas se ainda estiver dentro do TTL. */
  obterValido(chave: string): EntradaCache<T> | undefined {
    const e = this.entradas.get(chave);
    if (!e) return undefined;
    return this.agora() - e.gravadoEm <= this.ttlMs ? e : undefined;
  }

  /** Retorna o último valor conhecido, mesmo expirado. */
  obterUltimo(chave: string): EntradaCache<T> | undefined {
    return this.entradas.get(chave);
  }

  /** Força a expiração (o valor continua disponível via obterUltimo). */
  expirar(chave: string): void {
    const e = this.entradas.get(chave);
    if (e) e.gravadoEm = Math.min(e.gravadoEm, this.agora() - this.ttlMs - 1);
  }

  idadeMs(chave: string): number | undefined {
    const e = this.entradas.get(chave);
    return e ? this.agora() - e.gravadoEm : undefined;
  }
}
