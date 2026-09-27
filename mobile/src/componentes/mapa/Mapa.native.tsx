import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { CATEGORIA, IQAR, SEVERIDADE } from '@/tema/cores';
import { aneisExternos } from '@/utils/geo';
import { Icone } from '../Icone';
import type { PropsMapa } from './tipos';

/** Estilo escuro para o Google Maps (Android). No iOS usa-se userInterfaceStyle. */
const ESTILO_ESCURO = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c2a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9fb5b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101413' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3d3a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e2a3a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export default function Mapa(p: PropsMapa) {
  const ref = useRef<MapView>(null);
  const delta = p.regiaoInicial.delta ?? 0.3;

  useEffect(() => {
    if (!p.centralizarEm) return;
    const d = p.centralizarEm.delta ?? 0.04;
    ref.current?.animateToRegion({ latitude: p.centralizarEm.latitude, longitude: p.centralizarEm.longitude, latitudeDelta: d, longitudeDelta: d }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.centralizarEm?.chave]);

  const poligonos = useMemo(
    () =>
      (p.mananciais?.features ?? []).flatMap((f) =>
        aneisExternos(f.geometry).map((anel, i) => ({
          chave: `${f.properties.id}-${i}`,
          coordenadas: anel.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
        })),
      ),
    [p.mananciais],
  );

  return (
    <MapView
      ref={ref}
      testID={p.testID}
      style={[StyleSheet.absoluteFill, p.estilo]}
      initialRegion={{ latitude: p.regiaoInicial.latitude, longitude: p.regiaoInicial.longitude, latitudeDelta: delta, longitudeDelta: delta }}
      showsUserLocation={Boolean(p.minhaLocalizacao)}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      scrollEnabled={p.interativo !== false}
      zoomEnabled={p.interativo !== false}
      rotateEnabled={false}
      pitchEnabled={false}
      userInterfaceStyle={p.modoEscuro ? 'dark' : 'light'}
      customMapStyle={p.modoEscuro ? ESTILO_ESCURO : []}
      onPress={(e) => p.aoTocarMapa?.(e.nativeEvent.coordinate)}
      accessibilityLabel="Mapa de ocorrências ambientais"
    >
      {poligonos.map((pol) => (
        <Polygon key={pol.chave} coordinates={pol.coordenadas} fillColor="rgba(14,116,144,0.18)" strokeColor="#0e7490" strokeWidth={2} tappable={false} />
      ))}

      {(p.estacoes ?? []).map((e) => {
        const c = e.iqar ? IQAR[e.iqar.classe] : null;
        return (
          <Marker
            key={`est-${e.id}`}
            coordinate={e}
            tracksViewChanges={false}
            onPress={() => p.aoTocarEstacao?.(e.id)}
            accessibilityLabel={`${e.nome}: qualidade do ar ${c?.rotulo ?? 'sem dados'}`}
          >
            <View style={[estilos.estacao, { backgroundColor: c?.cor ?? '#607d8b' }]}>
              <Icone nome="radar" tamanho={12} cor={c?.corTexto ?? '#fff'} />
              <Text style={[estilos.textoEstacao, { color: c?.corTexto ?? '#fff' }]}>{e.iqar?.indice ?? '—'}</Text>
            </View>
          </Marker>
        );
      })}

      {(p.ocorrencias ?? []).map((o) => {
        const s = SEVERIDADE[o.severidade];
        return (
          <Marker
            key={o.id}
            coordinate={o}
            tracksViewChanges={false}
            onPress={() => p.aoTocarOcorrencia?.(o.id)}
            accessibilityLabel={`${CATEGORIA[o.categoria].rotulo}, severidade ${s.rotulo}`}
          >
            <View style={[estilos.ocorrencia, { backgroundColor: s.cor }]}>
              <Icone nome={CATEGORIA[o.categoria].icone} tamanho={18} cor={s.corTexto} />
            </View>
          </Marker>
        );
      })}

      {p.pontoSelecionado && (
        <Marker
          coordinate={p.pontoSelecionado}
          draggable
          onDragEnd={(e) => p.aoTocarMapa?.(e.nativeEvent.coordinate)}
          pinColor="#d03b3b"
          accessibilityLabel="Local da ocorrência (arraste para ajustar)"
        />
      )}
    </MapView>
  );
}

const estilos = StyleSheet.create({
  ocorrencia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  estacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  textoEstacao: { fontWeight: '800', fontSize: 12 },
});
