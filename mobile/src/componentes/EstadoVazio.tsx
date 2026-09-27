import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

type Ilustracao = 'lista' | 'alertas' | 'erro' | 'offline' | 'mapa';

/** Ilustração simples (vetorial, própria) para estados vazios e de erro. */
function Desenho({ tipo, cor }: { tipo: Ilustracao; cor: string }) {
  return (
    <Svg width={140} height={110} viewBox="0 0 140 110" accessibilityElementsHidden>
      <Ellipse cx="70" cy="98" rx="52" ry="8" fill={cor} opacity={0.12} />
      <Circle cx="70" cy="52" r="40" fill={cor} opacity={0.12} />
      {tipo === 'lista' && (
        <>
          <Path d="M48 32 h44 a4 4 0 0 1 4 4 v36 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-36 a4 4 0 0 1 4 -4 z" fill="#fff" stroke={cor} strokeWidth={2.5} />
          <Path d="M54 44 h32 M54 54 h26 M54 64 h20" stroke={cor} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {tipo === 'alertas' && (
        <>
          <Path d="M70 26 c-12 0 -20 9 -20 21 v14 l-6 8 h52 l-6 -8 v-14 c0 -12 -8 -21 -20 -21 z" fill="#fff" stroke={cor} strokeWidth={2.5} />
          <Path d="M63 74 a7 7 0 0 0 14 0" stroke={cor} strokeWidth={2.5} fill="none" />
          <Path d="M62 50 l6 6 l12 -12" stroke="#16a34a" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {tipo === 'erro' && (
        <>
          <Path d="M70 24 l30 52 h-60 z" fill="#fff" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M70 42 v16" stroke={cor} strokeWidth={4} strokeLinecap="round" />
          <Circle cx="70" cy="66" r="2.8" fill={cor} />
        </>
      )}
      {tipo === 'offline' && (
        <>
          <Path d="M42 50 a40 40 0 0 1 56 0 M50 58 a28 28 0 0 1 40 0 M58 66 a16 16 0 0 1 24 0" stroke={cor} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Circle cx="70" cy="74" r="4" fill={cor} />
          <Path d="M44 30 l52 52" stroke="#d03b3b" strokeWidth={4} strokeLinecap="round" />
        </>
      )}
      {tipo === 'mapa' && (
        <>
          <Path d="M40 34 l20 -8 l20 8 l20 -8 v44 l-20 8 l-20 -8 l-20 8 z" fill="#fff" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M60 26 v44 M80 34 v44" stroke={cor} strokeWidth={2} />
          <Circle cx="70" cy="48" r="6" fill="#d03b3b" />
        </>
      )}
    </Svg>
  );
}

export function EstadoVazio({
  titulo,
  descricao,
  ilustracao = 'lista',
  acao,
}: {
  titulo: string;
  descricao?: string;
  ilustracao?: Ilustracao;
  acao?: { rotulo: string; aoPressionar: () => void };
}) {
  const tema = useTheme();
  return (
    <View style={estilos.caixa} accessibilityRole="summary">
      <Desenho tipo={ilustracao} cor={tema.colors.primary} />
      <Text variant="titleMedium" style={estilos.titulo}>
        {titulo}
      </Text>
      {descricao && (
        <Text variant="bodyMedium" style={[estilos.descricao, { color: tema.colors.onSurfaceVariant }]}>
          {descricao}
        </Text>
      )}
      {acao && (
        <Button mode="contained-tonal" onPress={acao.aoPressionar} style={{ marginTop: 12 }}>
          {acao.rotulo}
        </Button>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { alignItems: 'center', padding: 24, gap: 6 },
  titulo: { textAlign: 'center', marginTop: 8 },
  descricao: { textAlign: 'center', maxWidth: 320 },
});
