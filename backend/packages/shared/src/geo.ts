/** Funções geográficas simples (sem dependências) usadas por regras de negócio. */

const RAIO_TERRA_KM = 6371.0088;

const rad = (graus: number) => (graus * Math.PI) / 180;

export interface Ponto {
  latitude: number;
  longitude: number;
}

/** Distância em km entre dois pontos pela fórmula de Haversine. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Teste de ponto em polígono (ray casting). O polígono é uma lista de [lon, lat]
 * (ordem GeoJSON). Usado pelo app como verificação local e em testes.
 */
export function pontoNoPoligono(ponto: Ponto, anel: Array<[number, number]>): boolean {
  let dentro = false;
  const x = ponto.longitude;
  const y = ponto.latitude;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
