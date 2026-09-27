// Gera ícone, ícone adaptativo (Android), splash e favicon do app a partir do logotipo vetorial
// do EcoRadar (o mesmo desenho usado no PDF e no componente <Logo/>).
// Uso: node scripts/util/gerar-icones-app.mjs   (usa o sharp instalado em backend/node_modules)
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sharp = createRequire(resolve(raiz, 'backend', 'package.json'))('sharp');
const destino = resolve(raiz, 'mobile', 'assets', 'images');

const VERDE = '#0f766e';
const AZUL = '#1d4ed8';

/** Símbolo em viewBox 0 0 100 100 (círculo branco, arcos de radar e folha). */
const simbolo = (cores = { circulo: '#ffffff', arco: AZUL, folha: '#16a34a', veio: '#ffffff' }) => `
  <circle cx="50" cy="50" r="46" fill="${cores.circulo}"/>
  <g stroke="${cores.arco}" stroke-width="4.5" fill="none" stroke-linecap="round">
    <path d="M 46.14 30.68 A 19.32 19.32 0 0 1 69.32 53.86"/>
    <path d="M 44.3 21.48 A 28.52 28.52 0 0 1 78.52 55.7"/>
    <path d="M 42.46 12.28 A 37.72 37.72 0 0 1 87.72 57.54"/>
  </g>
  <path d="M 27 73 C 24.7 45.4 45.4 33.9 63.8 36.2 C 63.8 56.9 50 75.3 27 73 Z" fill="${cores.folha}"/>
  <path d="M 31 69 L 57 43" stroke="${cores.veio}" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`;

const fundo = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${VERDE}"/><stop offset="1" stop-color="${AZUL}"/></linearGradient></defs>`;

const svg = (conteudo, tamanho = 1024) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 100 100">${conteudo}</svg>`);

const escala = (s, conteudo) => `<g transform="translate(${50 - 50 * s} ${50 - 50 * s}) scale(${s})">${conteudo}</g>`;

const arquivos = {
  // Ícone principal (iOS/Expo Go): fundo em degradê + símbolo
  'icon.png': svg(`${fundo}<rect width="100" height="100" fill="url(#g)"/>${escala(0.72, simbolo())}`),
  // Android adaptativo: primeiro plano transparente dentro da zona segura (~66%)
  'android-icon-foreground.png': svg(escala(0.56, simbolo())),
  'android-icon-background.png': svg(`${fundo}<rect width="100" height="100" fill="url(#g)"/>`),
  'android-icon-monochrome.png': svg(escala(0.56, simbolo({ circulo: '#ffffff', arco: '#000000', folha: '#000000', veio: '#ffffff' }))),
  // Splash: símbolo sobre fundo transparente (a cor de fundo vem do app.json)
  'splash-icon.png': svg(escala(0.9, simbolo())),
  'logo.png': svg(simbolo(), 512),
};

for (const [nome, buffer] of Object.entries(arquivos)) {
  await sharp(buffer).png().toFile(resolve(destino, nome));
  console.log('gerado', nome);
}
await sharp(svg(`${fundo}<rect width="100" height="100" rx="18" fill="url(#g)"/>${escala(0.8, simbolo())}`, 192)).resize(48, 48).png().toFile(resolve(destino, 'favicon.png'));
console.log('gerado favicon.png');
