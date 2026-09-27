import { describe, expect, it } from 'vitest';
import {
  criarOcorrenciaSchema,
  decidirIdempotencia,
  detectarTipoImagem,
  filtrosListagemSchema,
  paraSnapshot,
  podeConfirmar,
  validarTransicao,
} from '../src/dominio/regras.js';

const CHAVE = '3f1c2b1e-8a4d-4f7a-9d1e-2b3c4d5e6f70';

describe('ocorrencias › idempotência', () => {
  it('cria quando a chave nunca foi usada', () => {
    expect(decidirIdempotencia(undefined, 'u1')).toEqual({ tipo: 'NOVA' });
  });

  it('devolve o registro original quando o MESMO usuário reenvia (modo offline)', () => {
    expect(decidirIdempotencia({ id: 'oc-1', usuarioId: 'u1' }, 'u1')).toEqual({ tipo: 'REPETIDA', ocorrenciaId: 'oc-1' });
  });

  it('acusa conflito quando OUTRO usuário tenta reaproveitar a chave', () => {
    expect(decidirIdempotencia({ id: 'oc-1', usuarioId: 'u1' }, 'u2')).toEqual({ tipo: 'CONFLITO' });
  });
});

describe('ocorrencias › validação da criação (Zod)', () => {
  const base = {
    categoria: 'ALAGAMENTO',
    severidade: 'ALTA',
    descricao: 'Rua completamente alagada',
    latitude: '-23.55',
    longitude: '-46.63',
    idempotencyKey: CHAVE,
  };

  it('aceita campos vindos do multipart (números como texto)', () => {
    const r = criarOcorrenciaSchema.parse(base);
    expect(r.latitude).toBe(-23.55);
    expect(r.longitude).toBe(-46.63);
  });

  it('exige geolocalização e idempotencyKey válidos', () => {
    const r = criarOcorrenciaSchema.safeParse({ ...base, latitude: '200', idempotencyKey: 'abc' });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path.join('.'));
    expect(campos).toEqual(expect.arrayContaining(['latitude', 'idempotencyKey']));
  });

  it('rejeita categoria desconhecida e descrição curta', () => {
    const r = criarOcorrenciaSchema.safeParse({ ...base, categoria: 'TERREMOTO', descricao: 'oi' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['categoria', 'descricao']));
  });
});

describe('ocorrencias › filtros de listagem', () => {
  it('converte listas separadas por vírgula e aplica padrões', () => {
    const f = filtrosListagemSchema.parse({ categoria: 'ALAGAMENTO,QUEIMADA', status: 'ABERTA' });
    expect(f.categoria).toEqual(['ALAGAMENTO', 'QUEIMADA']);
    expect(f.status).toEqual(['ABERTA']);
    expect(f.pagina).toBe(1);
    expect(f.tamanhoPagina).toBe(20);
    expect(f.ordenacao).toBe('recentes');
  });

  it('exige lat/lon para filtrar por raio ou ordenar por distância', () => {
    expect(filtrosListagemSchema.safeParse({ raioKm: '2' }).success).toBe(false);
    expect(filtrosListagemSchema.safeParse({ ordenacao: 'distancia' }).success).toBe(false);
    expect(filtrosListagemSchema.safeParse({ raioKm: '2', lat: '-23.5', lon: '-46.6' }).success).toBe(true);
  });

  it('rejeita valores de enum inválidos e período invertido', () => {
    expect(filtrosListagemSchema.safeParse({ categoria: 'ALAGAMENTO,XYZ' }).success).toBe(false);
    expect(filtrosListagemSchema.safeParse({ desde: '2026-09-10', ate: '2026-09-01' }).success).toBe(false);
  });

  it('interpreta booleanos de texto', () => {
    const f = filtrosListagemSchema.parse({ emManancial: 'true', minhas: 'false' });
    expect(f.emManancial).toBe(true);
    expect(f.minhas).toBe(false);
  });
});

describe('ocorrencias › fluxo de status', () => {
  it('permite transições válidas', () => {
    expect(validarTransicao('ABERTA', 'EM_ANALISE')).toEqual({ ok: true });
    expect(validarTransicao('EM_ANALISE', 'RESOLVIDA')).toEqual({ ok: true });
    expect(validarTransicao('RESOLVIDA', 'ABERTA')).toEqual({ ok: true });
  });

  it('bloqueia status inalterado e transições inválidas', () => {
    expect(validarTransicao('ABERTA', 'ABERTA')).toMatchObject({ ok: false, codigo: 'STATUS_INALTERADO' });
    expect(validarTransicao('RESOLVIDA', 'DESCARTADA')).toMatchObject({ ok: false, codigo: 'TRANSICAO_INVALIDA' });
  });
});

describe('ocorrencias › confirmação colaborativa', () => {
  it('não permite confirmar a própria ocorrência', () => {
    expect(podeConfirmar({ usuarioId: 'u1', status: 'ABERTA' }, 'u1')).toMatchObject({ ok: false, codigo: 'NAO_PODE_CONFIRMAR_PROPRIA' });
  });

  it('não permite confirmar ocorrência encerrada', () => {
    expect(podeConfirmar({ usuarioId: 'u1', status: 'RESOLVIDA' }, 'u2')).toMatchObject({ ok: false, codigo: 'OCORRENCIA_ENCERRADA' });
  });

  it('permite que outro cidadão confirme ocorrência em andamento', () => {
    expect(podeConfirmar({ usuarioId: 'u1', status: 'EM_ANALISE' }, 'u2')).toEqual({ ok: true });
  });
});

describe('ocorrencias › detecção do tipo real da foto', () => {
  it('reconhece JPEG, PNG e WebP pelos magic bytes', () => {
    expect(detectarTipoImagem(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))?.extensao).toBe('jpg');
    expect(detectarTipoImagem(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))?.extensao).toBe('png');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
    expect(detectarTipoImagem(webp)?.extensao).toBe('webp');
  });

  it('rejeita arquivos que não são imagem (ex.: PDF renomeado)', () => {
    expect(detectarTipoImagem(Buffer.from('%PDF-1.7 conteúdo'))).toBeNull();
    expect(detectarTipoImagem(Buffer.alloc(0))).toBeNull();
  });
});

describe('ocorrencias › snapshot do evento', () => {
  it('serializa datas em ISO e mantém a versão', () => {
    const agora = new Date('2026-09-27T12:00:00Z');
    const s = paraSnapshot({
      id: 'id-1',
      categoria: 'QUEIMADA',
      severidade: 'CRITICA',
      status: 'ABERTA',
      descricao: 'Fogo em terreno baldio',
      latitude: -23.5,
      longitude: -46.6,
      bairro: 'Sé',
      emAreaDeManancial: false,
      manancialNome: null,
      confirmacoes: 2,
      fotoUrl: null,
      usuarioId: 'u1',
      usuarioNome: 'Ana',
      criadoEm: agora,
      atualizadoEm: agora,
      resolvidoEm: null,
      versao: 3,
    });
    expect(s.criadoEm).toBe('2026-09-27T12:00:00.000Z');
    expect(s.resolvidoEm).toBeNull();
    expect(s.versao).toBe(3);
  });
});
