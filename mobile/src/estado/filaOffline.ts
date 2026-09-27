import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Categoria, Severidade } from '@/tipos';

export type StatusEnvio = 'pendente' | 'enviando' | 'sincronizado' | 'erro';

export interface DadosNovaOcorrencia {
  categoria: Categoria;
  severidade: Severidade;
  descricao: string;
  latitude: number;
  longitude: number;
  bairro?: string | null;
}

export interface FotoLocal {
  uri: string;
  mime: string;
  nome: string;
}

/** Ocorrência criada no aparelho, identificada pela idempotencyKey (UUID v4). */
export interface ItemFila {
  idempotencyKey: string;
  dados: DadosNovaOcorrencia;
  foto: FotoLocal | null;
  status: StatusEnvio;
  criadoEm: string;
  tentativas: number;
  erro?: string;
  ocorrenciaId?: string;
  sincronizadoEm?: string;
}

interface EstadoFila {
  itens: ItemFila[];
  adicionar: (item: ItemFila) => void;
  atualizar: (chave: string, parcial: Partial<ItemFila>) => void;
  remover: (chave: string) => void;
  limparSincronizados: () => void;
}

/**
 * Fila persistente (AsyncStorage) de ocorrências registradas sem conexão. Ao reconectar,
 * cada item é reenviado com a MESMA idempotencyKey — o servidor nunca duplica o registro.
 */
export const useFilaOffline = create<EstadoFila>()(
  persist(
    (set) => ({
      itens: [],
      adicionar: (item) => set((s) => ({ itens: [item, ...s.itens.filter((i) => i.idempotencyKey !== item.idempotencyKey)] })),
      atualizar: (chave, parcial) => set((s) => ({ itens: s.itens.map((i) => (i.idempotencyKey === chave ? { ...i, ...parcial } : i)) })),
      remover: (chave) => set((s) => ({ itens: s.itens.filter((i) => i.idempotencyKey !== chave) })),
      limparSincronizados: () => set((s) => ({ itens: s.itens.filter((i) => i.status !== 'sincronizado') })),
    }),
    {
      name: 'ecoradar.fila-offline',
      storage: createJSONStorage(() => AsyncStorage),
      // Itens que estavam "enviando" quando o app fechou voltam para "pendente"
      onRehydrateStorage: () => (estado) => {
        estado?.itens.forEach((i) => i.status === 'enviando' && estado.atualizar(i.idempotencyKey, { status: 'pendente' }));
      },
    },
  ),
);

export const contarPendentes = (itens: ItemFila[]) => itens.filter((i) => i.status === 'pendente' || i.status === 'enviando').length;
