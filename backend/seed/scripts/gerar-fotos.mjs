// Gera as imagens ILUSTRATIVAS usadas nos dados de demonstração (uma por categoria),
// desenhadas em SVG pelo próprio projeto e convertidas para JPEG com o sharp.
// Nenhuma imagem de terceiros é utilizada.
// Uso: node seed/scripts/gerar-fotos.mjs   (a partir de backend/)
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, '..', 'fotos');
const destinoTestes = resolve(aqui, '..', '..', '..', 'tests', 'fixtures');
mkdirSync(destino, { recursive: true });
mkdirSync(destinoTestes, { recursive: true });

const W = 800;
const H = 600;

const ceu = (id, a, b) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;

function predios(base, cores, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let x = -10;
  let out = '';
  while (x < W) {
    const w = 60 + r() * 70;
    const h = 120 + r() * 170;
    const cor = cores[Math.floor(r() * cores.length)];
    out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${cor}"/>`;
    for (let wy = base - h + 14; wy < base - 20; wy += 26) {
      for (let wx = x + 10; wx < x + w - 16; wx += 20) {
        out += `<rect x="${wx}" y="${wy}" width="10" height="13" fill="#ffffff" opacity="${0.25 + r() * 0.35}"/>`;
      }
    }
    x += w + 6;
  }
  return out;
}

const carro = (x, y, cor, escala = 1) =>
  `<g transform="translate(${x} ${y}) scale(${escala})"><rect x="0" y="18" width="120" height="34" rx="10" fill="${cor}"/><path d="M22 18 L38 0 H86 L102 18 Z" fill="${cor}"/><path d="M42 4 H62 V18 H30 Z M66 4 H84 L96 18 H66 Z" fill="#cfe3f2"/><circle cx="28" cy="54" r="12" fill="#222"/><circle cx="92" cy="54" r="12" fill="#222"/></g>`;

const arvore = (x, y, h, cor = '#2e7d32') =>
  `<g><rect x="${x - 5}" y="${y - h * 0.35}" width="10" height="${h * 0.35}" fill="#6d4c41"/><circle cx="${x}" cy="${y - h * 0.55}" r="${h * 0.3}" fill="${cor}"/><circle cx="${x - h * 0.18}" cy="${y - h * 0.42}" r="${h * 0.22}" fill="${cor}"/><circle cx="${x + h * 0.18}" cy="${y - h * 0.42}" r="${h * 0.22}" fill="${cor}"/></g>`;

const casa = (x, y, cor, telhado) =>
  `<g><rect x="${x}" y="${y}" width="46" height="34" fill="${cor}"/><path d="M${x - 5} ${y} L${x + 23} ${y - 20} L${x + 51} ${y} Z" fill="${telhado}"/><rect x="${x + 18}" y="${y + 14}" width="10" height="20" fill="#5d4037"/></g>`;

const marcaDagua = `<rect x="0" y="${H - 34}" width="${W}" height="34" fill="#000" opacity="0.35"/><text x="${W - 16}" y="${H - 12}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#fff">Imagem ilustrativa · EcoRadar Urbano (dados de demonstração)</text>`;

const cenas = {
  alagamento: () =>
    ceu('c', '#7d93aa', '#c3d0dd') +
    predios(420, ['#6b7b8c', '#7f8e9c', '#5c6b7a'], 3) +
    `<rect x="0" y="380" width="${W}" height="220" fill="#3f6f9c"/>` +
    [400, 440, 480, 520].map((y, i) => `<path d="M0 ${y} Q 50 ${y - 10} 100 ${y} T 200 ${y} T 300 ${y} T 400 ${y} T 500 ${y} T 600 ${y} T 700 ${y} T 800 ${y}" stroke="#8fb3d6" stroke-width="${4 - i * 0.5}" fill="none" opacity="0.7"/>`).join('') +
    carro(300, 390, '#c62828', 1.4) +
    `<rect x="0" y="440" width="${W}" height="160" fill="#3f6f9c" opacity="0.85"/>` +
    Array.from({ length: 60 }, (_, i) => `<line x1="${(i * 53) % W}" y1="${(i * 37) % 360}" x2="${((i * 53) % W) - 12}" y2="${((i * 37) % 360) + 28}" stroke="#e3edf7" stroke-width="2" opacity="0.6"/>`).join(''),

  poluicao_ar: () =>
    ceu('c', '#a9a58c', '#dcd6bf') +
    predios(470, ['#8d8a7a', '#9c9886'], 7) +
    `<rect x="440" y="300" width="260" height="170" fill="#795548"/><rect x="480" y="150" width="34" height="160" fill="#6d4c41"/><rect x="560" y="120" width="34" height="190" fill="#6d4c41"/>` +
    [[497, 130, 40], [520, 95, 52], [555, 60, 64], [577, 100, 46], [610, 60, 58], [650, 40, 70]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3e3e3e" opacity="0.75"/>`).join('') +
    `<rect x="0" y="470" width="${W}" height="130" fill="#6f6a5a"/>`,

  transito: () =>
    ceu('c', '#8ec5ee', '#d9eefb') +
    predios(330, ['#90a4ae', '#a7b6bd', '#78909c'], 11) +
    `<path d="M0 600 L300 330 L500 330 L800 600 Z" fill="#455a64"/>` +
    [0, 1, 2, 3, 4].map((i) => `<rect x="${396 - i * 4}" y="${345 + i * 50}" width="${8 + i * 3}" height="${24 + i * 6}" fill="#fff59d"/>`).join('') +
    carro(250, 420, '#1565c0', 1.1) +
    carro(430, 450, '#f9a825', 1.2) +
    carro(330, 370, '#2e7d32', 0.8) +
    carro(460, 355, '#ad1457', 0.7) +
    `<rect x="700" y="250" width="10" height="200" fill="#37474f"/><rect x="684" y="200" width="42" height="80" rx="8" fill="#263238"/><circle cx="705" cy="220" r="10" fill="#e53935"/><circle cx="705" cy="245" r="10" fill="#555"/><circle cx="705" cy="268" r="8" fill="#555"/>`,

  transporte_publico: () =>
    ceu('c', '#9fd3f5', '#e3f3fc') +
    predios(360, ['#b0bec5', '#cfd8dc'], 5) +
    `<rect x="0" y="360" width="${W}" height="240" fill="#607d8b"/><rect x="0" y="440" width="${W}" height="10" fill="#eceff1"/>` +
    `<g><rect x="120" y="250" width="480" height="170" rx="18" fill="#1e88e5"/><rect x="120" y="360" width="480" height="30" fill="#fdd835"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${140 + i * 72}" y="272" width="58" height="60" rx="6" fill="#bbdefb"/>`).join('') +
    `<circle cx="200" cy="425" r="26" fill="#212121"/><circle cx="520" cy="425" r="26" fill="#212121"/><text x="560" y="300" font-family="Arial" font-size="22" font-weight="bold" fill="#fff">875</text></g>` +
    [640, 670, 700, 735].map((x, i) => `<g fill="${['#6a1b9a', '#ef6c00', '#00897b', '#5d4037'][i]}"><circle cx="${x}" cy="${390}" r="11"/><rect x="${x - 10}" y="402" width="20" height="46" rx="6"/></g>`).join('') +
    `<rect x="620" y="330" width="150" height="10" fill="#37474f"/><rect x="760" y="330" width="8" height="120" fill="#37474f"/>`,

  invasao_manancial: () =>
    ceu('c', '#8fd0f0', '#e0f4fb') +
    `<path d="M0 260 Q 200 180 420 250 T 800 230 V600 H0 Z" fill="#66bb6a"/>` +
    `<path d="M0 380 Q 180 330 380 390 T 800 400 V600 H0 Z" fill="#2f7fb5"/>` +
    [0, 1, 2].map((i) => `<path d="M${60 + i * 220} ${470 + i * 20} q 30 -8 60 0" stroke="#bfe0f5" stroke-width="3" fill="none"/>`).join('') +
    [[430, 330, '#ef9a9a', '#b71c1c'], [490, 318, '#fff59d', '#e65100'], [550, 328, '#b39ddb', '#4527a0'], [610, 310, '#ffcc80', '#bf360c'], [470, 360, '#a5d6a7', '#1b5e20'], [535, 368, '#90caf9', '#0d47a1'], [600, 352, '#f48fb1', '#880e4f'], [660, 340, '#e0e0e0', '#424242']].map(([x, y, a, b]) => casa(x, y, a, b)).join('') +
    arvore(80, 280, 90) + arvore(150, 270, 110) + arvore(740, 250, 100),

  desmatamento: () =>
    ceu('c', '#9ad0ec', '#e6f5fb') +
    `<rect x="0" y="360" width="${W}" height="240" fill="#8d6e63"/>` +
    [470, 540, 610, 680, 750, 505, 575, 645, 715].map((x, i) => arvore(x, 380 + (i > 4 ? 30 : 0), 150 + (i % 3) * 20, i % 2 ? '#1b5e20' : '#2e7d32')).join('') +
    [60, 130, 200, 270, 340, 100, 240].map((x, i) => `<g><rect x="${x}" y="${420 + (i > 4 ? 40 : 0)}" width="26" height="22" fill="#6d4c41"/><ellipse cx="${x + 13}" cy="${420 + (i > 4 ? 40 : 0)}" rx="13" ry="5" fill="#d7ccc8"/></g>`).join('') +
    `<g transform="translate(150 300)"><rect x="0" y="40" width="150" height="60" rx="8" fill="#fbc02d"/><rect x="90" y="0" width="60" height="50" rx="6" fill="#f9a825"/><rect x="100" y="10" width="40" height="28" fill="#fff8e1"/><rect x="-50" y="70" width="60" height="40" fill="#757575"/><rect x="0" y="100" width="150" height="26" rx="13" fill="#424242"/></g>`,

  inversao_termica: () =>
    ceu('c', '#f6b26b', '#fde9c9') +
    `<circle cx="640" cy="300" r="48" fill="#ffe082"/>` +
    predios(520, ['#7b6f67', '#8d8177', '#6d625b'], 13) +
    `<rect x="0" y="250" width="${W}" height="120" fill="#8d6e63" opacity="0.45"/><rect x="0" y="330" width="${W}" height="200" fill="#a1887f" opacity="0.35"/>` +
    `<rect x="0" y="520" width="${W}" height="80" fill="#5d4f47"/>` +
    `<text x="30" y="235" font-family="Arial" font-size="20" fill="#5d4037">camada de ar quente</text><path d="M30 245 H300" stroke="#5d4037" stroke-width="2"/>`,

  queimada: () =>
    ceu('c', '#f08a5d', '#f9d29d') +
    `<rect x="0" y="380" width="${W}" height="220" fill="#c9a84c"/>` +
    [[300, 190, 90], [360, 140, 110], [440, 110, 120], [520, 80, 110], [600, 60, 100]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#5f5f5f" opacity="0.55"/>`).join('') +
    [[250, 1], [330, 1.3], [420, 1.1], [500, 1.4], [580, 1]].map(([x, e]) => `<g transform="translate(${x} 400) scale(${e})"><path d="M0 0 C -30 -40 -10 -80 10 -120 C 20 -80 50 -60 40 -20 C 60 -40 60 -70 55 -90 C 85 -50 80 -10 60 0 Z" fill="#e53935"/><path d="M12 0 C -5 -25 5 -55 18 -75 C 25 -50 40 -35 35 -10 Z" fill="#ffb300"/></g>`).join('') +
    arvore(120, 400, 120, '#556b2f') + arvore(700, 400, 110, '#556b2f'),

  descarte_irregular_lixo: () =>
    ceu('c', '#b3d9f2', '#eaf6fd') +
    `<rect x="0" y="180" width="${W}" height="260" fill="#bcaaa4"/>` +
    Array.from({ length: 12 }, (_, i) => `<rect x="${i * 70}" y="180" width="66" height="260" fill="none" stroke="#a1887f" stroke-width="2"/>`).join('') +
    `<rect x="0" y="440" width="${W}" height="160" fill="#9e9e9e"/>` +
    `<rect x="470" y="330" width="220" height="80" rx="10" fill="#8d6e63"/><rect x="470" y="300" width="220" height="50" rx="10" fill="#795548"/>` +
    [[180, 430, 60], [250, 440, 55], [215, 390, 50], [320, 445, 45], [120, 450, 42]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#263238"/><path d="M${x - 8} ${y - r * 0.8} l8 -12 l8 12" fill="#37474f"/>`).join('') +
    [[560, 480], [630, 500], [700, 470]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="none" stroke="#212121" stroke-width="18"/>`).join(''),

  outros: () =>
    ceu('c', '#9ecbe8', '#e3f1fa') +
    predios(420, ['#b0bec5', '#90a4ae'], 17) +
    `<rect x="0" y="420" width="${W}" height="180" fill="#616161"/><ellipse cx="420" cy="520" rx="170" ry="30" fill="#90caf9" opacity="0.8"/>` +
    `<rect x="560" y="140" width="14" height="300" fill="#5d4037"/><rect x="520" y="150" width="94" height="10" fill="#5d4037"/>` +
    `<path d="M614 155 Q 660 230 640 300" stroke="#212121" stroke-width="4" fill="none"/><path d="M640 300 l -10 14 m10 -14 l 12 10 m-12 -10 l 2 16" stroke="#ffca28" stroke-width="4"/>`,
};

for (const [nome, desenhar] of Object.entries(cenas)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${desenhar()}${marcaDagua}</svg>`;
  const arquivo = resolve(destino, `${nome}.jpg`);
  await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(arquivo);
  console.log('gerada', arquivo);
}

// Foto usada nos testes E2E/integração (upload via filechooser)
const svgTeste = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${cenas.alagamento()}${marcaDagua}</svg>`;
await sharp(Buffer.from(svgTeste)).jpeg({ quality: 80 }).toFile(resolve(destinoTestes, 'foto-ocorrencia.jpg'));
console.log('gerada fixture de teste em', destinoTestes);
