import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

interface EstadoPreferencias {
  tema: PreferenciaTema;
  raioAlertasKm: number;
  onboardingVisto: boolean;
  ultimaLocalizacao: { latitude: number; longitude: number } | null;
  definirTema: (t: PreferenciaTema) => void;
  definirRaio: (km: number) => void;
  concluirOnboarding: () => void;
  registrarLocalizacao: (p: { latitude: number; longitude: number }) => void;
}

export const usePreferencias = create<EstadoPreferencias>()(
  persist(
    (set) => ({
      tema: 'sistema',
      raioAlertasKm: 10,
      onboardingVisto: false,
      ultimaLocalizacao: null,
      definirTema: (tema) => set({ tema }),
      definirRaio: (raioAlertasKm) => set({ raioAlertasKm }),
      concluirOnboarding: () => set({ onboardingVisto: true }),
      registrarLocalizacao: (ultimaLocalizacao) => set({ ultimaLocalizacao }),
    }),
    {
      name: 'ecoradar.preferencias',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ tema, raioAlertasKm, onboardingVisto, ultimaLocalizacao }) => ({ tema, raioAlertasKm, onboardingVisto, ultimaLocalizacao }),
    },
  ),
);

/** true quando as preferências já foram carregadas do AsyncStorage. */
export function usePreferenciasHidratadas(): boolean {
  return useSyncExternalStore(
    (avisar) => usePreferencias.persist.onFinishHydration(avisar),
    () => usePreferencias.persist.hasHydrated(),
    () => true,
  );
}
