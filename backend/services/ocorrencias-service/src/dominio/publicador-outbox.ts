import type { Logger } from 'pino';
import { calcularBackoff, type EnvelopeEvento } from '@ecoradar/shared';

export interface LinhaOutbox {
  id: string;
  payload: EnvelopeEvento;
}

export interface ResultadoLote {
  publicados: string[];
  falhas: Array<{ id: string; erro: string }>;
}

/**
 * Fonte dos eventos pendentes. A implementação real (PostgreSQL) abre uma transação,
 * trava as linhas com FOR UPDATE SKIP LOCKED (para que as 2 réplicas não publiquem o
 * mesmo evento ao mesmo tempo), chama `processar` e grava o resultado.
 */
export interface FonteOutbox {
  processarPendentes(limite: number, processar: (linhas: LinhaOutbox[]) => Promise<ResultadoLote>): Promise<ResultadoLote>;
}

export interface Broker {
  readonly conectado: boolean;
  publicar(evento: EnvelopeEvento): Promise<void>;
}

export interface OpcoesPublicador {
  intervaloMs?: number;
  tamanhoLote?: number;
}

/**
 * Publicador do Transactional Outbox. A cada ciclo, envia ao broker os eventos
 * pendentes em ordem de criação. Se o broker estiver fora, nada é perdido: os eventos
 * continuam na tabela e são enviados quando a conexão voltar (consistência eventual).
 * Ao primeiro erro o lote é interrompido para preservar a ordem dos eventos.
 */
export class PublicadorOutbox {
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;
  private falhasSeguidas = 0;
  private ativo = false;
  readonly estatisticas = { publicados: 0, falhas: 0, ultimoErro: null as string | null, ultimoCicloEm: null as string | null };

  constructor(
    private readonly fonte: FonteOutbox,
    private readonly broker: Broker,
    private readonly logger: Logger,
    private readonly opcoes: OpcoesPublicador = {},
  ) {}

  /** Executa um ciclo de publicação. Retorna quantos eventos foram publicados/falharam. */
  async executarCiclo(): Promise<{ publicados: number; falhas: number }> {
    if (!this.broker.conectado) return { publicados: 0, falhas: 0 };
    const resultado = await this.fonte.processarPendentes(this.opcoes.tamanhoLote ?? 50, async (linhas) => {
      const publicados: string[] = [];
      const falhas: ResultadoLote['falhas'] = [];
      for (const linha of linhas) {
        try {
          await this.broker.publicar(linha.payload);
          publicados.push(linha.id);
        } catch (erro) {
          falhas.push({ id: linha.id, erro: erro instanceof Error ? erro.message : String(erro) });
          break;
        }
      }
      return { publicados, falhas };
    });
    this.estatisticas.publicados += resultado.publicados.length;
    this.estatisticas.falhas += resultado.falhas.length;
    this.estatisticas.ultimoCicloEm = new Date().toISOString();
    if (resultado.falhas.length) this.estatisticas.ultimoErro = resultado.falhas[0].erro;
    if (resultado.publicados.length) {
      this.logger.info({ quantidade: resultado.publicados.length }, 'Eventos do outbox publicados no RabbitMQ');
    }
    return { publicados: resultado.publicados.length, falhas: resultado.falhas.length };
  }

  iniciar(): void {
    this.ativo = true;
    this.agendar(this.opcoes.intervaloMs ?? 1000);
  }

  private agendar(ms: number) {
    if (!this.ativo) return;
    this.timer = setTimeout(() => void this.tick(), ms);
    this.timer.unref?.();
  }

  private async tick() {
    if (this.rodando) return;
    this.rodando = true;
    let proximo = this.opcoes.intervaloMs ?? 1000;
    try {
      const r = await this.executarCiclo();
      if (r.falhas > 0) throw new Error(this.estatisticas.ultimoErro ?? 'falha ao publicar');
      this.falhasSeguidas = 0;
      // Se o lote veio cheio, há mais pendentes: publica o próximo lote logo em seguida
      if (r.publicados >= (this.opcoes.tamanhoLote ?? 50)) proximo = 0;
    } catch (erro) {
      proximo = calcularBackoff(this.falhasSeguidas++, { baseMs: 1000, maximoMs: 15_000 });
      this.estatisticas.ultimoErro = erro instanceof Error ? erro.message : String(erro);
      this.logger.warn({ err: erro, proximaTentativaMs: proximo }, 'Falha no ciclo do outbox; nova tentativa com backoff');
    } finally {
      this.rodando = false;
      this.agendar(proximo);
    }
  }

  parar(): void {
    this.ativo = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
