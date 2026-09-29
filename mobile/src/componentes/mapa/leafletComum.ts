// Partes do mapa Leaflet usadas na web (Mapa.web.tsx) e na WebView do Android
// (Mapa.android.tsx): CSS e HTML dos marcadores e conversão de zoom.
// Só strings e números: nada aqui importa o Leaflet, que no Android roda dentro da WebView.
import { CATEGORIA, IQAR, SEVERIDADE } from '@/tema/cores';
import { glifo } from '../Icone';
import type { MarcadorEstacao, MarcadorOcorrencia } from './tipos';

/** CSS dos marcadores. O ícone usa a fonte Material Community do app. */
export const CSS_MAPA = `
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

/** Marcador HTML no formato do L.divIcon: conteúdo, tamanho e ponto de ancoragem (px). */
export interface IconeHtml {
  html: string;
  tamanho: [number, number];
  ancora: [number, number];
}

export function iconeOcorrencia(o: Pick<MarcadorOcorrencia, 'categoria' | 'severidade'>): IconeHtml {
  const s = SEVERIDADE[o.severidade];
  const rotulo = `${CATEGORIA[o.categoria].rotulo}, severidade ${s.rotulo}`;
  return {
    tamanho: [34, 34],
    ancora: [17, 17],
    html: `<div class="eco-marcador" role="img" aria-label="${rotulo}" style="background:${s.cor};color:${s.corTexto}"><span class="eco-glifo">${glifo(CATEGORIA[o.categoria].icone)}</span></div>`,
  };
}

export function iconeEstacao(e: MarcadorEstacao): IconeHtml {
  const c = e.iqar ? IQAR[e.iqar.classe] : null;
  return {
    tamanho: [54, 24],
    ancora: [27, 12],
    html: `<div class="eco-estacao" role="img" aria-label="${e.nome}: qualidade do ar ${c?.rotulo ?? 'sem dados'}" style="background:${c?.cor ?? '#607d8b'};color:${c?.corTexto ?? '#fff'}"><span class="eco-glifo">${glifo('radar')}</span>${e.iqar?.indice ?? '—'}</div>`,
  };
}

/** Pino arrastável da tela de registro. */
export const ICONE_PINO: IconeHtml = {
  tamanho: [30, 42],
  ancora: [15, 40],
  html: `<svg width="30" height="42" viewBox="0 0 30 42" aria-label="Local da ocorrência"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="#d03b3b" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
};

/** Converte o "delta" (graus) usado no react-native-maps em nível de zoom aproximado. */
export const zoomDoDelta = (delta: number) => Math.max(3, Math.min(17, Math.round(Math.log2(360 / delta))));

/** Zoom ao recentralizar (props.centralizarEm). */
export const zoomAoCentralizar = (delta?: number) => (delta && delta > 0.1 ? 11 : 14);
