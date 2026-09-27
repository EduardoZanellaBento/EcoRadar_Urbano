import type { Logger } from 'pino';
import { criarEvento, type ClienteAmqp, type DefinicaoEstacao } from '@ecoradar/shared';
import { avaliarLeitura } from './dominio/avaliacao.js';
import { JanelaMovel, LimitadorEventos } from './dominio/indicadores.js';
import { leituraSensorSchema } from './dominio/leitura.js';
import type { Db } from './repositorio.js';
import { leituras } from './db/schema.js';

/**
 * Processa cada mensagem MQTT: valida, suaviza (média móvel), calcula o IQAr (CETESB),
 * detecta inversão térmica e nível crítico do córrego, grava a série temporal e publica
 * os eventos de domínio no RabbitMQ (AMQP).
 */
export class ProcessadorLeituras {
  private readonly janela = new JanelaMovel(12); // ~1 minuto de leituras a cada 5 s
  private readonly limitador = new LimitadorEventos(60_000);
  readonly estatisticas = { processadas: 0, descartadas: 0, eventosPublicados: 0, eventosDescartados: 0 };

  constructor(
    private readonly deps: {
      db: Db;
      amqp: ClienteAmqp;
      logger: Logger;
      estacoes: Map<string, DefinicaoEstacao>;
    },
  ) {}

  async processar(_topico: string, conteudo: Buffer): Promise<void> {
    const { db, amqp, logger, estacoes } = this.deps;
    let json: unknown;
    try {
      json = JSON.parse(conteudo.toString('utf-8'));
    } catch {
      this.estatisticas.descartadas++;
      logger.warn('Leitura MQTT descartada: JSON inválido');
      return;
    }
    const validacao = leituraSensorSchema.safeParse(json);
    if (!validacao.success) {
      this.estatisticas.descartadas++;
      logger.warn({ problemas: validacao.error.issues.slice(0, 3) }, 'Leitura MQTT descartada: formato inválido');
      return;
    }
    const l = validacao.data;
    const estacao = estacoes.get(l.estacaoId);
    if (!estacao) {
      this.estatisticas.descartadas++;
      logger.warn({ estacaoId: l.estacaoId }, 'Leitura de estação desconhecida descartada');
      return;
    }

    const k = (p: string) => `${estacao.id}:${p}`;
    const medias = {
      pm25: this.janela.adicionar(k('pm25'), l.pm25),
      pm10: this.janela.adicionar(k('pm10'), l.pm10),
      o3: this.janela.adicionar(k('o3'), l.o3),
      no2: this.janela.adicionar(k('no2'), l.no2),
      co: this.janela.adicionar(k('co'), l.co),
    };
    const avaliacao = avaliarLeitura(estacao, medias, {
      nivelCorregoCm: l.nivel_corrego_cm,
      tempSuperficie: l.temp_superficie,
      temp300m: l.temp_300m,
      medidoEm: l.medidoEm,
    });

    await db.insert(leituras).values({
      estacaoId: estacao.id,
      medidoEm: new Date(l.medidoEm),
      pm25: l.pm25 ?? null,
      pm10: l.pm10 ?? null,
      o3: l.o3 ?? null,
      no2: l.no2 ?? null,
      co: l.co ?? null,
      temperatura: l.temperatura ?? null,
      umidade: l.umidade ?? null,
      nivelCorregoCm: l.nivel_corrego_cm ?? null,
      tempSuperficie: l.temp_superficie ?? null,
      temp300m: l.temp_300m ?? null,
      iqar: avaliacao.iqar?.indice ?? null,
      iqarClasse: avaliacao.iqar?.classe ?? null,
      poluenteDominante: avaliacao.iqar?.poluenteDominante ?? null,
      inversao: avaliacao.inversao.inversao,
      cenario: l.cenario ?? null,
    });
    this.estatisticas.processadas++;

    for (const chave of avaliacao.normalizadas) this.limitador.liberar(chave);
    for (const ev of avaliacao.eventos) {
      if (!this.limitador.permitir(ev.chave)) continue;
      const evento = criarEvento(ev.tipo, ev.dados, { origem: 'ambiental-service', correlationId: l.correlationId });
      try {
        await amqp.publicar(evento);
        this.estatisticas.eventosPublicados++;
        logger.info({ requestId: evento.correlationId, tipo: ev.tipo, estacaoId: estacao.id }, 'Evento ambiental publicado');
      } catch (erro) {
        // Eventos ambientais são sinais periódicos: se o broker estiver fora, a próxima
        // leitura com a mesma condição gera o evento novamente.
        this.limitador.liberar(ev.chave);
        this.estatisticas.eventosDescartados++;
        logger.warn({ err: erro, tipo: ev.tipo }, 'Broker indisponível: evento ambiental será reenviado na próxima leitura');
      }
    }
  }
}
