import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConexao } from '@/estado/conexao';
import { contarPendentes, useFilaOffline } from '@/estado/filaOffline';
import { Icone } from './Icone';

/** Faixa global exibida quando não há conexão (ou há envios pendentes na fila). */
export function FaixaOffline() {
  const online = useConexao((s) => s.online);
  const pendentes = useFilaOffline((s) => contarPendentes(s.itens));
  const insets = useSafeAreaInsets();
  if (online !== false && pendentes === 0) return null;
  const offline = online === false;
  return (
    <Pressable
      onPress={() => router.push('/envios')}
      accessibilityRole="button"
      accessibilityLabel={offline ? 'Você está offline. Toque para ver os envios pendentes.' : `${pendentes} envios pendentes`}
      testID="faixa-offline"
      style={[estilos.faixa, { paddingTop: insets.top > 0 ? insets.top : 6, backgroundColor: offline ? '#5f4b00' : '#1d4ed8' }]}
    >
      <View style={estilos.linha}>
        <Icone nome={offline ? 'wifi-off' : 'cloud-sync'} tamanho={18} cor="#ffffff" />
        <Text style={estilos.texto}>
          {offline ? 'Você está offline' : 'Sincronizando'}
          {pendentes > 0 ? ` · ${pendentes} ${pendentes === 1 ? 'envio pendente' : 'envios pendentes'}` : ' · dados em cache'}
        </Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  faixa: { paddingBottom: 6, paddingHorizontal: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  texto: { color: '#ffffff', fontWeight: '600' },
});
