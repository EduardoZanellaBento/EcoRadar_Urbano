import amqp, { type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import { calcularBackoff, esperar, type OpcoesBackoff } from './backoff.js';
import { INSTANCIA_ID } from './config.js';
import { ehErroDeBancoIndisponivel } from './erros.js';
import { EXCHANGE_DLX, EXCHANGE_EVENTOS, envelopeSchema, type EnvelopeEvento } from './eventos.js';

export type ManipuladorEvento = (evento: EnvelopeEvento, mensagem: ConsumeMessage) => Promise<void>;

interface Assinatura {
  fila: string;
  chaves: string[];
  manipulador: ManipuladorEvento;
  prefetch: number;
}

export interface OpcoesClienteAmqp {
  url: string;
  nomeServico: string;
  logger: Logger;
  backoff?: OpcoesBackoff;
  /** Tempo máximo aguardando a confirmação (publisher confirm) do broker. */
  timeoutConfirmacaoMs?: number;
}

/**
 * Cliente AMQP resiliente:
 *  - conecta em segundo plano e, se o broker cair, reconecta com backoff exponencial + jitter;
 *  - reconfigura automaticamente filas, bindings e consumidores após reconectar;
 *  - publica com "publisher confirms" (só considera publicado após o ack do broker);
 *  - mensagens que falham repetidamente vão para uma DLQ (<fila>.dlq) em vez de travar a fila.
 * O serviço continua funcionando (degradado) enquanto o broker estiver fora.
 */
export class ClienteAmqp {
  private conexao: ChannelModel | null = null;
  private canal: ConfirmChannel | null = null;
  private readonly assinaturas: Assinatura[] = [];
  private tentativa = 0;
  private encerrando = false;
  private timerReconexao: NodeJS.Timeout | null = null;
  private conectando: Promise<void> | null = null;
  private readonly ouvintes = new Set<(conectado: boolean) => void>();
  private readonly log: Logger;

  constructor(private readonly opcoes: OpcoesClienteAmqp) {
    this.log = opcoes.logger.child({ componente: 'amqp' });
  }

  get conectado(): boolean {
    return this.canal !== null;
  }

  /** Inicia a conexão sem bloquear a inicialização do serviço. */
  iniciar(): void {
    void this.conectar();
  }

  /** Aguarda a conexão (útil em testes/scripts). */
  async aguardarConexao(timeoutMs = 30_000): Promise<void> {
    const limite = Date.now() + timeoutMs;
    while (!this.conectado) {
      if (Date.now() > limite) throw new Error('Tempo esgotado aguardando conexão com o RabbitMQ');
      await esperar(200);
    }
  }

  aoMudarEstado(ouvinte: (conectado: boolean) => void): void {
    this.ouvintes.add(ouvinte);
  }

  private notificar(conectado: boolean) {
    for (const o of this.ouvintes) {
      try {
        o(conectado);
      } catch {
        /* ouvinte não deve derrubar o cliente */
      }
    }
  }

  private conectar(): Promise<void> {
    if (this.encerrando) return Promise.resolve();
    if (this.conectando) return this.conectando;
    this.conectando = (async () => {
      try {
        const conexao = await amqp.connect(this.opcoes.url, {
          timeout: 5000,
          clientProperties: { connection_name: `${this.opcoes.nomeServico}@${INSTANCIA_ID}` },
        });
        conexao.on('error', (erro: Error) => this.log.warn({ err: erro }, 'Erro na conexão AMQP'));
        conexao.on('close', () => this.aoPerderConexao('conexão encerrada pelo broker'));
        const canal = await conexao.createConfirmChannel();
        canal.on('error', (erro: Error) => this.log.warn({ err: erro }, 'Erro no canal AMQP'));
        canal.on('close', () => this.aoPerderConexao('canal encerrado'));
        await canal.assertExchange(EXCHANGE_EVENTOS, 'topic', { durable: true });
        await canal.assertExchange(EXCHANGE_DLX, 'topic', { durable: true });
        this.conexao = conexao;
        this.canal = canal;
        for (const a of this.assinaturas) await this.configurarAssinatura(canal, a);
        this.log.info({ tentativasAnteriores: this.tentativa }, 'Conectado ao RabbitMQ (AMQP)');
        this.tentativa = 0;
        this.notificar(true);
      } catch (erro) {
        this.log.warn({ err: erro, tentativa: this.tentativa + 1 }, 'Falha ao conectar ao RabbitMQ');
        this.canal = null;
        this.conexao = null;
        this.agendarReconexao();
      } finally {
        this.conectando = null;
      }
    })();
    return this.conectando;
  }

  private aoPerderConexao(motivo: string) {
    if (!this.canal && !this.conexao) return;
    const conexaoAntiga = this.conexao;
    this.canal = null;
    this.conexao = null;
    conexaoAntiga?.close().catch(() => undefined);
    this.notificar(false);
    if (!this.encerrando) {
      this.log.warn({ motivo }, 'Conexão com o RabbitMQ perdida; reconectando com backoff exponencial');
      this.agendarReconexao();
    }
  }

  private agendarReconexao() {
    if (this.encerrando || this.timerReconexao) return;
    const atrasoMs = calcularBackoff(this.tentativa, { baseMs: 1000, maximoMs: 30_000, ...this.opcoes.backoff });
    this.tentativa++;
    this.log.info({ tentativa: this.tentativa, atrasoMs }, 'Nova tentativa de conexão AMQP agendada');
    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      void this.conectar();
    }, atrasoMs);
  }

  /** Publica um evento na exchange de domínio e aguarda a confirmação do broker. */
  async publicar(evento: EnvelopeEvento): Promise<void> {
    const canal = this.canal;
    if (!canal) throw new Error('Broker indisponível: publicação adiada');
    const conteudo = Buffer.from(JSON.stringify(evento));
    const timeoutMs = this.opcoes.timeoutConfirmacaoMs ?? 5000;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado aguardando confirmação do broker')), timeoutMs);
      try {
        canal.publish(
          EXCHANGE_EVENTOS,
          evento.tipo,
          conteudo,
          {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            messageId: evento.id,
            correlationId: evento.correlationId,
            type: evento.tipo,
            appId: this.opcoes.nomeServico,
            timestamp: Math.floor(Date.now() / 1000),
            headers: { 'x-request-id': evento.correlationId, 'x-instancia': INSTANCIA_ID },
          },
          (erro: unknown) => {
            clearTimeout(timer);
            if (erro) reject(erro instanceof Error ? erro : new Error('Mensagem recusada pelo broker (nack)'));
            else resolve();
          },
        );
      } catch (erro) {
        clearTimeout(timer);
        reject(erro);
      }
    });
    this.log.debug({ eventoId: evento.id, tipo: evento.tipo, requestId: evento.correlationId }, 'Evento publicado');
  }

  /**
   * Assina uma fila durável ligada às chaves informadas (ex.: "ocorrencia.*").
   * A assinatura é refeita automaticamente a cada reconexão.
   */
  async assinar(fila: string, chaves: string[], manipulador: ManipuladorEvento, prefetch = 10): Promise<void> {
    const assinatura: Assinatura = { fila, chaves, manipulador, prefetch };
    this.assinaturas.push(assinatura);
    if (this.canal) await this.configurarAssinatura(this.canal, assinatura);
  }

  private async configurarAssinatura(canal: ConfirmChannel, a: Assinatura) {
    const dlq = `${a.fila}.dlq`;
    await canal.assertQueue(dlq, { durable: true });
    await canal.bindQueue(dlq, EXCHANGE_DLX, a.fila);
    await canal.assertQueue(a.fila, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': EXCHANGE_DLX, 'x-dead-letter-routing-key': a.fila },
    });
    for (const chave of a.chaves) await canal.bindQueue(a.fila, EXCHANGE_EVENTOS, chave);
    await canal.prefetch(a.prefetch);
    await canal.consume(a.fila, (msg) => {
      if (msg) void this.processarMensagem(canal, a, msg);
    });
    this.log.info({ fila: a.fila, chaves: a.chaves }, 'Consumidor registrado');
  }

  private async processarMensagem(canal: ConfirmChannel, a: Assinatura, msg: ConsumeMessage) {
    let evento: EnvelopeEvento;
    try {
      evento = envelopeSchema.parse(JSON.parse(msg.content.toString('utf-8')));
    } catch (erro) {
      this.log.error({ err: erro, fila: a.fila }, 'Mensagem malformada enviada para a DLQ');
      this.nackSeguro(canal, msg, false);
      return;
    }
    const contexto = { eventoId: evento.id, tipo: evento.tipo, requestId: evento.correlationId, fila: a.fila };
    try {
      await a.manipulador(evento, msg);
      canal.ack(msg);
      this.log.info(contexto, 'Evento processado');
    } catch (erro) {
      if (ehErroDeBancoIndisponivel(erro)) {
        // Falha transitória: devolve à fila após uma pausa (não descarta o evento)
        this.log.warn({ ...contexto, err: erro }, 'Banco indisponível ao processar evento; devolvendo à fila');
        await esperar(3000);
        this.nackSeguro(canal, msg, true);
        return;
      }
      const reenfileirar = !msg.fields.redelivered;
      this.log.error({ ...contexto, err: erro, reenfileirar }, 'Falha ao processar evento');
      this.nackSeguro(canal, msg, reenfileirar);
    }
  }

  private nackSeguro(canal: ConfirmChannel, msg: ConsumeMessage, reenfileirar: boolean) {
    try {
      canal.nack(msg, false, reenfileirar);
    } catch {
      /* canal já fechado: o broker reentrega a mensagem automaticamente */
    }
  }

  async fechar(): Promise<void> {
    this.encerrando = true;
    if (this.timerReconexao) clearTimeout(this.timerReconexao);
    try {
      await this.canal?.close();
    } catch {
      /* ignorado */
    }
    try {
      await this.conexao?.close();
    } catch {
      /* ignorado */
    }
    this.canal = null;
    this.conexao = null;
  }
}
