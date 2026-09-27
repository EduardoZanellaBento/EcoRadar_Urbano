import { z } from 'zod';

/** Mensagem publicada pelo simulador no tópico MQTT ecoradar/sensores/{estacaoId}/leituras. */
export const leituraSensorSchema = z.object({
  estacaoId: z.string().min(1).max(60),
  medidoEm: z.string().datetime({ offset: true }),
  pm25: z.number().min(0).max(2000).nullable().optional(),
  pm10: z.number().min(0).max(3000).nullable().optional(),
  o3: z.number().min(0).max(2000).nullable().optional(),
  no2: z.number().min(0).max(5000).nullable().optional(),
  co: z.number().min(0).max(100).nullable().optional(),
  temperatura: z.number().min(-30).max(60).nullable().optional(),
  umidade: z.number().min(0).max(100).nullable().optional(),
  nivel_corrego_cm: z.number().min(0).max(2000).nullable().optional(),
  temp_superficie: z.number().min(-30).max(60).nullable().optional(),
  temp_300m: z.number().min(-30).max(60).nullable().optional(),
  /** Cenário ativo no simulador (apenas informativo). */
  cenario: z.string().nullable().optional(),
  correlationId: z.string().optional(),
});
export type LeituraSensor = z.infer<typeof leituraSensorSchema>;

/** Converte o período textual (ex.: 24h, 6h, 7d) em horas e no tamanho do "balde" de agregação. */
export function interpretarPeriodo(periodo: string): { horas: number; baldeMinutos: number } {
  const m = /^(\d{1,3})([hd])$/.exec(periodo);
  if (!m) throw new Error('Período inválido. Use, por exemplo, 6h, 24h ou 7d.');
  const horas = Number(m[1]) * (m[2] === 'd' ? 24 : 1);
  if (horas < 1 || horas > 24 * 30) throw new Error('O período deve estar entre 1h e 30d.');
  const baldeMinutos = horas <= 6 ? 10 : horas <= 24 ? 30 : horas <= 72 ? 60 : 180;
  return { horas, baldeMinutos };
}
