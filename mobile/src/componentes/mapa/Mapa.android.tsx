import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_URL } from '@/config';
import { CSS_MAPA, ICONE_PINO, iconeEstacao, iconeOcorrencia, zoomAoCentralizar, zoomDoDelta } from './leafletComum';
import { paginaMapa } from './paginaWebView';
import type { PropsMapa } from './tipos';

/*
 * Android: o Google Maps do Expo Go não carrega (a chave embutida no Expo Go falha na
 * autorização e o react-native-maps não desenha nem o fundo nem os marcadores). Por isso
 * o mapa é o mesmo Leaflet da web, rodando numa WebView (paginaWebView.ts). Os tiles do
 * OpenStreetMap vêm do gateway (/tiles, com cache — ver gateway/nginx.conf); o Leaflet e
 * a fonte dos ícones vêm de CDN.
 */
type Mensagem =
  | { tipo: 'pronto' }
  | { tipo: 'toque'; latitude: number; longitude: number }
  | { tipo: 'ocorrencia' | 'estacao'; id: string }
  | { tipo: 'erro'; mensagem: string };

export default function Mapa(p: PropsMapa) {
  const ref = useRef<WebView>(null);
  const pronto = useRef(false);
  const enviado = useRef('');
  const interativo = p.interativo !== false;

  // Montada uma vez: trocar o HTML recarregaria a WebView. As mudanças seguem por ecoAtualizar.
  const [pagina] = useState(() =>
    paginaMapa({
      latitude: p.regiaoInicial.latitude,
      longitude: p.regiaoInicial.longitude,
      zoom: zoomDoDelta(p.regiaoInicial.delta ?? 0.3),
      interativo,
      urlTiles: `${API_URL}/tiles/{z}/{x}/{y}.png`,
      css: CSS_MAPA,
    }),
  );

  const dados = JSON.stringify({
    escuro: Boolean(p.modoEscuro),
    mananciais: p.mananciais ?? null,
    estacoes: (p.estacoes ?? []).map((e) => ({ id: e.id, latitude: e.latitude, longitude: e.longitude, icone: iconeEstacao(e) })),
    ocorrencias: (p.ocorrencias ?? []).map((o) => ({ id: o.id, latitude: o.latitude, longitude: o.longitude, icone: iconeOcorrencia(o) })),
    local: p.minhaLocalizacao ? { latitude: p.minhaLocalizacao.latitude, longitude: p.minhaLocalizacao.longitude } : null,
    pino: p.pontoSelecionado ? { latitude: p.pontoSelecionado.latitude, longitude: p.pontoSelecionado.longitude, icone: ICONE_PINO } : null,
  });

  const atualizar = (d: string) => {
    enviado.current = d;
    ref.current?.injectJavaScript(`window.ecoAtualizar(${d});true;`);
  };

  const centralizar = (c: NonNullable<PropsMapa['centralizarEm']>) => {
    const alvo = { latitude: c.latitude, longitude: c.longitude, zoom: zoomAoCentralizar(c.delta) };
    ref.current?.injectJavaScript(`window.ecoCentralizar(${JSON.stringify(alvo)});true;`);
  };

  useEffect(() => {
    if (pronto.current && dados !== enviado.current) atualizar(dados);
  });

  useEffect(() => {
    if (pronto.current && p.centralizarEm) centralizar(p.centralizarEm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.centralizarEm?.chave]);

  const aoReceber = (ev: WebViewMessageEvent) => {
    let m: Mensagem;
    try {
      m = JSON.parse(ev.nativeEvent.data) as Mensagem;
    } catch {
      return;
    }
    switch (m.tipo) {
      case 'pronto':
        pronto.current = true;
        atualizar(dados);
        if (p.centralizarEm) centralizar(p.centralizarEm);
        break;
      case 'toque':
        p.aoTocarMapa?.({ latitude: m.latitude, longitude: m.longitude });
        break;
      case 'ocorrencia':
        p.aoTocarOcorrencia?.(m.id);
        break;
      case 'estacao':
        p.aoTocarEstacao?.(m.id);
        break;
      case 'erro':
        console.warn('[mapa] erro na WebView:', m.mensagem);
        break;
    }
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, p.estilo]}
      testID={p.testID}
      accessibilityLabel="Mapa de ocorrências ambientais"
      // Mapa só de visualização (detalhe): os toques seguem para a rolagem da tela
      pointerEvents={interativo ? 'auto' : 'none'}
    >
      <WebView
        ref={ref}
        source={{ html: pagina, baseUrl: API_URL }}
        originWhitelist={['*']}
        onMessage={aoReceber}
        onRenderProcessGone={() => {
          // O Android encerrou o processo da WebView: recarrega (o "pronto" reenvia os dados)
          pronto.current = false;
          ref.current?.reload();
        }}
        style={{ backgroundColor: p.modoEscuro ? '#1d2c2a' : '#dddddd' }}
        scrollEnabled={false}
        overScrollMode="never"
        nestedScrollEnabled
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
