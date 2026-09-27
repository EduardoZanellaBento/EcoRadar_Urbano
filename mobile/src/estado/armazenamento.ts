import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/** Armazenamento seguro (Keychain/Keystore) para a sessão — versão nativa. */
export const armazenamentoSeguro: StateStorage = {
  getItem: (nome) => SecureStore.getItemAsync(nome),
  setItem: (nome, valor) => SecureStore.setItemAsync(nome, valor),
  removeItem: (nome) => SecureStore.deleteItemAsync(nome),
};
