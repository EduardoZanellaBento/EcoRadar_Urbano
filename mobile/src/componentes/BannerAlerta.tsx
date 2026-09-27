import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlertasTempoReal } from '@/estado/conexao';
import { SEVERIDADE, TIPO_ALERTA } from '@/tema/cores';
import { Icone } from './Icone';

/** Banner in-app exibido quando chega um alerta em tempo real (some sozinho em 12 s). */
export function BannerAlerta() {
  const alerta = useAlertasTempoReal((s) => s.banner);
  const fechar = useAlertasTempoReal((s) => s.fecharBanner);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!alerta) return;
    const t = setTimeout(fechar, 12_000);
    return () => clearTimeout(t);
  }, [alerta, fechar]);
  if (!alerta) return null;
  const sev = SEVERIDADE[alerta.severidade];
  return (
    <View pointerEvents="box-none" style={[estilos.camada, { top: insets.top + 8 }]}>
      <Pressable
        testID="banner-alerta"
        accessibilityRole="alert"
        accessibilityLabel={`Novo alerta: ${alerta.titulo}. Severidade ${sev.rotulo}.`}
        onPress={() => {
          fechar();
          router.push('/alertas');
        }}
        style={[estilos.cartao, { borderLeftColor: sev.cor }]}
      >
        <View style={[estilos.icone, { backgroundColor: sev.cor }]}>
          <Icone nome={TIPO_ALERTA[alerta.tipo].icone} tamanho={22} cor={sev.corTexto} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.rotulo}>
            NOVO ALERTA · {sev.rotulo.toUpperCase()}
          </Text>
          <Text style={estilos.titulo} numberOfLines={2}>
            {alerta.titulo}
          </Text>
          <Text style={estilos.mensagem} numberOfLines={2}>
            {alerta.mensagem}
          </Text>
        </View>
        <IconButton icon="close" size={18} iconColor="#ffffff" onPress={fechar} accessibilityLabel="Fechar alerta" />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  camada: { position: 'absolute', left: 12, right: 12, zIndex: 1000 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1f2937',
    borderRadius: 14,
    padding: 10,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rotulo: { color: '#fcd34d', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  titulo: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  mensagem: { color: '#e5e7eb', fontSize: 12 },
});
