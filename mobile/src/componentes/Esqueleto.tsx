import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from 'react-native-paper';

/** Bloco pulsante usado como "skeleton" enquanto os dados carregam. */
export function Bloco({ largura = '100%', altura = 14, raio = 6 }: { largura?: DimensionValue; altura?: number; raio?: number }) {
  const tema = useTheme();
  const [opacidade] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    animacao.start();
    return () => animacao.stop();
  }, [opacidade]);
  return <Animated.View style={{ width: largura, height: altura, borderRadius: raio, backgroundColor: tema.colors.surfaceVariant, opacity: opacidade }} />;
}

/** Esqueleto de um cartão de lista. */
export function EsqueletoCartao() {
  const tema = useTheme();
  return (
    <View style={[estilos.cartao, { backgroundColor: tema.colors.surface }]} accessibilityLabel="Carregando" accessibilityRole="progressbar">
      <View style={estilos.linha}>
        <Bloco largura={40} altura={40} raio={20} />
        <View style={{ flex: 1, gap: 8 }}>
          <Bloco largura="60%" />
          <Bloco largura="35%" altura={10} />
        </View>
      </View>
      <Bloco largura="90%" altura={10} />
      <Bloco largura="70%" altura={10} />
    </View>
  );
}

export function EsqueletoLista({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: quantidade }, (_, i) => (
        <EsqueletoCartao key={i} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: 16, padding: 14, gap: 10 },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
