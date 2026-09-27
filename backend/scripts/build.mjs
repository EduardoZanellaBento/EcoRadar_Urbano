// Empacota um serviço (ou o seed) em um único arquivo ESM com esbuild.
// O pacote compartilhado (@ecoradar/shared) é incorporado ao bundle; as demais
// dependências continuam externas (instaladas em node_modules na imagem Docker).
// Uso (a partir da pasta do pacote): node ../../scripts/build.mjs
import { build } from 'esbuild';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const raizPacote = process.cwd();
const dist = resolve(raizPacote, 'dist');
rmSync(dist, { recursive: true, force: true });

/** Marca como externo todo import "de pacote", exceto os do monorepo (@ecoradar/*). */
const dependenciasExternas = {
  name: 'dependencias-externas',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.kind === 'entry-point' || isAbsolute(args.path)) return undefined;
      if (args.path.startsWith('@ecoradar/')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [resolve(raizPacote, 'src/index.ts')],
  outfile: resolve(dist, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [dependenciasExternas],
  banner: {
    js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);",
  },
});

// Copia artefatos não-TypeScript necessários em tempo de execução
for (const pasta of ['drizzle', 'dados', 'assets']) {
  const origem = resolve(raizPacote, pasta);
  if (existsSync(origem)) cpSync(origem, resolve(dist, pasta), { recursive: true });
}
console.log(`Build concluído: ${dist}`);
