import type { StyleProp, ViewStyle } from 'react-native';
import type { Categoria, ClasseIqar, ColecaoMananciais, Severidade } from '@/tipos';

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface MarcadorOcorrencia extends Coordenada {
  id: string;
  categoria: Categoria;
  severidade: Severidade;
  titulo: string;
}

export interface MarcadorEstacao extends Coordenada {
  id: string;
  nome: string;
  iqar: { indice: number; classe: ClasseIqar } | null;
  inversao: boolean;
}

export interface PropsMapa {
  regiaoInicial: Coordenada & { delta?: number };
  ocorrencias?: MarcadorOcorrencia[];
  estacoes?: MarcadorEstacao[];
  mananciais?: ColecaoMananciais;
  minhaLocalizacao?: Coordenada | null;
  /** Pino arrastável (tela de registro). */
  pontoSelecionado?: Coordenada | null;
  /** Muda a "chave" para forçar a recentralização. */
  centralizarEm?: (Coordenada & { chave: number; delta?: number }) | null;
  modoEscuro?: boolean;
  interativo?: boolean;
  estilo?: StyleProp<ViewStyle>;
  aoTocarMapa?: (c: Coordenada) => void;
  aoTocarOcorrencia?: (id: string) => void;
  aoTocarEstacao?: (id: string) => void;
  testID?: string;
}
