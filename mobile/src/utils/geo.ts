import type { ColecaoMananciais } from '@/tipos';

export interface Ponto {
  latitude: number;
  longitude: number;
}

const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em km (Haversine). */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray casting sobre um anel [lon, lat] (ordem GeoJSON). */
export function pontoNoAnel(p: Ponto, anel: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > p.latitude !== yj > p.latitude && p.longitude < ((xj - xi) * (p.latitude - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Anéis externos dos polígonos (Polygon ou MultiPolygon) de cada manancial. */
export function aneisExternos(geometria: { type: string; coordinates: unknown }): number[][][] {
  if (geometria.type === 'Polygon') return [(geometria.coordinates as number[][][])[0]];
  if (geometria.type === 'MultiPolygon') return (geometria.coordinates as number[][][][]).map((p) => p[0]);
  return [];
}

/** Verificação local (sem rede) de ponto dentro de manancial — usada como reserva quando offline. */
export function manancialLocal(p: Ponto, mananciais: ColecaoMananciais | undefined): string | null {
  for (const f of mananciais?.features ?? []) {
    if (aneisExternos(f.geometry).some((anel) => pontoNoAnel(p, anel))) return f.properties.nome;
  }
  return null;
}
