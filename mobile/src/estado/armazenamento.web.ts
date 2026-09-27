import type { StateStorage } from 'zustand/middleware';

/** Na web não existe SecureStore: adaptador para localStorage (com proteção a falhas). */
export const armazenamentoSeguro: StateStorage = {
  getItem: (nome) => {
    try {
      return window.localStorage.getItem(nome);
    } catch {
      return null;
    }
  },
  setItem: (nome, valor) => {
    try {
      window.localStorage.setItem(nome, valor);
    } catch {
      /* armazenamento indisponível (modo privado) */
    }
  },
  removeItem: (nome) => {
    try {
      window.localStorage.removeItem(nome);
    } catch {
      /* ignorado */
    }
  },
};
