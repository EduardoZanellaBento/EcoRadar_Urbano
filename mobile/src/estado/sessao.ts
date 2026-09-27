import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Perfil, Sessao, Usuario } from '@/tipos';
import { armazenamentoSeguro } from './armazenamento';

interface EstadoSessao {
  token: string | null;
  expiraEm: string | null;
  usuario: Usuario | null;
  motivoSaida: string | null;
  entrar: (s: Sessao) => void;
  sair: (motivo?: string) => void;
  atualizarUsuario: (u: Usuario) => void;
}

export const useSessao = create<EstadoSessao>()(
  persist(
    (set) => ({
      token: null,
      expiraEm: null,
      usuario: null,
      motivoSaida: null,
      entrar: (s) => set({ token: s.token, expiraEm: s.expiraEm, usuario: s.usuario, motivoSaida: null }),
      sair: (motivo) => set({ token: null, expiraEm: null, usuario: null, motivoSaida: motivo ?? null }),
      atualizarUsuario: (usuario) => set({ usuario }),
    }),
    {
      name: 'ecoradar.sessao',
      storage: createJSONStorage(() => armazenamentoSeguro),
      partialize: (s) => ({ token: s.token, expiraEm: s.expiraEm, usuario: s.usuario }),
    },
  ),
);

/** Token expirado ao abrir o app: descarta a sessão. */
function verificarExpiracao() {
  const { expiraEm, sair } = useSessao.getState();
  if (expiraEm && new Date(expiraEm).getTime() < Date.now()) sair('Sua sessão expirou. Entre novamente.');
}
// Na web o armazenamento é síncrono (a hidratação já terminou aqui); no celular é assíncrono
if (useSessao.persist.hasHydrated()) verificarExpiracao();
else useSessao.persist.onFinishHydration(verificarExpiracao);

/** true quando a sessão já foi carregada do armazenamento seguro. */
export function useSessaoHidratada(): boolean {
  return useSyncExternalStore(
    (avisar) => useSessao.persist.onFinishHydration(avisar),
    () => useSessao.persist.hasHydrated(),
    () => true,
  );
}

export const tokenAtual = () => useSessao.getState().token;

export function temPerfil(usuario: Usuario | null, ...perfis: Perfil[]): boolean {
  return Boolean(usuario && perfis.includes(usuario.perfil));
}
