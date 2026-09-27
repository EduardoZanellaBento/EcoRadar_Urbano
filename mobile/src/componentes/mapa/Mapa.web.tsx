import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { CATEGORIA, IQAR, SEVERIDADE } from '@/tema/cores';
import { glifo } from '../Icone';
import type { Coordenada, PropsMapa } from './tipos';

/** CSS dos marcadores (injetado uma vez). O ícone usa a fonte Material Community do app. */
function garantirEstilos() {
  if (typeof document === 'undefined' || document.getElementById('eco-mapa-estilos')) return;
  const s = document.createElement('style');
  s.id = 'eco-mapa-estilos';
  s.textContent = `
    .eco-icone { background: transparent; border: none; }
    .eco-marcador { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #fff; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: pointer; }
    .eco-glifo { font-family: 'material-community', 'MaterialCommunityIcons'; font-size: 19px; line-height: 1; }
    .eco-estacao { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 8px; border: 2px solid #fff;
      font: 800 12px system-ui, -apple-system, 'Segoe UI', sans-serif; box-shadow: 0 1px 4px rgba(0,0,0,.45); white-space: nowrap; cursor: pointer; }
    .eco-estacao .eco-glifo { font-size: 12px; }
    .eco-escuro .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.85) contrast(.9); }
    .leaflet-container { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
  `;
  document.head.appendChild(s);
}

function iconeOcorrencia(categoria: keyof typeof CATEGORIA, severidade: keyof typeof SEVERIDADE, rotulo: string) {
  const s = SEVERIDADE[severidade];
  return L.divIcon({
    className: 'eco-icone',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="eco-marcador" role="img" aria-label="${rotulo}" style="background:${s.cor};color:${s.corTexto}"><span class="eco-glifo">${glifo(CATEGORIA[categoria].icone)}</span></div>`,
  });
}

function iconeEstacao(e: NonNullable<PropsMapa['estacoes']>[number]) {
  const c = e.iqar ? IQAR[e.iqar.classe] : null;
  return L.divIcon({
    className: 'eco-icone',
    iconSize: [54, 24],
    iconAnchor: [27, 12],
    html: `<div class="eco-estacao" role="img" aria-label="${e.nome}: qualidade do ar ${c?.rotulo ?? 'sem dados'}" style="background:${c?.cor ?? '#607d8b'};color:${c?.corTexto ?? '#fff'}"><span class="eco-glifo">${glifo('radar')}</span>${e.iqar?.indice ?? '—'}</div>`,
  });
}

const iconePino = L.divIcon({
  className: 'eco-icone',
  iconSize: [30, 42],
  iconAnchor: [15, 40],
  html: `<svg width="30" height="42" viewBox="0 0 30 42" aria-label="Local da ocorrência"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="#d03b3b" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
});

function Controlador({ centralizarEm, aoTocarMapa }: { centralizarEm: PropsMapa['centralizarEm']; aoTocarMapa?: (c: Coordenada) => void }) {
  const mapa = useMap();
  useMapEvents({ click: (e) => aoTocarMapa?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  useEffect(() => {
    // O contêiner pode mudar de tamanho após a montagem (abas, layout): recalcula
    const t = setTimeout(() => mapa.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [mapa]);
  useEffect(() => {
    if (centralizarEm) mapa.setView([centralizarEm.latitude, centralizarEm.longitude], centralizarEm.delta && centralizarEm.delta > 0.1 ? 11 : 14, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralizarEm?.chave]);
  return null;
}

/** Converte o "delta" (graus) usado no react-native-maps em nível de zoom aproximado. */
const zoomDoDelta = (delta: number) => Math.max(3, Math.min(17, Math.round(Math.log2(360 / delta))));

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
          <Marker key={`est-${e.id}`} position={[e.latitude, e.longitude]} icon={iconeEstacao(e)} eventHandlers={{ click: () => p.aoTocarEstacao?.(e.id) }} />
        ))}

        {(p.ocorrencias ?? []).map((o) => (
          <Marker
            key={o.id}
            position={[o.latitude, o.longitude]}
            icon={iconeOcorrencia(o.categoria, o.severidade, `${CATEGORIA[o.categoria].rotulo}, severidade ${SEVERIDADE[o.severidade].rotulo}`)}
            eventHandlers={{ click: () => p.aoTocarOcorrencia?.(o.id) }}
          />
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
