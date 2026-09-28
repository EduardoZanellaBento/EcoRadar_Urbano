import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Renderiza texto de terminal (ex.: saída de docker compose ps ou log de um teste) como
 * imagem PNG, com aparência de console — usado como evidência visual.
 */
export async function terminalParaPng(titulo: string, texto: string, destino: string, larguraMax = 1500): Promise<void> {
  const linhas = texto.replace(/\r/g, '').split('\n').slice(0, 140);
  const alturaLinha = 18;
  const largura = Math.min(larguraMax, Math.max(700, 40 + Math.max(...linhas.map((l) => l.length)) * 8.4));
  const altura = 60 + linhas.length * alturaLinha + 20;
  const cor = (l: string) =>
    /✗|FALHOU|FALHA|erro|error|unhealthy/i.test(l) ? '#ff8a80' : /✓|OK|healthy|PASS|sucesso|200/i.test(l) ? '#9be49b' : /^(==|##|>>)/.test(l) ? '#8ab4f8' : '#e6e6e6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
    <rect width="100%" height="100%" rx="10" fill="#1e1f22"/>
    <rect width="100%" height="36" rx="10" fill="#2b2d31"/><rect y="26" width="100%" height="10" fill="#2b2d31"/>
    <circle cx="20" cy="18" r="6" fill="#ff5f57"/><circle cx="40" cy="18" r="6" fill="#febc2e"/><circle cx="60" cy="18" r="6" fill="#28c840"/>
    <text x="84" y="23" font-family="Consolas, 'DejaVu Sans Mono', monospace" font-size="13" fill="#bdbdbd">${escapar(titulo)}</text>
    ${linhas
      .map(
        (l, i) =>
          `<text x="18" y="${62 + i * alturaLinha}" font-family="Consolas, 'DejaVu Sans Mono', monospace" font-size="13.5" fill="${cor(l)}" xml:space="preserve">${escapar(l.slice(0, 180))}</text>`,
      )
      .join('')}
  </svg>`;
  mkdirSync(dirname(destino), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(destino);
}

/** Junta imagens lado a lado (ex.: dois celulares), com rótulos opcionais. */
export async function ladoALado(entradas: Array<{ caminho: string; rotulo?: string }>, destino: string, altura = 1000): Promise<void> {
  const imagens = await Promise.all(entradas.map((e) => sharp(e.caminho).resize({ height: altura }).png().toBuffer({ resolveWithObject: true })));
  const margem = 24;
  const topoRotulo = entradas.some((e) => e.rotulo) ? 44 : 0;
  let x = margem;
  const camadas: OverlayOptions[] = [];
  const rotulos: string[] = [];
  imagens.forEach((img, i) => {
    camadas.push({ input: img.data, left: x, top: margem + topoRotulo });
    if (entradas[i].rotulo) {
      rotulos.push(`<text x="${x + img.info.width / 2}" y="${margem + 28}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#0b0b0b">${escapar(entradas[i].rotulo!)}</text>`);
    }
    x += img.info.width + margem;
  });
  const largura = x;
  const alturaTotal = altura + 2 * margem + topoRotulo;
  const fundo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${alturaTotal}"><rect width="100%" height="100%" fill="#eef3f1"/>${rotulos.join('')}</svg>`);
  mkdirSync(dirname(destino), { recursive: true });
  await sharp(fundo).composite(camadas).png().toFile(destino);
}
