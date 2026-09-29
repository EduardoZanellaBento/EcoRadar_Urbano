// Página HTML do mapa Leaflet que roda na WebView do Android (Mapa.android.tsx).
// Sem imports: tudo chega por parâmetro, então dá para gerar e testar a página fora do app.

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
/** Mesma fonte Material Community do app (@expo/vector-icons): os códigos dos glifos coincidem. */
const FONTE_ICONES = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.woff2';

export interface InicioMapa {
  latitude: number;
  longitude: number;
  zoom: number;
  interativo: boolean;
  /** Modelo de URL dos tiles, ex.: http://gateway:8080/tiles/{z}/{x}/{y}.png */
  urlTiles: string;
  /** CSS dos marcadores (CSS_MAPA). */
  css: string;
}

/**
 * Recebe os dados por window.ecoAtualizar(dados) e window.ecoCentralizar(alvo) e responde
 * por window.ReactNativeWebView.postMessage: pronto, toque (mapa ou pino arrastado),
 * ocorrencia, estacao e erro.
 */
export function paginaMapa({ css, urlTiles, ...inicio }: InicioMapa): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
  @font-face { font-family: 'material-community'; src: url('${FONTE_ICONES}') format('woff2'); font-display: block; }
  html, body, #mapa { margin: 0; width: 100%; height: 100%; }
  .eco-escuro.leaflet-container { background: #1d2c2a; }
  ${css}
</style>
<script src="${LEAFLET}/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
</head>
<body>
<div id="mapa"></div>
<script>
(function () {
  function enviar(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.onerror = function (msg) { enviar({ tipo: 'erro', mensagem: String(msg) }); };

  var inicio = ${JSON.stringify(inicio)};
  var i = inicio.interativo;
  var mapa = L.map('mapa', { zoomControl: false, dragging: i, touchZoom: i, doubleClickZoom: i, scrollWheelZoom: false, boxZoom: false, keyboard: false })
    .setView([inicio.latitude, inicio.longitude], inicio.zoom);
  mapa.attributionControl.setPrefix(false);
  L.tileLayer(${JSON.stringify(urlTiles)}, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
  var camada = L.layerGroup().addTo(mapa);
  mapa.on('click', function (e) { enviar({ tipo: 'toque', latitude: e.latlng.lat, longitude: e.latlng.lng }); });

  function icone(d) { return L.divIcon({ className: 'eco-icone', html: d.html, iconSize: d.tamanho, iconAnchor: d.ancora }); }
  function marcador(m, tipo) {
    L.marker([m.latitude, m.longitude], { icon: icone(m.icone) })
      .on('click', function () { enviar({ tipo: tipo, id: m.id }); })
      .addTo(camada);
  }

  window.ecoAtualizar = function (d) {
    mapa.getContainer().classList.toggle('eco-escuro', d.escuro);
    camada.clearLayers();
    if (d.mananciais) {
      L.geoJSON(d.mananciais, { interactive: false, style: { color: '#0e7490', weight: 2, fillColor: '#0e7490', fillOpacity: 0.18 } }).addTo(camada);
    }
    d.estacoes.forEach(function (m) { marcador(m, 'estacao'); });
    d.ocorrencias.forEach(function (m) { marcador(m, 'ocorrencia'); });
    if (d.local) {
      L.circleMarker([d.local.latitude, d.local.longitude], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1, interactive: false }).addTo(camada);
    }
    if (d.pino) {
      L.marker([d.pino.latitude, d.pino.longitude], { icon: icone(d.pino.icone), draggable: i })
        .on('dragend', function (e) { var p = e.target.getLatLng(); enviar({ tipo: 'toque', latitude: p.lat, longitude: p.lng }); })
        .addTo(camada);
    }
  };
  window.ecoCentralizar = function (c) { mapa.setView([c.latitude, c.longitude], c.zoom, { animate: true }); };

  enviar({ tipo: 'pronto' });
})();
</script>
</body>
</html>`;
}
