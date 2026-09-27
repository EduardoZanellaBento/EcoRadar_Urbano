import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SERIES } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';

/**
 * Barras horizontais de uma única série (uma cor), ordenadas, com o valor escrito ao fim
 * de cada barra — legível no celular e na web, sem depender de hover.
 */
export function GraficoBarras({ dados, titulo }: { dados: { rotulo: string; valor: number }[]; titulo: string }) {
  const tema = useTheme<TemaEcoRadar>();
  const cor = tema.extra.escuro ? SERIES.escuro[0] : SERIES.claro[0];
  const ordenados = [...dados].sort((a, b) => b.valor - a.valor);
  const maximo = Math.max(1, ...ordenados.map((d) => d.valor));
  return (
    <View accessibilityLabel={`${titulo}: ${ordenados.map((d) => `${d.rotulo} ${d.valor}`).join(', ')}`}>
      {ordenados.map((d) => (
        <View key={d.rotulo} style={estilos.linha}>
          <Text variant="labelMedium" style={[estilos.rotulo, { color: tema.extra.tintaSecundaria }]} numberOfLines={1}>
            {d.rotulo}
          </Text>
          <View style={estilos.trilho}>
            <View style={[estilos.barra, { width: `${(d.valor / maximo) * 100}%`, backgroundColor: cor, minWidth: d.valor > 0 ? 3 : 0 }]} />
            <Text variant="labelMedium" style={[estilos.valor, { color: tema.colors.onSurface }]}>
              {d.valor}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 8 },
  rotulo: { width: 118, textAlign: 'right' },
  trilho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  barra: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  valor: { minWidth: 24 },
});
