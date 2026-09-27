import { Platform } from 'react-native';

/**
 * Endereço do gateway (Nginx) — ponto único de entrada da API.
 *  - Celular (Expo Go): EXPO_PUBLIC_API_URL, gravado em mobile/.env pelo scripts/configurar-ip
 *  - Web servida pelo gateway (http://localhost:8080): a própria origem da página
 *  - Web em desenvolvimento (expo start --web, porta 8081): mesmo host na porta 8080
 */
function descobrirUrlDaApi(): string {
  const doAmbiente = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port, origin } = window.location;
    if (port === '8081' || port === '19006') return `${protocol}//${hostname}:8080`;
    return origin;
  }
  return (doAmbiente || 'http://localhost:8080').replace(/\/+$/, '');
}

export const API_URL = descobrirUrlDaApi();
export const TIMEOUT_MS = 10_000;
export const MAX_TENTATIVAS = 3;

export const CIDADE_PADRAO = { nome: 'São Paulo/SP', latitude: -23.5505, longitude: -46.6333 };

/** URL absoluta de um recurso servido pelo gateway (ex.: /uploads/foto.jpg). */
export function urlAbsoluta(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return `${API_URL}${caminho.startsWith('/') ? '' : '/'}${caminho}`;
}
