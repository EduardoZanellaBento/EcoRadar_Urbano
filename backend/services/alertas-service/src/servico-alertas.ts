import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from 'pino';
import type { Server as ServidorSocket } from 'socket.io';
import {
  TIPOS_EVENTO,
  criarEvento,
  dadosOcorrenciaEventoSchema,
  type ClienteAmqp,
  type EnvelopeEvento,
  type SnapshotAlerta,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { alertas, eventosProcessados, ocorrenciasRecentes } from './db/schema.js';
import { avaliarEvento, ehDuplicado, PARAMETROS } from './dominio/motor-regras.js';

export type Db = NodePgDatabase<typeof schema>;
type LinhaAlerta = typeof alertas.$inferSelect;

export function paraSnapshotAlerta(a: LinhaAlerta) {
  const snapshot = {
    id: a.id,
    tipo: a.tipo,
    severidade: a.severidade,
    titulo: a.titulo,
    mensagem: a.mensagem,
    latitude: a.latitude,
    longitude: a.longitude,
    raioKm: a.raioKm,
    status: a.status,
    categoria: a.categoria,
    origem: a.origem,
    referenciaId: a.referenciaId,
    criadoEm: a.criadoEm.toISOString(),
    encerradoEm: a.encerradoEm ? a.encerradoEm.toISOString() : null,
    encerradoPor: a.encerradoPor,
    comentarioEncerramento: a.comentarioEncerramento,
  };
  return snapshot satisfies SnapshotAlerta;
}

/**
 * Consome eventos de ocorrências e ambientais, aplica o motor de regras, persiste os
 * alertas e os transmite em tempo real (Socket.IO). O consumo é idempotente: o id de cada
 * evento é registrado (inbox) na mesma transação dos alertas — reentregas são ignoradas.
 */
export class ServicoAlertas {
  readonly estatisticas = { eventosProcessados: 0, eventosDuplicadosIgnorados: 0, alertasCriados: 0, alertasDeduplicados: 0 };

  constructor(
    private readonly db: Db,
    private readonly io: ServidorSocket,
    private readonly amqp: ClienteAmqp,
    private readonly logger: Logger,
  ) {}

  async processarEvento(evento: EnvelopeEvento): Promise<void> {
    const log = this.logger.child({ requestId: evento.correlationId, eventoId: evento.id, tipo: evento.tipo });
    const agora = new Date();

    const resultado = await this.db.transaction(async (tx) => {
      const registrado = await tx
        .insert(eventosProcessados)
        .values({ eventoId: evento.id, tipo: evento.tipo })
        .onConflictDoNothing()
        .returning({ id: eventosProcessados.eventoId });
      if (!registrado.length) return { duplicado: true as const };

      let ocorrencia: ReturnType<typeof dadosOcorrenciaEventoSchema.parse>['ocorrencia'] | null = null;
      if (evento.tipo.startsWith('ocorrencia.')) {
        ocorrencia = dadosOcorrenciaEventoSchema.parse(evento.dados).ocorrencia;
        const valores = {
          categoria: ocorrencia.categoria,
          status: ocorrencia.status,
          latitude: ocorrencia.latitude,
          longitude: ocorrencia.longitude,
          criadoEm: new Date(ocorrencia.criadoEm),
          versao: ocorrencia.versao,
        };
        await tx
          .insert(ocorrenciasRecentes)
          .values({ id: ocorrencia.id, ...valores })
          .onConflictDoUpdate({ target: ocorrenciasRecentes.id, set: valores, setWhere: sql`${ocorrenciasRecentes.versao} < ${ocorrencia.versao}` });
      }

      // Contexto da regra de concentração: mesma categoria, janela de ±2 h
      const recentes = ocorrencia
        ? await tx
            .select()
            .from(ocorrenciasRecentes)
            .where(
              and(
                eq(ocorrenciasRecentes.categoria, ocorrencia.categoria),
                gte(ocorrenciasRecentes.criadoEm, new Date(new Date(ocorrencia.criadoEm).getTime() - 2 * 3_600_000)),
                sql`${ocorrenciasRecentes.status} IN ('ABERTA', 'EM_ANALISE')`,
              ),
            )
        : [];

      const candidatos = avaliarEvento(evento, { agora, ocorrenciasRecentes: recentes });
      const criados: LinhaAlerta[] = [];
      for (const c of candidatos) {
        const existentes = await tx
          .select()
          .from(alertas)
          .where(and(eq(alertas.tipo, c.tipo), gte(alertas.criadoEm, new Date(agora.getTime() - PARAMETROS.deduplicacaoJanelaMin * 60_000))));
        if (ehDuplicado(c, existentes, agora)) {
          this.estatisticas.alertasDeduplicados++;
          log.info({ tipoAlerta: c.tipo, area: c.chaveArea }, 'Alerta suprimido (duplicado na janela de 30 min)');
          continue;
        }
        const [novo] = await tx
          .insert(alertas)
          .values({ ...c, correlationId: evento.correlationId })
          .returning();
        criados.push(novo);
      }
      return { duplicado: false as const, criados, ocorrencia };
    });

    if (resultado.duplicado) {
      this.estatisticas.eventosDuplicadosIgnorados++;
      log.info('Evento já processado anteriormente (reentrega ignorada)');
      return;
    }
    this.estatisticas.eventosProcessados++;

    // Depois do commit: notifica os apps conectados e publica os eventos de alerta
    if (resultado.ocorrencia) {
      const nomeEvento = evento.tipo === TIPOS_EVENTO.OCORRENCIA_CRIADA ? 'ocorrencia:nova' : 'ocorrencia:atualizada';
      this.io.emit(nomeEvento, resultado.ocorrencia);
    }
    for (const a of resultado.criados) {
      const snapshot = paraSnapshotAlerta(a);
      this.estatisticas.alertasCriados++;
      this.io.emit('alerta:novo', snapshot);
      log.warn({ alertaId: a.id, tipoAlerta: a.tipo, severidade: a.severidade }, 'Novo alerta emitido em tempo real');
      await this.publicarSemFalhar(criarEvento(TIPOS_EVENTO.ALERTA_CRIADO, snapshot, { origem: 'alertas-service', correlationId: evento.correlationId }));
    }
  }

  async encerrar(id: string, usuario: { sub: string; nome: string }, comentario: string | undefined, requestId: string) {
    const [a] = await this.db
      .update(alertas)
      .set({ status: 'ENCERRADO', encerradoEm: new Date(), encerradoPor: usuario.nome, comentarioEncerramento: comentario ?? null })
      .where(and(eq(alertas.id, id), eq(alertas.status, 'ATIVO')))
      .returning();
    if (!a) return null;
    const snapshot = paraSnapshotAlerta(a);
    this.io.emit('alerta:encerrado', snapshot);
    await this.publicarSemFalhar(criarEvento(TIPOS_EVENTO.ALERTA_ENCERRADO, snapshot, { origem: 'alertas-service', correlationId: requestId }));
    return snapshot;
  }

  /** Encerra automaticamente alertas ativos há mais de 12 horas. */
  async expirarAntigos(): Promise<number> {
    const limite = new Date(Date.now() - 12 * 3_600_000);
    const expirados = await this.db
      .update(alertas)
      .set({ status: 'ENCERRADO', encerradoEm: new Date(), encerradoPor: 'sistema', comentarioEncerramento: 'Encerrado automaticamente após 12 h.' })
      .where(and(eq(alertas.status, 'ATIVO'), lt(alertas.criadoEm, limite)))
      .returning();
    for (const a of expirados) this.io.emit('alerta:encerrado', paraSnapshotAlerta(a));
    await this.db.delete(ocorrenciasRecentes).where(lt(ocorrenciasRecentes.criadoEm, new Date(Date.now() - 48 * 3_600_000)));
    await this.db.delete(eventosProcessados).where(lt(eventosProcessados.processadoEm, new Date(Date.now() - 7 * 86_400_000)));
    return expirados.length;
  }

  private async publicarSemFalhar(evento: EnvelopeEvento) {
    try {
      await this.amqp.publicar(evento);
    } catch (erro) {
      this.logger.warn({ err: erro, tipo: evento.tipo }, 'Não foi possível publicar evento de alerta (broker indisponível)');
    }
  }

  async listar(filtro: { status: 'ATIVO' | 'ENCERRADO' | 'TODOS'; tipo?: string; pagina: number; tamanhoPagina: number }) {
    const condicoes = [];
    if (filtro.status !== 'TODOS') condicoes.push(eq(alertas.status, filtro.status));
    if (filtro.tipo) condicoes.push(eq(alertas.tipo, filtro.tipo as LinhaAlerta['tipo']));
    const where = condicoes.length ? and(...condicoes) : undefined;
    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(alertas).where(where);
    const linhas = await this.db
      .select()
      .from(alertas)
      .where(where)
      .orderBy(desc(alertas.criadoEm))
      .limit(filtro.tamanhoPagina)
      .offset((filtro.pagina - 1) * filtro.tamanhoPagina);
    return { itens: linhas.map(paraSnapshotAlerta), total, pagina: filtro.pagina, tamanhoPagina: filtro.tamanhoPagina };
  }

  async buscar(id: string) {
    const [a] = await this.db.select().from(alertas).where(eq(alertas.id, id)).limit(1);
    return a ? paraSnapshotAlerta(a) : null;
  }

  async contarAtivos(): Promise<number> {
    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(alertas).where(eq(alertas.status, 'ATIVO'));
    return total;
  }
}
