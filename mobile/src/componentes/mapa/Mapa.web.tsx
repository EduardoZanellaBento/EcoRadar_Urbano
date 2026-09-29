import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { CSS_MAPA, ICONE_PINO, iconeEstacao, iconeOcorrencia, type IconeHtml, zoomAoCentralizar, zoomDoDelta } from './leafletComum';
import type { Coordenada, PropsMapa } from './tipos';

/** CSS dos marcadores (injetado uma vez). */
function garantirEstilos() {
  if (typeof document === 'undefined' || document.getElementById('eco-mapa-estilos')) return;
  const s = document.createElement('style');
  s.id = 'eco-mapa-estilos';
  s.textContent = CSS_MAPA;
  document.head.appendChild(s);
}

const divIcon = (i: IconeHtml) => L.divIcon({ className: 'eco-icone', html: i.html, iconSize: i.tamanho, iconAnchor: i.ancora });

const iconePino = divIcon(ICONE_PINO);

function Controlador({ centralizarEm, aoTocarMapa }: { centralizarEm: PropsMapa['centralizarEm']; aoTocarMapa?: (c: Coordenada) => void }) {
  const mapa = useMap();
  useMapEvents({ click: (e) => aoTocarMapa?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  useEffect(() => {
    // O contêiner pode mudar de tamanho após a montagem (abas, layout): recalcula
    const t = setTimeout(() => mapa.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [mapa]);
  useEffect(() => {
    if (centralizarEm) mapa.setView([centralizarEm.latitude, centralizarEm.longitude], zoomAoCentralizar(centralizarEm.delta), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralizarEm?.chave]);
  return null;
}

export default function Mapa(p: PropsMapa) {
  garantirEstilos();
  const zoom = zoomDoDelta(p.regiaoInicial.delta ?? 0.3);
  const chaveMananciais = useMemo(() => (p.mananciais?.features ?? []).map((f) => f.properties.id).join(','), [p.mananciais]);

  return (
    <View style={[{ flex: 1 }, p.estilo]} testID={p.testID} accessibilityLabel="Mapa de ocorrências ambientais">
      <MapContainer
        center={[p.regiaoInicial.latitude, p.regiaoInicial.longitude]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className={p.modoEscuro ? 'eco-escuro' : undefined}
        zoomControl={p.interativo !== false}
        dragging={p.interativo !== false}
        scrollWheelZoom={p.interativo !== false}
        doubleClickZoom={p.interativo !== false}
        attributionControl
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19} />
        <Controlador centralizarEm={p.centralizarEm} aoTocarMapa={p.aoTocarMapa} />

        {p.mananciais && (
          <GeoJSON
            key={chaveMananciais}
            data={p.mananciais as unknown as GeoJSON.FeatureCollection}
            style={{ color: '#0e7490', weight: 2, fillColor: '#0e7490', fillOpacity: 0.18 }}
            onEachFeature={(f, camada) => camada.bindTooltip(`${String(f.properties?.nome)} (área aproximada)`, { sticky: true })}
          />
        )}

        {(p.estacoes ?? []).map((e) => (
          <Marker key={`est-${e.id}`} position={[e.latitude, e.longitude]} icon={divIcon(iconeEstacao(e))} eventHandlers={{ click: () => p.aoTocarEstacao?.(e.id) }} />
        ))}

        {(p.ocorrencias ?? []).map((o) => (
          <Marker key={o.id} position={[o.latitude, o.longitude]} icon={divIcon(iconeOcorrencia(o))} eventHandlers={{ click: () => p.aoTocarOcorrencia?.(o.id) }} />
        ))}

        {p.minhaLocalizacao && (
          <CircleMarker center={[p.minhaLocalizacao.latitude, p.minhaLocalizacao.longitude]} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1 }} />
        )}

        {p.pontoSelecionado && (
          <Marker
            position={[p.pontoSelecionado.latitude, p.pontoSelecionado.longitude]}
            icon={iconePino}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                p.aoTocarMapa?.({ latitude: ll.lat, longitude: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </View>
  );
}
