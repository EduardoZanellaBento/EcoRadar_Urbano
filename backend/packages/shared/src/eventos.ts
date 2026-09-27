import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { INSTANCIA_ID } from './config.js';
import { CATEGORIAS, SEVERIDADES, STATUS_OCORRENCIA, TIPOS_ALERTA, CLASSES_IQAR } from './dominio.js';

/** Exchange do tipo "topic" por onde trafegam todos os eventos de domínio. */
export const EXCHANGE_EVENTOS = 'ecoradar.eventos';
/** Exchange de mensagens mortas (eventos que falharam repetidamente). */
export const EXCHANGE_DLX = 'ecoradar.dlx';

export const TIPOS_EVENTO = {
  OCORRENCIA_CRIADA: 'ocorrencia.criada',
  OCORRENCIA_CONFIRMADA: 'ocorrencia.confirmada',
  OCORRENCIA_STATUS_ALTERADO: 'ocorrencia.status_alterado',
  AMBIENTAL_LIMITE_EXCEDIDO: 'ambiental.limite_excedido',
  AMBIENTAL_INVERSAO_TERMICA: 'ambiental.inversao_termica',
  ALERTA_CRIADO: 'alerta.criado',
  ALERTA_ENCERRADO: 'alerta.encerrado',
} as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[keyof typeof TIPOS_EVENTO];

/** Envelope comum de todo evento publicado no broker. */
export const envelopeSchema = z.object({
  id: z.string().uuid(),
  tipo: z.string(),
  versao: z.number().int(),
  ocorridoEm: z.string(),
  origem: z.string(),
  instancia: z.string(),
  correlationId: z.string(),
  dados: z.unknown(),
});
export type EnvelopeEvento<T = unknown> = Omit<z.infer<typeof envelopeSchema>, 'dados'> & { dados: T };

export function criarEvento<T>(tipo: TipoEvento, dados: T, contexto: { origem: string; correlationId?: string }): EnvelopeEvento<T> {
  return {
    id: randomUUID(),
    tipo,
    versao: 1,
    ocorridoEm: new Date().toISOString(),
    origem: contexto.origem,
    instancia: INSTANCIA_ID,
    correlationId: contexto.correlationId || randomUUID(),
    dados,
  };
}

// ----- Ocorrências ---------------------------------------------------------------

/** Retrato completo da ocorrência no momento do evento (permite projeções idempotentes). */
export const snapshotOcorrenciaSchema = z.object({
  id: z.string().uuid(),
  categoria: z.enum(CATEGORIAS),
  severidade: z.enum(SEVERIDADES),
  status: z.enum(STATUS_OCORRENCIA),
  descricao: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  bairro: z.string().nullable(),
  emAreaDeManancial: z.boolean(),
  manancialNome: z.string().nullable(),
  confirmacoes: z.number().int(),
  fotoUrl: z.string().nullable(),
  usuarioId: z.string(),
  usuarioNome: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
  resolvidoEm: z.string().nullable(),
  /** Número de versão incrementado a cada alteração (ordenação de eventos fora de ordem). */
  versao: z.number().int(),
});
export type SnapshotOcorrencia = z.infer<typeof snapshotOcorrenciaSchema>;

export const dadosOcorrenciaEventoSchema = z.object({
  ocorrencia: snapshotOcorrenciaSchema,
  statusAnterior: z.enum(STATUS_OCORRENCIA).optional(),
  comentario: z.string().optional(),
  confirmadoPor: z.string().optional(),
});
export type DadosOcorrenciaEvento = z.infer<typeof dadosOcorrenciaEventoSchema>;

// ----- Ambiental -----------------------------------------------------------------

export const dadosLimiteExcedidoSchema = z.object({
  estacaoId: z.string(),
  estacaoNome: z.string(),
  bairro: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  indicador: z.enum(['IQAR', 'NIVEL_CORREGO']),
  valor: z.number(),
  limite: z.number(),
  classe: z.enum(CLASSES_IQAR).optional(),
  poluente: z.string().optional(),
  medidoEm: z.string(),
});
export type DadosLimiteExcedido = z.infer<typeof dadosLimiteExcedidoSchema>;

export const dadosInversaoTermicaSchema = z.object({
  estacaoId: z.string(),
  estacaoNome: z.string(),
  bairro: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  tempSuperficie: z.number(),
  temp300m: z.number(),
  diferenca: z.number(),
  medidoEm: z.string(),
});
export type DadosInversaoTermica = z.infer<typeof dadosInversaoTermicaSchema>;

// ----- Alertas -------------------------------------------------------------------

export const snapshotAlertaSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(TIPOS_ALERTA),
  severidade: z.enum(SEVERIDADES),
  titulo: z.string(),
  mensagem: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  raioKm: z.number().nullable(),
  status: z.enum(['ATIVO', 'ENCERRADO']),
  criadoEm: z.string(),
  encerradoEm: z.string().nullable(),
});
export type SnapshotAlerta = z.infer<typeof snapshotAlertaSchema>;
