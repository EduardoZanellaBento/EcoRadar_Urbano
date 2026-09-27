import { describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import type { EnvelopeEvento } from '@ecoradar/shared';
import { PublicadorOutbox, type FonteOutbox, type LinhaOutbox, type ResultadoLote } from '../src/dominio/publicador-outbox.js';

const logger = pino({ level: 'silent' });

function evento(n: number): EnvelopeEvento {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    tipo: 'ocorrencia.criada',
    versao: 1,
    ocorridoEm: new Date().toISOString(),
    origem: 'teste',
    instancia: 'teste-1',
    correlationId: `req-${n}`,
    dados: { n },
  };
}

/** Fonte em memória que imita a tabela outbox (pendentes -> publicados). */
function fonteEmMemoria(qtd: number) {
  const pendentes: LinhaOutbox[] = Array.from({ length: qtd }, (_, i) => ({ id: `e${i + 1}`, payload: evento(i + 1) }));
  const publicados: string[] = [];
  const falhas: string[] = [];
  const fonte: FonteOutbox = {
    async processarPendentes(limite, processar) {
      const lote = pendentes.slice(0, limite);
      if (!lote.length) return { publicados: [], falhas: [] };
      const r: ResultadoLote = await processar(lote);
      for (const id of r.publicados) {
        publicados.push(id);
        pendentes.splice(pendentes.findIndex((p) => p.id === id), 1);
      }
      for (const f of r.falhas) falhas.push(f.id);
      return r;
    },
  };
  return { fonte, pendentes, publicados, falhas };
}

describe('outbox › publicador (broker simulado)', () => {
  it('publica todos os eventos pendentes em ordem e os marca como publicados', async () => {
    const { fonte, pendentes, publicados } = fonteEmMemoria(3);
    const enviados: string[] = [];
    const broker = { conectado: true, publicar: vi.fn(async (e: EnvelopeEvento) => void enviados.push(e.correlationId)) };
    const pub = new PublicadorOutbox(fonte, broker, logger, { tamanhoLote: 10 });

    const r = await pub.executarCiclo();

    expect(r).toEqual({ publicados: 3, falhas: 0 });
    expect(enviados).toEqual(['req-1', 'req-2', 'req-3']);
    expect(publicados).toEqual(['e1', 'e2', 'e3']);
    expect(pendentes).toHaveLength(0);
    expect(pub.estatisticas.publicados).toBe(3);
  });

  it('não tenta publicar enquanto o broker está desconectado (eventos ficam guardados)', async () => {
    const { fonte, pendentes } = fonteEmMemoria(2);
    const broker = { conectado: false, publicar: vi.fn() };
    const pub = new PublicadorOutbox(fonte, broker, logger);

    expect(await pub.executarCiclo()).toEqual({ publicados: 0, falhas: 0 });
    expect(broker.publicar).not.toHaveBeenCalled();
    expect(pendentes).toHaveLength(2);
  });

  it('interrompe o lote na primeira falha para preservar a ordem e publica o restante depois', async () => {
    const { fonte, pendentes, publicados } = fonteEmMemoria(3);
    let falhar = true;
    const broker = {
      conectado: true,
      publicar: vi.fn(async (e: EnvelopeEvento) => {
        if (e.correlationId === 'req-2' && falhar) throw new Error('canal fechado');
      }),
    };
    const pub = new PublicadorOutbox(fonte, broker, logger);

    const primeiro = await pub.executarCiclo();
    expect(primeiro).toEqual({ publicados: 1, falhas: 1 });
    expect(publicados).toEqual(['e1']);
    expect(pendentes.map((p) => p.id)).toEqual(['e2', 'e3']);
    expect(pub.estatisticas.ultimoErro).toBe('canal fechado');

    // broker volta ao normal: consistência eventual
    falhar = false;
    const segundo = await pub.executarCiclo();
    expect(segundo).toEqual({ publicados: 2, falhas: 0 });
    expect(publicados).toEqual(['e1', 'e2', 'e3']);
  });

  it('respeita o tamanho do lote', async () => {
    const { fonte, pendentes } = fonteEmMemoria(5);
    const broker = { conectado: true, publicar: vi.fn(async () => undefined) };
    const pub = new PublicadorOutbox(fonte, broker, logger, { tamanhoLote: 2 });

    expect((await pub.executarCiclo()).publicados).toBe(2);
    expect(pendentes).toHaveLength(3);
  });

  it('roda periodicamente com iniciar()/parar()', async () => {
    vi.useFakeTimers();
    try {
      const { fonte, pendentes } = fonteEmMemoria(1);
      const broker = { conectado: true, publicar: vi.fn(async () => undefined) };
      const pub = new PublicadorOutbox(fonte, broker, logger, { intervaloMs: 100 });
      pub.iniciar();
      await vi.advanceTimersByTimeAsync(150);
      expect(pendentes).toHaveLength(0);
      pub.parar();
    } finally {
      vi.useRealTimers();
    }
  });
});
