import { describe, expect, it, vi } from 'vitest';
import {
  CacheTTL,
  ErroAplicacao,
  Erros,
  bairroMaisProximo,
  calcularBackoff,
  comRetry,
  criarEvento,
  distanciaKm,
  ehErroDeBancoIndisponivel,
  ehViolacaoDeUnicidade,
  envelopeSchema,
  pontoNoPoligono,
} from '../src/index.js';

describe('shared › backoff exponencial', () => {
  it('dobra o atraso a cada tentativa, sem jitter', () => {
    const op = { baseMs: 500, fator: 2, maximoMs: 30_000, jitter: 0 };
    expect([0, 1, 2, 3, 4].map((t) => calcularBackoff(t, op))).toEqual([500, 1000, 2000, 4000, 8000]);
  });

  it('respeita o atraso máximo', () => {
    expect(calcularBackoff(20, { baseMs: 1000, maximoMs: 30_000, jitter: 0 })).toBe(30_000);
  });

  it('aplica jitter dentro da faixa configurada', () => {
    const op = { baseMs: 1000, jitter: 0.2 };
    expect(calcularBackoff(0, op, () => 0)).toBe(800);
    expect(calcularBackoff(0, op, () => 1)).toBe(1200);
    expect(calcularBackoff(0, op, () => 0.5)).toBe(1000);
  });

  it('comRetry tenta de novo até ter sucesso', async () => {
    let chamadas = 0;
    const dormir = vi.fn(async () => undefined);
    const r = await comRetry(
      async () => {
        chamadas++;
        if (chamadas < 3) throw new Error('falha transitória');
        return 'ok';
      },
      { tentativas: 5, dormir, jitter: 0, baseMs: 10 },
    );
    expect(r).toBe('ok');
    expect(chamadas).toBe(3);
    expect(dormir).toHaveBeenNthCalledWith(1, 10);
    expect(dormir).toHaveBeenNthCalledWith(2, 20);
  });

  it('comRetry desiste após o limite e propaga o último erro', async () => {
    const aoFalhar = vi.fn();
    await expect(
      comRetry(async () => Promise.reject(new Error('sempre falha')), { tentativas: 3, dormir: async () => undefined, aoFalhar }),
    ).rejects.toThrow('sempre falha');
    expect(aoFalhar).toHaveBeenCalledTimes(2);
  });

  it('comRetry não repete erros não transitórios', async () => {
    let chamadas = 0;
    await expect(
      comRetry(
        async () => {
          chamadas++;
          throw new Error('dados inválidos');
        },
        { tentativas: 5, deveTentarNovamente: () => false, dormir: async () => undefined },
      ),
    ).rejects.toThrow();
    expect(chamadas).toBe(1);
  });
});

describe('shared › cache com TTL', () => {
  it('expira após o TTL, mas mantém o último valor para degradação graciosa', () => {
    let agora = 0;
    const cache = new CacheTTL<string>(1000, () => agora);
    cache.definir('x', 'valor');
    expect(cache.obterValido('x')?.valor).toBe('valor');
    agora = 1500;
    expect(cache.obterValido('x')).toBeUndefined();
    expect(cache.obterUltimo('x')?.valor).toBe('valor');
    expect(cache.idadeMs('x')).toBe(1500);
  });

  it('expirar() força nova busca sem perder o valor', () => {
    let agora = 100;
    const cache = new CacheTTL<number>(1000, () => agora);
    cache.definir('k', 42);
    cache.expirar('k');
    expect(cache.obterValido('k')).toBeUndefined();
    expect(cache.obterUltimo('k')?.valor).toBe(42);
    agora = 200;
    expect(cache.obterUltimo('inexistente')).toBeUndefined();
  });
});

describe('shared › geografia', () => {
  it('calcula distância Sé–Pinheiros (~7 km) pela fórmula de Haversine', () => {
    const d = distanciaKm({ latitude: -23.5503, longitude: -46.6339 }, { latitude: -23.5675, longitude: -46.7019 });
    expect(d).toBeGreaterThan(6.5);
    expect(d).toBeLessThan(7.5);
  });

  it('ponto em polígono (ray casting)', () => {
    const quadrado: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    expect(pontoNoPoligono({ longitude: 5, latitude: 5 }, quadrado)).toBe(true);
    expect(pontoNoPoligono({ longitude: 15, latitude: 5 }, quadrado)).toBe(false);
  });

  it('identifica o bairro mais próximo (ou nenhum, se estiver longe)', () => {
    expect(bairroMaisProximo(-23.5505, -46.6333)).toBe('Sé');
    expect(bairroMaisProximo(-10, -40)).toBeNull();
  });
});

describe('shared › erros e eventos', () => {
  it('fábrica de erros produz status e códigos padronizados', () => {
    const e = Erros.naoEncontrado('Ocorrência');
    expect(e).toBeInstanceOf(ErroAplicacao);
    expect(e.status).toBe(404);
    expect(e.message).toBe('Ocorrência não encontrado(a).');
    expect(Erros.arquivoGrande(5).status).toBe(413);
    expect(Erros.validacao('x').codigo).toBe('VALIDACAO');
  });

  it('reconhece erros de banco indisponível e de unicidade', () => {
    expect(ehErroDeBancoIndisponivel({ code: 'ECONNREFUSED' })).toBe(true);
    expect(ehErroDeBancoIndisponivel({ message: 'Connection terminated unexpectedly' })).toBe(true);
    expect(ehErroDeBancoIndisponivel({ cause: { code: '57P01' } })).toBe(true);
    expect(ehErroDeBancoIndisponivel(new Error('outro'))).toBe(false);
    expect(ehErroDeBancoIndisponivel(null)).toBe(false);
    expect(ehViolacaoDeUnicidade({ code: '23505' })).toBe(true);
    expect(ehViolacaoDeUnicidade({ cause: { code: '23505' } })).toBe(true);
    expect(ehViolacaoDeUnicidade({ code: '23503' })).toBe(false);
  });

  it('cria envelope de evento válido com correlationId propagado', () => {
    const ev = criarEvento('ocorrencia.criada', { a: 1 }, { origem: 'teste', correlationId: 'req-123' });
    expect(envelopeSchema.parse(ev)).toBeTruthy();
    expect(ev.correlationId).toBe('req-123');
    expect(criarEvento('alerta.criado', {}, { origem: 'teste' }).correlationId).toMatch(/[0-9a-f-]{36}/);
  });
});
