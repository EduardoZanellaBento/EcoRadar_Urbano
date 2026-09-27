// Baixa o Chromium do Playwright para tests/.cache/ms-playwright (dentro do projeto).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizTestes = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(raizTestes, '.cache', 'ms-playwright');
console.log('Instalando Chromium do Playwright em', process.env.PLAYWRIGHT_BROWSERS_PATH);
const r = spawnSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit', shell: true, cwd: raizTestes, env: process.env });
process.exit(r.status ?? 1);
