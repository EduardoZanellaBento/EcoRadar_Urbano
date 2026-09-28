// Renderiza os diagramas Mermaid de documentacao/figuras/*.mmd em PNG usando o
// Playwright (Chromium) que já existe em tests/ — nada é instalado globalmente.
// Uso: node documentacao/renderizar_diagramas.mjs   (chamado também pelo gerar_aps.py)
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const pastaFiguras = join(aqui, 'figuras');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(raiz, 'tests', '.cache', 'ms-playwright');

const require = createRequire(join(raiz, 'tests', 'package.json'));
const { chromium } = require('@playwright/test');

// Mermaid 11 (ESM) + layout ELK, carregados da CDN jsDelivr (precisa de internet).
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const ELK = 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs';
const somente = process.argv.slice(2);
const arquivos = readdirSync(pastaFiguras)
  .filter((f) => f.endsWith('.mmd'))
  .filter((f) => !somente.length || somente.some((s) => f.startsWith(s)));

const html = (codigo) => `<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif} #d{display:inline-block;padding:12px}</style>
</head><body><div id="d"><pre class="mermaid">${codigo
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')}</pre></div>
<script type="module">
import mermaid from '${MERMAID}';
import elk from '${ELK}';
mermaid.registerLayoutLoaders(elk);
mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Arial, Helvetica, sans-serif',
  themeVariables: { fontSize: '15px', fontFamily: 'Arial, Helvetica, sans-serif' },
  flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 28, rankSpacing: 38, useMaxWidth: false },
  sequence: { actorMargin: 10, messageFontSize: 15, noteFontSize: 15, actorFontSize: 15, mirrorActors: false, wrap: true, width: 128, boxMargin: 6, useMaxWidth: false },
  er: { fontSize: 15, useMaxWidth: false }, block: { useMaxWidth: false, padding: 10 } });
mermaid.run({ querySelector: '.mermaid' }).then(() => { window.pronto = true; }).catch((e) => { window.erro = String(e); });
</script></body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 1000 } });
for (const arquivo of arquivos) {
  const codigo = readFileSync(join(pastaFiguras, arquivo), 'utf-8');
  const temporario = join(pastaFiguras, '.render.html');
  writeFileSync(temporario, html(codigo));
  await pagina.goto('file:///' + temporario.replace(/\\/g, '/'));
  await pagina.waitForFunction(() => window.pronto || window.erro, null, { timeout: 30_000 });
  const erro = await pagina.evaluate(() => window.erro);
  if (erro) throw new Error(`${arquivo}: ${erro}`);
  const destino = join(pastaFiguras, arquivo.replace(/\.mmd$/, '.png'));
  await pagina.locator('#d').screenshot({ path: destino });
  console.log('ok', destino);
}
await navegador.close();
rmSync(join(pastaFiguras, '.render.html'), { force: true });
