import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/** Renderiza as páginas de um PDF em PNG (pdf.js + @napi-rs/canvas), para a galeria de evidências. */
export async function pdfParaPng(arquivoPdf: string, prefixoSaida: string, escala = 1.4): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const require = createRequire(import.meta.url);
  const fontes = resolve(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/') + '/';
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(arquivoPdf)), standardFontDataUrl: fontes }).promise;
  const gerados: string[] = [];
  mkdirSync(dirname(prefixoSaida), { recursive: true });
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const vp = pagina.getViewport({ scale: escala });
    const { canvas, context } = (pdf as unknown as { canvasFactory: { create: (w: number, h: number) => { canvas: { toBuffer: (t: string) => Buffer }; context: CanvasRenderingContext2D } } }).canvasFactory.create(vp.width, vp.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, vp.width, vp.height);
    await pagina.render({ canvasContext: context, viewport: vp, canvas: canvas as never }).promise;
    const destino = `${prefixoSaida}-pagina${i}.png`;
    writeFileSync(destino, canvas.toBuffer('image/png'));
    gerados.push(destino);
  }
  return gerados;
}
