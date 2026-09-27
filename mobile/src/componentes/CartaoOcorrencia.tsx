import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { urlAbsoluta } from '@/config';
import { CATEGORIA, SEVERIDADE } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import type { Ocorrencia } from '@/tipos';
import { distancia, tempoRelativo } from '@/utils/formatacao';
import { EtiquetaSeveridade, EtiquetaStatus } from './Etiquetas';
import { Icone } from './Icone';

export function CartaoOcorrencia({ ocorrencia: o, aoPressionar }: { ocorrencia: Ocorrencia; aoPressionar: () => void }) {
  const tema = useTheme<TemaEcoRadar>();
  const cat = CATEGORIA[o.categoria];
  const sev = SEVERIDADE[o.severidade];
  const foto = urlAbsoluta(o.fotoUrl);
  return (
    <Card mode="elevated" style={estilos.cartao} testID={`cartao-ocorrencia-${o.id}`}>
      <TouchableRipple
        onPress={aoPressionar}
        borderless
        style={estilos.toque}
        accessibilityRole="button"
        accessibilityLabel={`${cat.rotulo} em ${o.bairro ?? 'local não identificado'}, severidade ${sev.rotulo}, ${tempoRelativo(o.criadoEm)}. Abrir detalhes.`}
      >
        <View style={estilos.conteudo}>
          <View style={[estilos.icone, { backgroundColor: sev.cor }]}>
            <Icone nome={cat.icone} tamanho={22} cor={sev.corTexto} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={estilos.linhaTitulo}>
              <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={1}>
                {cat.rotulo}
              </Text>
              <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
                {tempoRelativo(o.criadoEm)}
              </Text>
            </View>
            <Text variant="bodyMedium" numberOfLines={2} style={{ color: tema.extra.tintaSecundaria }}>
              {o.descricao}
            </Text>
            <View style={estilos.linhaMeta}>
              <Icone nome="map-marker" tamanho={14} cor={tema.extra.tintaFraca} />
              <Text variant="labelMedium" style={{ color: tema.extra.tintaFraca }} numberOfLines={1}>
                {o.bairro ?? 'Local não identificado'}
                {o.distanciaKm != null ? ` · ${distancia(o.distanciaKm)}` : ''}
              </Text>
              {o.confirmacoes > 0 && (
                <>
                  <Icone nome="account-check" tamanho={14} cor={tema.extra.tintaFraca} />
                  <Text variant="labelMedium" style={{ color: tema.extra.tintaFraca }}>
                    {o.confirmacoes}
                  </Text>
                </>
              )}
            </View>
            <View style={estilos.etiquetas}>
              <EtiquetaSeveridade severidade={o.severidade} compacta />
              <EtiquetaStatus status={o.status} />
              {o.emAreaDeManancial && (
                <View style={[estilos.manancial, { borderColor: '#0e7490' }]}>
                  <Icone nome="water-alert" tamanho={13} cor="#0e7490" />
                  <Text style={{ color: '#0e7490', fontSize: 12, fontWeight: '600' }}>Manancial</Text>
                </View>
              )}
            </View>
          </View>
          {foto && <Image source={{ uri: foto }} style={estilos.foto} contentFit="cover" accessibilityLabel="Foto da ocorrência" />}
        </View>
      </TouchableRipple>
    </Card>
  );
}

const estilos = StyleSheet.create({
  cartao: { marginHorizontal: 16, marginVertical: 6 },
  toque: { borderRadius: 12 },
  conteudo: { flexDirection: 'row', gap: 12, padding: 12 },
  icone: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  etiquetas: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  manancial: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5 },
  foto: { width: 64, height: 64, borderRadius: 10 },
});
