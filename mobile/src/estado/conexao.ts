import { create } from 'zustand';
import type { Alerta } from '@/tipos';

interface EstadoConexao {
  /** null = ainda não sabemos (primeira verificação). */
  online: boolean | null;
  socket: { conectado: boolean; instancia: string | null; transporte: string | null; ultimaMudanca: string | null };
  definirOnline: (online: boolean) => void;
  definirSocket: (s: Partial<EstadoConexao['socket']>) => void;
}

export const useConexao = create<EstadoConexao>()((set) => ({
  online: null,
  socket: { conectado: false, instancia: null, transporte: null, ultimaMudanca: null },
  definirOnline: (online) => set({ online }),
  definirSocket: (s) => set((atual) => ({ socket: { ...atual.socket, ...s, ultimaMudanca: new Date().toISOString() } })),
}));

interface EstadoAlertas {
  naoLidos: number;
  banner: Alerta | null;
  receber: (a: Alerta) => void;
  fecharBanner: () => void;
  marcarLidos: () => void;
}

/** Alertas recebidos em tempo real: banner in-app e contador (badge) da aba. */
export const useAlertasTempoReal = create<EstadoAlertas>()((set) => ({
  naoLidos: 0,
  banner: null,
  receber: (banner) => set((s) => ({ banner, naoLidos: s.naoLidos + 1 })),
  fecharBanner: () => set({ banner: null }),
  marcarLidos: () => set({ naoLidos: 0 }),
}));
