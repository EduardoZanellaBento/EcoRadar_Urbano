const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const dataHora = (iso: string | Date) => fmtDataHora.format(new Date(iso));
export const hora = (iso: string | Date) => fmtHora.format(new Date(iso));
export const diaMes = (iso: string | Date) => fmtDiaMes.format(new Date(iso));
export const numero = (n: number | null | undefined, sufixo = '') => (n === null || n === undefined ? '—' : `${fmtNumero.format(n)}${sufixo}`);

/** "há 5 min", "há 2 h", "há 3 dias". */
export function tempoRelativo(iso: string | Date, agora = Date.now()): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'agora mesmo';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return dataHora(iso);
}

export function distancia(km: number | null | undefined): string {
  if (km === null || km === undefined) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${fmtNumero.format(km)} km`;
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/\(.*\)/, '').trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
