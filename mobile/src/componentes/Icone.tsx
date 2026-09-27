import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

export type NomeIcone = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Ícone Material Community (conjunto único em todo o app). */
export function Icone({ nome, tamanho = 22, cor, rotulo }: { nome: string; tamanho?: number; cor?: ColorValue; rotulo?: string }) {
  return (
    <MaterialCommunityIcons
      name={nome as NomeIcone}
      size={tamanho}
      color={cor as string}
      accessibilityElementsHidden={!rotulo}
      importantForAccessibility={rotulo ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={rotulo}
    />
  );
}

/** Código do glifo (usado no mapa da web, onde o marcador é HTML). */
export function glifo(nome: string): string {
  const mapa = (MaterialCommunityIcons as unknown as { glyphMap: Record<string, number> }).glyphMap;
  const codigo = mapa?.[nome];
  return codigo ? String.fromCodePoint(codigo) : '';
}
