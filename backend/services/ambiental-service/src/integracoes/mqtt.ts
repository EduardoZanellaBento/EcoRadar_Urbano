import mqtt, { type MqttClient } from 'mqtt';
import type { Logger } from 'pino';
import { INSTANCIA_ID, calcularBackoff } from '@ecoradar/shared';

export interface OpcoesAssinante {
  url: string;
  usuario: string;
  senha: string;
  topico: string;
  logger: Logger;
  aoReceber: (topico: string, conteudo: Buffer) => Promise<void>;
}

/**
 * Assinante MQTT (plugin MQTT do RabbitMQ) com sessão persistente (clean=false, QoS 1):
 * leituras publicadas enquanto o serviço estiver fora ficam na fila e são entregues
 * depois. A reconexão usa backoff exponencial (e não o intervalo fixo padrão da lib).
 */
export class AssinanteMqtt {
  private cliente: MqttClient | null = null;
  private tentativa = 0;
  private timer: NodeJS.Timeout | null = null;
  private encerrando = false;
  readonly estatisticas = { mensagensRecebidas: 0, mensagensInvalidas: 0, ultimaMensagemEm: null as string | null };
  private readonly log: Logger;

  constructor(private readonly opcoes: OpcoesAssinante) {
    this.log = opcoes.logger.child({ componente: 'mqtt' });
  }

  get conectado(): boolean {
    return Boolean(this.cliente?.connected);
  }

  iniciar(): void {
    this.cliente = mqtt.connect(this.opcoes.url, {
      username: this.opcoes.usuario,
      password: this.opcoes.senha,
      clientId: `ambiental-service-${INSTANCIA_ID}`,
      clean: false,
      reconnectPeriod: 0, // reconexão controlada manualmente (backoff exponencial)
      connectTimeout: 5000,
      keepalive: 30,
      protocolVersion: 4,
    });
    this.cliente.on('connect', () => {
      this.log.info({ tentativasAnteriores: this.tentativa }, 'Conectado ao broker MQTT');
      this.tentativa = 0;
      this.cliente?.subscribe(this.opcoes.topico, { qos: 1 }, (erro) => {
        if (erro) this.log.error({ err: erro }, 'Falha ao assinar tópico MQTT');
        else this.log.info({ topico: this.opcoes.topico }, 'Tópico MQTT assinado');
      });
    });
    this.cliente.on('message', (topico, conteudo) => {
      this.estatisticas.mensagensRecebidas++;
      this.estatisticas.ultimaMensagemEm = new Date().toISOString();
      this.opcoes.aoReceber(topico, conteudo).catch((erro) => {
        this.estatisticas.mensagensInvalidas++;
        this.log.warn({ err: erro, topico }, 'Falha ao processar mensagem MQTT');
      });
    });
    this.cliente.on('error', (erro) => this.log.warn({ err: erro }, 'Erro no cliente MQTT'));
    this.cliente.on('close', () => this.agendarReconexao());
  }

  private agendarReconexao() {
    if (this.encerrando || this.timer) return;
    const atrasoMs = calcularBackoff(this.tentativa++, { baseMs: 1000, maximoMs: 30_000 });
    this.log.warn({ tentativa: this.tentativa, atrasoMs }, 'Conexão MQTT perdida; reconectando com backoff exponencial');
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.encerrando) this.cliente?.reconnect();
    }, atrasoMs);
  }

  async fechar(): Promise<void> {
    this.encerrando = true;
    if (this.timer) clearTimeout(this.timer);
    await new Promise<void>((resolve) => (this.cliente ? this.cliente.end(false, {}, () => resolve()) : resolve()));
  }
}
