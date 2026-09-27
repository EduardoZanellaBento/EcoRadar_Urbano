// Executa um comando com PLAYWRIGHT_BROWSERS_PATH apontando para tests/.cache (navegadores
// do Playwright ficam DENTRO do projeto, sem instalação global).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizTestes = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(raizTestes, '.cache', 'ms-playwright');
const [comando, ...args] = process.argv.slice(2);
const r = spawnSync(comando, args, { stdio: 'inherit', shell: true, cwd: raizTestes, env: process.env });
process.exit(r.status ?? 1);
