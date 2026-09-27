import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { usePreferencias } from '@/estado/preferencias';

export interface Posicao {
  latitude: number;
  longitude: number;
  precisaoM: number | null;
}

/** Obtém a localização atual (pede permissão). Retorna null se negada ou indisponível. */
export async function obterLocalizacao(): Promise<Posicao | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    let pos: Location.LocationObject | null = null;
    try {
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
      ]);
    } catch {
      pos = null;
    }
    if (!pos && Platform.OS !== 'web') pos = await Location.getLastKnownPositionAsync();
    if (!pos) return null;
    const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, precisaoM: pos.coords.accuracy ?? null };
    usePreferencias.getState().registrarLocalizacao({ latitude: p.latitude, longitude: p.longitude });
    return p;
  } catch {
    return null;
  }
}
