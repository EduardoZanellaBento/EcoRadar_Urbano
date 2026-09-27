import { DarkTheme as NavEscuro, DefaultTheme as NavClaro, type Theme as TemaNavegacao } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { MARCA } from './cores';

export interface TemaEcoRadar extends MD3Theme {
  extra: {
    fundoPagina: string;
    superficieGrafico: string;
    tintaSecundaria: string;
    tintaFraca: string;
    grade: string;
    sucesso: string;
    aviso: string;
    perigo: string;
    offline: string;
    escuro: boolean;
  };
}

export const temaClaro: TemaEcoRadar = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: MARCA.verde,
    onPrimary: '#ffffff',
    primaryContainer: '#c8efe8',
    onPrimaryContainer: '#00201c',
    secondary: MARCA.azul,
    onSecondary: '#ffffff',
    secondaryContainer: '#dbe4ff',
    onSecondaryContainer: '#001552',
    tertiary: '#7c4d00',
    tertiaryContainer: '#ffddb3',
    background: '#f6f7f5',
    surface: '#ffffff',
    surfaceVariant: '#e3ebe8',
    onSurfaceVariant: '#3f4946',
    outline: '#6f7976',
    outlineVariant: '#c3cbc8',
    error: '#b3261e',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#f1f6f4',
      level2: '#ebf2f0',
      level3: '#e5efec',
    },
  },
  extra: {
    fundoPagina: '#f6f7f5',
    superficieGrafico: '#ffffff',
    tintaSecundaria: '#52514e',
    tintaFraca: '#6f6e69',
    grade: '#e1e0d9',
    sucesso: '#006300',
    aviso: '#8a5a00',
    perigo: '#b3261e',
    offline: '#5f4b00',
    escuro: false,
  },
};

export const temaEscuro: TemaEcoRadar = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#5ed6c5',
    onPrimary: '#003731',
    primaryContainer: '#005048',
    onPrimaryContainer: '#7cf3e1',
    secondary: '#b5c4ff',
    onSecondary: '#00257a',
    secondaryContainer: '#1d3a99',
    onSecondaryContainer: '#dbe4ff',
    background: '#101413',
    surface: '#1a1f1e',
    surfaceVariant: '#3f4946',
    onSurfaceVariant: '#bfc9c5',
    outline: '#899390',
    outlineVariant: '#3f4946',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#1a1f1e',
      level2: '#1f2524',
      level3: '#242b2a',
    },
  },
  extra: {
    fundoPagina: '#101413',
    superficieGrafico: '#1a1f1e',
    tintaSecundaria: '#c3c2b7',
    tintaFraca: '#9a9992',
    grade: '#2c2c2a',
    sucesso: '#5bd35b',
    aviso: '#f0c060',
    perigo: '#ffb4ab',
    offline: '#ffe08a',
    escuro: true,
  },
};

/** Tema do React Navigation (cabeçalhos, abas) derivado do tema Material do app. */
export function temaDeNavegacao(tema: TemaEcoRadar): TemaNavegacao {
  const base = tema.extra.escuro ? NavEscuro : NavClaro;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: tema.colors.primary,
      background: tema.extra.fundoPagina,
      card: tema.colors.surface,
      text: tema.colors.onSurface,
      border: tema.colors.outlineVariant,
      notification: tema.colors.error,
    },
  };
}
