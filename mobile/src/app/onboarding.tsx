import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Logo } from '@/componentes/Logo';
import { usePreferencias } from '@/estado/preferencias';
import { MARCA } from '@/tema/cores';

function IlustracaoMapa() {
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" accessibilityElementsHidden>
      <Path d="M20 40 L80 20 L140 40 L200 20 V130 L140 150 L80 130 L20 150 Z" fill="#e0f2ef" stroke={MARCA.verde} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M80 20 V130 M140 40 V150" stroke={MARCA.verde} strokeWidth={2} opacity={0.5} />
      <Path d="M30 110 Q 70 80 110 100 T 190 70" stroke={MARCA.azul} strokeWidth={6} fill="none" opacity={0.35} strokeLinecap="round" />
      {[
        [60, 70, '#d03b3b'],
        [120, 95, '#ec835a'],
        [165, 55, '#fab219'],
      ].map(([x, y, c]) => (
        <Path key={String(x)} d={`M${x} ${Number(y) + 22} C ${Number(x) - 14} ${Number(y) + 6} ${Number(x) - 14} ${y} ${x} ${y} C ${Number(x) + 14} ${y} ${Number(x) + 14} ${Number(y) + 6} ${x} ${Number(y) + 22} Z`} fill={String(c)} stroke="#fff" strokeWidth={2} />
      ))}
      <Circle cx="60" cy="76" r="4" fill="#fff" />
      <Circle cx="120" cy="101" r="4" fill="#fff" />
      <Circle cx="165" cy="61" r="4" fill="#fff" />
    </Svg>
  );
}

function IlustracaoAr() {
  const cores = ['#1b9e3e', '#e5b800', '#f07b12', '#d32f2f', '#7b1fa2'];
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" accessibilityElementsHidden>
      {cores.map((c, i) => {
        const a0 = Math.PI + (i * Math.PI) / 5;
        const a1 = Math.PI + ((i + 1) * Math.PI) / 5;
        const r = 80;
        const x0 = 110 + r * Math.cos(a0);
        const y0 = 130 + r * Math.sin(a0);
        const x1 = 110 + r * Math.cos(a1);
        const y1 = 130 + r * Math.sin(a1);
        return <Path key={c} d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={c} strokeWidth={22} fill="none" />;
      })}
      <Path d="M110 130 L70 88" stroke="#263238" strokeWidth={6} strokeLinecap="round" />
      <Circle cx="110" cy="130" r="10" fill="#263238" />
      <Rect x="150" y="18" width="56" height="30" rx="8" fill={MARCA.azul} />
      <Path d="M160 38 L170 28 L180 34 L196 24" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function IlustracaoAlerta() {
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" accessibilityElementsHidden>
      <Circle cx="110" cy="80" r="62" fill="#fff3d6" />
      <Path d="M110 34 c-20 0 -34 15 -34 36 v24 l-10 14 h88 l-10 -14 v-24 c0 -21 -14 -36 -34 -36 z" fill="#fab219" stroke="#8a5a00" strokeWidth={3} />
      <Path d="M98 116 a12 12 0 0 0 24 0" stroke="#8a5a00" strokeWidth={3} fill="none" />
      <Path d="M58 50 a60 60 0 0 1 14 -18 M162 50 a60 60 0 0 0 -14 -18" stroke="#d03b3b" strokeWidth={5} fill="none" strokeLinecap="round" />
      {[40, 180].map((x) => (
        <Circle key={x} cx={x} cy="140" r="12" fill={MARCA.verde} />
      ))}
      <Circle cx="110" cy="150" r="12" fill={MARCA.azul} />
    </Svg>
  );
}

const SLIDES = [
  {
    titulo: 'Registre o que acontece na sua cidade',
    texto: 'Alagamentos, poluição, queimadas, lixo, invasão de mananciais: registre com foto e localização — mesmo sem internet.',
    Ilustracao: IlustracaoMapa,
  },
  {
    titulo: 'Acompanhe a qualidade do ar em tempo real',
    texto: 'Estações conectadas calculam o IQAr (metodologia CETESB) e mostram temperatura, córregos e inversão térmica.',
    Ilustracao: IlustracaoAr,
  },
  {
    titulo: 'Receba alertas e ajude quem está perto',
    texto: 'Confirme ocorrências de outros cidadãos e receba avisos de risco na sua região, na hora.',
    Ilustracao: IlustracaoAlerta,
  },
];

export default function Onboarding() {
  const tema = useTheme();
  const [indice, setIndice] = useState(0);
  const concluir = usePreferencias((s) => s.concluirOnboarding);
  const slide = SLIDES[indice];
  const ultimo = indice === SLIDES.length - 1;

  const finalizar = () => {
    concluir();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={[estilos.pagina, { backgroundColor: tema.colors.background }]}>
      <View style={estilos.topo}>
        <View style={estilos.marca}>
          <Logo tamanho={36} comFundo />
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
            EcoRadar Urbano
          </Text>
        </View>
        {!ultimo && (
          <Button onPress={finalizar} accessibilityLabel="Pular apresentação" testID="botao-pular">
            Pular
          </Button>
        )}
      </View>
      <View style={estilos.centro} testID={`slide-${indice + 1}`}>
        <slide.Ilustracao />
        <Text variant="headlineSmall" style={estilos.titulo}>
          {slide.titulo}
        </Text>
        <Text variant="bodyLarge" style={[estilos.texto, { color: tema.colors.onSurfaceVariant }]}>
          {slide.texto}
        </Text>
      </View>
      <View style={estilos.pontos} accessibilityLabel={`Passo ${indice + 1} de ${SLIDES.length}`}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[estilos.ponto, { backgroundColor: i === indice ? tema.colors.primary : tema.colors.outlineVariant, width: i === indice ? 24 : 8 }]} />
        ))}
      </View>
      <Button
        mode="contained"
        onPress={() => (ultimo ? finalizar() : setIndice((i) => i + 1))}
        style={estilos.botao}
        contentStyle={{ paddingVertical: 6 }}
        testID="botao-proximo"
      >
        {ultimo ? 'Começar' : 'Próximo'}
      </Button>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, padding: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 8 },
  titulo: { textAlign: 'center', fontWeight: '700' },
  texto: { textAlign: 'center', maxWidth: 360 },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  ponto: { height: 8, borderRadius: 4 },
  botao: { marginBottom: 8 },
});
