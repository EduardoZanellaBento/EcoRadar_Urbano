import { z } from 'zod';
import {
  CATEGORIAS,
  SEVERIDADES,
  STATUS_OCORRENCIA,
  type SnapshotOcorrencia,
  type StatusOcorrencia,
} from '@ecoradar/shared';

// ----- Validação da criação -------------------------------------------------------

/** Campos aceitos na criação (multipart ou JSON — números chegam como texto no multipart). */
export const criarOcorrenciaSchema = z.object({
  categoria: z.enum(CATEGORIAS, { message: 'Categoria inválida.' }),
  severidade: z.enum(SEVERIDADES, { message: 'Severidade inválida.' }),
  descricao: z
    .string()
    .trim()
    .min(5, { message: 'Descreva a ocorrência com pelo menos 5 caracteres.' })
    .max(1000, { message: 'A descrição deve ter no máximo 1000 caracteres.' }),
  latitude: z.coerce
    .number({ message: 'Latitude obrigatória.' })
    .min(-90, { message: 'Latitude inválida.' })
    .max(90, { message: 'Latitude inválida.' }),
  longitude: z.coerce
    .number({ message: 'Longitude obrigatória.' })
    .min(-180, { message: 'Longitude inválida.' })
    .max(180, { message: 'Longitude inválida.' }),
  idempotencyKey: z.string().uuid({ message: 'idempotencyKey deve ser um UUID v4.' }),
  bairro: z.string().trim().max(80).optional().nullable(),
  /** Arquivo da foto (Buffer) quando enviado via multipart. */
  foto: z.any().optional(),
});
export type DadosCriacao = z.infer<typeof criarOcorrenciaSchema>;

export const alterarStatusSchema = z.object({
  status: z.enum(STATUS_OCORRENCIA, { message: 'Status inválido.' }),
  comentario: z
    .string()
    .trim()
    .min(3, { message: 'O comentário é obrigatório (mínimo de 3 caracteres).' })
    .max(500),
});

/** Converte "A,B" (ou array) em lista validada de valores de um enum. */
export function listaDeEnum<T extends string>(valores: readonly T[]) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      const itens = (Array.isArray(v) ? v : v.split(','))
        .map((s) => s.trim())
        .filter(Boolean);
      const invalidos = itens.filter((i) => !valores.includes(i as T));
      if (invalidos.length) {
        ctx.addIssue({ code: 'custom', message: `Valor(es) inválido(s): ${invalidos.join(', ')}` });
        return z.NEVER;
      }
      return itens as T[];
    });
}

export const ORDENACOES = ['recentes', 'antigas', 'severidade', 'confirmacoes', 'distancia'] as const;

export const filtrosListagemSchema = z
  .object({
    categoria: listaDeEnum(CATEGORIAS),
    status: listaDeEnum(STATUS_OCORRENCIA),
    severidade: listaDeEnum(SEVERIDADES),
    desde: z.coerce.date().optional(),
    ate: z.coerce.date().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    raioKm: z.coerce.number().positive().max(100).optional(),
    busca: z.string().trim().max(100).optional(),
    emManancial: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    minhas: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    ordenacao: z.enum(ORDENACOES).default('recentes'),
    pagina: z.coerce.number().int().min(1).default(1),
    tamanhoPagina: z.coerce.number().int().min(1).max(500).default(20),
  })
  .superRefine((f, ctx) => {
    const temPonto = f.lat !== undefined && f.lon !== undefined;
    if (f.raioKm !== undefined && !temPonto) {
      ctx.addIssue({ code: 'custom', path: ['raioKm'], message: 'Para filtrar por raio, informe lat e lon.' });
    }
    if (f.ordenacao === 'distancia' && !temPonto) {
      ctx.addIssue({ code: 'custom', path: ['ordenacao'], message: 'Ordenar por distância exige lat e lon.' });
    }
    if (f.desde && f.ate && f.desde > f.ate) {
      ctx.addIssue({ code: 'custom', path: ['desde'], message: 'A data inicial deve ser anterior à final.' });
    }
  });
export type FiltrosListagem = z.infer<typeof filtrosListagemSchema>;

// ----- Idempotência ---------------------------------------------------------------

export type DecisaoIdempotencia =
  | { tipo: 'NOVA' }
  | { tipo: 'REPETIDA'; ocorrenciaId: string }
  | { tipo: 'CONFLITO' };

/**
 * Decide o que fazer com uma requisição de criação a partir do registro que já usa a
 * mesma idempotencyKey (se houver):
 *  - nenhum registro -> criar (201);
 *  - registro do MESMO usuário -> é um reenvio: devolver o original (200), sem duplicar;
 *  - registro de OUTRO usuário -> conflito (409), a chave não pode ser reaproveitada.
 */
export function decidirIdempotencia(
  existente: { id: string; usuarioId: string } | undefined,
  usuarioId: string,
): DecisaoIdempotencia {
  if (!existente) return { tipo: 'NOVA' };
  if (existente.usuarioId === usuarioId) return { tipo: 'REPETIDA', ocorrenciaId: existente.id };
  return { tipo: 'CONFLITO' };
}

// ----- Fluxo de status ------------------------------------------------------------

const TRANSICOES: Record<StatusOcorrencia, StatusOcorrencia[]> = {
  ABERTA: ['EM_ANALISE', 'RESOLVIDA', 'DESCARTADA'],
  EM_ANALISE: ['ABERTA', 'RESOLVIDA', 'DESCARTADA'],
  RESOLVIDA: ['ABERTA'],
  DESCARTADA: ['ABERTA'],
};

export type ResultadoTransicao = { ok: true } | { ok: false; codigo: 'STATUS_INALTERADO' | 'TRANSICAO_INVALIDA'; mensagem: string };

export function validarTransicao(atual: StatusOcorrencia, novo: StatusOcorrencia): ResultadoTransicao {
  if (atual === novo) return { ok: false, codigo: 'STATUS_INALTERADO', mensagem: `A ocorrência já está com status ${novo}.` };
  if (!TRANSICOES[atual].includes(novo)) {
    return { ok: false, codigo: 'TRANSICAO_INVALIDA', mensagem: `Não é permitido mudar de ${atual} para ${novo}.` };
  }
  return { ok: true };
}

/** Só ocorrências ainda em andamento podem receber confirmação colaborativa. */
export function podeConfirmar(
  ocorrencia: { usuarioId: string; status: StatusOcorrencia },
  usuarioId: string,
): { ok: true } | { ok: false; codigo: string; mensagem: string } {
  if (ocorrencia.usuarioId === usuarioId) {
    return { ok: false, codigo: 'NAO_PODE_CONFIRMAR_PROPRIA', mensagem: 'Você não pode confirmar a própria ocorrência.' };
  }
  if (ocorrencia.status === 'RESOLVIDA' || ocorrencia.status === 'DESCARTADA') {
    return { ok: false, codigo: 'OCORRENCIA_ENCERRADA', mensagem: 'Ocorrências resolvidas ou descartadas não recebem confirmações.' };
  }
  return { ok: true };
}

// ----- Fotos ----------------------------------------------------------------------

export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Identifica o tipo real da imagem pelos "magic bytes" (não confia na extensão/mimetype). */
export function detectarTipoImagem(buf: Buffer): { extensao: 'jpg' | 'png' | 'webp'; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { extensao: 'jpg', mime: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extensao: 'png', mime: 'image/png' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { extensao: 'webp', mime: 'image/webp' };
  }
  return null;
}

// ----- Snapshot -------------------------------------------------------------------

export interface LinhaParaSnapshot {
  id: string;
  categoria: SnapshotOcorrencia['categoria'];
  severidade: SnapshotOcorrencia['severidade'];
  status: SnapshotOcorrencia['status'];
  descricao: string;
  latitude: number;
  longitude: number;
  bairro: string | null;
  emAreaDeManancial: boolean;
  manancialNome: string | null;
  confirmacoes: number;
  fotoUrl: string | null;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: Date;
  atualizadoEm: Date;
  resolvidoEm: Date | null;
  versao: number;
}

export function paraSnapshot(l: LinhaParaSnapshot): SnapshotOcorrencia {
  return {
    id: l.id,
    categoria: l.categoria,
    severidade: l.severidade,
    status: l.status,
    descricao: l.descricao,
    latitude: l.latitude,
    longitude: l.longitude,
    bairro: l.bairro,
    emAreaDeManancial: l.emAreaDeManancial,
    manancialNome: l.manancialNome,
    confirmacoes: l.confirmacoes,
    fotoUrl: l.fotoUrl,
    usuarioId: l.usuarioId,
    usuarioNome: l.usuarioNome,
    criadoEm: l.criadoEm.toISOString(),
    atualizadoEm: l.atualizadoEm.toISOString(),
    resolvidoEm: l.resolvidoEm ? l.resolvidoEm.toISOString() : null,
    versao: l.versao,
  };
}
